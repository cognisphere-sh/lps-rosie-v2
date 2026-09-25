## 4. AR state and supplier responses

The shared `note_for_supplier` may already contain the original LPS/customer ask.
Use the actual submitted supplier response and source evidence to identify new
availability facts; seeded instructions alone never prove stock or acceptance.
Preserve still-relevant sourcing requirements when revising the shared note.


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
`availability_requests.note_for_supplier` along with each line's
`availability_request_items.note_for_supplier`; it records
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
| `arriving_soon` | Arriving; ETA in `note_for_supplier`. |
| `diff_size_qty_sub` | Alternative plant/size or quantity; details in `note_for_supplier`. |
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
to the submitted header and line `note_for_supplier`: brief current supplier,
price and actual received response go in `note_internal`; customer-useful
information goes in `note_for_customer`. Split mixed content, preserve
customer-origin and unrelated notes, and keep uncertain audience/offer
applicability internal. Route request-wide conditions to the applicable jobs
and line details to the linked items, respecting each allocation.

For a submitted `diff_size_qty_sub` line, relay the supplier's *actual* offered
alternative size/quantity/variant and price evidence without changing the
customer's original demand. For an unambiguous `available` answer, do not seek
an extra APS confirmation merely to repeat the answer; send the actual submitted
facts and linked allocations to the job owner. Chris confirmed Carolina Cherry
Laurel 24-inch box as equivalent to 30 G (JR-78 webchat messages 33–34,
2026-09-24): flag this narrow equivalence in the relevant handoff rather than
raising an artificial size conflict. Do not generalize it to other plants or
assume a shared supplier quantity belongs to each linked job.

On the verified **first explicit APS submission**, identify this
standing-authority scope in the handoff so the job thread follows
its [first-APS-submission path](../../job-requests/artifacts/supplier-responses.md)
without another approval question for supported linked status, bounded
quantity, customer-safe note and alternative-offering price updates. Verify it
is genuinely the first submission rather than relying on a stale
`submitted_at`; include allocation shares and whether quantity/price applies
to each item, and flag ambiguous cases for a narrow hold. On later submissions
or other suppliers, follow the ordinary
[Diff Size/Qty/Variant path](../../job-requests/artifacts/supplier-responses.md):
update only current JR evidence/notes, search for the alternative's supported
price, then ask Chris whether to use it. If no reliable price exists, the job
thread must obtain Chris's **specific approval** before this supplier thread
asks for the alternative price. On approval, verify the current AR/line and
contact context, ask only for the identified alternative's price through the
approved supplier channel, and relay the answer to the job thread; neither the
supplier's different offering nor a price answer authorizes a job-line change.
Unsubmitted edits do not start this path or authorize outreach.

The job thread also posts a concise internal alert to Chris with the business
result and next action, linking `[Open AR-<id>](ar:<id>)` when useful. Do not
restate response quantities/prices already visible in the AR/job; use top-down
bullets if multiple independent decisions or exceptions require attention.
Editing a Completed request returns it to Processing until the supplier
submits again. These supplier-entered portal changes remain as saved; Rosie
reports them without overwriting them. Except for Chris's narrowly scoped
first-APS-submission standing instruction or his separate explicit instruction
for the affected submission and fields, a response does **not** authorize
Rosie to change job/item availability or status, available quantities, selected
supplier or the customer-facing offering. Chris's JR-78 direction to use the
APS response as-is for that request and “Always do this” establish a practice
of not re-asking about clear available answers, not blanket write authority
for later submissions, other suppliers or unrelated jobs. Relay any explicit
scoped instruction to the job owner with its source; only the job owner makes
supported updates after a fresh match and preserving customer constraints.
A customer-facing note can describe a verified proposed alternative under that first-submission instruction, but
must not present it as accepted or turn an unselected supplier's terms into
accepted customer terms. Surface only the material next action to Chris, using
bullets for multiple points rather than restating job details or the full AR
response. Replace superseded note facts; keep suppliers distinct and preserve
Chris's current selection without copying message history. A selected supplier
is not inferred from availability, price or submission. No automatic customer
message or acceptance follows. For a verified first APS submission Chris's
standing instruction supplies this scoped approval; otherwise, if Chris
expressly approves changing a linked job item in response to `can_order`, relay
the exact job-item scope to its job thread: displayed Can Order is schema-valid
`need_to_order`, and that same job-item update must set `available_quantity` to
the approved whole-line demand or explicitly approved allocation. A shared supplier total is never copied to every linked job item.
A response can supersede catalogue evidence in notes, but an unmentioned seeded
price is not newly confirmed by a chat.
