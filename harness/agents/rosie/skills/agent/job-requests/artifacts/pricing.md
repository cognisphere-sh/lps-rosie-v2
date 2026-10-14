# Pricing job lines

LPS currently buys only from **Austin Plant Supply (APS, `supplier_id = 1`)**.
Price from the APS price list unless Chris names another supplier for this
job. Use `plant-and-supplier-search` to find prices. Prices go on
**candidates** ([intake](intake.md#5-create-each-lines-candidates)); a line
shows the price of the candidate selected for it (its default unless another
is selected).

## Which price wins

1. A price the customer already accepted, or a price supplied with a
   committed order. Never replace it with a list price or a cheaper size.
2. A price or size Chris gives you ("lantana is $7", "use $495"). While APS
   is the only supplier, this is also the APS input for the AR
   ([manual AR inputs](../../supplier-coordination/artifacts/availability-requests.md#chris-changes-an-open-ar)).
3. The exact APS listing (same plant, cultivar, size).
4. A rule in `knowledge/files/price-rules.md`.
5. A listing with a different name for the same plant (name order, synonym,
   alias). Use it directly; no question needed when the requested plant and
   size match exactly.

1–5 price the line's default (the original ask, already selected): it is
then an exact match. Nothing fits → its `unit_price` stays **0**, meaning
"price not found" (the line's price shows blank; a job line is never 0), and
report the gap. When Chris names another supplier for the job, that
supplier's price goes on its own original (the copy of the default,
[intake](intake.md#5-create-each-lines-candidates)), which you then select
with `select_candidate` (his direction); the APS default keeps price 0
unless APS is priced too. A price given with a committed order or accepted quote, or
by Chris, goes on the line's selected candidate:
`SELECT public.update_job_line($itemId, '{"unit_price":"25.00"}'::jsonb);`
(re-read first; it writes only the selected candidate, the default unless
another is selected).
A submitted supplier price for the line beats a list price; never replace a
supplier answer with catalogue evidence. A budget or a supplier's cost is not
a selling price. Conflicting prices, or unclear unit-vs-total amounts: ask,
don't guess. Never create an AR just to fill a price gap, and never order an
unpriced line.

## Price every row

Before an AR or quote, try every row, not just the easy ones. Save each
supported price on its candidate, then re-read the rows (`job-snapshot`). A
line selecting an unanswered candidate reads `pending` with no
`available_quantity`.

After a real lookup (even with no match) record it once:

```sql
SET app.actor TO 'rosie';
SELECT public.record_job_workflow_event($jobId, 'pricing_fetched');
```

## When the exact listing is missing

| Case | Do |
|---|---|
| Same plant, same size, other color or variant listed (and no price rule) | Add the listing as a candidate (description `1 G Gaura`). Don't ask; Chris drags it if he wants it. If he says to use that price always, add a rule to `price-rules.md` and a line in that inventory row's `internal_notes` (see that file). |
| No size given | Keep `size` NULL. Add a candidate per listed size with its price; keep the default selected. Ask the size in your question batch. |
| Same plant listed only in other sizes | Don't price the original ask from another size. Add the nearest smaller **and** larger listed sizes as candidates (`3 G NA, only 5 G`) and name them in your chat reply. |
| Chris says "quote 5g, put 15g in note" | Select the 5 G candidate (his pick), then save `15 G $165.00` as the line's customer note (`set-note --table job_request_items --field note_for_customer`: the selected candidate's override). |
| Name not found at all | Try other common/botanical names, then web-researched names (`plant-and-supplier-search`). Still nothing → the default keeps price 0 (not found); report, and offer to search other suppliers. Wait for Chris before searching them. |
| Chris asks for "closest listed prices" | List the 1–2 closest candidates per gap, the best guess first. |

Check `price-rules.md` and this job's chat first: if Chris already decided,
apply it.

A missing price never blocks an approved AR: the APS AR asks about the
line's **default** (its original plant and size) unless Chris picks another
candidate, with a blank price.

## Customer gave several sizes (`3 G or 5 G`)

- Make each requested option a candidate, each with its own price and
  description: the default becomes the first option (update its `size`,
  price and description), the others are added. Don't ask which to quote.
- Chris's standing selection rule (`price-rules.md`): select the **cheapest
  requested option with a price**, then save the other option's price as the
  line's customer note (`5 G $25.00`; `set-note` on the line writes the
  selected candidate's override). No option priced → keep the default
  selected; Chris drags one.
- The AR asks for the selected option, else the default (see
  `supplier-coordination`); the other goes in its `note_for_supplier`.
- Never change an accepted or ordered line.

## Report

In the origin chat, lead with the result: how many lines priced, the total,
and the gaps with the candidates found (nearest listed sizes and prices). Keep SQL and tool details out.
