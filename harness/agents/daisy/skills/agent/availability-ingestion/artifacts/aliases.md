# Aliases (`plant_aliases`)

An alias is a pair of names for **the same plant**, so a search for one finds
the other (`Live Oak` ↔ `Quercus virginiana`, `Crape Myrtle` ↔ `Crepe
Myrtle`). A pair works both ways and expands every search that contains either
name. A wrong pair corrupts many searches; a missing one costs one search.
When unsure, add nothing.

## Two ways a pair is allowed

1. **Printed in the source you are ingesting**, both names on the same line for
   the same offering (botanical beside common, a synonym in the same cell, a
   spelling variant of that line). Store that line in `source_line` and this
   drop's `source_id`.
2. **Chris or Bhoumik asks for it** (directly, or relayed by Rosie with their
   words). Store `source_line = '<who>, <channel> <YYYY-MM-DD>: "<their
   words>"'` and `source_id = NULL`. Their instruction is the evidence; still
   run the checks below and say in one line if one fails, then do what they say.

Never add a pair from your own knowledge, the web or another supplier's list.
(Alias 44255 `Yucca gloriosa` ↔ `Yucca, Soft Leaf` was made that way and put
nine wrong rows into Chris's "soft leaf yucca" search.)

## Checks for every pair

- **Same plant.** Never species ↔ one of its cultivars, sibling cultivars, or
  two species (`Cercis canadensis` ↔ `Cercis mexicana` is wrong). If the trade
  sells two names as different products, they are different plants.
- **Not two offerings.** If both names appear as separate lines in this drop,
  or in any list from this supplier, they are two products.
- **Not generic.** `Oak`, `Grass`, `Maple`, `Redbud`, `Perennial`, `Native`,
  `Shade Tree` fit many plants; text search already finds them.
- **A name, not data.** No size, grade, container or form code, price,
  quantity, SKU, zone or shipping note, no cut-off fragment.
- **Not redundant.** Skip pairs that differ only by case, spacing or
  punctuation, or only repeat what is already in the row's name.

## Writing

```sql
INSERT INTO plant_aliases (name, other_name, source_id, source_line)
VALUES ('Live Oak', 'Quercus virginiana', '<source id or NULL>',
        'LIVE OAK (Quercus virginiana)  15G  $48.00');
```

- A trigger silently drops duplicates, self-pairs, empty names and mirrored
  pairs, so insert without conflict handling.
- Never reactivate an inactive pair; inactive pairs are history.
- Verify each new pair: run `search_inventory('<name>')` and
  `search_inventory('<other_name>')`. If either returns a plant that is not
  the same plant (for example the whole species for a cultivar), the pair is
  wrong: set it inactive and report it.
- A misspelled inventory name (e.g. `Spinless` for `Spineless`) is fixed on the
  row itself (see [repairs](repairs.md)), not with an alias.
