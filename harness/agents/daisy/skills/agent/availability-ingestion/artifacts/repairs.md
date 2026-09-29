# Fixes and one-off requests on inventory

Apply [fields](fields.md) to every edit, even a one-row fix.

## Fix a row (typo, wrong size, wrong split)

Example: "Spineless Prickly Pear 3g is misspelled (spinless) … can you edit?"

1. Find it: `search_inventory('<name>')` filtered by `supplier_id`; read the
   current values.
2. Fix the row itself. A misspelling is corrected on the row, not hidden with
   an alias. Keep the source's `source_id`.
3. Guarded update, noting what it was:

   ```sql
   UPDATE inventory
   SET common_name = $q$Spineless Prickly Pear$q$,
       internal_notes = concat_ws(E'\n', internal_notes,
         $q$2026-09-25: name corrected from "Spinless" (Chris, Telegram)$q$)
   WHERE id = '<id>' AND common_name IS NOT DISTINCT FROM $q$Spinless Prickly Pear$q$
   RETURNING id, name, size, unit_price;
   ```

   Zero rows back → someone changed it; re-read and retry.
4. Check the search now finds it; tell Chris in one line.

Other copies of the same typo from the same supplier: fix them in the same
statement. Other suppliers' rows: leave them unless asked.

## Chris gives a price or plant for a supplier

Example: "Giant Hesperaloe, Austin Plant Supply, $695" (with a photo).

- Matches an existing row and size → update the price; `internal_notes`:
  `<date>: price from Chris, <channel> <message id>`.
- No size given and more than one size exists → ask one plain question
  ("Which size is $695 — 30 G?"). Don't guess.
- A new offering → treat it as a manual current receipt ([source](source.md)):
  store the screenshot/photo as the source file, make a source row, insert.
- A photo that came with it also goes to `plant-photo-catalogue`.

## "Price X the same as Y" (another name for a priced plant)

Never create a new inventory row that copies another row's price under a
different name. (Bhoumik, 2026-09-25: "add other plant names as Alias. Do not
create a new entry.")

- Same plant, other name (Leopard Plant = Farfugium japonicum) → alias
  ([aliases](aliases.md), "Chris or Bhoumik asks for it").
- Different plants or selections priced alike (Texas Sage vs `Green Cloud`:
  "not interchangeable") → not an alias. It is a pricing rule: send Chris's
  exact words to Rosie (`main` thread) for her price rules, and tell Chris in
  one line where it went.

## Export a supplier's rows

```sh
scripts/agent/supabase/query --csv -c "SELECT name, common_name, botanical_name, cultivar_variety_trade_name, size, size_std, unit_price, quantity, height, width, caliper, notes, updated_at FROM inventory WHERE supplier_id = <id> AND is_active ORDER BY name, size" > workspace/threads/<ThreadId>/files/<slug>-active-inventory-<YYYY-MM-DD>.csv
bash scripts/webchat/webchat-cli send --text '<N> active rows for <Supplier>.' --file workspace/threads/<ThreadId>/files/<file>.csv
```

Leave out `internal_notes` unless asked. Say how many rows.

## Deactivate or delete

Never during a fix. Deactivating any row or source needs Chris's or
Bhoumik's yes for that exact set of rows.
