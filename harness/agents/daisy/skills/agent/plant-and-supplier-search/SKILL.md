---
name: plant-and-supplier-search
description: Look up inventory or suppliers. Includes RPC queries, identity/alias matching, widening and stock-location evidence. Use for plant, supplier or geographic lookups. (v1.8.0)
metadata:
  author: lps
  version: "1.8.0"
---

# Plant and supplier search

Read relevant schema through `database-access`.

## 1. Search with the RPC, not a hand-written query

Prefer **`search_inventory`** for plants and **`search_suppliers`** for
suppliers. They handle other/common names via the alias graph, partial matching
and typos — a `LIKE` query does not. Set the filters (`supplier_ids`, sort) from
what was actually asked.

An empty `search` returns **nothing** — there is nothing to rank. To *list*
rather than *search*, select from `inventory` with an `ORDER BY` and a `LIMIT`.

For literal/alias/cultivar details read [matching](artifacts/matching.md).
For no-match widening, custom queries, stock location and answer shape read
[lookup and reporting](artifacts/lookup.md). Select needed columns and bound
results; inventory is source evidence, never confirmed supply.
