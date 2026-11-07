"""Part B: Browser Use agent doing one errand-style task with a LOCAL headless Chromium inside
the sandbox. Identical file on both providers. LLM via OpenRouter (key in env OPENROUTER_API_KEY).

usage: python3 agent_b.py <outdir> <task_id> <model>
Writes <outdir>/run.gif, <outdir>/final.png, <outdir>/library/* (anything the agent saved).
Prints one JSON object on the last stdout line.
"""
import asyncio, datetime, json, os, sys, time, glob, shutil, inspect

# Task dates are relative to the day the benchmark runs: "this weekend" is the coming Saturday/Sunday and the
# dinner date is the Saturday after that. BENCH_FIXED_DATES=1 uses the original run's base date (Friday 2026-11-06,
# US time), which reproduces the exact prompts of the 2026-11-07 results (dinner Sat Nov 14, weekend Nov 7-8).
_base = datetime.date(2026, 11, 6) if os.environ.get("BENCH_FIXED_DATES") == "1" else datetime.date.today()
_sat = _base + datetime.timedelta(days=(5 - _base.weekday()) % 7)
_sun, _dinner = _sat + datetime.timedelta(days=1), _sat + datetime.timedelta(days=7)
DINNER_DATE = f"{_dinner:%A, %B} {_dinner.day}, {_dinner.year}"            # e.g. "Saturday, November 14, 2026"
WEEKEND = f"{_sat:%A %B} {_sat.day} or {_sun:%A %B} {_sun.day}, {_sun.year}"  # e.g. "Saturday November 7 or Sunday November 8, 2026"

outdir, task_id, model = sys.argv[1], sys.argv[2], sys.argv[3]
os.makedirs(outdir, exist_ok=True)
LIB = os.path.join(outdir, "library")

RULES = (" HARD RULES: never log in or create an account; never submit a reservation, order, purchase, payment, sign-up "
         "or any form that creates something real; do not type any personal details. Stop at the link. If a page shows a "
         "CAPTCHA or bot check, do not try to solve it: stop and say BLOCKED.")
TASKS = {
    # Errand: find a bookable table and stop at the link.
    "dinner": "You are a personal assistant running an errand for your user. Go to https://resy.com/cities/san-francisco-ca and find a "
              "well-rated Italian restaurant in San Francisco that shows an available table for 2 people on " + DINNER_DATE + " "
              "at around 7:00 PM (anything from 6:30 PM to 8:00 PM is fine). Reply with the restaurant name, the time slot you saw, and the "
              "link to that restaurant's Resy page. Do not click the time slot." + RULES,
    # Checkout prep: get the cart ready, then hand back the link (never check out).
    "charger": "You are a personal assistant. Your user wants a small USB-C wall charger. Go to https://www.anker.com and find the "
               "'Anker Nano Charger (30W)' (if that exact model is not listed, the closest Anker Nano USB-C wall charger). Add one to the "
               "cart as a guest, open the cart, and reply with the product name, the cart total and the cart link "
               "(https://www.anker.com/cart). Stop at the cart: do not click Checkout." + RULES,
    # Target was the first choice but showed a "press & hold" bot check on BOTH providers in a test run, so it was swapped for Verizon.
    "compare": "You are a personal assistant. Compare the price of Apple AirPods Pro 3 on https://www.apple.com/shop/buy-airpods/airpods-pro-3 "
               "and on Verizon (https://www.verizon.com/products/apple-airpods-pro-3/). Reply with both prices and the link to the cheaper "
               "product page (if they are equal, say so and give the Apple link). Do not add anything to a cart." + RULES,
    # Ideas: collect 3 options and save them to a file (the agent's library).
    "weekend": "You are a personal agent who brings your user ideas. Go to https://sf.funcheap.com and find 3 things to do in San Francisco "
               "this weekend (" + WEEKEND + "). Write a short markdown list: for each, the name, the day, one "
               "line on why it is worth going, and the event's link. Save it with your write_file action as weekend-ideas.md, then reply "
               "with the same list." + RULES,
    # Check-in: read one live number (graded against Yahoo Finance at the same moment).
    "stock": "You are a personal agent doing a scheduled goal check-in: your user tracks NVIDIA stock. Go to "
             "https://www.google.com/finance/quote/NVDA:NASDAQ and report NVIDIA's latest share price in USD. Reply with the price only, "
             "for example $123.45." + RULES,
}

T0 = time.perf_counter()
from browser_use import Agent, BrowserProfile, BrowserSession
from browser_use.llm import ChatOpenAI
T_IMPORT = time.perf_counter()

def find_chrome():
    c = sorted(glob.glob("/ms-playwright/chromium-*/chrome-linux*/chrome"))
    return c[-1] if c else None

async def main():
    llm = ChatOpenAI(model=model, base_url="https://openrouter.ai/api/v1", api_key=os.environ["OPENROUTER_API_KEY"],
                     temperature=0, max_completion_tokens=8192)
    profile = BrowserProfile(headless=True, executable_path=find_chrome(), chromium_sandbox=False,
                             window_size={"width": 1280, "height": 800}, viewport={"width": 1280, "height": 800},
                             user_data_dir=None, keep_alive=False)
    session = BrowserSession(browser_profile=profile)
    kw = dict(task=TASKS[task_id], llm=llm, browser_session=session, use_vision=True,
              generate_gif=os.path.join(outdir, "run.gif"))
    if "file_system_path" in inspect.signature(Agent.__init__).parameters:
        os.makedirs(LIB, exist_ok=True); kw["file_system_path"] = LIB
    agent = Agent(**kw)
    t1 = time.perf_counter()
    hist = await agent.run(max_steps=25)
    t2 = time.perf_counter()
    res = {
        "task": task_id, "model": model, "import_ms": round((T_IMPORT - T0) * 1000),
        "agent_wall_ms": round((t2 - t1) * 1000), "steps": hist.number_of_steps(), "done": hist.is_done(),
        "self_reported_success": hist.is_successful(), "final": (hist.final_result() or "")[:1500],
        "errors": [str(e)[:200] for e in hist.errors() if e][:6], "urls": [u for u in hist.urls() if u][-25:],
        "file_system_path_supported": "file_system_path" in kw,
    }
    try:
        u = hist.usage
        res["usage"] = {"prompt_tokens": u.total_prompt_tokens, "completion_tokens": u.total_completion_tokens} if u else None
    except Exception as e:
        res["usage_error"] = str(e)[:200]
    try:
        shots = [s for s in (hist.screenshot_paths() or []) if s and os.path.exists(s)]
        if shots: shutil.copy(shots[-1], os.path.join(outdir, "final.png"))
    except Exception as e:
        res["shot_error"] = str(e)[:200]
    try:
        res["library_files"] = [os.path.relpath(p, outdir) for p in glob.glob(os.path.join(LIB, "**", "*.md"), recursive=True)]
    except Exception:
        pass
    try:
        await session.kill()
    except Exception:
        pass
    res["script_total_ms"] = round((time.perf_counter() - T0) * 1000)
    print(json.dumps(res))

asyncio.run(main())
