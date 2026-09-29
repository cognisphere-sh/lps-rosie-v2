# Quote text format

## Copy-ready text

Put the quote (or any text Chris will copy, like a message draft) alone in a
fenced block tagged `text`, as its own message. Anything for Chris goes in a
separate message before or after, never inside the block.

## Standard quote (default)

```text
Delivery date to be confirmed

4 x 15 G Wax myrtle - $105.00 - $420.00
10 x 30 G Eagleston Holly - 45 G $595.00 - $395.00 - $3,950.00

Subtotal: $4,370.00
```

- First line: the job's `note_for_customer`, then a blank line. Skip both if
  the job note is empty.
- One line per item: `Qty x Size Plant - note - $Unit - $Line total`. The
  note is the item's saved `note_for_customer` (customer information only);
  leave the field out (with its dash) when empty. Never build a note from
  internal notes (they hold the customer's own requirements), AR notes or
  chat.
- Blank line, then `Subtotal: $X` as the last line.
- `G` for gallons; ` x ` between quantity and size; ` - ` between fields; `$`
  with two decimals and thousands commas. Keep non-gallon sizes as written
  (`24" box`).
- Line total = requested quantity × unit price, rounded to cents; subtotal =
  sum of line totals. Never use `available_quantity`.
- Plant names: common name only (the part before ` | `), unless Chris asks
  for botanical names.
- No heading, no pipes, no supplier names, no internal comments.

The examples are formats, not prices.

## Variants

| Chris wants | Command | Line shape |
|---|---|---|
| Standard quote | `quote-job <jobId>` | as above |
| Bid, per-unit prices, or quantities all 1 ("don't do the line total") | `quote-job <jobId> --no-totals` | `Qty x Size Plant - note - $Unit`, no subtotal |
| Availability list ("use ✅ for avail, red x for unavailable") | `quote-job <jobId> --status` | `Qty x Size Plant - ✅ - note - $Unit - $Line`; ❌ unavailable, `Can order`, `Diff Sz/Qty/Sub`, `Pending` |
| Only available and different-size lines | `quote-job <jobId> --status --only available,alternative_proposed` | same |
| Some lines only | `--items 748,754` | same |
| Grouped by project or phase (only when asked) | one `--items` run per group, group name above each | same; never merge groups |

In the availability list the subtotal covers priced lines only. It uses the
job lines' current statuses; Chris's own
status edits in the app are the truth.

Any other format only when Chris asks for it; keep the rules above that he
didn't change.

## Unpriced lines

A standard quote refuses lines with no price or quantity and names them. Fix
them, or quote the priced lines with `--items` and tell Chris (outside the
block) which lines are left out and why. Never drop a line silently or invent
a value to make it pass.

## Custom input

`render-quote --input /tmp/<thread>-quote.json [--no-totals] [--status]`
renders rows you supply (`job_id`, optional job `note_for_customer`, `items`
with `id`, `name`, `size`, `demanded_quantity`, `unit_price`,
`note_for_customer`, `status`). Use it only for rows that aren't saved yet in
that form; normally use `quote-job`.
