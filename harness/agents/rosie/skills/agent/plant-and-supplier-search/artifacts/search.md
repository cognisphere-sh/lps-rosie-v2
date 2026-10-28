# Finding a price

## 1. Run the helper

```sh
skills/agent/plant-and-supplier-search/scripts/aps-price "<plant name>" --size "<size>"
```

It shows, in one call: matching price rules, the aliases the search used
(marked `close match` for a misspelt or unfinished alias name, `partial match`
when you typed part of one), and every listed size and price of the
best-matching plants, with the EXACT size or the nearest
smaller and larger ones marked. Default supplier is APS (1); `--supplier N`
for another.

For a whole job, run it once per unpriced line (skip lines already priced).
Keep one answer per plant per job, so repeat lookups agree.

## 2. Check the match

The search forgives typos and expands aliases (also a misspelt alias, or part
of one when that is all you typed), so the top row can be the wrong cultivar
or plant. Check a close or partial alias the helper shows really is the plant
asked for. Compare common name, botanical name, cultivar and size. Word
order doesn't matter (`Southern Magnolia` = `Magnolia Southern`).

| What you found | Do |
|---|---|
| Same plant, requested size | Use its price on the line's default (exact match, already selected: [intake](../../job-requests/artifacts/intake.md)). Also add 2–3 similar listings from this supplier as hidden substitute options (`hide_from_lps`, [intake](../../job-requests/artifacts/intake.md#5-create-each-lines-candidates)). |
| Same plant under another name (synonym, trade name, word order) | Use its price; no question. Still an exact match. |
| A rule in `knowledge/files/price-rules.md` covers it | Use it; no question. |
| Same plant, same size, only another color/variant listed | Add it as a candidate; don't ask ([pricing](../../job-requests/artifacts/pricing.md)). |
| Same plant, other sizes only | Make the nearest smaller and larger their own candidates; don't price the original ask from them. |
| Different species or form | Not a match. Add it as a candidate only if it's a sensible substitute; don't ask. |

## 3. Nothing found?

1. Search again: common name, botanical name, fewer words, other word order.
   Exact substring: wrap in straight quotes, `aps-price '"Italian Cypress"'`
   (no alias expansion, no typo tolerance).
2. Look up other names on the web: `scripts/agent/ddgs text -q "<plant>
   other names" -m 5`. Use a name only if a real source (URL) says it's the
   same plant; a similar look or shared genus is not enough. Search APS again
   with it.
3. Found by another name → add that listing as a candidate (description:
   its size and listed name); don't ask. Whenever Chris says two names are the same, have Daisy add the pair to `plant_aliases` (never a new inventory row), not just a price rule. His explicit identity instruction authorizes the alias; after noting a naming risk once, follow his direction. Example: `African Iris = Bi Color Iris`.
4. Still nothing → the line's default stays unpriced (NULL, price not
   found). Give 1–2 closest listed options (same plant nearby size first, then
   close relatives) in the reply, and offer to search other suppliers. Search
   them only after Chris says so.

## 4. Suppliers other than APS

Only when Chris asks ("which growers list this?") or allows it for a job.
Check plant, size, positive price, list date and where the stock is (a
supplier's head office isn't its stock location; branches share a
`head_branch_id`). A new supplier goes to Daisy for onboarding before any
order work. Listed quantities are the list's numbers, not a reservation.

## Data problems

A wrong alias, wrong listing or bad price row goes to Daisy with the evidence.
Don't edit inventory yourself, except adding a "use always" line to
`internal_notes` (see `price-rules.md`). For custom identity queries compare
the normalized keys (`name_key`, `common_name_key`, `botanical_name_key`,
`cultivar_keys`, `normalize_plant_key()`), not raw text. Never call
`search_inventory('')`; list rows from `inventory` with an order and a limit.
