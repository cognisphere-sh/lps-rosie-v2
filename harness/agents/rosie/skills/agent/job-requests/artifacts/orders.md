# Orders

An order is LPS's commitment to buy from a supplier. It needs the
**customer's commitment** for exactly the lines and quantities ordered
(Chris relaying it counts). A supplier answer is never customer acceptance,
and one customer's yes never commits another customer's job.

## How ARs, orders and jobs link

- Candidate → job line: `candidates.job_request_item_id` (one line each). An
  asked candidate is its AR's line; the ask is the job line's
  `demanded_quantity` (candidates carry none, 0139). One AR per job and
  supplier: `availability_requests.job_request_id` (never NULL, 0139).
- Order → job: `orders.job_request_id` (0146). One order belongs to one job
  and one supplier; a job has at most one **open** order per supplier.
- Order row → candidate: `order_items.candidate_id`, one row per candidate
  (unique). A row is a copy of the job line's **selected** candidate at order
  time; later edits on either side don't touch the other. A row added by hand
  has no candidate.
- The order's AR is the one with the same job and supplier, if any.

## Create an order

**Before**: read the job lines and the job's existing orders. A line whose
selected candidate is already on an order can't be ordered again. Supplier
is the selected candidate's supplier (APS unless Chris chose another).

```sql
SET app.actor TO 'rosie';
SELECT public.create_order(
  $jobId, $supplierId, ARRAY[$lineId, $lineId]::bigint[],
  $fulfillmentMethod, $noteForSupplier, $noteForCustomer
);
```

- Order only with the customer's commitment (Chris relaying it counts).
  Order exactly the lines committed to.
- Every line must have that supplier's selected candidate. Each becomes one
  row with the candidate's name, size, price, status (`can_order` →
  `need_to_order`, NULL → `pending`), LPS's ask (`note_for_supplier`), the
  supplier's reply (`note_from_supplier`) and the effective customer note.
  Quantity = what the job line shows available (capped at its Qty), else its
  Qty; a line with neither is refused. Unpriced or unanswered lines can be
  ordered; fix them on the order afterwards.
- If the job already has an open order with that supplier, the lines are
  added to it and the method and notes are ignored. Otherwise a new order
  starts **New** with them. The job becomes **Committed**.
- Method (`pickup`/`delivery`) only when known; else NULL. The supplier sets
  the fulfillment date when confirming. Never copy the job's EDD into it.
- Don't create, answer or submit an AR just to make an order possible, and
  don't invent supplier answers or dates.

**After**: verify the order, its rows and the job stage. After an unclear
result, check the job's orders before retrying. Tell the supplier from this
thread (`supplier-coordination` → orders). The order showing in the portal
needs no further approval; an email or customer message still needs its own.

## Supplier confirms

`confirm_order(orderId, supplierId, confirmationDate, fulfillmentDate)` moves
the order New → **Processing** and saves the dates. `update_partner_order`
moves it to **Order Ready**. The job stays **Committed** (jobs have no
Confirmed stage). An AR submission is not an order confirmation. If the
supplier confirmed in the portal, it's already saved; just re-read. Resolve
partial or unclear confirmations before recording them. Relay the new order
status and date to every linked job.

## Change a placed order

Any change after creation (rows, quantities, prices, statuses, dates,
method, instructions) — from Chris, a customer relay or a supplier event:

- Row values: plain `UPDATE order_items` (name, size, quantity, unit_price,
  notes); status with `update_partner_order_item(order, supplier, row,
  status[, note_from_supplier])`. A new row: `INSERT INTO order_items
  (order_id, name, size, quantity, unit_price, status)` (no candidate).
  Remove a row: `delete_order_item(order, row)` (an emptied order goes too).
  None of these change the candidate or the job line.
- A supplier's reply given by email goes in `note_from_supplier` on the row
  or the order.

1. Re-read the order, rows and recent changes. Know the before
   and after values and who authorized the change. This rule doesn't
   authorize the change itself.
2. Apply only the authorized edit (guarded). Verify. A change someone else
   already saved: just verify it.
3. Add one dated line to the end of `orders.note_for_supplier`, keeping the
   existing text (guarded): `09-22: Wax myrtle 15 G qty 10 → 12; pickup
   09-24 → 09-25.` The supplier sees it, so keep it factual. Don't add it
   twice on retry. (This is the one note that keeps history. There is no
   `orders.notes` column any more.)
4. Tell the supplier in their conversation (`supplier-coordination` →
   orders). You have standing permission for this factual notice; no draft
   approval needed.
5. Done only when the note is saved and the supplier message is confirmed
   sent.

## Record names

Per-job names like `JR-42:AR-1`, `JR-42:Order-1` come from a `record_name`
column (migration 0104). As of 2026-09-25 that column was **not** on the live
database: check `schema` first, and if it's missing refer to records by id
(`AR-45`, order id). When it exists, read it after creation; never compute,
renumber or overwrite it. Shared records keep the
first job's name. Messages to suppliers use the job **name**, not these
numbers (`supplier-coordination`).
