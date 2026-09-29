# Orders

An order is LPS's commitment to buy from a supplier. It needs the
**customer's commitment** for exactly the lines and quantities ordered
(Chris relaying it counts). A supplier answer is never customer acceptance,
and one customer's yes never commits another customer's job.

## How ARs, orders and jobs link

- Candidate → job line: `candidates.job_request_item_id` (one line each). An
  asked candidate is its AR's line; its `demanded_quantity` is the ask. One AR
  per job: `availability_requests.job_request_id`.
- Order line ↔ job lines: `order_item_job_request_items.quantity`. Order lines
  have no AR pointer; related ARs are found through the job lines, same
  supplier only.
- Read every allocation before relaying answers, changing quantities or
  ordering. A shared total is never each job's amount.

## Create an order

**Before**: read the job lines, recent changes and **all** existing order
allocations for them (direct and AR-backed). Reuse an order that already
covers the scope; never order the same demand twice. Every ordered line needs
a known positive quantity and a price ([pricing](pricing.md) → "which price
wins"). Supplier is APS unless Chris chose another.

**Direct order** (committed intake or accepted quote, no AR needed):

```sql
SET app.actor TO 'rosie';
SELECT public.create_direct_order(
  $supplierId,
  '[{"job_request_item_id":7,"quantity":10}]'::jsonb,
  $fulfillmentMethod, $fulfillmentDate, $noteForSupplier, true,
  $noteForCustomer
);
```

**AR-backed order** (use when a suitable answered candidate exists; the
allocation must be the candidate's own job line):

```sql
SET app.actor TO 'rosie';
SELECT public.create_order(
  $supplierId,
  '[{"candidate_id":42,"allocations":[{"job_request_item_id":7,"quantity":10}]}]'::jsonb,
  $fulfillmentMethod, $fulfillmentDate, $noteForSupplier, true
);
```

- `true` = real customer commitment. Never guess it.
- Method (`pickup`/`delivery`) and fulfillment date only when known; else
  NULL. Never copy the job's EDD into the supplier's fulfillment date.
- The order starts **New**; its jobs become **Committed**. It appears in the
  supplier portal's Orders tab and each job's Orders tab. Order lines copy the
  job line's name, size, price, `note_for_customer` and status (`can_order` →
  `need_to_order`).
- Don't create, answer or submit an AR just to make an order possible, don't
  mark lines available, and don't invent supplier answers or dates. Existing
  ARs stay as they are.
- If `create_direct_order` is missing, report that gap; don't work around it.
- Capacity: every active order (any supplier, direct or AR-backed) uses up
  the job line's remaining demand; lost or inactive orders don't. The
  candidate id passed to `create_order` only validates and copies that answer
  (name, size, price, status, LPS ask and supplier reply); it isn't stored.

**After**: verify the order, its lines, prices, quantities, allocations and
the job stage. After an unclear result, check for an existing order before
retrying. Relay the order id, allocations, acceptance evidence and origin chat
to the supplier thread (`skip_availability: true` for direct orders). The
committed request is enough for the order to appear in the portal; an email
or customer message still needs its own approval.

## Supplier confirms

`confirm_order(orderId, supplierId, confirmationDate, fulfillmentDate)` moves
the order New → **Processing** and saves the dates. `update_partner_order`
moves it to **Order Ready**. The job stays **Committed** (jobs have no
Confirmed stage). An AR submission is not an order confirmation. If the
supplier confirmed in the portal, it's already saved; just re-read. Resolve
partial or unclear confirmations before recording them. Relay the new order
status and date to every linked job.

## Change a placed order

Any change after creation (lines, quantities, prices, allocations, dates,
method, instructions, status) — from Chris, a customer relay or a supplier
event:

1. Re-read the order, lines, allocations and recent changes. Know the before
   and after values and who authorized the change. This rule doesn't
   authorize the change itself.
2. Apply only the authorized edit (guarded). Verify. A change someone else
   already saved: just verify it.
3. Add one dated line to the end of `orders.note_for_supplier`, keeping the
   existing text (guarded): `09-22: Wax myrtle 15 G qty 10 → 12; pickup
   09-24 → 09-25.` The supplier sees it, so keep it factual. Don't add it
   twice on retry. (This is the one note that keeps history. There is no
   `orders.notes` column any more.)
4. Tell the supplier: hand the change to the supplier thread. You have
   standing permission for this factual notice; no draft approval needed.
5. Done only when the note is saved and the supplier message is confirmed
   sent. Relay the change to every affected job thread.

## Record names

Per-job names like `JR-42:AR-1`, `JR-42:Order-1` come from a `record_name`
column (migration 0104). As of 2026-09-25 that column was **not** on the live
database: check `schema` first, and if it's missing refer to records by id
(`AR-45`, order id). When it exists, read it after creation; never compute,
renumber or overwrite it. Shared records keep the
first job's name. Messages to suppliers use the job **name**, not these
numbers (`supplier-coordination`).
