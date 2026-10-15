# Supplier answers on job lines

The supplier thread relays a **submitted** AR to its job's `jr-<id>`
(`supplier-coordination`). A saved draft never reaches the job.

## What the database already did

A candidate is one fixed plant and size; a supplier never changes it. Its
`status` is the supplier's answer, and a job line shows its **selected**
candidate (the default unless another is selected).

- **Substitutes, as soon as the supplier saves.** The supplier answers
  **Diff Sz/Sub** and either ticks one of the line's other candidates (same
  supplier) or types "Something else"; **Unavailable** is its own picker
  option (no substitute). With a substitute, the asked candidate becomes
  `unavailable` (quantity 0, price kept) with `offered_candidate_id` pointing
  at it, and the substitute becomes `diff_size_sub` for the demanded
  quantity, with the supplier's reply as its `note_from_supplier`. The
  substitute is linked to the same AR (so it can be ordered) but is not a row
  of its own there: the asked row shows it, and the supplier's price,
  quantity and note edits on that row go to the substitute. A picked tag is
  an existing candidate — if it was hidden (`hide_from_lps`), picking it
  clears the flag so Chris sees it; a typed substitute is a new placeholder
  candidate named with what they typed (no size, no price;
  `offer_description` is also kept on the asked one) for you to enrich
  ([below](#substitutes)). Partial Qty is `partial_qty`, never Diff.
- **On each submission**, for jobs in Quote or Availability: a line whose
  selected candidate on that AR was answered Unavailable with a substitute
  since the previous submission switches to the substitute; then this AR's
  other alternatives are hidden (not the line's default or selection, the
  supplier's originals, or the substitutes they offer). An alternative Chris
  unhid can be hidden again by a later submission of the same AR.

The line status is derived from the selected candidate:

| Selected candidate | Job line |
|---|---|
| unanswered | `pending` |
| `available` | `available`; quantity = the demand |
| `available` below the demand, or `partial_qty` | `partial_qty` (Partial Qty); the supplier's quantity |
| `can_order` / `arriving_soon` | `need_to_order` / `arriving_soon` |
| `unavailable` | `unavailable`; quantity 0, price kept |
| `unavailable` with a substitute on offer | `diff_size_sub` (Diff Sz/Sub); asked size and price |
| `diff_size_sub`, or a non-original candidate answered `available` or `partial_qty` | `diff_size_sub` with its own size and price |

Size, price, quantity and customer note always follow the selected
candidate. The customer note is the candidate's `note_for_customer`
override if set, else the supplier's reply (`note_from_supplier`); nothing
is copied. The customer's requirements live in `note_internal` and are
never touched. Don't redo, undo or add to any of this by hand.

## What you do

1. Re-read the job (`job-snapshot`).
2. Post one short alert in the origin chat: the lines that changed, and
   answers on candidates that are **not** selected (`APS: 5 G NA, offers 7 G
   at $65 for Elaeagnus`) that Chris may want to drag in. Link `[Open AR-<id>](ar:<id>)`.
   Don't repeat what the job table shows. Conflicting or incomplete answers
   go in the same alert as one MCQ ([below](#conflicting-or-incomplete-answers)).
3. A request-wide reply in the AR header: see
   [notes](notes.md#supplier-answers--job-notes).
4. A reply that isn't customer-safe (costs, supplier names, LPS asks) shows
   as the customer note: propose clean wording to Chris; on his yes save it
   as the override (`set-note --table candidates --field note_for_customer`,
   or on the line for its selected candidate). A customer-safe reply needs
   no override except the standing same-plant/different-size name cleanup in
   [notes](notes.md): omit the repeated plant name without another approval.

Limits:

- Never copy an answer onto a job line yourself. Never select a candidate
  because of an answer, even the only or cheapest one — except Chris's yes on
  a conflict fix ([below](#conflicting-or-incomplete-answers)). The
  database's switch to a substitute on submission is not yours to undo.
- Committed or closed jobs get no submission switch: report the answer.
- Never change `demanded_quantity` because the supplier offered a different
  amount.
- Nothing goes to the customer. Notes are not a send.

## Substitutes

- **Picked tag:** done by the database (a selected asked row moves to it on
  submission). Mention it in the alert.
- **Typed substitute** (`ar-snapshot` shows the asked row `→ sub N typed`
  and the placeholder `sub for` it, no size, no price): after submission,
  enrich the placeholder, no approval needed, with a plain guarded `UPDATE
  candidates` of `name` and `size` split from the text (`Oak 15 G` → `Oak`,
  `15 G`), a `description` like `15 G Oak`, `unit_price` (the supplier's if
  given, else the price-list price for that exact size, else 0 = not found)
  and `mapped_inventory_id` (the exact listing, else NULL). It doesn't
  change the AR's status. A closed AR refuses it ("This request is closed"):
  report to Chris instead. The customer note follows the supplier's reply;
  override it only per step 4 above. If it duplicates an existing candidate
  of the line, tell Chris instead of merging. Verify with `job-snapshot`.
- **An extra offer in the reply text** (`also have 7 G`) on top of an answer
  that stands: add the candidate (`is_original = false`, status left blank)
  and mention it.
- **A reply that replaces the answer with another plant or size** (`15g
  nelsonii` on an Available answer): if it's a clear confirmation, record it
  as that answer's substitute without asking Chris (his JR-90 rule). Pick or
  create the candidate (same supplier, same line), then, only while the AR
  is still `submitted`:

  ```sql
  SET app.actor TO 'rosie';
  SELECT public.answer_availability_request($arId, $supplierId, $answeredCandidateId,
    '{"status":"diff_size_sub","offered_candidate_id":"$substituteCandidateId","note_from_supplier":"$reply"}'::jsonb, false);
  -- the substitute is diff_size_sub at once; re-submitting moves a selected line to it
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
| `unavailable` → a substitute | a substitute, no price | substitute price missing |
| blank | a clear answer | the note's answer |

1. Read the note's answer. A size with no supplier price → look up that
   supplier's price-list price for that **exact** size (`aps-price "<plant>"
   --size "<size>"` for APS). A nearest size is not that size's price; none
   found → price stays missing.
2. The substitute is the note's plant and size: an active candidate of the
   same supplier on that line if one matches (e.g. the listed `3 G
   Elaeagnus`, its own price), else a new one ([substitutes](#substitutes)).
   If the matching candidate is itself asked on this AR (Chris asked about
   both sizes), it can't be the substitute (refused): correct the asked row
   to Unavailable with no substitute and answer the matching candidate on
   its own row, or report it to Chris.
3. A note with one clear reading: correct the answer now, without asking
   (Chris's JR-90 rule), only while the AR is still `submitted`
   (`ar-snapshot`; if the supplier is editing again, report and wait), and
   re-submit (the correction marks the AR Processing; re-submitting returns
   it to Submitted and moves a selected line to a new substitute):

   ```sql
   SET app.actor TO 'rosie';
   SELECT public.answer_availability_request($arId, $supplierId, $candidateId,
     '{"status":"diff_size_sub","offered_candidate_id":"$substituteId"}'::jsonb, false);
   SELECT public.answer_availability_request($arId, $supplierId, NULL, NULL, true);
   ```

   Payloads per answer (values are strings): Available
   `{"status":"available"}` (quantity = demand); Partial Qty
   `{"status":"partial_qty","available_quantity":"6"}`; no substitute
   `{"status":"unavailable","offered_candidate_id":"","offer_description":""}`
   (`{"status":"unavailable"}` alone keeps a substitute already offered); a
   picked substitute as above; a typed one
   `{"status":"diff_size_sub","offered_candidate_id":"","offer_description":"<text>","note_from_supplier":"<text>"}`.
   Other keys: `unit_price`, `note_from_supplier` (on a row with a
   substitute both go to the substitute); no `size`, and no
   `offer_unit_price` / `offer_quantity` (ignored). Answer the asked row,
   never the substitute's own row (refused). Change only what the note
   contradicts; keep `note_from_supplier` as written. Verify with
   `job-snapshot`. A committed or closed job: report only.

4. Then ask Chris, in the alert, one MCQ question per line (one
   questionnaire), recommended action first, only for what needs him: using a
   price-list price the supplier didn't give, selecting the substitute, or a
   note with two readings (its readings are the options).
   `Elaeagnus: APS marked 5 G available, but the note says "only 3 G".`
   → `Select 3 G at $18 (APS list) (Recommended)` · `Keep 5 G selected` ·
   `Ask APS`. On his yes: set the substitute's price (guarded) if it was 0
   or empty, then `select_candidate($itemId, $substituteId)` unless the
   submission already moved the line to it. His yes is the only case where
   an answer leads you to select a candidate.
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
- **On your own**: only the candidate Chris's direction or a standing
  selection rule (`price-rules.md`) picks; the default is selected from the
  start ([intake](intake.md#5-create-each-lines-candidates)). Never from a
  supplier answer, except Chris's yes on a conflict fix.
- **Back to the default** (Chris unselects): `SELECT
  public.unselect_candidate($itemId);`.
- **Removing a candidate** (app bin, or Chris's word in chat):
  `SELECT public.delete_candidate($candidateId);`. It is a soft delete: the
  candidate leaves the supplier's AR, and a line selecting it falls back to
  its default. The default itself can't be removed.

## Answers from outside the portal

A supplier's email or chat answer is evidence only. The supplier thread
records it in the AR only on Chris's instruction
(`supplier-coordination`). A quantity alone doesn't confirm a seeded price.
