### Order creation and many-to-many allocations

Availability requests and orders are separate records. A job can have many
ARs and orders, and an AR or order can serve several jobs. A consolidated
grower request may combine compatible quantities from different job items;
one job item may be split across AR items or orders. Never assume the legacy
scalar `job_request_id` or `job_request_item_id` is the complete relationship.

- `availability_request_jobs` connects AR headers to all jobs;
  `availability_request_item_jobs` connects AR rows to job items and preserves
  each allocated `quantity`.
- `orders` and `order_items` hold supplier-facing commitments;
  `order_item_job_request_items` allocates each order row back to job items.
  AR-backed order rows retain their `availability_request_item_id` as source
  evidence; direct order rows have NULL and link to the job items instead.
- Read every allocation before relaying answers, changing quantities or
  creating orders. A combined supplier quantity is a shared total, never the
  amount available to every linked job. Preserve job-specific demand, prices,
  dates and customer privacy; combine only the exact approved scope.

When the availability path has suitable answered AR rows and explicit customer
acceptance, create the supplier order atomically with the accepted allocations
and any known fulfillment details:

```sql
SET app.actor TO 'rosie';
SELECT public.create_order(
  $supplierId,
  '[{"availability_request_item_id":42,"allocations":[{"job_request_item_id":7,"quantity":10}]}]'::jsonb,
  $fulfillmentMethod, $fulfillmentDate, $notes, true
);
```

The final argument records actual customer acceptance, never a guess. Every
allocation needs that customer's acceptance; one customer's go-ahead cannot
commit another job. Use the real ids and accepted quantities, inspect existing
allocations before retrying and never over-order or duplicate demand. Order
creation makes an Order **New** and its jobs **Committed**, maps AR `can_order`
to order `need_to_order`
(**Need to Order**), and exposes the order in the supplier portal's Orders tab
and every linked job's Orders tab. If acceptance arrives before suitable AR
rows exist, use [direct orders](direct-orders.md). Existing ARs do not force a new
availability round; never fabricate responses or duplicate demand already ordered.
Preserve existing ARs and their answers; a direct order alone is not permission
to delete, hide or close a request still serving other work.

Store a known `orders.fulfillment_method` as `pickup`/`delivery` and
`orders.fulfillment_date` as the agreed pickup/delivery date, separate from
`job_requests.expected_install_date`. Do not guess a shared order's plan from
one linked job when their requirements differ; unknown method/date stays NULL.
Explicit supplier order
confirmation uses `confirm_order(orderId, supplierId, confirmationDate,
fulfillmentDate)`, moves the Order **New → Processing** and records `confirmation_date`.
The next order stage is **Order Ready** (`order_ready`), via `update_partner_order`.
The **Job Request remains Committed**; it has no Confirmed stage. An
availability submission does not confirm an order. Resolve ambiguous supplier
confirmation before applying it; relay the actual order status/date to every
affected job thread.
