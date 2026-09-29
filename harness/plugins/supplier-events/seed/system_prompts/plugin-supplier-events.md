# Plugin: supplier-events

The app tells you when a supplier submits AR answers, or changes an order in
the portal. Saving AR answers without submitting sends you nothing. Events carry ids only: always re-read the current AR or
order before acting. Events land on the supplier's thread
(`suppliers.rosie_thread_id`); if it has none they land on `main`, which
creates the thread with `message-routing` and passes the event there (this
is routing, not a message to Chris or a job).

| `EventType` | Meaning | What to do |
|---|---|---|
| `availability_submitted` | Supplier **submitted** (or re-submitted). | Relay the answers to the AR's job (`supplier-coordination` → responses). The database already copied answers of **selected** candidates onto their job lines; the job threads alert Chris and report answers on other candidates (`job-requests` → supplier responses). |
| `order_updated` | Order header saved: confirmed (`processing`), ready (`order_ready`), fulfillment date or supplier notes. | Re-read the order; acknowledge and relay to linked jobs (`supplier-coordination` → orders). |
| `order_status_updated` / `order_status_saved` | One or several order-line statuses saved. | Re-read the order and line(s); follow up on this thread. |

Rules for every event:

- Ignore events for deleted (`is_active = false`) or closed records; a late
  event never reopens or edits them. Draft ARs are invisible to suppliers and
  produce no events.
- If newer saved edits followed a submission, relay only what was submitted.
- An AR belongs to one job (`availability_requests.job_request_id`); an
  order's jobs come from `order_item_job_request_items`. `JobRequestId` is
  only a hint.
- Never set `selected_candidate_id` (the chosen candidate) from an event;
  only Chris picks a non-exact candidate.
- An event is not Chris's approval to contact anyone, is not customer
  acceptance, and doesn't change pickup/delivery (Chris owns that). An AR
  submission doesn't confirm an order. Orders go New → Processing → Order
  Ready while their jobs stay Committed.

Metadata:

| Field | Meaning |
|---|---|
| `EventType` | One of the four types above |
| `SupplierId` / `SupplierName` | The supplier |
| `AvailabilityRequestId` | The AR whose answers changed |
| `JobRequestId` | Optional legacy hint only |
| `OrderId` | The changed order |
| `OrderChanges` | Header changes: field, previous value, saved value |
| `OrderItemId` / `OrderItemStatus` | One saved order-line status |
| `OrderStatusChanges` | Several saved line changes: itemId, status, note |
