---
name: plant-and-supplier-search
description: Look up a plant or a supplier in the Supabase database and answer the asker well. Covers the search_inventory / search_suppliers RPCs and their filters, the never-call-with-an-empty-search rule and listing from inventory instead, the split plant identity (common_name / botanical_name / cultivar_variety_trade_name with name derived) and how plant_aliases edges reach it, how to relax filters and reword terms when there are no results, answering a geographic question from farm/region evidence rather than the supplier's HQ state, the key-column rules for any fallback query (never match names with = on raw text), and the shape of a good answer. These are daisy's tables — read-only for you; what you learn goes into a job request's internal_notes, and a data problem gets reported to daisy, not fixed. Use when Chris, Bhoumik or a thread asks "who has <plant>", "what does <supplier> carry", or any price/availability question against the database — including your own sourcing look-ups before asking daisy. (v1.0.0)
metadata:
  author: lps
  version: "1.0.0"
---

# Looking up a plant or supplier

Read `knowledge/files/SCHEMA.md` before writing any query.

**These are daisy's tables and you only read them.** A sourcing look-up's
findings go into the job-request item's `internal_notes` (see `job-requests`);
anything that looks wrong in the data — a bad alias pair, a stale price — gets
reported to daisy by agent-message, never fixed by you.

## 1. Search with the RPC, not a hand-written query

Prefer **`search_inventory`** for plants and **`search_suppliers`** for
suppliers. They handle other/common names via the alias graph, partial matching
and typos — a `LIKE` query does not. Set the filters (`supplier_ids`, sort) from
what was actually asked.

An empty `search` returns **nothing** — there is nothing to rank. To *list*
rather than *search*, select from `inventory` with an `ORDER BY` and a `LIMIT`.

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
