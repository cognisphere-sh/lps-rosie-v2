# Pricing job lines

LPS currently buys only from **Austin Plant Supply (APS, `supplier_id = 1`)**.
Price from the APS price list unless Chris names another supplier for this
job. Use `plant-and-supplier-search` to find prices.

## Which price wins

1. A price the customer already accepted, or a price supplied with a
   committed order. Never replace it with a list price or a cheaper size.
2. A price or size Chris gives you ("lantana is $7", "use $495"). While APS
   is the only supplier, this is also the APS input for the AR
   ([manual AR inputs](../../supplier-coordination/artifacts/availability-requests.md#chris-changes-an-open-ar)).
3. The exact APS listing (same plant, cultivar, size).
4. A rule in `knowledge/files/price-rules.md`.
5. A listing with a different name for the same plant (name order, synonym,
   alias). Use it directly; no question needed.

Nothing fits → leave `unit_price` NULL (never 0) and report the gap.
A submitted supplier price for the line beats a list price; never replace a
supplier answer with catalogue evidence. A budget or a supplier's cost is not
a selling price. Conflicting prices, or unclear unit-vs-total amounts: ask,
don't guess. Never create an AR just to fill a price gap, and never order an
unpriced line.

## Price every row

Before an AR or quote, try every row, not just the easy ones. Save each
supported price in `unit_price`, then re-read the rows. Pricing never changes
a line's status or `available_quantity` (new lines stay `pending`).

After a real lookup (even with no match) record it once:

```sql
SET app.actor TO 'rosie';
SELECT public.record_job_workflow_event($jobId, 'pricing_fetched');
```

## When the exact listing is missing

| Case | Do |
|---|---|
| Same plant, same size, other color or variant listed (and no price rule) | Ask Chris once, in plain words: "APS lists Gaura 1 G at $7.95, not Whirling Butterflies. Use $7.95?" Options: **Yes, always for this plant (Recommended)**, **Yes, this job only**, **No**. "Always" → add a rule to `price-rules.md` and a line in that inventory row's `internal_notes` (see that file). No answer → leave NULL. |
| No size given | Keep `size` NULL. Price only a size Chris or the plan states. Put the listed sizes and prices in `note_internal` (`1 G $7, 3 G $21`) and `Size?` in `note_for_customer`. |
| Same plant listed only in other sizes | Don't price the row from another size. Put the nearest smaller **and** larger listed sizes with prices in `note_internal` (`3 G not listed; American Beauty Berry 5 G @ $23`) and in your chat reply. |
| Chris says "quote 5g, put 15g in note" | Change `size` to 5 G, price it, and put `15 G $165.00` in `note_for_customer`. |
| Name not found at all | Try other common/botanical names, then web-researched names (`plant-and-supplier-search`). Still nothing → NULL, report, and offer to search other suppliers. Wait for Chris before searching them. |
| Chris asks for "closest listed prices" | List the 1–2 closest listed options per gap in one MCQ batch, the best guess first. |

Before asking anything, check `price-rules.md` and this job's chat: if Chris
already answered, apply the answer.

A missing price never blocks an approved AR: the AR asks APS about the
**original** plant and size with a blank price.

## Customer gave several sizes (`3 G or 5 G`)

Chris's rule: quote the **cheapest requested option that has a price**.

- Set `size` and `unit_price` to that option. The line's `name` and `size`
  must show exactly one plant and one size.
- Put the other option's price in `note_for_customer`: `5 G $25.00`.
- Keep the original ask in `note_internal`: `Req 3 G or 5 G`.
- No option priced → price gap. Don't pick an option the customer didn't ask
  for.
- The AR still asks for the options the customer allowed (see
  `supplier-coordination`).
- Never apply this to an accepted or ordered line.

## Report

In the origin chat, lead with the result: how many lines priced, the total,
and the gaps with their nearest listed sizes. Keep SQL and tool details out.
