// Lists benchmark sandboxes still alive on each provider (never touches anything).
const P = require('./providers');
const keys = require('./keys');
(async () => {
  const a = await P.agent37.listMine();
  console.log('agent37 workspace instances total:', a.total, '| benchmark instances still present:', a.mine.length, JSON.stringify(a.mine.map((x) => ({ id: x.id, status: x.status, name: x.name }))));
  if (keys.has('E2B_API_KEY')) { const e = await P.e2b.listMine(); console.log('e2b sandboxes total (running/paused):', e.total, '| benchmark sandboxes still present:', e.mine.length, JSON.stringify(e.all)); }
  else console.log('e2b: no key');
})();
