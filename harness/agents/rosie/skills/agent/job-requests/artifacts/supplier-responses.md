# Apply supplier answers to job lines

The supplier thread relays a **submitted** AR to each linked `jr-<id>`
(`supplier-coordination`). A saved draft never reaches the job.

## APS submissions: update the job, don't ask

Chris's standing instruction (JR-72, 2026-09-24): "On submission of AR by
APS, directly update Job with AR statuses. Add relevant notes for customer,
also update the pricing in case of substitute ... Do not ask questions about
that." Repeated in JR-78 ("just use APS AR response as-is to update the
status and add customer notes. Always do this.").

So for every explicit APS submission, update each linked job line yourself:

| APS answer | Job line update |
|---|---|
| `available` | `status = 'available'`; `available_quantity` = this line's allocation from `availability_request_item_jobs` (never more than its demand). |
| `can_order` | `status = 'need_to_order'` and `available_quantity` = the allocation, in the same update. ETA → `note_for_customer` (`Can order Tuesday`). |
| `diff_size_qty_sub` | `status = 'alternative_proposed'`. If APS offers one clear size **and it has a price**: set `size` to it and `unit_price` to that size's own price, keep the original in `note_internal` (`Was 1 G`), and note for the customer `3G only, 1G NA` (only what APS said). No price → see below. |
| `unavailable` | `status = 'unavailable'`. No customer note. If APS recommends an alternative, put it in `note_internal` and ask Chris whether to offer it. |
| `arriving_soon`, blank or unclear | Notes only. |

Then post one short alert in the origin chat: what changed and anything
Chris must decide. Link `[Open AR-<id>](ar:<id>)`. Don't repeat what the
job table already shows.

Limits (all still apply):

- Update the line only if it matches the AR line exactly (plant, size or a
  rule in `price-rules.md`, e.g. Carolina Cherry Laurel 24" box = 30 G).
- Don't overwrite fields Chris edited in the app after the AR was sent
  (check the item's recent changelog). Tell him about the conflict instead.
- Don't touch lines that are accepted or on an order, or whose chosen
  supplier (`selected_availability_request_item_id`) is a different AR line.
- Don't apply the same submission twice (repeated event or retry): compare
  with the line's current values and recent changes first.
- The supplier note also holds LPS's own ask (`30 G acceptable`, `Needed by
  Sep 18`). Only the supplier's new words are an answer.
- A shared AR total belongs to all its jobs. Use each job's allocation;
  never copy the total to every job. If APS's number doesn't fit the
  allocations, leave quantity/status and report the gap.
- Never change `demanded_quantity` because APS offered a different amount.
- Never set `selected_availability_request_item_id` (see below).
- Nothing goes to the customer. Notes are not a send.
- Other suppliers' answers: report to Chris and wait for his word before
  changing the job.

## Different size, variant or quantity

- Never reuse the old size's price for the new size, even if the old price
  was listed.
- APS gave a price for the new size → use it if it is clearly a per-unit
  selling price (not a cost or a total). Otherwise use the APS list price of
  the offered plant and size, and note it internally (`APS list 7 G Elaeagnus
  $65`). A price Chris gave for that offer beats both. Different species or a
  4-inch price is not a 1 G price.
- No price found → keep the requested size and price unchanged, note
  `APS offers 7 G; no price` internally, and ask Chris: "Ask APS for the 7 G price?" Only after his yes,
  hand the question to the supplier thread. APS's reply is evidence; apply it
  under the table above.
- Several sizes offered, or the offer is unclear → keep the requested size
  and price, note the offer internally, and ask Chris.
- A quantity-only difference doesn't change the unit price.

## Chris picks a supplier (`selected_availability_request_item_id`)

This column says which supplier AR line was chosen for a job line. The app
shows it as the highlighted capsule in the job table's Suppliers column.

- **Chris chose it in the app**: that is his decision. The app already copied
  the answer's status, price, capped quantity and note to the line. Don't
  undo or redo it. Later answers don't resync the line; report them. Check
  the copied note text ([notes](notes.md)).
- **Chris chose it in chat**: re-read the line, the AR line and the
  allocation. In one guarded update set this column to that
  `availability_request_items.id` plus the fields he approved (same mapping
  as the app unless he says otherwise).
- **Never on your own.** A submission, the only answer or the cheapest answer
  never sets it. Only AR lines linked to the job line through
  `availability_request_item_jobs` can be selected. Deleting the AR line
  clears it.

## Answers from outside the portal

A supplier's email or chat answer is evidence only. The supplier thread
records it in the AR only on Chris's instruction
(`supplier-coordination`). A quantity alone doesn't confirm a seeded price.
