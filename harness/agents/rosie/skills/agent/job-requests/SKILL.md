---
name: job-requests
description: Own job intake and naming, pricing, job/item note audiences, AR note handoffs, allocations and order lifecycle. Includes task-specific write procedures. Use for new/quick quotes, committed orders, job updates or closure; lookups create no job. (v5.41.0)
metadata:
  author: lps
  version: "5.41.0"
---

# Job requests

Run on `jr-<id>`; contact threads own correspondence. Read the relevant schema
with `database-access`, then [write discipline](artifacts/writes.md) before any
write. Load only the task references below; do not read the whole directory.

| Intent | Path |
|---|---|
| Pricing/general question | Search and answer; no job, AR or order. |
| New ordinary request | New job/items → APS quote → approved optional AR → accepted order. |
| Explicit quick quote | New job/items → quote → stop; no AR or availability approval ask. |
| Committed intake | Job/items → retain supplied prices, APS fills gaps → direct order. |
| Accepted quote | Its existing job/items and accepted terms → direct order; no new quote/AR. |

New intake never searches other jobs by matching plants. Reuse only an explicit
job reference, established context or the same known/reserved id on retry.
Commitment must identify the accepted scope; a supplier reply is not acceptance.
Later acceptance supersedes `quote_only` for that scope. Perform independent
intake and supported updates before clarification; unresolved facts block only
dependent output. APS is supplier 1 unless Chris explicitly authorizes another.

| Task | Read |
|---|---|
| Create job/items, job naming, customer matching, EDD/Unknown, fulfillment | [intake](artifacts/intake.md) |
| Requested size/variant alternatives | [requested options](artifacts/requested-options.md) |
| Price lines or apply Chris's manual APS inputs | [pricing](artifacts/pricing.md), then `plant-and-supplier-search` |
| Write/clean job or item customer, external or internal notes; route AR notes | [notes](artifacts/notes.md); `quote-generation` owns shared-note wording |
| Review submitted supplier evidence / approved job availability | [supplier responses](artifacts/supplier-responses.md) |
| Create accepted order without an AR | [direct orders](artifacts/direct-orders.md) |
| Create AR-backed order / allocate across jobs | [allocated orders](artifacts/allocated-orders.md) |
| Change an existing order | [order changes](artifacts/order-changes.md) |
| Advance or close job/order | [lifecycle](artifacts/lifecycle.md) |
| Read assigned AR/order names | [record names](artifacts/record-names.md) |
| Quote delivery/customer acceptance relay | [customer updates](artifacts/customer-updates.md) |

Before reporting completion, verify the saved rows, allocations and intended
stage. Inspect existing records before retrying an uncertain create/send.
Use `message-routing` to return findings and required approvals to the original
request chat; preserve scoped acceptance, prices and approval evidence.
