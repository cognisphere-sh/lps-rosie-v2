---
name: job-requests
description: Run a job request end to end. Includes intake and job naming, pricing lines, note rules for all three note fields, candidates and supplier answers, orders and order changes, and job stages. Use in a jr-<id> thread for new requests, quick quotes, committed orders, job edits or closing. (v8.1.0)
metadata:
  author: lps
  version: "8.1.0"
---

# Job requests

Work in the job's own thread, `jr-<id>`. Customer and supplier threads own
their correspondence. Read only the reference you need:

| Task | Read |
|---|---|
| New request, quick quote, committed intake, job name, customer, EDD, lines, candidates | [intake](artifacts/intake.md) |
| Price lines, Chris's manual prices, several requested sizes, gaps | [pricing](artifacts/pricing.md) |
| Write any note (customer, internal, supplier) | [notes](artifacts/notes.md) |
| A supplier submitted an AR; conflicting or incomplete answers; Chris picks or removes a candidate | [supplier responses](artifacts/supplier-responses.md) |
| Create, confirm or change an order | [orders](artifacts/orders.md) |
| Stages, workflow events, closing, deleting | [lifecycle](artifacts/lifecycle.md) |
| Send a quote or update to the customer | `customer-coordination` |
| Create or send an AR | `supplier-coordination` |

## The usual flows

| Request | Steps |
|---|---|
| Price question | Answer. No job. |
| New request | Job + lines → candidates and prices for every row → post link and gaps → AR if Chris approves the scope. A quote only if asked. |
| Quick quote | Job + lines → price → quote → stop. No AR. |
| Committed order | Job + lines + candidates (keep given prices, fill gaps from APS) → direct order. No quote, no AR. |
| Accepted quote | Existing job and accepted terms → direct order. |

Stages don't have to run in order. Later acceptance of a quick quote turns
that scope into an order.

## Every task

1. Snapshot the job first: `skills/agent/database-access/scripts/job-snapshot
   <jobId>` (job, lines, recent changes, linked ARs and orders).
2. Do the work. Every write uses the guarded pattern in `database-access`
   and `SET app.actor TO 'rosie'`.
3. Verify the saved rows, then report the result in the origin chat
   (`message-routing` if you're not in it). Check existing records before
   retrying anything that may have half-worked.
