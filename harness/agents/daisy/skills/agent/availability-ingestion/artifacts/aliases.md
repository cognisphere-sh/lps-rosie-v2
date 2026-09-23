- **Aliases** (`plant_aliases`): an alias exists for exactly one reason — so a
  search finds the row when the user types **another name for the same thing**.
  A pair is a plain undirected edge between two names: `Live Oak` ↔ `Quercus
  virginiana`, `Crape Myrtle` ↔ `Crepe Myrtle`, `Wolff` ↔ `Emperor 1`.

  **There is no `alias_type` and no distinction between kinds of pair.** Until
  migration 0045 a `cultivar` edge was only ever compared to the cultivar
  column, so it could not make a generic row of a species answer a search for
  one selection. Aliases now **expand the query** instead of matching columns,
  and an expanded query has no column to be restricted to, so every edge already
  behaved identically at match time; 0050 dropped the column that recorded the
  distinction.

  **That makes the quality bar below the only thing standing between a bad pair
  and a bad result**, exactly as it was before 0040. A pair joining a species to
  one of its cultivars turns a search for that cultivar into a search for the
  whole species, returning every sibling selection — the failure migrations
  0006, 0007, 0021, 0025, 0028 and 0029 each existed to clean up, and it is one
  word long so the multi-word safety gate never runs. Nothing downstream will
  catch it for you.

  ```sql
  INSERT INTO plant_aliases (name, other_name, source_id, source_line)
  VALUES ('Live Oak', 'Quercus virginiana', '<this drop''s source id>',
          'LIVE OAK (Quercus virginiana)  15G  $48.00');
  ```

  **Both sides must be printed in the source you are ingesting, for the same
  offering** — the botanical name beside the common name, a synonym in the same
  cell, a spelling variant of that line. **Never supply the other side from your
  own knowledge, from the web, or from another supplier's list.** If the source
  prints one name, insert nothing; the identity is already searchable through
  its own columns. This is not a style preference: alias 44255
  (`Yucca gloriosa` ↔ `Yucca, Soft Leaf`, retired by migration 0028) was created
  exactly that way and put nine wrong rows across four suppliers into Chris's
  "soft leaf yucca" search. Soft-leaf yucca is *Yucca recurvifolia*; the source
  that printed the label printed that botanical name too, right there on the row.

  **Quality bar — an alias is a liability, not a freebie.** Search substitutes
  only the opposite endpoint of an edge **directly incident** to a query span;
  there is no hopping through a shared hub to sibling names. A bad pair still
  wrongly equates two things in both directions. **When in doubt,
  insert nothing** — a missing alias costs one search; a wrong one corrupts many.
  Before inserting, every pair must pass all of these:

  - **Attested by this source, on this line, and recorded.** You can quote the
    line that prints both names, and you **put that line in `source_line`** with
    the drop's `source_id`. A botanical name you know but the source doesn't
    print belongs nowhere — not in `botanical_name`, not in a pair. **A pair you
    cannot quote a line for does not ship.**
  - **Never two line items from the same list.** If both names appear as
    separate offerings in this drop — or in any drop from this supplier — they
    are two products, not two names for one. A supplier does not price the same
    plant twice under different names in one availability sheet. Check before
    inserting; this is what 44255 got wrong.
  - **Same thing, not a relative.** Both sides must name the *same* plant — the
    same species, or the same selection. Never a species ↔ one of its cultivars,
    never sibling cultivars, and never two different species:
    `Cercis canadensis` ↔ `Cercis mexicana` is wrong, they are different plants.
    Genuine renames are fine. Where taxonomies disagree, **the trade wins**: if
    the two names are sold as different products they are different plants,
    however a botanist would classify them.
  - **Nothing generic.** A label that fits many plants — `Oak`, `Grass`, `Maple`,
    `Redbud`, `Perennial`, `Native`, `Shade Tree` — is a category, not a name.
    Text search already finds a name containing "Maple"; an alias only wires
    unrelated plants together. Rule of thumb: if it would fit more than a couple
    of distinct plants in the catalogue, don't insert it.
  - **A name, not data.** Never a size, grade, container or form code (`15 G`,
    `B&B`, `M/S`, `STD`, `Clump`), a price, a quantity, a SKU, a zone or shipping
    note, or a truncated fragment of a longer name.
  - **Not redundant.** Skip it if it differs from the column it would match only
    by punctuation, casing or spacing — those already match. A name already
    spelled inside the row's composed `name` is found by searching that name
    directly, so a pair that only restates the identity buys nothing.

  New pairs are `is_active = true` (the default). A BEFORE INSERT trigger
  silently drops duplicates, self-pairs, empty keys **and mirrored pairs**, so
  blind-insert without conflict handling. Inactive pairs are historical: they
  power neither search nor display, they block re-insertion of the same pair in
  either orientation, and you **never reactivate one** to "restore" a name.
