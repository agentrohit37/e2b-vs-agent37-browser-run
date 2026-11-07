# E2B vs Agent37 - Browser Run

This repo measures how fast a headless Chromium browser runs inside two cloud sandbox products, [Agent37](https://www.agent37.com/docs) and [E2B](https://e2b.dev/docs), at the same size (2 vCPU / 4 GB) and with the same image. It has two parts:

- **Part A, raw browser speed.** Create a new sandbox, open Chromium, load 10 public websites, take a screenshot of each, delete the sandbox. Every step is timed.
- **Part B, AI agent tasks.** A [Browser Use](https://github.com/browser-use/browser-use) agent runs inside each sandbox with its own local Chromium and does 5 errand-style web tasks. A script grades each answer.

The results below are from **2026-11-07**. The code, prompts and summarized data are all here, so you can run it again with your own API keys and check the numbers.

**Disclosure:** Agent37 wrote and ran this benchmark. Agent37 is one of the two products compared. That is the reason the code and data are public.

## Results (2026-11-07)

Medians unless noted. "p90" means 9 of 10 runs were faster than this value. Full numbers: [`results/2026-11-07/summary.json`](results/2026-11-07/summary.json).

### Part A: 20 new sandboxes per provider

| Step | Agent37 | E2B |
|---|---|---|
| **Whole job: create sandbox to last screenshot** | **18.1 s** (p90 20.3 s) | **17.2 s** (p90 26.4 s) |
| Sandbox ready (first shell command answers) | 1.89 s | 2.00 s |
| Chromium cold launch | **0.29 s** | 3.28 s |
| One page load (200 loads) | 846 ms | **613 ms** |
| One screenshot (200) | 80 ms | **59 ms** |
| JS CPU test inside Chromium | 143 ms | **129 ms** |
| Failed runs / failed page loads | 0 / 0 | 0 / 0 |

- On the whole job, Agent37 was about **5% slower** at the median (18.1 s vs 17.2 s). In the paired runs (same run, same site order), E2B was faster in 12 of 20. The median paired difference was 1.4 s in E2B's favour.
- At p90, Agent37 was faster (20.3 s vs 26.4 s). E2B had two slow runs (27.8 s and 39.2 s). The slowest Agent37 run was 20.6 s.
- **Chromium launch:** Agent37 was faster in all 20 paired runs (0.29 s vs 3.28 s).
- **Page loads:** Agent37 was slower on all 10 sites. With Chromium already open (warm set: 3 sandboxes x 3 rounds = 90 loads per provider), one page load took 817 ms vs 620 ms, and one round of 10 sites took 12.7 s vs 9.6 s.
- **The page-load gap is not the network.** Chromium's own navigation timing shows time to first byte of 51 ms (Agent37) vs 103 ms (E2B), but time from first byte to the `load` event of 735 ms vs 489 ms. A `curl` probe from inside the sandbox agrees: first byte 53 ms vs 92 ms, 25 MB download 106 MB/s vs 100 MB/s. The extra time is after the first byte (many small requests, page JavaScript, rendering).

Per site, page load in ms (median / p90, 20 cold loads each):

| Site | Agent37 | E2B |
|---|---|---|
| wikipedia.org | 338 / 500 | 305 / 352 |
| news.ycombinator.com | 372 / 386 | 212 / 263 |
| python.org | 424 / 619 | 242 / 505 |
| developer.mozilla.org | 554 / 709 | 285 / 577 |
| apple.com | 757 / 1,024 | 627 / 1,222 |
| vercel.com | 903 / 1,215 | 617 / 1,044 |
| stripe.com | 1,178 / 1,476 | 662 / 1,115 |
| nasa.gov | 1,448 / 1,861 | 1,051 / 5,375 |
| github.com | 1,995 / 2,783 | 1,113 / 1,466 |
| bbc.com | 2,480 / 3,004 | 1,670 / 1,980 |

### Part B: Browser Use agent, 5 tasks

Only (run, task) pairs that both providers finished are compared (11 pairs; see caveat 4).

| | Agent37 | E2B |
|---|---|---|
| Tasks passed | **11 / 11** | **11 / 11** |
| Agent time, median | 112 s | 104 s |
| Agent time, p90 | 207 s | 117 s |
| Steps, median | 10 | 10 |

Most of the agent time is the LLM thinking, so the sandbox has less effect here. The largest gap was on anker.com, a heavy page. Agent37 was faster in 3 of the 11 pairs. E2B also finished one more run: all 15 of its attempts passed.

### Price at 2 vCPU / 4 GB (read 2026-11-07)

| | Agent37 | E2B |
|---|---|---|
| List price | $4.76 per month (`default` instance type, default disk) | $0.000028/s for 2 vCPU + $0.000018/s for 4 GiB RAM = $0.000046/s |
| Per hour | **$0.0065** ($4.76 / 730 h, the rate Agent37's billing docs use) | **$0.1656** |
| Billing unit | per minute | per second |

At these list prices, E2B costs about 25 times more per running hour for this size. This compares list prices only. It does not include plan fees (E2B Pro is $150/month; the Hobby plan used here is $0/month) or free credits. Snapshots of the price pages are in [`sources/`](sources/).

## Method

**Same on both providers**

- Image: [`image/Dockerfile`](image/Dockerfile), `mcr.microsoft.com/playwright/python:v1.64.1-noble` + `playwright==1.64.1` + `browser-use==0.13.14`, built into a template on each provider. Nothing is installed at run time.
- Browser: Chromium 156.0.8078.4, headless (Playwright default). Commands run as root with the same environment variables.
- Size: 2 vCPU / 4 GB. Agent37: `resources: {cpu: 2, memory: 4}`, type `default`, region `us`. E2B: template built with `cpuCount: 2, memoryMB: 4096` (the sandbox reports 3.8 GiB).
- Scripts: the files in [`sandbox-scripts/`](sandbox-scripts/) are copied into the sandbox and run there, so browser timings are measured inside the sandbox, not over the network.
- One client machine drives both providers with the same Node.js code ([`lib/providers.js`](lib/providers.js) puts both behind one interface).

**Part A** ([`run-part-a.js`](run-part-a.js), [`sandbox-scripts/bench_a.py`](sandbox-scripts/bench_a.py))

- Cold set: 20 runs per provider, a new sandbox for each run. Runs alternate between providers. In each run both providers get the **same random site order**, and a coin flip picks which provider goes first.
- Each page load uses a new, empty browser context (no cache, no cookies), a 1280x800 viewport, waits for the `load` event (45 s limit), then takes a JPEG screenshot.
- "Whole job" = create call start to sandbox ready, plus the whole browser script (Chromium launch, CPU test, 10 loads + screenshots, close).
- Warm set (`--warm`): 3 sandboxes per provider, Chromium opened once, one unscored warm-up round, then 3 scored rounds of the 10 sites.
- After the browser test (not timed as part of it), a `curl` probe records network first-byte times and download speed.
- Create calls are not retried, so a slow or failed create shows in the data.

**Part B** ([`run-part-b.js`](run-part-b.js), [`sandbox-scripts/agent_b.py`](sandbox-scripts/agent_b.py), [`lib/grade-b.js`](lib/grade-b.js))

- Model: `google/gemini-3.8-flash` via OpenRouter, temperature 0, vision on, 25 steps max. Same model and prompts on both providers.
- With `--parallel`, both providers run the same run index at the same time, so they see the same LLM and website conditions. Tasks run in the same random order on both.
- Tasks: book-ready restaurant search on resy.com (stop at the venue link), add a charger to a guest cart on anker.com (stop before checkout), compare AirPods Pro 3 prices on apple.com and verizon.com, find 3 weekend events on sf.funcheap.com and save them to a file, read NVIDIA's share price on Google Finance (graded against Yahoo Finance at the same moment).
- Every prompt forbids logging in, submitting any order, reservation or payment, and typing personal details. At a CAPTCHA the agent must stop and answer `BLOCKED` (graded as a fail).

**Analysis** ([`analyze.js`](analyze.js)): reads the raw JSONL files and writes `summary.json` plus three CSV tables. Run 0 is treated as a smoke test and excluded.

## Caveats

1. **Different regions.** Agent37 ran in Warrenton, Virginia (OVH). E2B ran in The Dalles, Oregon (Google Cloud). Neither could be matched on the plans used (E2B Hobby has no region option). The network probe shows faster first bytes on Agent37, so location does not explain the page-load gap, but it is a difference. Create, ready and delete times also include the round trip from the client to each provider's API, so they depend on where you run the client.
2. **Different isolation.** Agent37 `default` instances are gVisor containers (kernel `4.19.0-gvisor`, CPU model hidden). E2B sandboxes are Firecracker microVMs (kernel `6.1.189+`, Intel Xeon @ 2.60GHz). This is each product as sold, and it is the likely cause of the page-load and screenshot gap. Agent37's `performance` and `vm` instance types were not tested.
3. **E2B's slow first Chromium launch** comes from starting a sandbox from a snapshot: the browser binary is read from storage on first use. An app that keeps Chromium open, or opens it in the template's start command, avoids this cost. Then E2B wins the whole job by more.
4. **Part B is small and incomplete.** The run was stopped part-way through run 3 because the client machine ran low on memory (not a sandbox failure). Data: runs 1 and 2 complete on both providers, run 3 complete on E2B and 1 task on Agent37. That is 2-3 runs per task, so treat the Part B timings as a rough sign. The pass rate (11/11 each) is solid for these tasks.
5. **Sites changed before scoring.** reddit.com, nytimes.com and stackoverflow.com returned 403 or "Just a moment..." bot pages on both providers, and amazon.com returned a 202 bot challenge. They were replaced by developer.mozilla.org, python.org, stripe.com and nasa.gov. e2b.dev was replaced by apple.com so that neither provider's own site is in the set. In Part B, target.com showed a "press & hold" bot check on both providers and was replaced by verizon.com. All swaps were made before any scored run and apply to both providers. Websites change over time, so your page-load numbers will differ.
6. The first Agent37 create after the template build took 30 s (the image was copied to the host). It was a smoke run (run 0) and is excluded.
7. All results are from one evening (01:44 to 02:55 UTC, 2026-11-07) and one client machine.

## Run it yourself

You need Node.js 20 or newer, the `tar` command, an [Agent37](https://www.agent37.com) API key with wallet balance, an [E2B](https://e2b.dev) API key, and (for Part B only) an [OpenRouter](https://openrouter.ai) key.

1. Install the dependencies:
   ```sh
   npm install
   ```
2. Set your keys. Copy `.env.example` to `.env` and fill it in, or export the variables in your shell:
   ```sh
   cp .env.example .env
   # AGENT37_API_KEY=...  E2B_API_KEY=...  OPENROUTER_API_KEY=...
   ```
3. Build the template on both providers (same Dockerfile). This takes about 2 minutes on E2B and about 7 minutes on Agent37:
   ```sh
   npm run build:e2b
   npm run build:agent37
   ```
4. Run Part A. `--runs N` sets the number of cold runs per provider (the published results use 20):
   ```sh
   node run-part-a.js --runs 20
   node run-part-a.js --warm --runs 3 --passes 3
   ```
   Allow about 20 to 30 minutes for 20 cold runs. To run one provider only, add `--providers e2b` or `--providers agent37`.
5. Optional: run Part B (published results: `--parallel`, 2 to 3 runs):
   ```sh
   node run-part-b.js --runs 3 --parallel
   ```
   The task dates (dinner booking, weekend events) are computed from the day you run it. `BENCH_FIXED_DATES=1` uses the original prompts, but those dates are now in the past.
6. Summarize:
   ```sh
   node analyze.js
   ```
   This writes `data/summary.json`, `data/part-a-cold-runs.csv`, `data/part-a-page-loads.csv` and `data/part-b-agent-runs.csv`. Compare them with [`results/2026-11-07/`](results/2026-11-07/). The README numbers come from these fields: `cold.<provider>.total_ms`, `ready_ms`, `launch_ms`, `page_load_ms_all`, `screenshot_ms_all`, `cpu_js_ms`, `per_site`; `cold_paired_agent37_minus_e2b`; `warm.<provider>.page_load_ms`, `pass_total_ms`; `agent_paired`.
7. Check that nothing is left running:
   ```sh
   node lib/list-mine.js
   ```
   Every sandbox the scripts create is logged in `data/created-<provider>.jsonl` and tagged with metadata `purpose: browser-bench`. The runners delete each sandbox when its run ends, also on errors (but not if you kill the process). The templates stay; delete them in each provider's console if you do not need them.

Raw output (`data/`, `shots/`, `videos/`) is git-ignored. It holds sandbox ids, each sandbox's public IP information and agent logs.

Other helpers: `lib/cost.js` estimates sandbox spend from your run logs, `lib/or-usage.js` prints your OpenRouter key usage (run it before and after Part B), `lib/env-check.js <agent37|e2b>` checks that a template starts, and `lib/site-probe.js <agent37|e2b>` loads candidate sites once to find ones that block datacenter IPs.

### Approximate cost to rerun

| Part | Cost (list prices, 2026-11-07) |
|---|---|
| Part A, 20 cold runs + warm set | E2B about $0.03 (about 660 sandbox-seconds); Agent37 under $0.01 |
| Part B, `--runs 3` (30 task attempts) | OpenRouter about $3 (the original run used about $0.10 per attempt with `google/gemini-3.8-flash`, upper bound); E2B about $0.10; Agent37 about $0.01 |
| Template builds | See each provider's pricing |

The whole original benchmark, including tests, cost about $4.25. E2B gives new accounts $100 in one-time credits. Agent37 needs wallet balance before it creates an instance (at least one day of the instance's price); see [`sources/agent37-billing-2026-11-07.md`](sources/agent37-billing-2026-11-07.md).

## Contributing results

PRs with your results are welcome, also if they disagree with ours. Add a folder `results/<YYYY-MM-DD>-<your-name>/` with the four files from `node analyze.js` and a short note: where the client ran, your plan on each provider, the run count, and anything you changed. Please do not commit the raw `data/` files (they contain sandbox IPs and ids).

## Files

```
image/Dockerfile               the image for both providers
build-e2b-template.js          builds the E2B template
build-agent37-template.js      builds the Agent37 template
run-part-a.js                  Part A runner (raw browser speed)
run-part-b.js                  Part B runner (Browser Use agent tasks)
sandbox-scripts/bench_a.py     runs inside the sandbox for Part A
sandbox-scripts/agent_b.py     runs inside the sandbox for Part B (task prompts)
lib/                           provider adapter, key loading, grading, helpers
analyze.js                     raw JSONL -> summary.json + CSVs
results/2026-11-07/            published summary + CSV tables
sources/                       price page snapshots, 2026-11-07
```

## License

MIT, see [LICENSE](LICENSE).
