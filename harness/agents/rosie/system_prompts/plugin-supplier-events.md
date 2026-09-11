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

Keep sourcing notes current for each supplier considered on each plant; use
one concise structured row per supplier. Check current lifecycle state first:
a delayed event never reopens or edits a closed request. A notification is not
Chris's approval for external communication; follow the applicable approval
procedure before contacting a supplier or customer.
