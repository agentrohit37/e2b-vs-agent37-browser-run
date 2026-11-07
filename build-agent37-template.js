// Builds image/Dockerfile into an Agent37 workspace template (default name "browser-bench") with the
// template-builds API: pack image/ as a .tar.gz, upload it, start a cloud build, stream the build log.
//   node build-agent37-template.js
// Needs AGENT37_API_KEY and the `tar` command (present on Linux, macOS and Windows 10+).
const path = require('path'), zlib = require('zlib');
const { execFileSync } = require('child_process');
const key = require('./lib/keys').agent37();
const NAME = process.env.BENCH_TEMPLATE || 'browser-bench';
const API = 'https://api.agent37.com/v1';
const H = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  // Plain tar to stdout, gzipped here: no output path for tar to misread, and the same result from GNU tar and bsdtar.
  const ctx = zlib.gzipSync(execFileSync('tar', ['-cf', '-', '.'], { cwd: path.join(__dirname, 'image'), maxBuffer: 64 * 1024 * 1024 }));
  let r = await fetch(`${API}/template-builds`, { method: 'POST', headers: H, body: JSON.stringify({ name: NAME, size_bytes: ctx.length, description: 'browser benchmark: playwright python 1.64.1 noble + browser-use 0.13.14' }) });
  const b = await r.json(); if (!r.ok) throw new Error(JSON.stringify(b));
  console.log('build', b.id);
  r = await fetch(b.upload_url, { method: 'PUT', body: ctx }); if (!r.ok) throw new Error('upload ' + r.status + (await r.text()));
  r = await fetch(`${API}/template-builds/${b.id}/start`, { method: 'POST', headers: H, body: '{}' }); console.log('start', r.status, await r.text());
  let offset = 0, t0 = Date.now();
  for (;;) {
    await sleep(5000);
    r = await fetch(`${API}/template-builds/${b.id}/logs?offset=${offset}`, { headers: H });
    const j = await r.json();
    if (j.log || j.chunk || j.logs) process.stdout.write(j.log || j.chunk || j.logs);
    if (typeof j.offset === 'number') offset = j.offset;
    if (['succeeded', 'failed', 'published', 'ready', 'completed', 'timeout', 'canceled'].includes(j.status) || j.error) {
      console.log('\nFINAL', JSON.stringify({ ...j, log: undefined, chunk: undefined, logs: undefined }), 'secs', (Date.now() - t0) / 1000);
      if (j.error || ['failed', 'timeout', 'canceled'].includes(j.status)) process.exit(1);
      break;
    }
  }
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
