# Supplier answers on ARs

## AR states

| Shown as | Stored | Meaning |
|---|---|---|
| Draft | `draft` | Being prepared by LPS; the supplier can't see or answer it. Only Rosie sends it (`send_availability_request`) → New. |
| New | `new` | Sent; supplier hasn't touched it. |
| Processing | `processing` | Supplier saved some answers, not submitted. |
| Completed | `submitted` | Supplier pressed Submit. Editing again returns it to Processing until re-submitted. Only `reopen_availability_request` (LPS, explicit) returns it to New. |
| Closed | `closed` | Job/AR closed; nobody can edit. |

| Line answer `status` | Meaning |
|---|---|
| `available` | Has the requested plant, size and quantity. The database sets `available_quantity` = the demand (below the demand it is `partial_qty`). |
| `partial_qty` | Partial Qty: the requested plant and size, fewer than demanded (`available_quantity`). |
| `can_order` | Can get it. Becomes `need_to_order` on an order line. |
| `arriving_soon` | Coming; ETA in the note. |
| `unavailable` | Unavailable or Diff Sz/Sub in the portal (separate picker options since 2026-10-05). Can't supply: quantity 0; the price stays (no status changes a price). With `offered_candidate_id` it names a substitute (a ticked candidate of the line, or a typed placeholder created with the raw text as its name) and the row reads **Diff Sz/Sub**, showing the substitute's price, quantity and note. |
| `diff_size_sub` | The substitute itself (Diff Sz/Sub): its own price, the demanded quantity, the supplier's reply as its note; linked to this AR but not listed as its own row. Older answers without a substitute also carry it. |
| NULL | Not answered. A seeded price alone is not an answer. |

## Rosie Submit/re-submit approval

Before every Rosie-initiated Submit or re-submit, obtain Chris's explicit
confirmation in the job chat. An approved edit, correction or enrichment
never implies approval to re-submit. Example: “May I re-submit AR-77?”
Wait for his yes; do not ask the supplier to Submit as a workaround.
Supplier-initiated native form submissions remain their own actions.

## Events

Always re-read the AR and its lines. Ignore inactive ARs (`is_active =
false`).

- `availability_updated` (a saved edit) never reaches you. Saves aren't
  answers: don't tell Chris or touch job notes about them. This includes
  edits after an earlier submission; the old `submitted_at` doesn't cover
  them.
- `availability_submitted` (Submit or re-Submit) lands on the AR's job thread
  (`availability_requests.job_request_id`).

## Read a submission

1. Match each line (candidate) to its job line through the candidate's
   `job_request_item_id` (`ar-snapshot`); every candidate has one (0139).
2. Collect the facts for its candidates: AR id and state,
   candidate and job line ids, whether the candidate is selected, the plant
   and size asked, the answer (status, quantity, size, price, mapping), the
   header `note_for_supplier`, the candidate's `note_for_supplier` (LPS ask)
   and `note_from_supplier` (reply), and "portal submission" as the source.
   For an answer with a substitute, give the substitute candidate (description,
   price, quantity; `ar-snapshot` still lists it) and say which were typed, so the job thread enriches them. Mention narrow equivalences
   from `price-rules.md` (e.g. Carolina Cherry Laurel 24" box = 30 G). Flag
   an answer whose status, size or quantity disagrees with its note (or a
   note size without a price) as **conflicting**, with the note's reading;
   the job thread settles it with Chris.
3. Job lines already show their selected candidates' answers, and the
   database moved a line whose selected asked row offers a substitute onto
   that substitute. The job thread alerts Chris
   ([supplier responses](../../job-requests/artifacts/supplier-responses.md)).
   Don't ask APS to re-confirm a clear answer.
4. Supplier-entered answers stay as the supplier saved them. Never rewrite
   them, except the job thread's correction of a conflicting answer to match
   its note, with Chris's yes (`job-requests` → supplier responses).

## Supplier availability updates in chat

A supplier's chat update is evidence to relay, not permission to change an
AR or job. This includes text, images, voice and quick-question answers.

1. Read the message and current job/AR; identify the plant, size and scope.
2. Acknowledge with a simple text, such as “Thanks for confirming.” Do not
   ask the supplier to review or Submit, and do not enter the answer yet.
3. Relay the supplier's exact answer and relevant current values to the
   owning job thread. Ask Chris there to confirm the proposed AR/JR update
   before writing anything based on the response. Example: “APS says 1 G
   Russian Sage is available. May I update the AR/JR?”
4. After Chris confirms, re-read the records and apply only his approved
   changes using the supported answer/line helpers. Verify and report in the
   job chat. Changing a selection, price or quantity needs that scope in his
   confirmation; never infer it from the supplier's reply.
5. Submit and re-submit on the supplier's behalf both require Chris's
   explicit confirmation, separately from approval to update the answer.
   Closed records remain read-only; report the response instead.

This approval gate also covers follow-up corrections based on chat updates;
a clear answer is not an exception. Native supplier form submissions remain
supplier-entered answers and follow the submission flow above.

Email answers are likewise evidence only; confirm with Chris in the job
thread before updating an AR or JR.
