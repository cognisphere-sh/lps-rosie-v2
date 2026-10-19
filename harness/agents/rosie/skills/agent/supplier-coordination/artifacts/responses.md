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

## Supplier answers in portal chat (transcription)

A trusted supplier's **portal** message (text, image or voice, or answers to
a [quick-questions](questions.md) questionnaire) that clearly answers an open
AR line (candidate) lets you type that answer into the AR for them.

1. Identify the AR from trusted metadata and read it with its job.
   Several possible ARs → ask which one. Closed AR → don't edit; record the
   message in the job's chat.
2. Take only what the message says. A photo without quantity or price gives
   neither.
3. Voice note or chat answer: first reply `--portal` "Thanks — I'll enter
   that for you now." Then write it:

   ```sql
   SET app.actor TO 'rosie';
   SELECT public.answer_availability_request(
     $arId, $supplierId, $candidateId,
     '{"status":"available","unit_price":"12.00"}'::jsonb,
     false
   );
   ```

   Values are strings; `""` clears a field. Payload per answer:

   | Answer | Changes |
   |---|---|
   | Available | `{"status":"available"}` (the database sets quantity = demand; empty demand → don't mark it, ask) |
   | Partial Qty (fewer than asked) | `{"status":"partial_qty","available_quantity":"6"}` |
   | Unavailable, no substitute | `{"status":"unavailable","offered_candidate_id":"","offer_description":""}` |
   | Another size or plant, one of that supplier's candidates on the line | `{"status":"diff_size_sub","offered_candidate_id":"<id>","note_from_supplier":"<their words>"}` |
   | Another size or plant, none matches | `{"status":"diff_size_sub","offered_candidate_id":"","offer_description":"<text>","note_from_supplier":"<text>"}` (creates the placeholder at once) |

   Add `unit_price` and `note_from_supplier` when given; on a row with a
   substitute they go to the substitute. `unavailable` zeroes the quantity,
   never the price; `{"status":"unavailable"}` alone keeps a substitute
   already offered; `diff_size_sub` without a substitute is refused. Answer
   the asked row, never the substitute's own row. A candidate asked on this
   AR in its own right can't be picked as a substitute (refused): answer it
   on its own row. Don't send
   `offer_unit_price` / `offer_quantity` (ignored). The supplier's words go
   in `note_from_supplier`; LPS's ask stays in `note_for_supplier`.
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
