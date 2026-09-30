# Supplier answers on job lines

The supplier thread relays a **submitted** AR to its job's `jr-<id>`
(`supplier-coordination`). A saved draft never reaches the job.

## What the database already did

On each submission, every **selected** candidate on that AR that changed
since the previous submission is copied onto its job line, for jobs in Quote
or Availability:

| Candidate answer | Job line |
|---|---|
| `available` | `available`; quantity = the answer, capped at the demand |
| `can_order` | `need_to_order` (Can Order) |
| `diff_size_qty_sub` | `alternative_proposed`, with the supplier's size and price |
| `arriving_soon` | `arriving_soon` |
| `unavailable` | `unavailable`; quantity and price 0 |
| blank | `pending` |

Size, price and quantity always follow the candidate. The supplier's reply
(`note_from_supplier`), if any, replaces the candidate's `note_for_customer`
and so the line's. The customer's requirements live in `note_internal` and
are never touched.
This replaces Chris's JR-72/JR-78 standing instruction to update APS lines by
hand: don't redo, undo or add to it.

## What you do

1. Re-read the job (`job-snapshot`).
2. Post one short alert in the origin chat: the lines that changed, and
   answers on candidates that are **not** selected (`APS offers 7 G at $65 for
   Elaeagnus`) that Chris may want to drag in. Link `[Open AR-<id>](ar:<id>)`.
   Don't repeat what the job table shows. Conflicting or incomplete answers
   go in the same alert as one MCQ ([below](#conflicting-or-incomplete-answers)).
3. A request-wide reply in the AR header: see
   [notes](notes.md#supplier-answers--job-notes).
4. A copied reply that contains costs, supplier names or LPS asks: propose
   clean wording to Chris; change it only after he agrees.

Limits:

- Never copy an answer onto a job line yourself except re-applying a **previously selected** candidate after recording its confirmed status (below). Never select a new candidate because of an answer, even the only or cheapest one — except Chris's yes on a conflict fix ([below](#conflicting-or-incomplete-answers)).
- Committed or closed jobs aren't updated by the database: report the answer.
- Never change `demanded_quantity` because the supplier offered a different
  amount.
- Nothing goes to the customer. Notes are not a send.

## Different size, variant or quantity

The supplier can change a candidate's size and price in the portal, so a
selected candidate carries them to the line. An offer in the reply text on
top of the answer (another plant, or `also have 7 G`) → add a candidate for
it (the offered name and size, a `description` like `7 G Elaeagnus`, its own
price if the supplier gave one, else 0; `note_for_customer` like `7 G only`),
mention it in your alert, and let Chris drag it. Don't ask whether to use it.
Without a supplier price, use the price-list price for that exact plant and size on the offered candidate; never reuse the old size's price. A quantity-only difference doesn't change the unit price. A reply that contradicts the answer itself is a conflict (next section).

### Supplier-confirmed alternative candidates

When a **submitted** supplier answer confirms another plant, size or quantity, mark the offered candidate `diff_size_qty_sub` with the confirmed quantity immediately—even if that candidate was not itself on the AR. Example: asked 7 G Nolina lindheimeriana ×3, answer `15g nelsonii` → 15 G Nolina nelsonii candidate Diff Sz/Qnty/Sub ×3; asked 30 G Pride of Houston ×2, answer `45g instock` → its 45 G candidate Diff Sz/Qnty/Sub ×2. Use the exact-size list price if one exists, but don't call that a supplier-confirmed price. An exact original request confirmed as asked is `available`; `trailing lantana work?` alone confirms no stock.

Re-read the submitted AR and candidate. For an unasked candidate, guard the update (`SET app.actor TO 'rosie'`; active, same line/name/size, `availability_request_id IS NULL`, old status/quantity still as read). Keep it unasked and don't write `note_from_supplier` or `answered_at`. If the differing candidate was answered on the AR, correct its status through `answer_availability_request` and re-submit while still submitted. If Chris already selected it, re-run `select_candidate`: the candidate's Diff status copies to the job line (`alternative_proposed`). Otherwise leave selection to Chris and guard-update only the original line's status to Diff Size/Qty; keep its requested size and quantity. Verify both candidate and line. No new supplier request or Chris permission is needed for a clear submitted confirmation.

## Conflicting or incomplete answers

The supplier's note (`note_from_supplier`) is the source of truth. An answer
conflicts when its status, size or quantity disagrees with the note; it is
incomplete when the note names a size without a price, or answers a line
left without a status.

| Answer | Note says | Read it as |
|---|---|---|
| `available` | another size (`only 3 G`) | `diff_size_qty_sub` at the note's size |
| `available` | fewer (`only have 6`) | `diff_size_qty_sub`, the note's quantity, same unit price |
| `available` / `can_order` | none (`NA`, `out`) | `unavailable` |
| `available` | coming (`ready in 2 wks`) | `arriving_soon` |
| `unavailable` | has another size | `diff_size_qty_sub` at the note's size |
| `diff_size_qty_sub` | a size, no price | that size; price missing |
| blank | a clear answer | the note's answer |

1. Read the note's answer. A size with no supplier price → look up that
   supplier's price-list price for that **exact** size (`aps-price "<plant>"
   --size "<size>"` for APS). A nearest size is not that size's price; none
   found → price stays missing.
2. The note names a plant and size that is already an active candidate of
   the same supplier on that line (e.g. the listed `3 G Elaeagnus`) → the fix
   is: select that candidate, and mark the answered one `unavailable`. Its
   price is the candidate's own; if that is 0, use step 1's price.
3. Settle it with Chris first. In the alert, one MCQ question per line
   (grouped into one questionnaire), recommended fix first:
   `Elaeagnus: APS marked 5 G available, but the note says "only 3 G".`
   → `Select 3 G at $18 (APS list), mark 5 G unavailable (Recommended)` (or,
   with no such candidate, `Update to 3 G at $18 (APS list) (Recommended)`) ·
   `Update to 3 G, no price` · `Keep as marked` · `Ask APS`. His yes is the
   only case where an answer leads you to select a candidate.
4. On his yes, and only while the AR is still `submitted` (`ar-snapshot`; if
   the supplier is editing again, report and wait), correct the candidate's
   answer for the supplier and re-submit so the database re-applies the line
   (for step 2, the correction is `{"status":"unavailable"}`; then run
   `select_candidate($itemId, $matchId)` last, and set its price first if it
   was 0):

   ```sql
   SET app.actor TO 'rosie';
   SELECT public.answer_availability_request($arId, $supplierId, $candidateId,
     '{"status":"diff_size_qty_sub","size":"3 G","unit_price":"18.00"}'::jsonb, false);
   SELECT public.answer_availability_request($arId, $supplierId, NULL, NULL, true);
   ```

   Change only the fields the note contradicts; keep `note_from_supplier` as
   written. Re-submitting copies the reply onto `note_for_customer` again:
   restore wording Chris agreed earlier. Verify with `job-snapshot`. A
   committed or closed job: report only.
5. Not settled — Chris picks `Ask APS`, the note has two readings, or his
   answer leaves the point open → offer once, as an MCQ, to send the supplier
   quick questions, showing the exact questions. On his yes, hand them to the
   supplier thread (`supplier-coordination` → questions).

## Chris picks a candidate (`selected_candidate_id`)

The app shows the selected candidate in the job table's Selected column.

- **In the app** (dragged onto Selected): his decision; the app already ran
  `select_candidate`. Don't undo or redo it.
- **In chat**: `SELECT public.select_candidate($itemId, $candidateId);` for
  the candidate he named (it must belong to that line), then verify.
- **On your own**: only the exact match at intake
  ([intake](intake.md#5-create-each-lines-candidates)), or the candidate
  Chris's direction or a standing selection rule (`price-rules.md`) picks.
  Never from a supplier answer, except Chris's yes on a conflict fix.
- **Removing a candidate** (app bin, or Chris's word in chat):
  `SELECT public.delete_candidate($candidateId);`. It is a soft delete: the
  candidate leaves the supplier's AR and is unselected; the line keeps its
  values.

## Answers from outside the portal

A supplier's email or chat answer is evidence only. The supplier thread
records it in the AR only on Chris's instruction
(`supplier-coordination`). A quantity alone doesn't confirm a seeded price.
