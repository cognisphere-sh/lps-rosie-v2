---
name: plant-and-supplier-search
description: Look up a plant or a supplier in the Supabase database and answer the asker well. daisy's skill, narrowed — the same RPCs and search discipline, plus scoping a sourcing look-up to Austin Plant Supply and when to widen past it, and the read-only framing — findings go into a job request's `sourcing_notes`, data problems get reported to daisy rather than fixed, and a hit is a listing rather than an availability. Use for any price or sourcing question against the database. (v1.1.3)
metadata:
  author: lps
  version: "1.1.3"
---

# Looking up a plant or supplier

Read `knowledge/files/SCHEMA.md` before writing any query.

**These are daisy's tables and you only read them.** A sourcing look-up's
findings go into the job-request item's `sourcing_notes` (see `job-requests`);
anything that looks wrong in the data — a bad alias pair, a stale price — gets
reported to daisy by agent-message, never fixed by you.

**A search answers what a plant costs, not whether it can be had.** Every row
is a line off a price list someone published — Austin Plant Supply's included —
and its `quantity` is what that sheet claimed on the day it was ingested.
Report a hit as the listing it is ("listed at $X on their Aug 18 sheet"), never
as availability. What makes a job-request line `available` is the supplier's
own answer or Chris's word, never a look-up (`job-requests` §5.3).

## 1. Search with the RPC, not a hand-written query

Prefer **`search_inventory`** for plants and **`search_suppliers`** for
suppliers. They handle other/common names via the alias graph, partial matching
and typos — a `LIKE` query does not. `search_inventory` takes only `search` and
`fuzzy_ratio`; **scoping and sorting are yours**, applied as SQL over its
result.

An empty `search` returns **nothing** — there is nothing to rank. To *list*
rather than *search*, select from `inventory` with an `ORDER BY` and a `LIMIT`.

### Scope a sourcing look-up to Austin Plant Supply

A look-up done for a job request starts at **Austin Plant Supply**
(`suppliers.id = 1`) — the house yard and the default source (`job-requests`
§5). Scope it by filtering the result:

```sql
SELECT supplier_name, name, size, size_std, unit_price, quantity, relevance
FROM search_inventory('live oak 30 g')
WHERE supplier_id = 1
ORDER BY relevance DESC, unit_price;
```

The RPC already excludes inactive rows and retired sources, so a supplier
filter is all you add. Read the whole size range that comes back, not just the
size asked for — when they don't have the ask, the closest thing they *do* have
is what the ladder's next rung recommends.

Widen past supplier 1 only on the ladder's terms — Austin Plant Supply has
neither the ask nor a close alternative, or Chris or the customer named another
supplier. A question that was never about a job request ("who has Muskogee?")
is not scoped at all.

### How it matches and ranks

It searches **names, size and notes**. It is typo tolerant, matches **partially
at both ends** (`sycamor` and `ycamor` both find `sycamore`), and expands your
terms through `plant_aliases` first — so the common and botanical name return
the same rows.

Results are **ranked, not filtered**: `relevance` is the sum of the rarity
weight of each query term the row matched, so rare terms dominate. Two things
follow, and both matter when you read a result set:

- **The top of the list is the answer; the tail is weak.** A search returns
  everything matching *any* term. `Crape Myrtle Muskogee` returns ~755 rows, but
  only the top ~178 match both parts — read `relevance` (or just the first
  screen), don't report the row count as "how many we have".
- **A cultivar that nobody carries no longer comes back empty.** It returns the
  generic plant, ranked below anything matching the cultivar. Check `relevance`
  and the returned `cultivar_variety_trade_name` before telling someone a
  supplier has the selection they asked for.

### What a plant's identity is made of

A row carries the common name, the botanical name and the
cultivar/variety/trade name in **three separate columns**, each holding only
what the source printed; `inventory.name` is the composition of them — the
non-empty parts joined by ` - `. So `search_inventory` finds a row by any of
the three, and the returned `common_name` / `botanical_name` /
`cultivar_variety_trade_name` tell you which part actually matched — worth
saying out loud when the asker searched a cultivar and got the species.

**Aliases expand the query.** Any contiguous run of query words that names an
alias is replaced by itself OR the other side of that edge, and the groups stay
AND-ed: `Live Oak Boardwalk` searches
`((live oak) OR (quercus virginiana)) boardwalk`. So a plant found under either
name comes back either way, and — unlike the older mechanism — an alias-reached
row is scored like any other text match rather than ranking last.

One thing to know when a result looks too broad: nothing restricts what an alias
pair can reach. If a search for a cultivar returns the whole species, suspect a
bad alias pair joining the two, and report it — that is a data problem, not a
search bug.

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
