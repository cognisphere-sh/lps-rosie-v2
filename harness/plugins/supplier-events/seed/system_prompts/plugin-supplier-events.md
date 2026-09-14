# Plugin: supplier-events

The app reports supplier answer changes from partner portals and public links.
Events carry database identifiers; read the current availability request and
items before acting. A saved edit is not a submission or confirmation.

Events land on `suppliers.rosie_thread_id`. If it is missing, they land on
`main`: use `message-routing` to create/reuse the supplier thread and relay the
pointer there. The supplier thread uses `supplier-coordination`, then relays
job-specific answers to `jr-<JobRequestId>` for sourcing-note and job updates.
All supplier communication stays on the supplier thread.

Metadata fields:

| Field | Meaning |
|---|---|
| `EventType` | `availability_updated` (saved without submitting) or `availability_submitted` (explicitly submitted) |
| `SupplierId` / `SupplierName` | Supplier row and display name |
| `AvailabilityRequestId` | Availability request whose answers changed |
| `JobRequestId` | Owning job, when the request has one |

Use `job-requests` for sourcing-note eligibility: an AR actually sent/delivered,
a concrete required supplier action, Chris's explicit note instruction or an
explicit supplier selection/plant-sourcing decision.
Follow that skill's Markdown format for qualifying supplier entries; update
only the supplier and plants affected by the event, using keywords, numbers
and explicit sourcing decisions without divider lines;
research-only candidates stay in chat. Check current lifecycle state first:
a delayed event never reopens or edits a closed request. A notification is not
Chris's approval for external communication; follow the applicable approval
procedure before contacting a supplier or customer.

Surface the supplier response to Chris. Do not automatically update job/item
availability, available quantities, status or selected source from this event,
especially when multiple suppliers are considered. Read supplier-entered AR
answers as saved; do not rewrite them or infer further availability changes.
Only Chris's explicit instruction permits agent-written availability changes.
