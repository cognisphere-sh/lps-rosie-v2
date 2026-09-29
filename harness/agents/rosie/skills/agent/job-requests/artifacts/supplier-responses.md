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
   Don't repeat what the job table shows.
3. A request-wide reply in the AR header: see
   [notes](notes.md#supplier-answers--job-notes).
4. A copied reply that contains costs, supplier names or LPS asks: propose
   clean wording to Chris; change it only after he agrees.

Limits:

- Never copy an answer onto a job line yourself, and never select a
  candidate because of an answer, even the only or cheapest one.
- Committed or closed jobs aren't updated by the database: report the answer.
- Never change `demanded_quantity` because the supplier offered a different
  amount.
- Nothing goes to the customer. Notes are not a send.

## Different size, variant or quantity

The supplier can change a candidate's size and price in the portal, so a
selected candidate carries them to the line. An offer only in the reply text
(another plant, or a size with no price) → add a candidate for it (the
offered name and size, a `description` like `7 G Elaeagnus`, its own price
if the supplier gave one, else 0; `note_for_customer` like `7 G only`), mention it in your alert, and let Chris
drag it. Don't ask whether to use it. Never reuse the old size's price. Ask the supplier for a missing price only
after Chris's yes. A quantity-only difference doesn't change the unit price.

## Chris picks a candidate (`selected_candidate_id`)

The app shows the selected candidate in the job table's Selected column.

- **In the app** (dragged onto Selected): his decision; the app already ran
  `select_candidate`. Don't undo or redo it.
- **In chat**: `SELECT public.select_candidate($itemId, $candidateId);` for
  the candidate he named (it must belong to that line), then verify.
- **On your own**: only the exact match at intake
  ([intake](intake.md#5-create-each-lines-candidates)), or the candidate
  Chris's direction or a standing selection rule (`price-rules.md`) picks.
  Never from a supplier answer.
- **Removing a candidate** (app bin, or Chris's word in chat):
  `SELECT public.delete_candidate($candidateId);`. It is a soft delete: the
  candidate leaves the supplier's AR and is unselected; the line keeps its
  values.

## Answers from outside the portal

A supplier's email or chat answer is evidence only. The supplier thread
records it in the AR only on Chris's instruction
(`supplier-coordination`). A quantity alone doesn't confirm a seeded price.
