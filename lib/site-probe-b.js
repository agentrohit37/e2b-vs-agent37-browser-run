// One-off: check that Part B candidate sites load (no bot wall) on a provider. Not a timed measurement.
const fs = require('fs'), path = require('path');
const P = require('./providers');
const prov = P[process.argv[2]];
const C = process.argv[3] ? JSON.parse(fs.readFileSync(process.argv[3], 'utf8')) : [
 ['opentable','https://www.opentable.com/s?dateTime=2026-11-14T19%3A00%3A00&covers=2&term=italian%20san%20francisco'],
 ['tock','https://www.exploretock.com/explore?city=San%20Francisco'],
 ['resy','https://resy.com/cities/san-francisco-ca'],
 ['anker','https://www.anker.com/collections/chargers'],
 ['target','https://www.target.com/s?searchTerm=anker+usb-c+charger'],
 ['apple-airpods','https://www.apple.com/shop/buy-airpods/airpods-pro-3'],
 ['bestbuy-search','https://www.bestbuy.com/site/searchpage.jsp?st=airpods+pro+3'],
 ['funcheap','https://sf.funcheap.com/'],
 ['sfstation','https://www.sfstation.com/calendar'],
 ['eventbrite','https://www.eventbrite.com/d/ca--san-francisco/events--this-weekend/'],
 ['stockanalysis','https://stockanalysis.com/stocks/nvda/'],
 ['googlefinance','https://www.google.com/finance/quote/NVDA:NASDAQ'],
 ['yahoofinance','https://finance.yahoo.com/quote/NVDA/'],
 ['googleflights','https://www.google.com/travel/flights?q=Flights%20from%20SFO%20to%20JFK%20on%202026-11-13'],
 ['kayak','https://www.kayak.com/flights/SFO-JFK/2026-11-13'],
];
(async () => {
  const sb = await prov.create('bench-siteprobe-b-' + prov.name);
  try {
    await prov.writeFile(sb, '/opt/bench/bench_a.py', fs.readFileSync(path.join(__dirname, '..', 'sandbox-scripts', 'bench_a.py'), 'utf8'));
    const r = await prov.exec(sb, `export PLAYWRIGHT_BROWSERS_PATH=/ms-playwright && python3 /opt/bench/bench_a.py /tmp/probe cold 1 '${JSON.stringify(C)}'`);
    const j = JSON.parse(r.stdout.trim().split('\n').pop());
    const dir = path.join(__dirname, '..', 'data', 'siteprobe-b-' + prov.name); fs.mkdirSync(dir, { recursive: true });
    for (const l of j.loads) {
      console.log(prov.name, l.site.padEnd(15), l.ok, l.status, l.load_ms, (l.title || '').slice(0, 50), (l.error || '').slice(0, 60));
      try { fs.writeFileSync(path.join(dir, `${l.site}.jpg`), await prov.readFileB64(sb, `/tmp/probe/${String(l.idx).padStart(2, '0')}-${l.site}.jpg`)); } catch (e) {}
    }
  } finally { await prov.destroy(sb); console.log('deleted', sb.id); }
})();
