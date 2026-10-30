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
  $jobId, $supplierId, ARRAY[$lineId, $lineId]::bigint[], $additionalDetails::jsonb
);
```

`$additionalDetails` is the JSON field list ([below](#ordersadditional_details)),
dollar-quoted, or NULL.

- Order only with the customer's commitment (Chris relaying it counts).
  Order exactly the lines committed to.
- Every line must have that supplier's selected candidate. Each becomes one
  row with the candidate's name, size, price, status (`can_order` →
  `need_to_order`, NULL → `pending`), LPS's ask (`note_for_supplier`) and the
  supplier's reply (`note_from_supplier`). Orders have no customer note.
  Quantity = what the job line shows available (capped at its Qty), else its
  Qty; a line with neither is refused. Unpriced or unanswered lines can be
  ordered; fix them on the order afterwards.
- If the job already has an open order with that supplier, the lines are
  added to it and `$additionalDetails` is ignored (add a change-log line
  instead). Otherwise a new order starts **New** with them. The job becomes
  **Committed**.
- Pickup/delivery and the target date are the job's (`fulfillment_method`,
  `expected_install_date`); orders have none of their own (0149). Set them on
  the job, before ordering when known.
- Don't create, answer or submit an AR just to make an order possible, and
  don't invent supplier answers or dates.

**After**: verify the order, its rows and the job stage. After an unclear
result, check the job's orders before retrying. Tell the supplier from this
thread (`supplier-coordination` → orders). The order showing in the portal
needs no further approval; an email or customer message still needs its own.

## Additional details and change log

Two order fields the supplier reads; the portal shows each as a collapsed
section (Additional details above the order's rows, the change log below
them). Copy order and the print sheet include the Additional details only.

### `orders.additional_details`

Everything the supplier needs to fulfil the order. Write it with the order
and keep it current. **JSON, never markdown or prose** (0151, Bhoumik: "let
additional details be json"): an ordered list of `{"field", "value"}`
objects, both non-blank text (field ≤ 100, value ≤ 2000 characters), 1–50
of them, nothing else in an object. The list order is the display order.
The database refuses anything else; NULL when there is nothing to say.

```json
[
  {"field": "Customer", "value": "Lake Landscapes"},
  {"field": "Delivery address", "value": "113 Espanola Cove, Austin, TX 78732"},
  {"field": "Delivery contact", "value": "Will Heathcott, will@lakelandscapes.com, 512-350-1358"},
  {"field": "Payment method", "value": "On file"}
]
```

Fields, in this order, each only when known (leave it out rather than
writing "unknown"):

| Field | What |
| --- | --- |
| Customer | Company, else name. Always. |
| Delivery address | Delivery jobs only: the job's shipping address. |
| Delivery contact | Who receives the plants (the customer's contact otherwise), one field: `Name, email, phone` — the parts you have, in that order. |
| Billing contact | Only when someone else handles payment or invoices; same `Name, email, phone`. |
| Payment method | When known. |
| Gate code, Delivery window, Site instructions | Other facts the supplier needs to deliver. |

Don't add fields for pickup/delivery or the target date (the job's), plants,
quantities or prices (the order rows), the change log (its own field),
internal notes, customer prices or the customer's wishes that aren't the
supplier's business. A detail that changes (a new phone, a corrected
address) is updated in place.

### `orders.change_log`

**Material changes only** — what the supplier has to do differently: a
plant added, removed or substituted, a size, quantity or price change,
pickup ↔ delivery, the target date. A bullet list (never a table), one bullet per change,
`- MM/DD: brief change`, newest last; never rewrite older bullets. No
heading. Empty (NULL) until the first material change.

```markdown
- 10/22: Wax myrtle 15 G qty 10 → 12
- 10/23: Added 5 × Texas sage 5 G @ $14
```

Events are not changes and never go in the log: the order being placed,
acknowledged, processing or ready; row status updates; messages or
notices sent; notes; details filled in or corrected.

Edit either guarded with `set-note --table orders --field additional_details`
(the files hold the whole JSON list: read it, change the one field, write it
back in order; no `--append-file`) or `--field change_log`.

## Supplier confirms

`confirm_order(orderId, supplierId[, confirmationDate])` moves the order
New → **Processing** (no date: the target date is the job's EDD). `update_partner_order`
moves it to **Order Ready**, then **Completed** (0154; the supplier's last
step, still open until LPS closes it Won/Lost). The job stays **Committed** (jobs have no
Confirmed stage). An AR submission is not an order confirmation. If the
supplier confirmed in the portal, it's already saved; just re-read. Resolve
partial or unclear confirmations before recording them. Relay the new order
status to the job. A portal confirmation, Order Ready or Completed gets no message
to the supplier.

## Change a placed order

Any change after creation (rows, quantities, prices, statuses, contacts,
instructions, or the job's date or pickup/delivery) — from Chris, a customer
relay or a supplier event:

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
3. A material change ([above](#orderschange_log)): add one bullet to the
   end of `orders.change_log`, keeping the existing text (guarded):
   `- 10/22: Wax myrtle 15 G qty 10 → 12; pickup 10/24 → 10/25`. A contact,
   address or payment change: update its field in
   `orders.additional_details` instead, no log bullet. Events (status,
   acknowledgement, messages) get neither. The supplier sees it, so keep it factual. Don't add it twice on
   retry. (This is the one note that keeps history.)
4. Tell the supplier in their conversation (`supplier-coordination` →
   orders). You have standing permission for this factual notice; no draft
   approval needed. Skip this for a change the supplier made in the portal.
5. Done only when the note is saved and any supplier message is confirmed
   sent.

## Record names

Per-job names like `JR-42:AR-1`, `JR-42:Order-1` come from a `record_name`
column (migration 0104). As of 2026-09-25 that column was **not** on the live
database: check `schema` first, and if it's missing refer to records by id
(`AR-45`, order id). When it exists, read it after creation; never compute,
renumber or overwrite it. Shared records keep the
first job's name. Messages to suppliers use the job **name**, not these
numbers (`supplier-coordination`).
