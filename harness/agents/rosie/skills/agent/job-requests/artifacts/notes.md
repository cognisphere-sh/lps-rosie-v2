# Notes: what goes where

This is the only place that defines note content. Other skills link here.

## The note fields

| Field | Where | Who reads it | What goes in it |
|---|---|---|---|
| `note_for_customer` | jobs | Customer (quotes, app column) | **Only information for the customer**: what's available instead, ETA, a substitution explanation. A job line shows its selected candidate's. Never the customer's own requirements. |
| `description` | candidates | Chris | Short size + one common or botanical name + needed variant (`5 G Shumard Oak`). Never both names joined by `|`. Required. Not a note. |
| `note_for_customer` | candidates | Customer, via the line that selects it | LPS's override of the customer note: NULL follows the supplier's reply, `''` is deliberately blank ([below](#candidate-customer-note)). |
| `note_internal` | jobs, job items | Chris and LPS only | The customer's requirements (single trunk, red flowers only, must be full, delivery constraints); open points; internal context. **Never** supplier, listing, price or answer facts: candidates show those. |
| `note_for_supplier` | AR header, candidates, order items | Supplier and LPS | LPS's sourcing asks. On the AR header also the supplier's request-wide reply. |
| `additional_details` | orders | Supplier and LPS | JSON list of `{"field", "value"}`: customer, delivery address, contacts (`Name, email, phone`), payment method ([orders](orders.md#additional-details-and-change-log)). |
| `change_log` | orders | Supplier and LPS | Bullets `- MM/DD: change`, material changes only ([orders](orders.md#additional-details-and-change-log)). |
| `note_from_supplier` | candidates | LPS, and the customer unless overridden | The supplier's reply for that candidate. Written only by the supplier (or by you transcribing for them). |

Placed orders also get a dated bullet in `orders.change_log` for each
material change (see [orders](orders.md#additional-details-and-change-log)). That is the only note that keeps
history.

## Rules for every note

- **Fewest words possible.** Chris reads them. Assume he understands; no
  warnings, caveats or explanations.
- **Current state only.** Replace old facts. Never keep a log of actions,
  approvals, questions asked or decisions rejected.
- **Don't repeat columns or candidates.** Plant, size, quantity, price,
  status and every candidate's supplier, listing, price and answer are
  already shown.
- **Sourcing facts only:** cultivar, color, form, acceptable alternatives,
  purchase units, ETA. Leave out spacing, layout, installation, project or
  phase names, and (in customer and supplier notes) customer names.
- **Scope:** job-wide facts go on the job; line facts go on the item.
- Empty is fine. Use NULL when there is nothing useful to say.
- Plan legends: put the stated size/caliper in `size` (`4–5" Cal`), not transcription commentary in `note_internal`; omit distracting source/readability explanations.
- Keep existing text that is still true (the customer's own words). Edit
  with a guarded update (see `database-access`).

## `note_for_customer`

Only information **for** the customer. The customer's own requirements go
in `note_internal`, never here. Questions for the customer (`How many?`) go
in your chat question batch, not in a note. On a line the note is the
selected candidate's (below). Outcomes come from Chris, a **submitted**
supplier answer, or a candidate's substitute note:

| Situation | Note | Example |
|---|---|---|
| Available as requested | Nothing | — |
| Available, but the unit was unclear before | Confirm the unit | `140 x 4" correct` |
| Different size / quantity / variant offered | Few words, offered size first | `15G only` · `3G only, 1G NA` · `Only blue available` |
| Can order | ETA only | `Can order Tuesday` · `Can order for Sep 29` |
| Unavailable | Nothing, or an alternative Chris approved offering | `Dwarf pittosporum 3G available` |
| Customer gave two sizes | The other size and its price | `45 G $595.00` |

- Same plant, different size: omit the plant name from the customer note, e.g. `1 G NA, 4 in only`. Chris's standing approval covers this name-only cleanup of a supplier reply; preserve the supplier's original reply.
- On a line, write "NA" or "only" only when the supplier said so, or as a
  selected substitute candidate's note (`5 G NA, 3 G only`).
- For a supplier-proposed alternative, give its size/name and its **own**
  price. If that price is unknown, report the proposal to Chris instead.
- Notes Chris writes himself stay as he wrote them.
- Never write: the supplier's name, costs or internal prices, "proxy",
  "cultivar not confirmed", questions meant for the supplier (`RED Avail?`), declined
  substitutions, `Quoted for ...`, `Originally 15 G or 20 G ...`, price-sheet
  references, JR/AR numbers, or "not available for the Sep 24 pickup" when
  "Can order ..." already says it.
- A line's customer note is its selected candidate's effective note: the
  candidate's `note_for_customer` override if set, else the supplier's reply.
  Nothing is copied; writing the line's note (`set-note --table
  job_request_items --field note_for_customer`) sets the selected
  candidate's override, and `--clear` goes back to following the reply. If a
  reply contains LPS asks, costs or supplier names, propose clean wording to
  Chris; save the override only after he agrees.

## Candidate customer note

A candidate's `note_for_customer` is an override: NULL shows the supplier's
reply, `''` shows nothing, text replaces the reply. A new supplier reply
clears it, so the reply shows first; override after it if needed. It becomes the line's
note when the candidate is selected, so the line-note rules above apply (no
supplier names, costs or `proxy`). For an alternative you add, few words on
how it differs from the ask, offered size first: `5 G NA, 3 G only` · `Only
blue`. Never the plant's own name or size alone: that is the candidate's
`description` (`3 G Salvia greggii 'Furman's Red'`). NULL for the default
until a line note is saved on it.

## `note_internal`

The customer's requirements, and what Chris needs to decide the next step:

| Situation | Example |
|---|---|
| Customer requirement (line or job) | `Single trunk` · `Red flowers only` · `Must be full` · `Sub soft leaf yucca OK` · `Deliver after 3 pm` |
| Open point for Chris (never which substitute: that's a candidate) | `Flat count?` |
| Line unit changed from the customer's ask | `1 flat = 18 x 4" pots` |
| Unknown customer (job note) | The identity clue: `From jane@acme.com` |

Never write supplier names, listings, list or supplier prices, nearest sizes,
price basis, supplier answers or offers (`APS: 7 G only @ $65`, `priced from
APS ...`, `Was 1 G`, `3 G not listed ...`): those are candidates. Also never:
"proxy pricing", "Chris approved ...", "AR response pending", rejected options
(`No 7G substitution`), step-by-step history, or tentative-match warnings.

## `note_for_supplier` (AR and order-row asks)

When asking on an AR, copy the customer requirements the supplier needs
from the job's and line's `note_internal` (never the rest of it), plus
Chris's instructions:

- Header: request-wide needs (`Needed by Sep 18`, `Pickup Sep 24`).
- Candidate: that line's specs (`Single trunk only`, `Atrosanguinea or Shalimar
  Red cultivar`, `140 individual 4-inch pots packed in trays; unit price per
  pot`, `30 G acceptable`, `Is listed Muskogee suitable?`).
- Say what is wanted, in positive words. Don't forbid suggestions
  (not `do not substitute 7 G`). The supplier may suggest other options.
- Don't add: `Please price ...` (a blank seed price already asks), `Please
  confirm availability`, `Let us know if you have questions`, project
  headings, or customer names unless customer sharing is on.
- Don't repeat plant, size, quantity or price. Don't repeat the header on
  every line.
- Mention an alternative plant or size only after Chris approved asking about
  it. A price taken from another listing is not an exact match; don't present
  it as one.

## Supplier answers → job notes

A candidate's reply (`note_from_supplier`) is its customer note unless LPS
set an override, and so the note of a line selecting it. Don't copy it
yourself; override it only when it isn't customer-safe (above).

The header `note_for_supplier` may hold the supplier's request-wide reply
after LPS's ask. On a **submission**, customer-useful outcomes from it go to
the AR's job `note_for_customer` (table above), in few words (`Ready
Friday`). Supplier or price facts go nowhere: report them to Chris in chat.
