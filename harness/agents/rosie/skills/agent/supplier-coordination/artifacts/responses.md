# Supplier answers on ARs

## AR states

| Shown as | Stored | Meaning |
|---|---|---|
| Draft | `draft` | Being prepared by LPS; the supplier can't see or answer it. Only Rosie sends it (`send_availability_request`) → New. |
| New | `new` | Sent; supplier hasn't touched it. |
| Processing | `processing` | Supplier saved some answers, not submitted. |
| Completed | `submitted` | Supplier pressed Submit. Editing again returns it to Processing until re-submitted. |
| Closed | `closed` | Job/AR closed; nobody can edit. |

| Line answer `status` | Meaning |
|---|---|
| `available` | Has the requested plant, size and quantity. Its `available_quantity` = the candidate's `demanded_quantity`. |
| `partial_qty` | Partial Qty: the requested plant and size, fewer than demanded (`available_quantity`). |
| `can_order` | Can get it. Becomes `need_to_order` on an order line. |
| `arriving_soon` | Coming; ETA in the note. |
| `diff_size_qty_sub` | Diff Sz/Sub: the asked one is unavailable (0/0) and the supplier names a substitute, either another candidate of the line (`offered_candidate_id`, a tag) or a typed one (`offer_description`), with `offer_unit_price` and `offer_quantity`. On submission a tag becomes Available on this AR. The candidate's own size never changes. Older answers without a substitute rewrote size and price. |
| `unavailable` | Can't supply. Quantity and price are set to 0. Unavailable with a substitute is saved as Diff Sz/Sub. |
| NULL | Not answered. A seeded price alone is not an answer. |

## Events

Always re-read the AR and its lines. Ignore inactive ARs (`is_active =
false`).

- `availability_updated` (a saved edit): **stays on this supplier thread.**
  Don't tell Chris or any job, and don't touch job notes. This includes edits
  after an earlier submission; the old `submitted_at` doesn't cover them.
- `availability_submitted` (Submit or re-Submit): relay to the AR's job
  (`availability_requests.job_request_id`).

## Relay a submission

1. Match each line (candidate) to its job line through the candidate's
   `job_request_item_id` (`ar-snapshot`). A line with no job line (its job was
   deleted) is history only.
2. Send the job's `jr-<id>` the facts for its candidates: AR id and state,
   candidate and job line ids, whether the candidate is selected, the plant
   and size asked, the answer (status, quantity, size, price, mapping), the
   header `note_for_supplier`, the candidate's `note_for_supplier` (LPS ask)
   and `note_from_supplier` (reply), and "portal submission" as the source.
   For `diff_size_qty_sub`, give the substitute (the tag's description, or
   the typed `offer_description`) with its price and quantity; say which
   typed ones the job thread must turn into candidates. Mention narrow equivalences
   from `price-rules.md` (e.g. Carolina Cherry Laurel 24" box = 30 G). Flag
   an answer whose status, size or quantity disagrees with its note (or a
   note size without a price) as **conflicting**, with the note's reading;
   the job thread settles it with Chris.
3. Selected candidates are already copied onto their job lines by the
   database. The job thread alerts Chris
   ([supplier responses](../../job-requests/artifacts/supplier-responses.md)).
   Don't ask APS to re-confirm a clear answer.
4. Supplier-entered answers stay as the supplier saved them. Never rewrite
   them, except the job thread's correction of a conflicting answer to match
   its note, with Chris's yes (`job-requests` → supplier responses).

## Supplier answers in portal chat (transcription)

A trusted supplier's **portal** message (text, image or voice, or answers to
a [quick-questions](questions.md) questionnaire) that clearly answers an open
AR line (candidate) lets you type that answer into the AR for them.

1. Identify the AR from trusted metadata and read it with its job.
   Several possible ARs → ask which one. Closed AR → don't edit; record the
   message and tell the job thread.
2. Take only what the message says. A photo without quantity or price gives
   neither.
3. Voice note or chat answer: first reply `--portal` "Thanks — I'll enter
   that for you now." Then write it:

   ```sql
   SET app.actor TO 'rosie';
   SELECT public.answer_availability_request(
     $arId, $supplierId, $candidateId,
     '{"status":"available","available_quantity":"<demanded quantity>","unit_price":"12.00"}'::jsonb,
     false
   );
   ```

   Values are strings; `""` clears a field; keys are only `status`,
   `available_quantity`, `unit_price`, `note_from_supplier`,
   `offered_candidate_id`, `offer_description`, `offer_unit_price`,
   `offer_quantity` (`unavailable` zeroes quantity and price). For
   `available`, the quantity is the candidate's `demanded_quantity`; if that
   is empty, don't mark it available, ask. Fewer than asked → `partial_qty`
   with their quantity. Another size or plant → `unavailable` plus the
   substitute: `offered_candidate_id` when it matches one of that supplier's
   candidates on the line, else `offer_description` (`diff_size_qty_sub`
   without a substitute is refused). The supplier's words go in `note_from_supplier`;
   LPS's ask stays in `note_for_supplier`.
4. Verify, then reply `--portal`: "Please review and tap **Submit**." Never
   say it was submitted. If the match was unsafe, ask the supplier which line
   they mean instead of writing.
5. It stays a saved draft until the supplier submits. Submit it yourself
   (`p_submit = true`, NULL item and changes) only when Chris tells you to.
   "I'm done" from the supplier is not that instruction.

A supplier's request-wide note is saved (and the AR submitted) with
`submit_availability_request_note(arId, supplierId, note)`; use it only when
Chris tells you to submit.

Email or other non-portal answers are evidence only: report them; write them
into the AR only when Chris says so.
