// Estimates sandbox spend from the run logs: sandbox lifetime (create call start -> delete done) x list price.
// Prices (2 vCPU / 4 GB), read 2026-11-07:
//   Agent37: $4.76 per month at the default 4 GB disk (agent37.com/docs/agents-api/instance-sizing), metered per minute
//            at the monthly price / 730 hours / 60 (agent37.com/docs/agents-api/billing).
//   E2B: $0.000028/s for 2 vCPU + $0.0000180/s for 4 GiB RAM = $0.000046/s (e2b.dev/pricing).
const fs = require('fs'), path = require('path');
const D = require('./providers').DATA;
const read = (f) => fs.existsSync(path.join(D, f)) ? fs.readFileSync(path.join(D, f), 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse) : [];
const A37_PER_S = 4.76 / (730 * 3600), E2B_PER_S = 0.000046;
const secs = { agent37: 0, e2b: 0 }, count = { agent37: 0, e2b: 0 };
for (const r of [...read('part-a-cold.jsonl'), ...read('part-a-warm.jsonl')]) {
  if (!r.started || !r.finished) continue;
  secs[r.provider] += (new Date(r.finished) - new Date(r.started)) / 1000; count[r.provider]++;
}
// Part B: one sandbox per provider per run; lifetime ~= sum of its task exec times + setup.
const pb = read('part-b.jsonl');
const byBox = {};
for (const r of pb) { const k = r.provider + ':' + r.id; byBox[k] = (byBox[k] || 0) + (r.exec_ms || 0) / 1000 + 20; }
for (const [k, s] of Object.entries(byBox)) { const p = k.split(':')[0]; secs[p] += s + 10; count[p]++; }
// Probes, env checks and smoke tests not in the logs above: allow 15 sandbox-minutes per provider.
const extra = 15 * 60;
const out = {};
for (const p of ['agent37', 'e2b']) {
  const s = secs[p] + extra, rate = p === 'agent37' ? A37_PER_S : E2B_PER_S;
  out[p] = { logged_sandboxes: count[p], sandbox_seconds_est: Math.round(s), usd_est: +(s * rate).toFixed(4), usd_per_hour: +(rate * 3600).toFixed(4), usd_per_730h: +(rate * 730 * 3600).toFixed(2) };
}
console.log(JSON.stringify(out, null, 1));
