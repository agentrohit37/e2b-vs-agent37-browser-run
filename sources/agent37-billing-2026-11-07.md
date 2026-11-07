> ## Documentation Index
> Fetch the complete documentation index at: https://www.agent37.com/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# Billing

> Prepaid and managed in the dashboard: one workspace wallet funds compute and managed usage.

Billing is prepaid. You top up one workspace wallet in the dashboard, and everything draws from it: instance compute and managed usage.

## How the balance works

* **\$5 free to start.** Add a card from the billing page (nothing is charged) and your workspace gets a one-time \$5 credit, enough to run your first instance around the clock for about a month, or a mostly-idle [auto-sleep](https://www.agent37.com/docs/agents-api/instance-auto-sleep.md) instance for many months. The credit is granted once per account and once per card, and only to a workspace that has not topped up yet; a workspace created by [`POST /v1/signup`](https://www.agent37.com/docs/agents-api/signup) never receives it. Until your first real top-up, the workspace runs up to three instances at once, of any template, size, or type, VMs included. Your first top-up raises that to 10 instances running at once; once your top-ups total \$50 the limit rises to 50, at \$250 to 200, and at \$1,000 to 1,000. See [Instance limits](#instance-limits).
* **Top up in the dashboard, or from the API.** Add funds at [dashboard/cloud/billing](https://www.agent37.com/dashboard/cloud/billing), or call [`POST /v1/billing/top-up`](#fund-the-wallet-from-the-api). Top-ups are \$5 to \$10,000 each, paid through Stripe.
* **Automatic top-up is on by default.** A top-up saves its card and turns on a refill rule (buy the same amount again once the balance drops below half of it) so the wallet refills itself; switch it off as you pay, or adjust it any time. See [Automatic top-up](#automatic-top-up).
* **Instances draw it down.** Compute is metered per minute: time an instance spends running bills its full rate, time spent stopped or sleeping bills its disk alone. See [Per-minute metering](#per-minute-metering).
* **Managed usage draws it down.** Managed LLM, Brave search, and Composio calls are metered at cost against the same wallet, gated by each instance's [budget](https://www.agent37.com/docs/agents-api/budgets.md).
* **Delete to stop billing.** Deleting an instance settles its final minutes and ends billing. Nothing is ever prepaid, so there is nothing to refund.

> [!NOTE]
>
> The wallet is readable and fundable from the API: [`GET /v1/billing`](#read-the-wallet) for the balance and the tier, [`POST /v1/billing/top-up`](#fund-the-wallet-from-the-api) to pay. The ledger and the spend breakdown stay in the [dashboard](https://www.agent37.com/dashboard/cloud/billing).

## Instance limits

How many instances a workspace can run at once depends only on how much it has topped up:

| Workspace | Running at once |
| - | - |
| Free (before your first top-up) | 3, all shapes |
| Topped up at least once (any amount) | 10, all shapes |
| Top-ups total \$50 or more | 50, all shapes |
| Top-ups total \$250 or more | 200, all shapes |
| Top-ups total \$1,000 or more | 1,000, all shapes |

The limit rises on its own: your first top-up lifts the workspace to 10, \$50 in total top-ups makes it 50, \$250 makes it 200, and \$1,000 makes it 1,000, with nothing to request or configure. Top-ups add up over the life of the workspace, and the limit never goes back down. Need more than 1,000 at once? Email [vishnu@agent37.com](mailto:vishnu@agent37.com) or use the chat bubble in the dashboard.

The limit counts only awake instances. Sleeping and stopped ones never count, so you can keep as many as you like, each billing its disk alone; with one instance per end user and [auto-sleep](https://www.agent37.com/docs/agents-api/instance-auto-sleep.md), you can serve any number of users as long as no more than your limit are awake at once. A create or [start](https://www.agent37.com/docs/agents-api/instances/start.md) past the limit returns `409 instance_limit_reached`. A request to a sleeping instance's URL is still served past the limit, and the instance goes back to sleep right after, with `instance_limit_reached` in its `status_reason`.

These are limits on how many instances run at once, not a balance requirement: each instance simply [meters its own compute](#per-minute-metering) from the wallet, with no extra reserve for running several.

### Performance accounts

For workspaces that need fast starts every time. On a Performance account, new instances start faster and more consistently, and sleeping instances wake faster. It covers every instance in the workspace, on any tier, and is a paid add-on priced per account.

To ask for one, click **Request** next to Performance account on the [Billing page](https://www.agent37.com/dashboard/cloud/billing) to chat with us, or email [vishnu@agent37.com](mailto:vishnu@agent37.com).

Performance accounts and [Performance instances](#default-and-performance-instances) are separate: the account setting speeds up starts and wakes across the workspace, and a Performance instance runs on cores held for that one instance.

## Compute pricing

Compute is priced from the instance's `resources`:

| Resource | Rate |
| - | - |
| vCPU | \$0.80 per vCPU per month |
| RAM | \$0.70 per GB per month |
| Disk | \$0.09 per GB per month |

Applied to the shapes at their default disk:

| Shape | Price at the default disk |
| - | - |
| 2 vCPU / 4 GB RAM / 2-12 GB disk (the default) | \$4.76 |
| 4 vCPU / 8 GB RAM / 2-20 GB disk | \$9.34 |
| 4 vCPU / 16 GB RAM / 2-40 GB disk | \$15.48 |
| 4 vCPU / 32 GB RAM / 2-80 GB disk | \$27.76 |

Every template offers the same four shapes, 2 vCPU / 4 GB is the smallest, and 4 vCPU is the ceiling on every type. Disk is any whole number of GB within the shape's range and defaults to 4, 6, 12, or 24 GB by shape; every GB bills at \$0.09 per month. See [Instances](https://www.agent37.com/docs/agents-api/instances.md) for how to pick a shape with `resources` on create.

### Default and Performance instances

Every instance is a **default** instance unless you ask for something else, and the prices above are what one costs awake around the clock. For most harnesses the default is all you need: agents spend most of the day idle.

A **Performance** instance is a whole machine whose cores are held for it, so it gets the same CPU in a busy hour as in a quiet one. Reach for it when the agent does heavy work, such as computer use (driving a browser or a desktop), and needs the same speed every hour. Isolation and every endpoint on this reference behave identically.

Start with the default. For a Performance instance, pass `"type": "performance"` on [create](https://www.agent37.com/docs/agents-api/instances/create.md); compute is 4x the default rate, and disk is unchanged. It boots a kernel, like a [VM instance](https://www.agent37.com/docs/agents-api/vm-instances.md), so a create takes longer than a default instance's.

Default instances share hardware, so sustained heavy CPU use may be limited when the hardware is busy. Performance and VM instances are not.

A [VM instance](https://www.agent37.com/docs/agents-api/vm-instances.md) is a whole virtual machine with its own kernel, for Docker, Kubernetes, databases, and Android emulators. Its compute is 2.5x the default rate, and disk is unchanged.

[Auto-sleep](https://www.agent37.com/docs/agents-api/instance-auto-sleep.md) does not change these rates. An auto-sleep instance bills the same rate as an always-on one for the time it is awake, and disk alone for the time it is asleep, so anything idle for most of the day costs a fraction of the always-on price. See [Per-minute metering](#per-minute-metering).

### Burstable instances

`burstable` is an experimental instance type for low average CPU and RAM usage, with pricing starting at \$1/month. [Apply here](https://cal.com/vishnukool/30min) to enable it for your workspace.

## Per-minute metering

The monthly price is the rate; the wallet is metered per minute (the monthly price divided by 730 hours, divided by 60). What a minute costs depends on what the instance holds:

| Time spent | Meters at |
| - | - |
| `running`, and the transitional states (`starting`, `restarting`, `updating`, `stopping`) | The full compute rate, with [auto-sleep](https://www.agent37.com/docs/agents-api/instance-auto-sleep.md) on or off. |
| `sleeping`, `stopped`, or `waking` | The disk rate alone: \$0.09 per reserved GB per month. |
| Parked in cold storage | \$0.03 per GB per month, on the actual compressed bytes stored. |

**Create checks a day, debits nothing.** `POST /v1/instances` requires the wallet to hold one day of the instance's running rate; below that, the create returns `402 insufficient_balance` and nothing is provisioned. Nothing is debited at create: the meter starts when the instance first reaches `running`, so a failed create costs nothing and there is nothing to refund.

```json wrap theme={null}
{
  "error": {
    "code": "insufficient_balance",
    "message": "This instance costs $0.0068 per hour, metered per minute; creating it requires at least one day of balance ($0.1624). Add balance to your workspace and try again."
  }
}
```

**Each instance meters on its own.** Every instance draws its own metered debits from the wallet; there is no extra balance reserve for running several at once. How many can run at once is set by your [instance limit](#instance-limits), not by your balance.

**Sleep and stop cut the rate; delete ends it.** An instance bills for as long as it exists, but only for what it holds. Stopping (or [auto-sleep](https://www.agent37.com/docs/agents-api/instance-auto-sleep.md)) releases CPU and RAM and keeps the disk, so parked time bills disk alone. An auto-sleep instance that spends most of its life asleep costs mostly its disk, about \$0.36 per month at the default 4 GB. Deleting an instance settles the final window and billing stops.

**The meter settles behind the scenes.** Whole minutes are billed at every lifecycle transition and at least hourly; you never see a per-minute charge on an API call. Each debit lands in the [ledger](#ledger-and-spend-visibility) as a metered compute entry.

## Automatic top-up

Automatic top-up keeps instances from being suspended when the balance runs low: when it falls below your threshold, your card is charged for a fixed amount. The rule is checked whenever managed usage leaves the balance below the threshold, on an hourly sweep, and once more right before any instance would be suspended, so instances stay up as long as the card charges.

* It is on by default when you top up: the **Add funds** dialog sets the purchase amount to what you are adding and the threshold to half of that, at least \$3 (a \$25 top-up buys \$25 again below \$12.50). Switch it off in the same dialog, or adjust both amounts or turn it off later at [dashboard/cloud/billing](https://www.agent37.com/dashboard/cloud/billing). It charges your default card, or the most recently saved one when none is set.
* The threshold can be \$3 to \$10,000. The purchase amount follows the usual \$5 to \$10,000 top-up range.
* If a charge fails, automatic top-up turns itself off and emails the workspace owner. Add funds manually, which saves a new card, then re-enable it.

## Past due and suspension

The meter is post-paid within the hour, so a busy instance can carry the balance below zero before the hourly settle catches it. When a settle leaves the wallet negative, and [automatic top-up](#automatic-top-up) is off or could not charge, the workspace's instances are suspended: running ones are force-slept, every one is flagged `past_due: true`, and the workspace owner is emailed. A request to a suspended instance's URL returns `402` with `{"error": "instance_suspended"}` instead of waking it, and suspended time is never billed.

**past\_due** `boolean`

`true` while the instance is suspended for non-payment. Cleared by topping up.

```json wrap theme={null}
{
  "id": "ab12cd34ef",
  "status": "sleeping",
  "past_due": true
}
```

Topping up reactivates immediately: the flag clears, the meter re-anchors at the top-up (the suspended gap is never back-billed), and the next request to each instance's URL wakes it. A suspension discards no data, but the force-sleep takes no checkpoint, so the first wake after one boots fresh, like `start` after `stop`. An instance left suspended for 30 days is permanently deleted.

> [!TIP]
>
> Branch on the error `code`, not the message. See [Errors](https://www.agent37.com/docs/agents-api/errors.md) for the full list and the response shape.

## Managed usage

Managed LLM, Brave search, and Composio calls debit the same wallet at cost, but only within each instance's budget: a monthly cap that resets each UTC month plus optional one-time top-up headroom. The default cap is \$0, so an instance spends nothing on managed services until you raise its cap or top it up. When a managed call is refused, the 402 reason tells you which pot ran dry: `insufficient_balance` means the wallet is empty, `instance_budget_exhausted` means the wallet has funds but the instance hit its cap. See [Budgets](https://www.agent37.com/docs/agents-api/budgets.md) for the endpoints, rates, and both 402 reasons.

## Wallet endpoints

Two endpoints cover the whole money rail from a program: read what is left, and pay. Both take the workspace key.

| Method | Path | Returns |
| - | - | - |
| `GET` | `/v1/billing` | `200` with the balance, tier, instance ceiling, refill rule, and suspension state |
| `POST` | `/v1/billing/top-up` | `201` with a Checkout URL |

### Read the wallet

`GET /v1/billing` answers what is left. It is deliberately separate from [`GET /v1/usage`](#read-workspace-usage), which reports what was spent and never what remains.

**balance\_usd** `number`

What the wallet holds, in dollars. Negative while a workspace is past due.

**tier** `integer`

`0` before the first top-up, then `1`, `2`, `3`, or `4` as total top-ups pass the thresholds in [Instance limits](#instance-limits).

**instance\_limit** `integer`

How many instances the workspace may run at once: `10`, `50`, `200`, or `1000` by tier, unless a higher limit was assigned. `3` on the free tier.

**auto\_top\_up** `object`

The refill rule, or `null` until a top-up arms one: `enabled`, `threshold_usd`, and `amount_usd`. See [Automatic top-up](#automatic-top-up).

**past\_due** `boolean`

`true` when non-payment has suspended the workspace's instances. A top-up clears it and they become startable again. See [Past due and suspension](#past-due-and-suspension).

```bash curl wrap theme={null}
curl https://api.agent37.com/v1/billing \
  -H "Authorization: Bearer sk_live_..."
```

```python Python wrap theme={null}
import requests

response = requests.get(
    "https://api.agent37.com/v1/billing",
    headers={"Authorization": "Bearer sk_live_..."},
)
response.raise_for_status()
print(response.json())
```

```javascript Node wrap theme={null}
const response = await fetch("https://api.agent37.com/v1/billing", {
  headers: { Authorization: "Bearer sk_live_..." },
});
if (!response.ok) throw new Error(await response.text());
console.log(await response.json());
```

```json theme={null}
{
  "balance_usd": 42.5,
  "tier": 1,
  "instance_limit": 10,
  "auto_top_up": { "enabled": true, "threshold_usd": 12.5, "amount_usd": 25 },
  "past_due": false
}
```

### Fund the wallet from the API

`POST /v1/billing/top-up` answers with a Stripe-hosted payment page for `amount_usd`.

**amount\_usd** `number` *required*

How much to add, \$5 to \$10,000.

**url** `string`

A hosted Stripe Checkout link for `amount_usd`.

**amount\_usd** `number`

The amount the link charges.

**paid** `boolean`

`false`: nothing has moved when the call returns, and the money lands when the payment confirms.

Open it, pay once, and the card is saved: [automatic top-up](#automatic-top-up) then refills the wallet off-session from then on, so the browser is needed exactly once per account and never again. The balance changes when Stripe confirms the payment, so poll `GET /v1/billing` for it.

```bash curl wrap theme={null}
curl -X POST \
  https://api.agent37.com/v1/billing/top-up \
  -H "Authorization: Bearer sk_live_..." \
  -H "Content-Type: application/json" \
  -d '{"amount_usd": 25}'
```

```python Python wrap theme={null}
import requests

response = requests.post(
    "https://api.agent37.com/v1/billing/top-up",
    headers={"Authorization": "Bearer sk_live_..."},
    json={"amount_usd": 25},
)
response.raise_for_status()
print("Open to pay:", response.json()["url"])
```

```javascript Node wrap theme={null}
const response = await fetch("https://api.agent37.com/v1/billing/top-up", {
  method: "POST",
  headers: {
    Authorization: "Bearer sk_live_...",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ amount_usd: 25 }),
});
if (!response.ok) throw new Error(await response.text());
console.log("Open to pay:", (await response.json()).url);
```

```json theme={null}
{ "url": "https://checkout.stripe.com/c/pay/cs_live_...", "amount_usd": 25, "paid": false }
```

## Ledger and spend visibility

Every wallet movement is recorded: top-ups, the signup credit, and metered compute debits land in an append-only ledger, while managed usage is metered per call into its own usage ledger. Review the ledger, your balance, and the spend breakdown at [dashboard/cloud/billing](https://www.agent37.com/dashboard/cloud/billing); the [usage page](https://www.agent37.com/dashboard/cloud/usage) shows the same numbers by day, by instance, and by model for any window in the last 90 days.

### Read workspace usage

`GET /v1/usage?from=YYYY-MM-DD&to=YYYY-MM-DD` returns everything the workspace spent, by UTC day, by instance, and by model, for a window of up to 90 days. Both parameters are optional: `to` defaults to today and `from` to 30 days ending there. Deleted instances stay in the list for the days they spent. Compute lands here within the hour (it is metered per minute and settled hourly); models, search, and tools land as each call is billed.

**from** `string`

First UTC day covered, formatted `YYYY-MM-DD`.

**to** `string`

Last UTC day covered, inclusive.

**total\_micros** `integer`

Everything spent in the window, in USD millionths.

**by\_integration** `object`

`compute`, `llm`, `brave`, `composio`, and `perflo`, each with `cost_micros`. `llm` also carries `calls`, `input_tokens`, and `output_tokens`. `perflo` is [paid tools](https://www.agent37.com/docs/agents-api/managed-services.md#paid-tools).

**by\_model** `array`

One entry per model called in the window, highest spend first: `model` (the id as the provider reports it), `cost_micros`, `calls`, `input_tokens`, `output_tokens`. Calls whose model was not recorded are grouped under `unknown`.

**days** `array`

One entry per UTC day in the window, oldest first: `date`, `total_micros`, `compute_micros`, `llm_micros`, `brave_micros`, `composio_micros`, `perflo_micros`, `llm_calls`, `input_tokens`, `output_tokens`. Days with no spend are present with zeros.

**instances** `array`

One entry per instance that spent anything in the window, highest total first, with the same fields as a day plus the instance `id`.

```bash curl wrap theme={null}
curl -X GET \
  https://api.agent37.com/v1/usage \
  --url-query "from=2026-08-11" \
  --url-query "to=2026-09-09" \
  -H "Authorization: Bearer sk_live_..."
```

```python Python wrap theme={null}
import requests

response = requests.get(
    "https://api.agent37.com/v1/usage",
    headers={
        "Authorization": "Bearer sk_live_..."
    },
    params={
        "from": "2026-08-11",
        "to": "2026-09-09"
    },
)
response.raise_for_status()
print(response.json())
```

```javascript Node wrap theme={null}
const query = new URLSearchParams({
  "from": "2026-08-11",
  "to": "2026-09-09"
});

const response = await fetch(
  "https://api.agent37.com/v1/usage" + "?" + query,
  {
    method: "GET",
    headers: {
      "Authorization": "Bearer sk_live_..."
    },
  },
);
if (!response.ok) {
  throw new Error(await response.text());
}
console.log(await response.json());
```

```json response wrap theme={null}
{
  "from": "2026-08-11",
  "to": "2026-09-09",
  "total_micros": 4898130000,
  "by_integration": {
    "compute": { "cost_micros": 2100000000 },
    "llm": { "cost_micros": 2588130000, "calls": 410212, "input_tokens": 23400000000, "output_tokens": 610000000 },
    "brave": { "cost_micros": 110000000 },
    "composio": { "cost_micros": 60000000 },
    "perflo": { "cost_micros": 40000000 }
  },
  "by_model": [
    { "model": "openai/gpt-5.6-luna", "cost_micros": 2401000000, "calls": 380100, "input_tokens": 21900000000, "output_tokens": 570000000 },
    { "model": "deepseek/deepseek-v4-flash", "cost_micros": 187130000, "calls": 30112, "input_tokens": 1500000000, "output_tokens": 40000000 }
  ],
  "days": [
    {
      "date": "2026-08-11",
      "total_micros": 152400000,
      "compute_micros": 70000000,
      "llm_micros": 76200000,
      "brave_micros": 3500000,
      "composio_micros": 1500000,
      "perflo_micros": 1200000,
      "llm_calls": 12840,
      "input_tokens": 720000000,
      "output_tokens": 19000000
    }
  ],
  "instances": [
    {
      "id": "ab12cd34ef",
      "total_micros": 312400000,
      "compute_micros": 21000000,
      "llm_micros": 291400000,
      "brave_micros": 0,
      "composio_micros": 0,
      "perflo_micros": 0,
      "llm_calls": 9120,
      "input_tokens": 2100000000,
      "output_tokens": 48000000
    }
  ]
}
```

For managed spend on a single instance for one month, `GET /v1/instances/{id}/usage` returns a monthly rollup; see [Budgets](https://www.agent37.com/docs/agents-api/budgets.md#read-managed-spend).


This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.