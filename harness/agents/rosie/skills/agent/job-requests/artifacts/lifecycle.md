## 6. Job lifecycle and orders

| Display | Stored status | Trigger |
|---|---|---|
| Quote | `quoted` | Initial job record and quoting; committed intake passes through this initial state without generating a quote. Quote-only work stops here. |
| Availability | `availability` | Optional stage: Chris approves and the availability request is delivered. |
| Committed (Order stage) | `committed` | Customer commitment is established and supplier orders exist for the accepted lines, with or without a prior AR. |
| Won | `closed_won` | Request explicitly closed as won. |
| Lost | `closed_lost` | Request explicitly closed as lost. |

`archived` is legacy, not a new workflow stage. Active/`sourcing` and job
`confirmed` are retired. Customer acceptance is **Committed**. Supplier
confirmation changes the **Order** from **New** to **Processing** while the
**Job Request remains Committed**. Neither event closes the job. Do not infer a lost sale
from silence. Never assign `confirmed` to a job or use the compatibility
`supplier_confirmed` job event to advance its stage; use [order confirmation](allocated-orders.md).
Historical customer-confirmed jobs migrate to Committed without invented order
records; inspect their evidence before preparing any outstanding supplier order.

```sql
SET app.actor TO 'rosie';
SELECT public.record_job_workflow_event($jobId, 'pricing_fetched');
```

Record pricing/quote events only after the work occurs: a draft is not a
shared quote, and a failed send is not sent. `availability_sent` advances
Quote → Availability. Repeated pricing/quote events never move later stages
backward or reopen a terminal job. Create accepted supplier orders through
[direct orders](direct-orders.md) or [AR-backed orders](allocated-orders.md); do not represent
customer acceptance by changing a job status without creating its order records.
Explicit lookup completion is still recorded when no price is saved.

Close with a fresh read and the explicit won/lost outcome. Use
`close_order(orderId, 'closed_won' | 'closed_lost')` for an order. A job may
be closed directly when the quote/request is lost before an order exists.
Closing the last order closes a job automatically only when all active demand
is known and fully allocated to terminal orders. Partial or unknown demand
stays open for Chris's explicit closure decision. A closed order's Won/Lost
outcome cannot be reclassified through `close_order`.
Do not close a shared AR or another customer's order because only one linked
job ended; database hooks preserve work for its other open jobs. Closed ARs
cannot be edited; do not reuse revoked public links after reopening.
Quote, Availability and Committed are the open job stages, separate
from an AR's New/Processing/Completed/Closed state.
