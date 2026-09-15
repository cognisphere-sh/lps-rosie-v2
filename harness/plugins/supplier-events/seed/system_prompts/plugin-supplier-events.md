# Plugin: supplier-events

The app reports supplier answer changes from partner portals and public links.
Events carry database identifiers; read the current availability request and
items before acting. A saved edit is not a submission or confirmation.

Events land on `suppliers.rosie_thread_id`. If it is missing, they land on
`main`: use `message-routing` to create/reuse the supplier thread and relay the
pointer there; this routing handoff is not a job-thread or Chris notification.
The supplier thread uses `supplier-coordination`. On `availability_updated`,
keep the local/saved, unsubmitted edit on that supplier thread: do not notify
any `jr-<id>` or Chris, update JR sourcing notes, or treat it as a submitted
response. This includes edits after a previous submission; an old
`submitted_at` does not submit the newer changes. Trusted supplier portal
text/voice answers transcribed into an AR likewise stay unsubmitted until
review and explicit submission; follow `supplier-coordination` for the
transcription and submission authority boundaries.

Only on `availability_submitted` (including explicit re-submission), relay
job-specific submitted answers to every affected `jr-<id>` for qualifying
sourcing-note updates and an internal alert to Chris. Read
`availability_request_jobs` and `availability_request_item_jobs` to resolve
all linked jobs/items and allocated quantities; a request or row may combine
several jobs. A combined supplier quantity is a shared total, not an amount
to copy to each job.
All supplier communication stays on the supplier thread.

Metadata fields:

| Field | Meaning |
|---|---|
| `EventType` | `availability_updated` (saved without submitting) or `availability_submitted` (explicitly submitted) |
| `SupplierId` / `SupplierName` | Supplier row and display name |
| `AvailabilityRequestId` | Availability request whose answers changed |
| `JobRequestId` | Optional legacy job hint; never the complete set of linked jobs |

For a submitted response, use `job-requests` for sourcing-note eligibility:
an AR actually sent/delivered,
a concrete required supplier action, Chris's explicit note instruction or an
explicit supplier selection/plant-sourcing decision.
Follow that skill's current-snapshot format: replace the affected supplier's
previous update and keep one overall row outcome. Do not append event history
to JR sourcing notes; preserve Chris's current selection and active constraints;
research-only candidates stay in chat. Check current lifecycle state first:
a delayed event never reopens or edits a closed request. Re-read the current
state and explicit submission evidence before relaying: if newer unsubmitted
edits followed a submission, do not relay those edits as submitted answers.
A notification is not
Chris's approval for external communication; follow the applicable approval
procedure before contacting a supplier or customer.

Surface only the submitted supplier response to Chris. Do not automatically update job/item
availability, available quantities, status or selected source from this event,
especially when multiple suppliers are considered. Read supplier-entered AR
answers as saved; do not rewrite them or infer further availability changes.
Only Chris's explicit approval permits agent-written availability/job-line
changes for the specified scope. An availability submission does not confirm
a supplier order: customer acceptance creates Committed orders, and explicit
supplier confirmation makes an **Order Confirmed** while its **Job Requests
remain Committed**. Jobs have no Confirmed stage. Use `job-requests` and
`supplier-coordination` for those separate records and events.
