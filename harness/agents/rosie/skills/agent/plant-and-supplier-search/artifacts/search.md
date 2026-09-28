# Finding a price

## 1. Run the helper

```sh
skills/agent/plant-and-supplier-search/scripts/aps-price "<plant name>" --size "<size>"
```

It shows, in one call: matching price rules, aliases, and every listed size
and price of the best-matching plants, with the EXACT size or the nearest
smaller and larger ones marked. Default supplier is APS (1); `--supplier N`
for another.

For a whole job, run it once per unpriced line (skip lines already priced).
Keep one answer per plant per job, so repeat lookups agree.

## 2. Check the match

The search forgives typos and expands aliases, so the top row can be the
wrong cultivar. Compare common name, botanical name, cultivar and size. Word
order doesn't matter (`Southern Magnolia` = `Magnolia Southern`).

| What you found | Do |
|---|---|
| Same plant, requested size | Use its price. |
| Same plant under another name (synonym, trade name, word order) | Use its price; no question. Note the listed name in `note_internal` only if it isn't obvious. |
| A rule in `knowledge/files/price-rules.md` covers it | Use it; no question. |
| Same plant, same size, only another color/variant listed | Ask Chris once ([pricing](../../job-requests/artifacts/pricing.md)). |
| Same plant, other sizes only | Report nearest smaller and larger; don't price the line from them. |
| Different species or form | Not a match. It's an alternative; report it, don't use it. |

## 3. Nothing found?

1. Search again: common name, botanical name, fewer words, other word order.
   Exact substring: wrap in straight quotes, `aps-price '"Italian Cypress"'`
   (no alias expansion, no typo tolerance).
2. Look up other names on the web: `scripts/agent/ddgs text -q "<plant>
   other names" -m 5`. Use a name only if a real source (URL) says it's the
   same plant; a similar look or shared genus is not enough. Search APS again
   with it.
3. Found by another name → use the price, and ask Chris in one line: "Add
   `<other name>` as an alias of `<requested name>`?" On yes, ask Daisy to add
   the pair to `plant_aliases` (never a new inventory row).
4. Still nothing → price stays NULL. Give 1–2 closest listed options (same
   plant nearby size first, then close relatives) in the reply, and offer to
   search other suppliers. Search them only after Chris says so.

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
