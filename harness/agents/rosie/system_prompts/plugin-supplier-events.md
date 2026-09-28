# Plugin: supplier-events

The app reports supplier answer changes from partner portals and public links.
Events carry database identifiers; read the current availability request and
items before acting. A saved edit is not a submission or confirmation.

An `order_updated` event means APS/the supplier saved order header changes:
confirmation (`processing`), ready (`order_ready`), fulfillment date or supplier
notes. This wakes Rosie in the same supplier/order chat thread used for order
coordination. Re-read the order; follow `supplier-coordination` and `job-requests`
for the brief order note, acknowledgment and affected-job relays. Never replay
the update or infer customer acceptance from this event.

An `order_status_saved` event contains a batch of saved line statuses and notes.
An `order_status_updated` event means the supplier explicitly saved a line
status on an order. Keep this update on that supplier's order thread: read the
current order and line before coordinating any follow-up. It is not approval to
change Pickup/Delivery (Chris owns that arrangement) or to make unrelated job
changes.

Events land on `suppliers.rosie_thread_id`. If it is missing, they land on
`main`: use `message-routing` to create/reuse the supplier thread and relay the
pointer there; this routing handoff is not a job-thread or Chris notification.
The supplier thread uses `supplier-coordination`. On `availability_updated`,
keep the local/saved, unsubmitted edit on that supplier thread: do not notify
any `jr-<id>` or Chris, update job/item internal or customer-facing notes, or treat it as a submitted
response. This includes edits after a previous submission; an old
`submitted_at` does not submit the newer changes. Trusted supplier portal
text/voice answers transcribed into an AR likewise stay unsubmitted until
review and explicit submission; follow `supplier-coordination` for the
transcription and submission authority boundaries.

Only on `availability_submitted` (including explicit re-submission), relay
job-specific submitted answers and header/line `note_for_supplier` to every
affected `jr-<id>` for note updates by audience and an internal alert to Chris. Read
`availability_request_jobs` and `availability_request_item_jobs` to resolve
all linked jobs/items and allocated quantities; a request or row may combine
several jobs. A combined supplier quantity is a shared total, not an amount
to copy to each job.
All supplier communication stays on the supplier thread.

Metadata fields:

| Field | Meaning |
|---|---|
| `EventType` | `availability_updated`, `availability_submitted`, `order_updated`, `order_status_updated` or `order_status_saved` |
| `OrderId` | Changed order; read its current rows and allocations |
| `OrderChanges` | Header changes: field, previous value and saved value |
| `OrderItemId` / `OrderItemStatus` | Single saved order-line status |
| `OrderStatusChanges` | Batch of saved line changes: itemId, status and note |
| `SupplierId` / `SupplierName` | Supplier row and display name |
| `AvailabilityRequestId` | Availability request whose answers changed |
| `JobRequestId` | Optional legacy job hint; never the complete set of linked jobs |

For a submitted response, `job-requests` owns job/item note audiences:
internal sourcing progress goes in `note_internal`; information meant for the
customer goes in `note_for_customer`. Split mixed supplier notes and keep
job-wide versus line-specific scope. Preserve customer-origin notes, unrelated
external notes, Chris's selection and active constraints; replace superseded
facts without appending event history. Check current lifecycle state first:
a delayed event never reopens or edits a closed or deleted (`is_active=false`) request. Re-read the current
state and explicit submission evidence before relaying: if newer unsubmitted
edits followed a submission, do not relay those edits as submitted answers.
A notification is not
Chris's approval for external communication; follow the applicable approval
procedure before contacting a supplier or customer.

Surface only the submitted supplier response to Chris. Do not automatically update job/item
availability, available quantities, status or selected source
(`selected_availability_request_item_id`) from this event,
especially when multiple suppliers are considered. Read supplier-entered AR
answers as saved; do not rewrite them or infer further availability changes.
Only Chris's explicit approval permits agent-written availability/job-line
changes for the specified scope. An availability submission does not confirm
a supplier order: customer acceptance creates New orders, and explicit
supplier confirmation makes an **Order Processing** while its **Job Requests
remain Committed**. Jobs have no Confirmed stage. Use `job-requests` and
`supplier-coordination` for those separate records and events.
