"""Part A browser benchmark. Runs INSIDE the sandbox. Identical file on both providers.

usage: python3 bench_a.py <outdir> <mode: cold|warm> <passes> <sites_json>
  sites_json: JSON list of [name, url] in the order to load them (the client randomises it).
  cold: time Chromium launch, then load every site once.
  warm: launch Chromium (not scored), one unscored warm-up pass, then <passes> scored passes,
        each pass in a fresh random order (seeded from the client order).
Every load uses a fresh browser context (empty cache, no cookies) and a 1280x800 viewport.
Prints one JSON object on the last stdout line.
"""
import json, os, sys, time, random, platform, hashlib

T0 = time.perf_counter()
def ms(a, b): return round((b - a) * 1000, 1)

outdir, mode, passes, sites = sys.argv[1], sys.argv[2], int(sys.argv[3]), json.loads(sys.argv[4])
os.makedirs(outdir, exist_ok=True)

t_imp0 = time.perf_counter()
from playwright.sync_api import sync_playwright
t_imp1 = time.perf_counter()

NAV_JS = """() => { const n = performance.getEntriesByType('navigation')[0];
  return n ? { ttfb: n.responseStart, dcl: n.domContentLoadedEventEnd, load: n.loadEventEnd,
               transfer: n.transferSize, proto: n.nextHopProtocol } : null }"""
CPU_JS = """() => { const t = performance.now(); let a = [];
  for (let i = 0; i < 300000; i++) a.push((i * 7919) % 100003);
  a.sort((x, y) => x - y); let s = 0; for (let i = 0; i < 3000000; i++) s += Math.sqrt(i);
  return performance.now() - t }"""

def load(browser, name, url, shot_path):
    r = {"site": name, "url": url, "ok": False}
    t0 = time.perf_counter()
    ctx = browser.new_context(viewport={"width": 1280, "height": 800}, locale="en-US")
    page = ctx.new_page()
    t1 = time.perf_counter()
    try:
        resp = page.goto(url, wait_until="load", timeout=45000)
        t2 = time.perf_counter()
        r["load_ms"] = ms(t1, t2)
        r["status"] = resp.status if resp else None
        r["final_url"] = page.url
        try: r["title"] = page.title()[:120]
        except Exception: r["title"] = None
        try: r["nav"] = page.evaluate(NAV_JS)
        except Exception: r["nav"] = None
        t3 = time.perf_counter()
        if shot_path:
            page.screenshot(path=shot_path, type="jpeg", quality=55, timeout=30000)
        t4 = time.perf_counter()
        r["shot_ms"] = ms(t3, t4)
        r["load_plus_shot_ms"] = ms(t1, t4)
        r["ok"] = r["status"] is not None and r["status"] < 400
    except Exception as e:
        r["error"] = (type(e).__name__ + ": " + str(e))[:300]
        r["load_ms"] = ms(t1, time.perf_counter())
    finally:
        r["ctx_ms"] = ms(t0, t1)
        try: ctx.close()
        except Exception: pass
    r["site_total_ms"] = ms(t0, time.perf_counter())
    return r

out = {"mode": mode, "python": platform.python_version(), "import_ms": ms(t_imp0, t_imp1)}
with sync_playwright() as p:
    t_l0 = time.perf_counter()
    browser = p.chromium.launch(headless=True)
    t_l1 = time.perf_counter()
    out["launch_ms"] = ms(t_l0, t_l1)
    out["browser_version"] = browser.version
    pg = browser.new_page(); out["cpu_js_ms"] = round(pg.evaluate(CPU_JS), 1); pg.close()
    loads = []
    if mode == "cold":
        for i, (name, url) in enumerate(sites):
            loads.append(dict(load(browser, name, url, os.path.join(outdir, f"{i:02d}-{name}.jpg")), pass_no=1, idx=i))
    else:
        rng = random.Random(hashlib.md5(json.dumps(sites).encode()).hexdigest())
        for name, url in sites:  # unscored warm-up pass
            load(browser, name, url, None)
        for pno in range(1, passes + 1):
            order = list(sites); rng.shuffle(order)
            for i, (name, url) in enumerate(order):
                shot = os.path.join(outdir, f"p{pno}-{i:02d}-{name}.jpg") if pno == passes else None
                loads.append(dict(load(browser, name, url, shot), pass_no=pno, idx=i))
    out["loads"] = loads
    t_c0 = time.perf_counter(); browser.close(); out["close_ms"] = ms(t_c0, time.perf_counter())
out["script_total_ms"] = ms(T0, time.perf_counter())
print(json.dumps(out))
