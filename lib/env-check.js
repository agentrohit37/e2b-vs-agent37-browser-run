const P = require('./providers');
(async () => { const prov = P[process.argv[2]]; const sb = await prov.create('bench-envcheck-' + prov.name);
  try { const r = await prov.exec(sb, 'whoami; env | grep -iE "playwright|pip|python|^PATH" ; ls /ms-playwright; python3 --version; pip show browser-use | head -2'); console.log(r.stdout, r.stderr); }
  finally { await prov.destroy(sb); console.log('deleted', sb.id); } })();
