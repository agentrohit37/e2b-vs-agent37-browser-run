> ## Documentation Index
> Fetch the complete documentation index at: https://www.agent37.com/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# Instance sizing

> Choose CPU, memory, disk, and an instance type.

| cpu | memory | disk | Price at the default disk |
| - | - | - | - |
| 2 | 4 GB | 2-12 GB | \$4.76 per month (the default) |
| 4 | 8 GB | 2-20 GB | \$9.34 per month |
| 4 | 16 GB | 2-40 GB | \$15.48 per month |
| 4 | 32 GB | 2-80 GB | \$27.76 per month |

Disk bills at \$0.09 per GB per month, included in the prices above at the default disk. Those are the prices of the `default` [instance type](https://www.agent37.com/docs/agents-api/billing.md#default-and-performance-instances). The monthly price is the rate; the wallet is metered per minute, and only for what the instance holds: running time bills the full rate, and stopped or sleeping time bills the disk alone. Deleting an instance settles its final minutes and billing ends. See [Billing](https://www.agent37.com/docs/agents-api/billing.md).

4 vCPU is the ceiling on every instance type. A create that asks for more cores keeps the memory it
asked for and comes back with 4 vCPU, at the price above, so a request for `{ "cpu": 16, "memory": 32 }`
provisions 4 vCPU / 32 GB. The `resources` in the response is always what the instance actually has.

A [VM instance](https://www.agent37.com/docs/agents-api/vm-instances.md) takes the same four shapes, and its compute is 2.5x the default rate. A VM or `performance` instance takes 2-100 GB of disk on every shape.

With `resources` omitted, `agent37-ubuntu` uses 2 vCPU / 4 GB RAM / 12 GB disk and
`agent37-android` uses 4 vCPU / 8 GB RAM / 12 GB disk. These two templates require
`"type": "vm"` and default to 12 GB disk even if you select a different CPU/RAM shape.
Other templates default to 4, 6, 12, or 24 GB disk by shape. Pass `resources.disk` to choose
another whole number within the shape's range.

[`burstable` instances](https://www.agent37.com/docs/agents-api/billing#burstable-instances) start at \$1/month for low average CPU and RAM usage and require workspace enablement.


This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.