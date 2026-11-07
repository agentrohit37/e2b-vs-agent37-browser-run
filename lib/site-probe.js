// One-off: load candidate sites on one sandbox to find sites that do not bot-block datacenter IPs.
const fs = require('fs'), path = require('path');
const P = require('./providers');
const prov = P[process.argv[2]];
const C = [['mdn','https://developer.mozilla.org/en-US/'],['cnn','https://www.cnn.com/'],['python','https://www.python.org/'],['espn','https://www.espn.com/'],
 ['target','https://www.target.com/'],['ebay','https://www.ebay.com/'],['nasa','https://www.nasa.gov/'],['microsoft','https://www.microsoft.com/en-us/'],
 ['theverge','https://www.theverge.com/'],['stripe','https://stripe.com/'],['cloudflare','https://www.cloudflare.com/'],['npm','https://www.npmjs.com/'],
 ['wapo','https://www.washingtonpost.com/'],['guardian','https://www.theguardian.com/us'],['bestbuy','https://www.bestbuy.com/'],['etsy','https://www.etsy.com/'],
 ['amazon','https://www.amazon.com/'],['reddit','https://www.reddit.com/'],['stackoverflow','https://stackoverflow.com/questions'],['nytimes','https://www.nytimes.com/']];
(async () => {
  const sb = await prov.create('bench-siteprobe-' + prov.name);
  try {
    await prov.writeFile(sb, '/opt/bench/bench_a.py', fs.readFileSync(path.join(__dirname, '..', 'sandbox-scripts', 'bench_a.py'), 'utf8'));
    const r = await prov.exec(sb, `export PLAYWRIGHT_BROWSERS_PATH=/ms-playwright && python3 /opt/bench/bench_a.py /tmp/probe cold 1 '${JSON.stringify(C)}'`);
    const j = JSON.parse(r.stdout.trim().split('\n').pop());
    for (const l of j.loads) console.log(prov.name, l.site.padEnd(14), l.ok, l.status, l.load_ms, (l.title || '').slice(0, 50), (l.error || '').slice(0, 80));
  } finally { await prov.destroy(sb); console.log('deleted', sb.id); }
})();
