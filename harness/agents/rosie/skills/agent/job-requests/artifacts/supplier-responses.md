# Supplier answers on job lines

The supplier thread relays a **submitted** AR to its job's `jr-<id>`
(`supplier-coordination`). A saved draft never reaches the job.

## What the database already did

A candidate is one fixed plant and size; a supplier never changes it.

- **Substitutes, as soon as the supplier saves (0123, 0124).** The supplier
  answers **Diff Sz/Sub** and either ticks one of the line's other
  candidates or types "Something else"; **Unavailable** is its own picker
  option (no substitute). With a
  substitute, the asked candidate becomes `unavailable` (quantity 0, price
  kept) with `offered_candidate_id` pointing at it, and the substitute becomes
  **Available** for the demanded quantity at its own candidate price (the
  dialog asks no price or quantity). The substitute is linked to the same AR
  (so it can be ordered) but is not a row of its own there: the asked row
  reads Diff Sz/Sub. A picked tag is an existing candidate — if it was a
  hidden substitute option (`hide_from_lps`), picking it clears the flag so
  Chris sees it; a typed substitute gets a new candidate named with what they
  typed (no size, price 0; `offer_description` is also kept on the asked one)
  for you to enrich ([below](#substitutes)).
- **Lines, on each submission.** Every **selected** candidate on that AR answered since the
  previous submission re-applies to its job line, for jobs in Quote or
  Availability. The line status is computed:

| Selected candidate | Job line |
|---|---|
| Original, `available` | `available`; quantity = the answer, capped at the demand |
| Original, `partial_qty` | `partial_qty` (Partial Qty); the supplier's quantity |
| Original, `can_order` / `arriving_soon` | `need_to_order` / `arriving_soon` |
| Original, `unavailable` | `unavailable`; quantity 0, price kept |
| Original, `unavailable` with a substitute on offer | `alternative_proposed` (Diff Sz/Sub); asked size and price |
| Any other candidate, answered | `alternative_proposed` (Diff Sz/Sub) with its own size and price |
| Any candidate unanswered / unavailable | `pending` / `unavailable` |

Size, price and quantity always follow the selected candidate. The
supplier's reply (`note_from_supplier`), if any, replaces the candidate's
`note_for_customer` and so the line's. The customer's requirements live in
`note_internal` and are never touched. Older `diff_size_qty_sub` answers
without a substitute carry a supplier-rewritten size and price and read
Diff Sz/Sub. Don't redo, undo or add to any of this by hand.

## What you do

1. Re-read the job (`job-snapshot`).
2. Post one short alert in the origin chat: the lines that changed, and
   answers on candidates that are **not** selected (`APS: 5 G NA, offers 7 G
   at $65 for Elaeagnus`) that Chris may want to drag in. Link `[Open AR-<id>](ar:<id>)`.
   Don't repeat what the job table shows. Conflicting or incomplete answers
   go in the same alert as one MCQ ([below](#conflicting-or-incomplete-answers)).
3. A request-wide reply in the AR header: see
   [notes](notes.md#supplier-answers--job-notes).
4. A copied reply that contains costs, supplier names or LPS asks: propose
   clean wording to Chris; change it only after he agrees.

Limits:

- Never copy an answer onto a job line yourself. Never select a candidate
  because of an answer, even the only or cheapest one — except Chris's yes on
  a conflict fix ([below](#conflicting-or-incomplete-answers)).
- Committed or closed jobs aren't updated by the database: report the answer.
- Never change `demanded_quantity` because the supplier offered a different
  amount.
- Nothing goes to the customer. Notes are not a send.

## Substitutes

- **Picked tag:** done by the database. Mention it in the alert; Chris drags
  it onto the line if he wants it.
- **Typed substitute** (asked candidate has `offer_description`; its
  `offered_candidate_id` is the row the database created, named with the raw
  text, no size): after submission, enrich that row, no approval needed.
  Guarded update of `name` and `size` split from the text (`Oak 15 G` →
  `Oak`, `15 G`), a `description` like `15 G Oak`, and a `note_for_customer`
  like `15 G only`. Keep the supplier's price; if they gave none (0), use the
  price-list price for that exact size. If it duplicates an existing
  candidate of the line, tell Chris instead of merging. Verify with
  `job-snapshot`.
- **An extra offer in the reply text** (`also have 7 G`) on top of an answer
  that stands: add the candidate (as above, status left blank) and mention it.
- **A reply that replaces the answer with another plant or size** (`15g
  nelsonii` on an Available answer): if it's a clear confirmation, record it
  as that answer's substitute without asking Chris (his JR-90 rule). Pick or
  create the candidate as above, then, only while the AR is still `submitted`:

  ```sql
  SET app.actor TO 'rosie';
  SELECT public.answer_availability_request($arId, $supplierId, $answeredCandidateId,
    '{"status":"unavailable","offered_candidate_id":"$substituteCandidateId","offer_quantity":"3"}'::jsonb, false);
  -- saves the substitute as Available at once; the submit re-applies the line
  SELECT public.answer_availability_request($arId, $supplierId, NULL, NULL, true);
  ```

  Unclear → the conflict flow below.
- Never reuse the old size's price. A quantity-only difference is
  `partial_qty` at the same unit price. Don't select; Chris drags.

## Conflicting or incomplete answers

The supplier's note (`note_from_supplier`) is the source of truth. An answer
conflicts when its status, size or quantity disagrees with the note; it is
incomplete when the note names a size without a price, or answers a line
left without a status.

| Answer | Note says | Read it as |
|---|---|---|
| `available` | another size (`only 3 G`) | Unavailable with that size as substitute |
| `available` | fewer (`only have 6`) | `partial_qty`, the note's quantity, same unit price |
| `available` / `can_order` | none (`NA`, `out`) | `unavailable` |
| `available` | coming (`ready in 2 wks`) | `arriving_soon` |
| `unavailable` | has another size | Unavailable with that size as substitute |
| `diff_size_qty_sub` | a substitute, no price | substitute price missing |
| blank | a clear answer | the note's answer |

1. Read the note's answer. A size with no supplier price → look up that
   supplier's price-list price for that **exact** size (`aps-price "<plant>"
   --size "<size>"` for APS). A nearest size is not that size's price; none
   found → price stays missing.
2. The substitute is the note's plant and size: an active candidate of the
   same supplier on that line if one matches (e.g. the listed `3 G
   Elaeagnus`, its own price), else a new one ([substitutes](#substitutes)).
3. A note with one clear reading: correct the answer now, without asking
   (Chris's JR-90 rule), only while the AR is still `submitted`
   (`ar-snapshot`; if the supplier is editing again, report and wait), and
   re-submit so the database re-applies the line:

   ```sql
   SET app.actor TO 'rosie';
   SELECT public.answer_availability_request($arId, $supplierId, $candidateId,
     '{"status":"unavailable","offered_candidate_id":"$substituteId"}'::jsonb, false);
   SELECT public.answer_availability_request($arId, $supplierId, NULL, NULL, true);
   ```

   Keys: `status`, `available_quantity`, `unit_price`, `note_from_supplier`,
   `offered_candidate_id`, `offer_description`, `offer_unit_price`,
   `offer_quantity` (no `size`). Change only what the note contradicts; keep
   `note_from_supplier` as written. Re-submitting copies the reply onto
   `note_for_customer` again: restore wording Chris agreed earlier. Verify
   with `job-snapshot`. A committed or closed job: report only.

4. Then ask Chris, in the alert, one MCQ question per line (one
   questionnaire), recommended action first, only for what needs him: using a
   price-list price the supplier didn't give, selecting the substitute, or a
   note with two readings (its readings are the options).
   `Elaeagnus: APS marked 5 G available, but the note says "only 3 G".`
   → `Select 3 G at $18 (APS list) (Recommended)` · `Keep 5 G selected` ·
   `Ask APS`. On his yes: set the substitute's price (guarded) if it was 0,
   then `select_candidate($itemId, $substituteId)`. His yes is the only case
   where an answer leads you to select a candidate.
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
