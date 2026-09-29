# Notes: what goes where

This is the only place that defines note content. Other skills link here.

## The three note fields

| Field | Where | Who reads it | What goes in it |
|---|---|---|---|
| `note_for_customer` | jobs, job items, orders, order items | Customer (quotes, app column) | The customer's sourcing requirements, plus short outcomes the customer needs. |
| `note_internal` | jobs, job items | Chris and LPS only | Current supplier, price and response facts; actual line changes; open questions that block the next step. |
| `note_for_supplier` | AR header and lines, orders, order items | Supplier and LPS | LPS's sourcing asks, and the supplier's replies. One shared field for both. |

Placed orders also get a short dated change line at the end of
`orders.note_for_supplier` (see [orders](orders.md)). That is the only note
that keeps history.

## Rules for every note

- **Fewest words possible.** Chris reads them. Assume he understands; no
  warnings, caveats or explanations.
- **Current state only.** Replace old facts. Never keep a log of actions,
  approvals, questions asked or decisions rejected.
- **Don't repeat columns or exact-match price-list evidence.** Plant, size,
  quantity, price and status are already shown. When APS lists the requested
  plant and size under another common or botanical name, no internal note is
  needed: `Rosemary Prostrata Trailing` for creeping rosemary 3 G is an exact
  match. Keep a short price-basis note when pricing a different cultivar or
  variant from a generic listing.
- **Sourcing facts only:** cultivar, color, form, acceptable alternatives,
  purchase units, ETA. Leave out spacing, layout, installation, project or
  phase names, and (in customer and supplier notes) customer names.
- **Scope:** job-wide facts go on the job; line facts go on the item.
- Empty is fine. Use NULL when there is nothing useful to say.
- Keep existing text that is still true (the customer's own words, other
  suppliers' facts). Edit with a guarded update (see `database-access`).

## `note_for_customer`

Keep the customer's own requirements (alternatives they allow, color, form,
units). Plan or list remarks like `Sub soft leaf yucca` go in word for word;
don't turn them into questions. Add an outcome only when it comes from Chris
or a **submitted** supplier answer, never from a missing price-list entry:

| Situation | Note | Example |
|---|---|---|
| Available as requested | Nothing | — |
| Available, but the unit was unclear before | Confirm the unit | `140 x 4" correct` |
| Different size / quantity / variant offered | Few words, offered size first, or ask if it works | `15G only` · `3G only, 1G NA` · `Only blue available` · `3G only — OK?` |
| Can order | ETA only | `Can order Tuesday` · `Can order for Sep 29` |
| Unavailable | Nothing, or an alternative Chris approved offering | `Dwarf pittosporum 3G available` |
| Customer gave two sizes | The other size and its price | `45 G $595.00` |
| Quantity not given | Ask | `How many?` |
| Detail the customer must give | Short question | `Height?` · `Variety?` |

- Write "NA" or "only" only when the supplier actually said so.
- For a supplier-proposed alternative, give its size/name and its **own**
  price. If that price is unknown, keep the proposal in `note_internal`.
- Notes Chris writes himself stay as he wrote them.
- Never write: the supplier's name, costs or internal prices, "proxy",
  "cultivar not confirmed", questions meant for the supplier (`RED Avail?`), declined
  substitutions, `Quoted for ...`, `Originally 15 G or 20 G ...`, price-sheet
  references, JR/AR numbers, or "not available for the Sep 24 pickup" when
  "Can order ..." already says it.
- The app copies a supplier's answer note into `note_for_customer` when Chris
  picks a supplier capsule. If that text contains LPS asks, costs or supplier
  names, propose clean wording to Chris; change it only after he agrees.

## `note_internal`

Only what Chris needs to decide the next step:

| Situation | Example |
|---|---|
| Price came from a different plant, variant or size | `Whirling Butterflies Gaura priced from APS generic Gaura` · `Texas Sedge 1 G priced from APS Sedge 1 G` |
| Requested size not listed (give nearest smaller **and** larger, if both exist) | `3 G not listed; American Beauty Berry 5 G @ $23` · `7 G not listed; Nolina 5 G @ $23, 15 G @ $175` |
| Supplier answer received | `APS: 7 G only @ $65` |
| Line changed from the customer's ask | `Req 15 G or 20 G; using 15 G` · `1 flat = 18 x 4" pots` · `Was Pride of Houston Yaupon 30 G` |
| APS proposed another plant/size | Its APS list price: `APS list 7 G Elaeagnus $65`, or `No APS price for 7 G` |
| Open point for Chris | `Flat count?` · `Twistleaf or Softleaf?` |

Never write: "proxy pricing", "Chris approved ...", "AR response pending",
rejected options (`No 7G substitution`), step-by-step history, or
tentative-match warnings.

## `note_for_supplier` (AR and order asks)

When building an approved AR, copy only what the supplier needs from the
job's and items' `note_for_customer`, plus Chris's instructions:

- Header: request-wide needs (`Needed by Sep 18`, `Pickup Sep 24`).
- Line: that line's specs (`Single trunk only`, `Atrosanguinea or Shalimar
  Red cultivar`, `140 individual 4-inch pots packed in trays; unit price per
  pot`, `30 G acceptable`, `Is listed Muskogee suitable?`).
- Say what is wanted, in positive words. Don't forbid suggestions
  (not `do not substitute 7 G`). The supplier may suggest other options.
- Don't add: `Please price ...` (a blank seed price already asks), `Please
  confirm availability`, `Let us know if you have questions`, project
  headings, or customer names unless customer sharing is on.
- Don't repeat plant, size, quantity or price. Don't repeat the header on
  every line. On a shared AR, keep each job's needs on its own line.
- Mention an alternative plant or size only after Chris approved asking about
  it. A price taken from another listing is not an exact match; don't present
  it as one.

## Supplier answers → job notes

When a supplier **submits** an AR (not a saved draft), read the header and
line `note_for_supplier`. Skip LPS's own ask already in that field. Split
the supplier's words by reader: customer-useful outcomes go to
`note_for_customer` (table above), supplier/price facts go to
`note_internal`. Header facts go to every linked job; line facts to the linked
items only. If you're unsure who should see a fact, keep it internal.

Example: supplier line note `Can order for Oct 1.` → item
`note_for_customer` `Can order Oct 1`.
