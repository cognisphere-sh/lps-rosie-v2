# Chris's standing price rules

Plant pricing rules Chris has approved for all future jobs. Check this table
whenever a requested plant has no exact APS listing. Use it without asking
Chris again.

How to use a rule:

- Always read the **current** APS price of the listed row. Prices noted here
  are examples from the day of the decision, not fixed prices.
- Keep the customer's requested name, cultivar and color on the job line and
  its default candidate (the original ask); the rule price goes on the default.
- A rule gives a **price only**. It does not mean the plant is in stock, and
  the AR still asks APS for the original requested plant.
- Don't write the price basis in `note_internal`. Never write "proxy" or
  "proxy pricing".

## Price rules

| Requested plant | Use the price of | Limits | Source |
|---|---|---|---|
| Any sedge variety, 1 G (e.g. Berkeley Sedge, Texas Sedge / Carex texensis) | APS generic `Sedge` 1 G ($6.50 on 2026-09-25) | 1 G only. Not 4-inch or other sizes. | Chris 2026-08-25; JR-82 2026-09-25 ("never want to ask again") |
| Texas Sage (generic), 3 G | $21 (Chris's price) | 3 G only. | JR-82 2026-09-25 |
| Texas Sage (generic), other sizes | The APS Green Cloud and Compact Texas Sage price for that size | Only when **both** list that exact size at the **same** price. Use an exact generic Texas Sage listing first if one exists. Green Cloud is not the same plant as generic Texas Sage. | JR-82 2026-09-25 |
| Lantana, any color | APS Lantana of the same size and form (trailing vs upright/regular) | Color never changes the price. If APS lists only a plain `Lantana` at that size (no form), use it (Chris did this for Texas lantana 1 G at $7). | JR-65 2026-09-21; JR-82 2026-09-25 |
| Gold Rush Lantana 3 G | APS generic Lantana 3 G | Same size only. | JR-79 2026-09-24 ("use always") |
| Whirling Butterflies Gaura | APS generic Gaura, same size (1 G $7.95 on 2026-09-28) | Same size only. | JR-85 2026-09-28 ("yes, always") |
| Flowering plants in different colors, including roses and lantanas | Same-size APS listing of that plant in any color | Color does not change the pricing basis. Example: any 3 G oleander listing can price another 3 G oleander color. | Chris JR-98 2026-10-05 |
| Oleander, any color, 3 G | APS 3 G oleander listing in any color | Chris: any oleander in 3 gallon will work for pricing. | Chris JR-98 2026-10-05 |
| Chilean Mesquite, Honey Mesquite | APS generic `Prosopis Mesquite`, same size/box | Same size or box only. | JR-82 2026-09-25 |
| Pride of Houston Yaupon | APS generic Yaupon Holly, same size | Same size only. Chris asked for a plant alias too: ask Daisy to add it if search still misses it. | JR-78 2026-09-24 |
| Oklahoma Texas Redbud 45 G | APS generic Texas Redbud 45 G | Same size only. | JR-79 2026-09-24 ("use always") |
| Dwarf Loropetalum (no cultivar given) | APS Purple Pixie Loropetalum, same size | Same size. Keep "dwarf" on the line. | JR-61 2026-09-17 |
| Crape Myrtle, Plumbago, Salvia: variety or color not listed | APS generic listing, same size | Same size. Say "generic price" in chat. | JR-9 2026-08-24 |
| Agave parryi truncata | APS `Artichoke Parry's Agave` or `Agave Parryi`, same size | Same size. | 2026-09-11 |
| Carolina Cherry Laurel (Prunus caroliniana) | APS `Prunus Compact Cherry Laurel`, same size (5 G $46, 15 G $225, 30 G $395, 24" $395, 30"/36" $795 on 2026-09-25) | Same size. | Chris Telegram 1281 2026-09-25 |
| Carolina Cherry Laurel 30 G | A 24" box listing counts as 30 G | This plant only. If APS says a 24" box is available, no question needed. | JR-78 2026-09-24 |
| Leopard Plant, Giant Leopard Plant (Farfugium japonicum) | APS Ligularia, same size (1 G $15, 3 G $27 on 2026-09-25) | Same size. | Main 2026-09-25 |

## Same plant, other names

These names mean the same plant. Search under both. If a search misses one,
ask Daisy to add the pair to `plant_aliases` (never a new inventory row).

| Name | Same plant as | Source |
|---|---|---|
| Southern Magnolia | Magnolia Southern (word order only) | JR-79 2026-09-24 |
| Leopard Plant | Farfugium japonicum | Main 2026-09-25 |
| Whale's Tongue Agave | Agave ovatifolia | JR-82 2026-09-25 |
| Giant Hesperaloe | Hesperaloe funifera | Main 2026-09-25 |
| Shumard Oak | Red Oak | JR-79 2026-09-24 |

## Adding a rule

When Chris says a price should always be used ("use this price always",
"remember this", "never ask again"):

1. Add one row above: requested plant, listed row to use, limits, source
   (thread and date). Keep it one line.
2. If Chris says the two names are the same plant, also ask Daisy to add a
   `plant_aliases` pair so search finds it next time.
3. If Chris says a variant listing's price should always be used, also add a
   short line to that inventory row's `internal_notes`, e.g.
   `Also prices Gold Rush Lantana 3 G (Chris 2026-09-24)`. Keep the existing
   text (guarded update).

A one-time answer ("for this job only") is not a rule. Don't add it here.

## Candidate selection rules

When a line has several candidates and none is an exact match, select one
yourself (`select_candidate`) only when a rule below or Chris's direction for
this job picks it. Otherwise the default stays selected and Chris drags.

| When | Select | Source |
|---|---|---|
| Customer gave several sizes (`3 G or 5 G`) | The cheapest requested option with a price (> 0); none priced → keep the default | Chris, standing |

When Chris gives a new standing selection rule, add one row here the same way.
