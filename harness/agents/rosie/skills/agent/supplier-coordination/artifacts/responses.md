## 4. AR state and supplier responses

| Display | Stored state | Meaning |
|---|---|---|
| New | `new` | Created, no supplier work yet. |
| Processing | `processing` | Partial/unsent supplier work. |
| Completed | `submitted` | Supplier submitted the response. |
| Closed | `closed` | Job/request closed; public and private supplier edits forbidden. |

Listen for both `availability_updated` (draft/edit) and
`availability_submitted` (explicit submission). Re-read request/items on each
event to maintain safe current context. Ignore events for deleted requests
(`is_active=false`). A **local/saved, unsubmitted edit
stays on this supplier thread**: do not notify any job thread or Chris, update
job/item `note_internal` or `note_for_customer`, or treat it as a response. Relay only an explicit
submission and only its actual saved answers. Include the saved request-wide
`availability_requests.note_from_supplier` along with each line's
`availability_request_items.note_from_supplier`; it records
supplier conditions for the whole AR and is separate from LPS instructions.
Relay its applicable context to each linked job without turning it into a
line-level availability change. A saved price or note is supplier
work but is not submission. Inventory prefill is neither supplier work nor an
answer. Preserve `submitted_at` as the latest explicit submission evidence. An AR
shared across jobs stays open for its remaining open jobs. Reissue
a fresh public token through the normal publication path when a link is
needed after explicit AR reopening; reopening a job never reopens its ARs.
Do not reuse a token revoked by closure or a switch to private.

Deletion is separate from workflow status. For an explicitly requested AR
deletion, set only `availability_requests.is_active=false`; keep `status`,
`submitted_at`, `public_token`, lines and answers unchanged. Do not use `hidden`
or write the removed closure-history columns. Verify the AR is inactive and
absent from active views. Its saved token provides no access while deleted.
Restore an AR only on explicit instruction after checking its linked jobs and
supplier; restoring `is_active=true` retains its saved state and sharing setting.

| Supplier item status | Response |
|---|---|
| `available` | Has the requested plant/size/quantity; its saved `available_quantity` is the AR item's authoritative allocated demand total. |
| `can_order` | Can source/order; becomes `need_to_order` (Need to Order) on a committed order row. |
| `arriving_soon` | Arriving; ETA in `note_from_supplier`. |
| `diff_size_qty_sub` | Alternative plant/size or quantity; details in `note_from_supplier`. |
| `unavailable` | Cannot supply. |
| NULL | Unanswered. |

For every **explicit supplier submission**, first establish a safe match to
the AR and every affected request item via `availability_request_item_jobs` and
`availability_request_jobs`. Relay a **factual, contextual response** to each
linked `jr-<job_request_id>`: AR id/state, job id, allocated quantity, combined
supplier quantity, supplier name/id, each requested plant and size (plus item
id), the stated response, quantity, supplier price, mapping, short
qualification and source (`portal submission`). Include whether it is partial
or submitted. If the submission cannot be safely tied to an AR/item/job or the
supplier's plant context is ambiguous, do not guess or write a sourcing entry:
flag it for Chris's review with the ambiguity and source instead.

The job thread applies [job note audiences](../../job-requests/artifacts/notes.md)
to the submitted header and line `note_from_supplier`: internal progress and
follow-ups go in `note_internal`; information intended for the customer goes
in `note_for_customer`. Split mixed content, preserve customer-origin and unrelated
notes, and keep uncertain audience/offer applicability internal. Route
request-wide conditions to the applicable jobs and line details to the linked
items, respecting each allocation. The job thread also posts a concise internal
alert to Chris naming the supplier, affected plants and source; it may link
`[Open AR-<id>](ar:<id>)`. A useful shape is:
`APS — Live Oak 15 G: 12 available at $105 (portal submission, AR-42).`
Editing a Completed request returns it to Processing until the supplier
submits again. These supplier-entered portal changes remain as saved; Rosie
reports them without overwriting them. A response does **not** authorize Rosie
to change job/item availability or status, available quantities, selected
supplier or the customer-facing offering. A customer-facing note must not offer
an unapproved alternative or turn an unselected supplier's terms into accepted
customer terms. Surface the response to Chris and update notes by audience
without duplicating visible prices or AR/order statuses. Replace superseded facts; keep suppliers
distinct and preserve Chris's current selection without copying the message
history into the notes. A selected supplier is not inferred from availability,
price or submission. No automatic customer message or acceptance follows. If
Chris expressly approves changing a linked job item in response to `can_order`,
relay the exact job-item scope to its job thread: displayed Can Order is
schema-valid `need_to_order`, and that same job-item update must set
`available_quantity` to the approved whole-line demand or explicitly approved
allocation. A shared supplier total is never copied to every linked job item.
A response can supersede catalogue evidence in notes, but an unmentioned seeded
price is not newly confirmed by a chat.
