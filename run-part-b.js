// Part B runner: Browser Use agent (local headless Chromium inside the sandbox) on 5 errand-style tasks.
//   node run-part-b.js --runs 5 --parallel [--start 1] [--providers agent37,e2b] [--model google/gemini-3.8-flash]
// --parallel runs both providers for the same run index at the same time (this is how the published results were made).
// Task dates are computed from today; set BENCH_FIXED_DATES=1 to reuse the original prompts (see sandbox-scripts/agent_b.py).
// Per run index: each provider gets one fresh sandbox, runs the 5 tasks in the same random order.
// Provider order per run is a coin flip. Grading is done here, against live ground truth.
const fs = require('fs'), path = require('path');
const P = require('./lib/providers');
const keys = require('./lib/keys');
const A = process.argv.slice(2);
const arg = (n, d) => { const i = A.indexOf('--' + n); return i >= 0 ? A[i + 1] : d; };
const RUNS = +arg('runs', 5), START = +arg('start', 1);
const PROVIDERS = arg('providers', 'agent37,e2b').split(',');
const MODEL = arg('model', 'google/gemini-3.8-flash');
const OUT = path.join(P.DATA, 'part-b.jsonl');
const SCRIPT = fs.readFileSync(path.join(__dirname, 'sandbox-scripts', 'agent_b.py'), 'utf8');
const TASKS = ['dinner', 'charger', 'compare', 'weekend', 'stock'];
const log = (...m) => console.log(new Date().toISOString().slice(11, 19), ...m);
const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

async function truth() {
  const t = {};
  try { const j = await (await fetch('https://query1.finance.yahoo.com/v8/finance/chart/NVDA', { headers: { 'User-Agent': 'Mozilla/5.0' } })).json(); t.nvda = j.chart.result[0].meta.regularMarketPrice; } catch (e) { t.nvda_error = e.message; }
  return t;
}
const { grade } = require('./lib/grade-b');

async function oneRun(provider, runNo, order, firstOfPair) {
  const label = `bench-agent-${runNo}-${provider.name}`;
  const recs = [];
  let sb;
  const base = { provider: provider.name, run: runNo, model: MODEL, first_of_pair: firstOfPair };
  try {
    const t0 = P.now();
    sb = await provider.create(label);
    for (let i = 0; ; i++) { try { const r = await provider.exec(sb, 'true', 60000); if (r.exit_code === 0) break; } catch (e) { if (i > 30) throw e; await P.sleep(500); } }
    base.id = sb.id; base.ready_ms = Math.round(P.now() - t0);
    await provider.writeFile(sb, '/opt/bench/agent_b.py', SCRIPT);
    await provider.writeFile(sb, '/opt/bench/.orkey', keys.openrouter());
    for (const task of order) {
      const t = await truth();
      const outdir = `/tmp/agent/${task}`;
      const tb = P.now();
      const r = await provider.exec(sb, `cd /tmp && export PLAYWRIGHT_BROWSERS_PATH=/ms-playwright PYTHONUNBUFFERED=1 && OPENROUTER_API_KEY=$(cat /opt/bench/.orkey) BENCH_FIXED_DATES=${process.env.BENCH_FIXED_DATES === '1' ? 1 : 0} ANONYMIZED_TELEMETRY=false BROWSER_USE_LOGGING_LEVEL=info timeout 600 python3 /opt/bench/agent_b.py ${outdir} ${task} ${MODEL}`, 700000);
      let lib = null;
      try { const lr = await provider.exec(sb, `find ${outdir}/library -name '*.md' ! -name todo.md -exec cat {} + 2>/dev/null | head -c 20000`, 60000); lib = lr.stdout.trim() || null; } catch (e) {}
      const rec = { ...base, task, exec_ms: Math.round(P.now() - tb), exit_code: r.exit_code, started: new Date().toISOString() };
      try { rec.result = JSON.parse(r.stdout.trim().split('\n').pop()); } catch (e) { rec.error = 'no json: ' + (r.stderr || r.stdout).slice(-1500); }
      rec.grade = rec.result ? grade(task, rec.result, t, lib) : { pass: false };
      rec.library = lib;
      rec.success = !!(rec.result && rec.grade && rec.grade.pass);
      rec.log_tail = (r.stdout + '\n' + r.stderr).slice(-3000);
      { // keep the recording + final screenshot of every run (for picking video clips)
        const dir = path.join(__dirname, 'videos', label); fs.mkdirSync(dir, { recursive: true });
        try { fs.writeFileSync(path.join(dir, `${task}.gif`), await provider.readFileB64(sb, `${outdir}/run.gif`)); } catch (e) { rec.gif_error = e.message.slice(0, 200); }
        try { fs.writeFileSync(path.join(dir, `${task}-final.png`), await provider.readFileB64(sb, `${outdir}/final.png`)); } catch (e) { rec.png_error = e.message.slice(0, 200); }
        if (lib) fs.writeFileSync(path.join(dir, `${task}-library.md`), lib);
      }
      fs.appendFileSync(OUT, JSON.stringify(rec) + '\n');
      recs.push(rec);
      log(`${label} ${task} success=${rec.success} wall=${rec.result && rec.result.agent_wall_ms} steps=${rec.result && rec.result.steps} grade=${JSON.stringify(rec.grade).slice(0, 160)} final=${JSON.stringify(rec.result && rec.result.final).slice(0, 160)} ${rec.error ? 'ERR ' + rec.error.slice(-300) : ''}`);
    }
  } catch (e) {
    const rec = { ...base, error: String(e.message || e).slice(0, 600), stage: 'setup' };
    fs.appendFileSync(OUT, JSON.stringify(rec) + '\n');
    log(label, 'ERR', rec.error);
  } finally {
    if (sb) { try { await provider.destroy(sb); } catch (e) { log('DELETE FAILED', sb.id, e.message); } }
  }
}

(async () => {
  for (const n of PROVIDERS) { if (!P[n]) throw new Error('unknown provider ' + n); keys[n](); } // fail fast on a missing key
  keys.openrouter();
  const provs = PROVIDERS.map((n) => P[n]);
  for (let run = START; run < START + RUNS; run++) {
    const order = shuffle(TASKS);
    const seq = Math.random() < 0.5 ? provs : provs.slice().reverse();
    // --parallel: both providers run the same run index at the same time, so they share the same LLM/API conditions.
    if (A.includes('--parallel')) await Promise.all(seq.map((p, k) => oneRun(p, run, order, k === 0)));
    else for (let k = 0; k < seq.length; k++) await oneRun(seq[k], run, order, k === 0);
  }
  log('done');
})();
