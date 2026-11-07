// Summarises data/*.jsonl into data/summary.json + CSVs. Run 0 = smoke tests, excluded.
//   node analyze.js            (reads and writes ./data, or BENCH_DATA_DIR if set)
const fs = require('fs'), path = require('path');
const D = process.env.BENCH_DATA_DIR ? path.resolve(process.env.BENCH_DATA_DIR) : path.join(__dirname, 'data');
const read = (f) => fs.existsSync(path.join(D, f)) ? fs.readFileSync(path.join(D, f), 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse) : [];
const q = (a, p) => { a = a.filter((x) => typeof x === 'number' && isFinite(x)).sort((x, y) => x - y); if (!a.length) return null; const i = (a.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i); return +(a[lo] + (a[hi] - a[lo]) * (i - lo)).toFixed(1); };
const stat = (a) => ({ n: a.filter((x) => typeof x === 'number').length, median: q(a, 0.5), p90: q(a, 0.9), min: q(a, 0), max: q(a, 1) });
const PROV = ['agent37', 'e2b'];
const out = { generated: new Date().toISOString() };
const csv = (rows) => rows.map((r) => r.map((v) => (v == null ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v)).join(',')).join('\n') + '\n';

// ---------- Part A cold ----------
const cold = read('part-a-cold.jsonl').filter((r) => r.run > 0);
out.cold = {};
const coldRows = [['provider', 'run', 'first_of_pair', 'ok', 'create_ms', 'ready_ms', 'launch_ms', 'cpu_js_ms', 'sum_load_plus_shot_ms', 'script_total_ms', 'total_ms', 'sites_ok', 'error']];
const loadRows = [['provider', 'mode', 'run', 'pass', 'idx', 'site', 'ok', 'status', 'load_ms', 'shot_ms', 'load_plus_shot_ms', 'ttfb', 'dcl', 'nav_load', 'title', 'error']];
for (const p of PROV) {
  const rs = cold.filter((r) => r.provider === p);
  const okr = rs.filter((r) => r.ok);
  const loads = okr.flatMap((r) => r.result.loads);
  const sumLoads = okr.map((r) => r.result.loads.reduce((s, l) => s + (l.load_plus_shot_ms || l.load_ms || 0), 0));
  out.cold[p] = {
    runs: rs.length, runs_ok: okr.length, failures: rs.filter((r) => !r.ok).map((r) => ({ run: r.run, error: r.error })),
    create_ms: stat(rs.map((r) => r.create_ms)), ready_ms: stat(rs.map((r) => r.ready_ms)),
    launch_ms: stat(okr.map((r) => r.result.launch_ms)), cpu_js_ms: stat(okr.map((r) => r.result.cpu_js_ms)),
    all_sites_load_plus_shot_ms: stat(sumLoads), script_total_ms: stat(okr.map((r) => r.result.script_total_ms)), total_ms: stat(okr.map((r) => r.total_ms)),
    page_load_ms_all: stat(loads.filter((l) => l.ok).map((l) => l.load_ms)), screenshot_ms_all: stat(loads.filter((l) => l.ok).map((l) => l.shot_ms)),
    site_failures: loads.filter((l) => !l.ok).map((l) => `${l.site}:${l.status || (l.error || '').slice(0, 40)}`),
    delete_ms: stat(rs.map((r) => r.delete_ms)), all_deleted: rs.every((r) => r.deleted),
    region: [...new Set(rs.map((r) => { const m = (r.sysinfo || '').match(/"city":"([^"]+)","region":"([^"]+)".*?"org":"([^"]+)"/); return m ? `${m[1]}, ${m[2]} (${m[3]})` : '?'; }))],
    kernel: [...new Set(rs.map((r) => ((r.sysinfo || '').match(/\n(\d+\.\d+\.\d+[^\n]*)/) || [])[1]))],
    cpu_model: [...new Set(rs.map((r) => ((r.sysinfo || '').match(/model name\s*:\s*([^\n]+)/) || [])[1]))],
    nproc_mem: [...new Set(rs.map((r) => ((r.sysinfo || '').match(/nproc=(\d+)/) || [])[1] + ' vCPU / ' + Math.round(+(((r.sysinfo || '').match(/MemTotal:\s+(\d+)/) || [])[1] || 0) / 1048576 * 10) / 10 + ' GiB'))],
    browser_version: [...new Set(okr.map((r) => r.result.browser_version))],
    download_MBps: stat(rs.map((r) => { const m = (r.netprobe || '').match(/speed_Bps=([\d.]+)/); return m ? +(+m[1] / 1e6).toFixed(2) : null; })),
    ttfb_probe_ms: stat(rs.flatMap((r) => [...(r.netprobe || '').matchAll(/ttfb=([\d.]+)/g)].map((m) => +m[1] * 1000))),
  };
  out.cold[p].per_site = {};
  for (const s of [...new Set(loads.map((l) => l.site))].sort()) {
    const ls = loads.filter((l) => l.site === s);
    out.cold[p].per_site[s] = { ok: ls.filter((l) => l.ok).length + '/' + ls.length, load_ms: stat(ls.filter((l) => l.ok).map((l) => l.load_ms)), load_plus_shot_ms: stat(ls.filter((l) => l.ok).map((l) => l.load_plus_shot_ms)) };
  }
  for (const r of rs) {
    coldRows.push([p, r.run, r.first_of_pair, r.ok, r.create_ms, r.ready_ms, r.result && r.result.launch_ms, r.result && r.result.cpu_js_ms,
      r.result && Math.round(r.result.loads.reduce((s, l) => s + (l.load_plus_shot_ms || l.load_ms || 0), 0)), r.result && r.result.script_total_ms, r.total_ms,
      r.result && r.result.loads.filter((l) => l.ok).length, r.error]);
    for (const l of (r.result ? r.result.loads : [])) loadRows.push([p, 'cold', r.run, l.pass_no, l.idx, l.site, l.ok, l.status, l.load_ms, l.shot_ms, l.load_plus_shot_ms, l.nav && l.nav.ttfb, l.nav && l.nav.dcl, l.nav && l.nav.load, l.title, l.error]);
  }
}
// paired differences (same run number, same site order)
const pairs = [];
for (const r of cold.filter((x) => x.provider === 'agent37' && x.ok)) {
  const e = cold.find((x) => x.provider === 'e2b' && x.run === r.run && x.ok);
  if (e) pairs.push({ run: r.run, total: r.total_ms - e.total_ms, ready: r.ready_ms - e.ready_ms, launch: r.result.launch_ms - e.result.launch_ms, script: r.result.script_total_ms - e.result.script_total_ms });
}
out.cold_paired_agent37_minus_e2b = { n: pairs.length, total_ms: stat(pairs.map((x) => x.total)), ready_ms: stat(pairs.map((x) => x.ready)), launch_ms: stat(pairs.map((x) => x.launch)), script_total_ms: stat(pairs.map((x) => x.script)), agent37_faster_total_in: pairs.filter((x) => x.total < 0).length, agent37_faster_script_in: pairs.filter((x) => x.script < 0).length };

// ---------- Part A warm ----------
const warm = read('part-a-warm.jsonl').filter((r) => r.run > 0);
out.warm = {};
for (const p of PROV) {
  const rs = warm.filter((r) => r.provider === p && r.ok);
  const loads = rs.flatMap((r) => r.result.loads);
  out.warm[p] = { sandboxes: warm.filter((r) => r.provider === p).length, loads: loads.length, loads_ok: loads.filter((l) => l.ok).length,
    page_load_ms: stat(loads.filter((l) => l.ok).map((l) => l.load_ms)), load_plus_shot_ms: stat(loads.filter((l) => l.ok).map((l) => l.load_plus_shot_ms)),
    pass_total_ms: stat(rs.flatMap((r) => [...new Set(r.result.loads.map((l) => l.pass_no))].map((pn) => r.result.loads.filter((l) => l.pass_no === pn).reduce((s, l) => s + l.site_total_ms, 0)))),
    site_failures: loads.filter((l) => !l.ok).map((l) => `${l.site}:${l.status || (l.error || '').slice(0, 40)}`) };
  out.warm[p].per_site = {};
  for (const s of [...new Set(loads.map((l) => l.site))].sort()) { const ls = loads.filter((l) => l.site === s && l.ok); out.warm[p].per_site[s] = stat(ls.map((l) => l.load_ms)); }
  for (const r of rs) for (const l of r.result.loads) loadRows.push([p, 'warm', r.run, l.pass_no, l.idx, l.site, l.ok, l.status, l.load_ms, l.shot_ms, l.load_plus_shot_ms, l.nav && l.nav.ttfb, l.nav && l.nav.dcl, l.nav && l.nav.load, l.title, l.error]);
}

// ---------- Part B ----------
const pb = read('part-b.jsonl').filter((r) => r.run > 0);
out.agent = {};
const bRows = [['provider', 'run', 'task', 'success', 'agent_wall_ms', 'script_total_ms', 'steps', 'prompt_tokens', 'completion_tokens', 'final', 'error']];
for (const p of PROV) {
  const rs = pb.filter((r) => r.provider === p && r.task);
  out.agent[p] = { attempts: rs.length, setup_failures: pb.filter((r) => r.provider === p && !r.task).length, success: rs.filter((r) => r.success).length,
    agent_wall_ms: stat(rs.filter((r) => r.result).map((r) => r.result.agent_wall_ms)), steps: stat(rs.filter((r) => r.result).map((r) => r.result.steps)),
    prompt_tokens: rs.reduce((s, r) => s + ((r.result && r.result.usage && r.result.usage.prompt_tokens) || 0), 0), by_task: {} };
  for (const t of ['dinner', 'charger', 'compare', 'weekend', 'stock']) {
    const ts = rs.filter((r) => r.task === t);
    out.agent[p].by_task[t] = { success: `${ts.filter((r) => r.success).length}/${ts.length}`, agent_wall_ms: stat(ts.filter((r) => r.result).map((r) => r.result.agent_wall_ms)), steps: stat(ts.filter((r) => r.result).map((r) => r.result.steps)) };
  }
  for (const r of rs) bRows.push([p, r.run, r.task, r.success, r.result && r.result.agent_wall_ms, r.result && r.result.script_total_ms, r.result && r.result.steps, r.result && r.result.usage && r.result.usage.prompt_tokens, r.result && r.result.usage && r.result.usage.completion_tokens, r.result && r.result.final, r.error && r.error.slice(-200)]);
}

// paired view: only (run, task) cells that BOTH providers completed
{
  const all = pb.filter((r) => r.task && r.result);
  const key = (r) => r.run + ':' + r.task;
  const both = new Set(all.filter((r) => r.provider === 'agent37').map(key).filter((k) => all.some((r) => r.provider === 'e2b' && key(r) === k)));
  out.agent_paired = { cells: both.size };
  for (const p of PROV) {
    const rs = all.filter((r) => r.provider === p && both.has(key(r)));
    out.agent_paired[p] = { success: rs.filter((r) => r.success).length + '/' + rs.length, agent_wall_ms: stat(rs.map((r) => r.result.agent_wall_ms)), steps: stat(rs.map((r) => r.result.steps)), by_task: {} };
    for (const t of ['dinner', 'charger', 'compare', 'weekend', 'stock']) { const ts = rs.filter((r) => r.task === t); out.agent_paired[p].by_task[t] = { n: ts.length, success: ts.filter((r) => r.success).length, wall_ms_median: q(ts.map((r) => r.result.agent_wall_ms), 0.5), steps_median: q(ts.map((r) => r.result.steps), 0.5) }; }
  }
  const diffs = [...both].map((k) => { const a = all.find((r) => r.provider === 'agent37' && key(r) === k), e = all.find((r) => r.provider === 'e2b' && key(r) === k); return { k, d: a.result.agent_wall_ms - e.result.agent_wall_ms, sa: a.result.steps, se: e.result.steps }; });
  out.agent_paired.agent37_minus_e2b_wall_ms = stat(diffs.map((x) => x.d));
  out.agent_paired.agent37_faster_in = diffs.filter((x) => x.d < 0).length;
  out.agent_paired.same_steps_cells = diffs.filter((x) => x.sa === x.se);
  out.agent_paired.same_steps_agent37_minus_e2b_wall_ms = stat(diffs.filter((x) => x.sa === x.se).map((x) => x.d));
}
fs.writeFileSync(path.join(D, 'summary.json'), JSON.stringify(out, null, 2));
fs.writeFileSync(path.join(D, 'part-a-cold-runs.csv'), csv(coldRows));
fs.writeFileSync(path.join(D, 'part-a-page-loads.csv'), csv(loadRows));
fs.writeFileSync(path.join(D, 'part-b-agent-runs.csv'), csv(bRows));
console.log(JSON.stringify(out, null, 1));
