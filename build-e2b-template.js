// Builds the SAME image/Dockerfile as an E2B template (default name "browser-bench") at 2 vCPU / 4096 MB.
//   node build-e2b-template.js
// Needs E2B_API_KEY.
const fs = require('fs'), path = require('path');
const { Template, defaultBuildLogger } = require('e2b');
const key = require('./lib/keys').e2b();
const NAME = process.env.BENCH_TEMPLATE || 'browser-bench';
(async () => {
  const t0 = Date.now();
  const dockerfile = fs.readFileSync(path.join(__dirname, 'image', 'Dockerfile'), 'utf8');
  const tpl = Template().fromDockerfile(dockerfile);
  const info = await Template.build(tpl, NAME, { cpuCount: 2, memoryMB: 4096, apiKey: key, onBuildLogs: defaultBuildLogger() });
  console.log('BUILT', JSON.stringify(info), 'secs', (Date.now() - t0) / 1000);
})().catch((e) => { console.error('ERR', e && e.message); process.exit(1); });
