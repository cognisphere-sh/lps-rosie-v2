---
name: plant-and-supplier-search
description: Look up a plant or a supplier in the Supabase database and answer the asker well. Covers the search_inventory / search_suppliers RPCs and their filters, the never-call-with-an-empty-search rule, how to relax filters and reword terms when there are no results, the key-column rules for any fallback query (never write generated *_key columns, never match names with = on raw text), and the shape of a good answer. Use when Chris, Bhoumik or a thread asks "who has <plant>", "what does <supplier> carry", "look up <plant/supplier>", or any price/availability question against the database. (v1.0.0)
metadata:
  author: lps
  version: "1.0.0"
---

# Looking up a plant or supplier

Read `knowledge/SCHEMA.md` before writing any query.

## 1. Search with the RPC, not a hand-written query

Prefer **`search_inventory`** for plants and **`search_suppliers`** for
suppliers. They handle other/common names via the alias graph, partial matching
and typos — a `LIKE` query does not. Set the filters (`supplier_ids`, sort) from
what was actually asked.

**Never call `search_inventory` with an empty `search`.** With nothing to rank it
walks every active row and blows the statement timeout. To *list* rather than
*search*, select from `inventory_enriched` with an `ORDER BY` and a `LIMIT`.

## 2. If nothing comes back, widen before concluding

Relax the filters and adjust the terms before saying there's no match:

- broader term (drop the cultivar, drop the size),
- botanical name ↔ common name,
- fewer filters (all suppliers rather than one).

## 3. Fall back to a custom query only when the RPC can't express the question

Two rules always hold:

- **Never write generated `*_key` columns.**
- **Never match plant names with `=` on raw text** — join or compare on
  `name_key`, or wrap the text in `normalize_plant_key(<text>)`.

## 4. Answering

Reply with a brief summary:

- how many suppliers carry the plant,
- a few of them by name, with pricing and basic metadata (size, quantity,
  availability notes),
- an offer to expand — full supplier list, more sizes/varieties — if they want
  more.

Keep it non-technical for Chris: no SQL, schema or tooling terms.
