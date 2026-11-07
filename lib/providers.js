// One interface over both providers: create / exec / writeFile / readFileB64 / destroy.
// Every sandbox id we create is appended to data/created-<provider>.jsonl so teardown only
// ever touches sandboxes this benchmark made.
const fs = require('fs'), path = require('path');
const keys = require('./keys');
// Raw run output goes to ./data (git-ignored). Override with BENCH_DATA_DIR.
const DATA = process.env.BENCH_DATA_DIR ? path.resolve(process.env.BENCH_DATA_DIR) : path.join(__dirname, '..', 'data');
fs.mkdirSync(DATA, { recursive: true });
// Template name on both providers (build-*-template.js use the same name).
const TEMPLATE = process.env.BENCH_TEMPLATE || 'browser-bench';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const now = () => performance.now();
function track(provider, rec) { fs.appendFileSync(path.join(DATA, `created-${provider}.jsonl`), JSON.stringify({ ...rec, at: new Date().toISOString() }) + '\n'); }

// ---------------- Agent37 ----------------
const A_API = 'https://api.agent37.com/v1', A_SBX = 'https://sandbox.agent37.app/v1';
async function aCall(method, url, body, headers, tries = 5) {
  for (let t = 1; ; t++) {
    let r, text;
    try {
      r = await fetch(url, { method, headers: { 'Content-Type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(900000) });
      text = await r.text();
    } catch (e) { r = { status: 0 }; text = String(e.message); }
    if (r.status >= 200 && r.status < 300) return text ? JSON.parse(text) : {};
    const transient = r.status === 0 || r.status === 409 || r.status === 429 || r.status >= 500;
    if (!transient || t >= tries) { const e = new Error(`${method} ${url.split('/v1/')[1]} -> ${r.status} ${text.slice(0, 300)}`); e.status = r.status; throw e; }
    await sleep(2000 * t);
  }
}
const agent37 = {
  name: 'agent37',
  async create(label) {
    const key = keys.agent37();
    const t0 = now();
    // No retries on create: a retry would hide real create latency. Failures are recorded.
    const r = await fetch(`${A_API}/instances`, { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ template: TEMPLATE, resources: { cpu: 2, memory: 4 }, region: 'us', name: label, metadata: { purpose: 'browser-bench' } }) });
    const j = await r.json().catch(() => ({}));
    const create_ms = now() - t0;
    if (r.status !== 201 && r.status !== 200) throw Object.assign(new Error(`create -> ${r.status} ${JSON.stringify(j).slice(0, 300)}`), { create_ms });
    track('agent37', { id: j.id, label });
    return { id: j.id, create_ms, info: { status: j.status, resources: j.resources, region: j.region, type: j.type, template: j.template } };
  },
  async exec(sb, command, timeoutMs = 900000) {
    const j = await aCall('POST', `${A_SBX}/instances/${sb.id}/exec`, { command, user: 'root' }, { 'X-Agent37-Key': keys.agent37() });
    return { exit_code: j.exit_code, stdout: j.stdout || '', stderr: j.stderr || '' };
  },
  async writeFile(sb, file, content) {
    const b64 = Buffer.from(content).toString('base64');
    const r = await this.exec(sb, `mkdir -p "$(dirname ${file})" && printf %s '${b64}' | base64 -d > ${file}`);
    if (r.exit_code !== 0) throw new Error('write failed ' + r.stderr);
  },
  async readFileB64(sb, file) {
    // exec stdout is capped at 512 KB, so read in 300 KB chunks.
    const sz = await this.exec(sb, `stat -c %s ${file}`);
    if (sz.exit_code !== 0) throw new Error('read failed ' + sz.stderr);
    const size = +sz.stdout.trim(), CH = 300000, parts = [];
    for (let i = 0; i * CH < size; i++) {
      const r = await this.exec(sb, `dd if=${file} bs=${CH} skip=${i} count=1 2>/dev/null | base64 -w0`);
      if (r.exit_code !== 0) throw new Error('read failed ' + r.stderr);
      parts.push(Buffer.from(r.stdout.trim(), 'base64'));
    }
    return Buffer.concat(parts);
  },
  async destroy(sb) {
    try { await aCall('DELETE', `${A_API}/instances/${sb.id}`, null, { Authorization: `Bearer ${keys.agent37()}` }); return true; }
    catch (e) { if (e.status === 404) return true; throw e; }
  },
  async listMine() {
    const f = path.join(DATA, 'created-agent37.jsonl');
    const ids = new Set((fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l).id));
    const all = [];
    let url = `${A_API}/instances?limit=100`;
    for (let i = 0; i < 20 && url; i++) {
      const j = await aCall('GET', url, null, { Authorization: `Bearer ${keys.agent37()}` });
      const items = j.data || j.instances || j.items || [];
      all.push(...items);
      const cur = j.next_cursor || j.cursor || (j.has_more && items.length ? items[items.length - 1].id : null);
      url = cur ? `${A_API}/instances?limit=100&${j.next_cursor || j.cursor ? 'cursor' : 'starting_after'}=${cur}` : null;
    }
    return { total: all.length, mine: all.filter((x) => ids.has(x.id) || (x.metadata && x.metadata.purpose === 'browser-bench')) };
  },
};

// ---------------- E2B ----------------
let E2B;
const e2b = {
  name: 'e2b',
  async create(label) {
    E2B ||= require('e2b');
    const t0 = now();
    const s = await E2B.Sandbox.create(TEMPLATE, { apiKey: keys.e2b(), timeoutMs: 30 * 60 * 1000, metadata: { purpose: 'browser-bench', label } });
    const create_ms = now() - t0;
    track('e2b', { id: s.sandboxId, label });
    let info = {};
    try { const i = await E2B.Sandbox.getInfo(s.sandboxId, { apiKey: keys.e2b() }); info = { cpuCount: i.cpuCount, memoryMB: i.memoryMB, templateId: i.templateId, state: i.state }; } catch (e) {}
    return { id: s.sandboxId, sdk: s, create_ms, info };
  },
  async exec(sb, command, timeoutMs = 900000) {
    try {
      const r = await sb.sdk.commands.run(command, { user: 'root', timeoutMs, requestTimeoutMs: timeoutMs });
      return { exit_code: r.exitCode, stdout: r.stdout || '', stderr: r.stderr || '' };
    } catch (e) {
      if (e && typeof e.exitCode === 'number') return { exit_code: e.exitCode, stdout: e.stdout || '', stderr: e.stderr || String(e.message) };
      throw e;
    }
  },
  async writeFile(sb, file, content) { await sb.sdk.files.write(file, content, { user: 'root' }); },
  async readFileB64(sb, file) { return Buffer.from(await sb.sdk.files.read(file, { format: 'bytes', user: 'root' })); },
  async destroy(sb) { E2B ||= require('e2b'); return E2B.Sandbox.kill(sb.id, { apiKey: keys.e2b() }); },
  async listMine() {
    E2B ||= require('e2b');
    const pg = E2B.Sandbox.list({ apiKey: keys.e2b() });
    const all = [];
    while (pg.hasNext) all.push(...(await pg.nextItems()));
    return { total: all.length, mine: all.filter((x) => x.metadata && x.metadata.purpose === 'browser-bench'), all: all.map((x) => ({ id: x.sandboxId, state: x.state, metadata: x.metadata })) };
  },
};

module.exports = { agent37, e2b, sleep, now, DATA, TEMPLATE };
