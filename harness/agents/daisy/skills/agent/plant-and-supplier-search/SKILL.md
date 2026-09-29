---
name: plant-and-supplier-search
description: Find plants and suppliers in the database and answer Chris. Includes search_inventory / search_suppliers use, quoted exact search, how ranking and aliases work, widening a search, stock location vs head office, substitutes and the answer format. Use for any "who has…", "do we have…", price or supplier lookup. (v2.0.0)
metadata:
  author: lps
  version: "2.0.0"
---

# Plant and supplier search

Inventory is what suppliers listed, not confirmed stock.

## 1. Search with the RPCs

```sql
SELECT id, name, common_name, botanical_name, cultivar_variety_trade_name, size, size_std,
       unit_price, quantity, supplier_id, supplier_name, supplier_city, supplier_state, notes, relevance
FROM search_inventory('<what was asked>')
WHERE <filters the question asks for>
ORDER BY relevance DESC LIMIT 30;
```

Suppliers: `search_suppliers(...)`. Never call either with an empty term; to
list rows, select from the table with `ORDER BY` and `LIMIT`.

- **Unquoted:** searches names, size and notes; forgives typos; matches word
  parts (`ycamor` finds sycamore); expands aliases (`Live Oak Boardwalk` →
  `(live oak OR quercus virginiana) boardwalk`).
- **Ranked, not filtered.** Every row matching any word comes back. Read the
  top rows and `relevance`; the row count is not "how many we have" (`Crape
  Myrtle Muskogee` returns ~755 rows, ~178 match both words). A typed size
  ranks, it doesn't filter: filter `size_std` yourself.
- **A cultivar nobody carries** returns the plain species below it. Check the
  returned `cultivar_variety_trade_name` before saying a supplier has it, and
  say which part matched ("they list the species, not 'Muskogee'").
- **Quoted** (`"Italian Cypress"`): exact, case-insensitive text in the name
  parts only. No aliases, typos or reordering. A precision tool, not the
  default. Quotes mean nothing special in `search_suppliers` or
  `search_plant_photos`.
- A cultivar search that returns the whole species suggests a bad alias:
  report it (see `availability-ingestion` → aliases).

## 2. Exact plant first, then everything else

1. Find the exact plant and size across **all** suppliers first.
2. Then apply the extras (state, city, price, supplier type), and still
   mention exact matches just outside them ("none in Florida; Lake Growers,
   GA has 6' Cherry Laurel"). Chris, 2026-09-04: "why did you not return that
   the first time???"
3. **No hit is not a "no".** Before saying a supplier doesn't have it or
   there's no price: widen (drop the cultivar or size, try botanical ↔
   common name, fewer filters), and for Austin Plant Supply check the price
   list source itself. (APS 48" Palo Verde was reported missing but was on the
   list, 2026-09-09.)

Custom SQL only when the RPC can't express the question. Never write derived
columns; compare names with `name_key`, `common_name_key`,
`botanical_name_key`, `cultivar_keys && …` or `normalize_plant_key(...)`,
never `=` on raw text.

## 3. Where the plant actually is

A head office is not where the stock is (Everde is in Houston; its Bunnell,
FL farm is a separate row). Use the location row the inventory belongs to
and any farm/region in the row; say which you used. Sister sites share
`head_branch_id`; the nearer one may be another row.

## 4. Substitutes

Suggest only plants that suppliers list (Austin Plant Supply first), with
size and price. If a question is about a specific job, answer the plant part
and leave job changes to Rosie.

## 5. Answer

Short and plain, no SQL or tool talk:

- how many suppliers have it; a few by name with size, price, quantity and any
  supplier note;
- nearest listed sizes when the asked size is missing;
- offer the full list if they want more.

On Telegram use short lines, not tables (`Name (size) — Supplier — $price`).
Link the app (`/suppliers/<id>`, `/photos?q=…`) rather than signed files when
someone will look at it later.
