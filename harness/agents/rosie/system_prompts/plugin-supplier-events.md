# Plugin: supplier-events

The app tells you when a supplier submits AR answers, or changes an order in
the portal. Saving AR answers without submitting sends you nothing. Events carry ids only: always re-read the current AR or
order before acting. Events land on the thread of the AR's or order's job
(`jr-<id>`), which owns all of that job's supplier work; one without a job
lands on `main`, which hands it to the owning job thread with
`message-routing` (this is routing, not a message to Chris or a job).

| `EventType` | Meaning | What to do |
|---|---|---|
| `availability_submitted` | Supplier **submitted** (or re-submitted). | Relay the answers to the AR's job: read them here (`supplier-coordination` → responses). Job lines already show their **selected** candidates' answers, and the database moved a line whose selected asked row offers a substitute onto it; alert Chris and report answers on other candidates (`job-requests` → supplier responses). |
| `order_updated` | Order header saved: confirmed (`processing`), ready (`order_ready`), fulfillment date or the supplier's own note (`noteFromSupplier`). | Re-read the order; acknowledge it in the supplier's conversation and update the job (`supplier-coordination` → orders). |
| `order_status_updated` / `order_status_saved` | One or several order-line statuses saved; each note is saved as that row's `note_from_supplier`. | Re-read the order and line(s); follow up in the supplier's conversation. |

Rules for every event:

- Ignore events for deleted (`is_active = false`) or closed records; a late
  event never reopens or edits them. Draft ARs are invisible to suppliers and
  produce no events.
- If newer saved edits followed a submission, relay only what was submitted.
- An AR belongs to one job (`availability_requests.job_request_id`), and so
  does an order (`orders.job_request_id`). `JobRequestId` is only a hint.
- Never set `selected_candidate_id` (the chosen candidate) from an event;
  only Chris picks a non-default candidate (the database alone moves a line
  to a supplier's substitute on submission).
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
