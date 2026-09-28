# Supplier answers on ARs

## AR states

| Shown as | Stored | Meaning |
|---|---|---|
| New | `new` | Created; supplier hasn't touched it. |
| Processing | `processing` | Supplier saved some answers, not submitted. |
| Completed | `submitted` | Supplier pressed Submit. Editing again returns it to Processing until re-submitted. |
| Closed | `closed` | Job/AR closed; nobody can edit. |

| Line answer `status` | Meaning |
|---|---|
| `available` | Has the requested plant, size and quantity. Its `available_quantity` = the line's total allocated demand. |
| `can_order` | Can get it. Becomes `need_to_order` on an order line. |
| `arriving_soon` | Coming; ETA in the note. |
| `diff_size_qty_sub` | Offers another size, quantity or plant; details in the note. |
| `unavailable` | Can't supply. |
| NULL | Not answered. A seeded price alone is not an answer. |

## Events

Always re-read the AR and its lines. Ignore inactive ARs (`is_active =
false`).

- `availability_updated` (a saved edit): **stays on this supplier thread.**
  Don't tell Chris or any job, and don't touch job notes. This includes edits
  after an earlier submission; the old `submitted_at` doesn't cover them.
- `availability_submitted` (Submit or re-Submit): relay to every linked job.

## Relay a submission

1. Match the AR and every line to its job lines through
   `availability_request_jobs` and `availability_request_item_jobs`. If a
   line can't be matched safely, don't guess: flag it to Chris with the
   reason.
2. Send each linked `jr-<id>` the facts for its lines: AR id and state, job
   line id, requested plant/size, this job's allocation and the shared total,
   APS's answer (status, quantity, price, mapping), the header and line
   `note_for_supplier`, and "portal submission" as the source. For
   `diff_size_qty_sub`, give the exact offer. Mention narrow equivalences from
   `price-rules.md` (e.g. Carolina Cherry Laurel 24" box = 30 G) so the job
   thread doesn't raise a false size conflict.
3. The job thread applies it
   ([supplier responses](../../job-requests/artifacts/supplier-responses.md))
   and alerts Chris. Don't ask APS to re-confirm a clear answer.
4. Supplier-entered answers stay as the supplier saved them. Never rewrite
   them.

## Supplier answers in portal chat (transcription)

A trusted supplier's **portal** message (text, image or voice) that clearly
answers an open AR line lets you type that answer into the AR for them.

1. Identify the AR from trusted metadata and read it with its linked jobs.
   Several possible ARs → ask which one. Closed AR → don't edit; record the
   message and tell the job thread.
2. Take only what the message says. A photo without quantity or price gives
   neither.
3. Voice note or chat answer: first reply `--portal` "Thanks — I'll enter
   that for you now." Then write it:

   ```sql
   SET app.actor TO 'rosie';
   SELECT public.answer_availability_request(
     $arId, $supplierId, $arItemId,
     '{"status":"available","available_quantity":"<allocated total>","unit_price":"12.00"}'::jsonb,
     false
   );
   ```

   Values are strings; `""` clears a field; keys are only `status`,
   `available_quantity`, `unit_price`, `note_for_supplier`. For `available`,
   the quantity is the line's current allocated total; if allocations are
   missing, don't mark it available, ask. Partial quantity or an alternative
   uses the matching non-available status. Keep existing LPS text when
   writing `note_for_supplier`.
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
