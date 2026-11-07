// Part A runner. Interleaves providers run by run, from this one client machine.
//   node run-part-a.js --runs 20 [--start 1] [--providers agent37,e2b]            cold runs (fresh sandbox each)
//   node run-part-a.js --warm --runs 3 --passes 3 [--providers agent37,e2b]      warm runs (browser already up)
// Each run: both providers get the SAME randomised site order; which provider goes first is a coin flip.
const fs = require('fs'), path = require('path');
const P = require('./lib/providers');
const A = process.argv.slice(2);
const arg = (n, d) => { const i = A.indexOf('--' + n); return i >= 0 ? A[i + 1] : d; };
const WARM = A.includes('--warm');
const RUNS = +arg('runs', 20), START = +arg('start', 1), PASSES = +arg('passes', 3);
const PROVIDERS = arg('providers', 'agent37,e2b').split(',');
const SHOT_RUNS = +arg('shot-runs', 3);
const OUT = path.join(P.DATA, WARM ? 'part-a-warm.jsonl' : 'part-a-cold.jsonl');
const SCRIPT = fs.readFileSync(path.join(__dirname, 'sandbox-scripts', 'bench_a.py'), 'utf8');

// Ten stable public sites. reddit, nytimes and stackoverflow (from the brief's example list) return 403 / bot
// challenges to datacenter IPs, so they measure bot-blocking rather than browser speed; they were replaced by
// mdn, python.org and stripe (see lib/site-probe.js results). e2b.dev was swapped for apple.com so neither
// provider's own website is in the set. amazon.com answered with a 202 bot-challenge page on both providers in
// smoke tests (a fast empty page, not a real load), so it was swapped for nasa.gov.
const SITES = [
  ['wikipedia', 'https://www.wikipedia.org/'], ['github', 'https://github.com/'], ['hackernews', 'https://news.ycombinator.com/'],
  ['nasa', 'https://www.nasa.gov/'], ['bbc', 'https://www.bbc.com/'], ['mdn', 'https://developer.mozilla.org/en-US/'],
  ['python', 'https://www.python.org/'], ['stripe', 'https://stripe.com/'], ['vercel', 'https://vercel.com/'], ['apple', 'https://www.apple.com/'],
];
const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const q = (s) => `'${s.replace(/'/g, `'"'"'`)}'`;
const log = (...m) => console.log(new Date().toISOString().slice(11, 19), ...m);

const SYSINFO = `echo "nproc=$(nproc)"; grep MemTotal /proc/meminfo; grep -m1 'model name' /proc/cpuinfo; uname -r; ` +
  `cat /sys/fs/cgroup/cpu.max 2>/dev/null | sed 's/^/cpu.max=/'; cat /sys/fs/cgroup/memory.max 2>/dev/null | sed 's/^/memory.max=/'; ` +
  `df -h /tmp | tail -1; dmesg 2>/dev/null | grep -i -m1 gvisor; ` +
  `curl -s -m 8 https://ipinfo.io/json | tr -d '\\n '`;
// Network probe AFTER the browser test (not part of any browser timing).
const NETPROBE = `for u in https://www.wikipedia.org/ https://github.com/ https://www.amazon.com/; do ` +
  `curl -s -o /dev/null -m 20 -w "probe $u dns=%{time_namelookup} connect=%{time_connect} tls=%{time_appconnect} ttfb=%{time_starttransfer} total=%{time_total}\\n" $u; done; ` +
  `curl -s -o /dev/null -m 60 -w "download25MB total=%{time_total} speed_Bps=%{speed_download}\\n" "https://speed.cloudflare.com/__down?bytes=25000000"`;

async function oneRun(provider, runNo, order, firstOfPair) {
  const label = `bench-${WARM ? 'warm' : 'cold'}-${runNo}-${provider.name}`;
  const rec = { provider: provider.name, run: runNo, mode: WARM ? 'warm' : 'cold', first_of_pair: firstOfPair, order: order.map((s) => s[0]), started: new Date().toISOString(), ok: false };
  let sb;
  const t0 = P.now();
  try {
    sb = await provider.create(label);
    rec.id = sb.id; rec.create_ms = Math.round(sb.create_ms); rec.create_info = sb.info;
    // ready = first shell command answers
    for (let i = 0; ; i++) {
      try { const r = await provider.exec(sb, 'true', 60000); if (r.exit_code === 0) break; } catch (e) { if (i > 30) throw e; await P.sleep(500); }
    }
    rec.ready_ms = Math.round(P.now() - t0);
    rec.first_cmd_ms = rec.ready_ms - rec.create_ms;
    const si = await provider.exec(sb, SYSINFO, 60000); rec.sysinfo = si.stdout.slice(0, 2000);
    await provider.writeFile(sb, '/opt/bench/bench_a.py', SCRIPT);
    const outdir = `/tmp/bench/${label}`;
    const tb = P.now();
    const r = await provider.exec(sb, `cd /tmp && export PLAYWRIGHT_BROWSERS_PATH=/ms-playwright PYTHONUNBUFFERED=1 && python3 /opt/bench/bench_a.py ${outdir} ${WARM ? 'warm' : 'cold'} ${PASSES} ${q(JSON.stringify(order))}`, 1200000);
    rec.bench_exec_ms = Math.round(P.now() - tb);
    rec.exit_code = r.exit_code;
    const last = r.stdout.trim().split('\n').pop();
    try { rec.result = JSON.parse(last); } catch (e) { rec.error = 'no json: ' + (r.stderr || r.stdout).slice(-800); }
    if (rec.result) {
      rec.total_ms = Math.round(rec.ready_ms + rec.result.script_total_ms); // create->ready + whole browser script
      rec.ok = true;
    }
    if (r.stderr) rec.stderr_tail = r.stderr.slice(-600);
    try { const n = await provider.exec(sb, NETPROBE, 120000); rec.netprobe = n.stdout; } catch (e) { rec.netprobe_error = e.message; }
    if (runNo <= SHOT_RUNS && rec.result) {
      const dir = path.join(__dirname, 'shots', label); fs.mkdirSync(dir, { recursive: true });
      const ls = await provider.exec(sb, `ls ${outdir}`, 60000);
      for (const f of ls.stdout.split('\n').filter((x) => x.endsWith('.jpg'))) {
        try { fs.writeFileSync(path.join(dir, f), await provider.readFileB64(sb, `${outdir}/${f}`)); } catch (e) { rec.shot_error = e.message; }
      }
    }
  } catch (e) {
    rec.error = (rec.error ? rec.error + ' | ' : '') + String(e.message || e).slice(0, 600);
    if (e.create_ms) rec.create_ms = Math.round(e.create_ms);
  } finally {
    if (sb) {
      const td = P.now();
      try { await provider.destroy(sb); rec.deleted = true; } catch (e) { rec.deleted = false; rec.delete_error = e.message; }
      rec.delete_ms = Math.round(P.now() - td);
    }
    rec.finished = new Date().toISOString();
    fs.appendFileSync(OUT, JSON.stringify(rec) + '\n');
  }
  const loads = rec.result ? rec.result.loads : [];
  log(`${label} ok=${rec.ok} create=${rec.create_ms} ready=${rec.ready_ms} launch=${rec.result && rec.result.launch_ms} loadsOK=${loads.filter((l) => l.ok).length}/${loads.length} total=${rec.total_ms} ${rec.error ? 'ERR ' + rec.error.slice(0, 200) : ''}`);
  return rec;
}

(async () => {
  const keys = require('./lib/keys');
  for (const n of PROVIDERS) { if (!P[n]) throw new Error('unknown provider ' + n); keys[n](); } // fail fast on a missing key
  const provs = PROVIDERS.map((n) => P[n]);
  for (let run = START; run < START + RUNS; run++) {
    const order = shuffle(SITES);
    const seq = Math.random() < 0.5 ? provs : provs.slice().reverse();
    for (let k = 0; k < seq.length; k++) await oneRun(seq[k], run, order, k === 0);
  }
  log('done');
})();
