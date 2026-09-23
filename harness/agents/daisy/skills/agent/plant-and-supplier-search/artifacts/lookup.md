## 2. If nothing comes back, widen before concluding

Relax the filters and adjust the terms before saying there's no match:

- broader term (drop the cultivar, drop the size),
- botanical name ↔ common name,
- fewer filters (all suppliers rather than one).

Nothing coming back at all is now rare — the search returns anything matching
any term. If a cultivar search returns rows but none of them actually name that
cultivar, that is the answer: nobody on file carries it, and what you are seeing
is the generic plant ranked below it.

## 3. Fall back to a custom query only when the RPC can't express the question

Two rules always hold:

- **Never write a derived column** — `inventory.name` and every `*_key`
  (`name_key`, `common_name_key`, `botanical_name_key`, `cultivar_keys`) are
  maintained by the database. Write the three name parts instead.
- **Never match plant names with `=` on raw text** — compare on `name_key`,
  `common_name_key` or `botanical_name_key`, test `cultivar_keys` (an array)
  with `&&` or `= any`, or wrap the text in `normalize_plant_key(<text>)`.

## 4. "Who has this near me?" — HQ is not stock location

A geographic question must **not** be answered from `suppliers.state` alone. A
company's headquarters and the site the stock actually sits on differ: Everde is
headquartered in Houston, while a Francis Mason row of theirs is `FARM=BNL` /
`REGION=FL` in Bunnell, Florida. Until inventory location is a structured
column:

- check **both** the supplier's geography and any explicit farm / region /
  location evidence in the inventory row or its source notes,
- **say which one your answer rests on** — "their Bunnell, FL farm, per the row"
  reads differently from "their head office is in Houston",
- never state or imply that the HQ state is where the plant is.

Sister locations of one company are separate `suppliers` rows sharing a
`head_branch_id`, so the nearer site may be a different row than the one you
matched.

## 5. Answering

Reply with a brief summary:

- how many suppliers carry the plant,
- a few of them by name, with pricing and basic metadata (size, quantity,
  availability notes),
- an offer to expand — full supplier list, more sizes/varieties — if they want
  more.

Keep it non-technical for Chris: no SQL, schema or tooling terms.
