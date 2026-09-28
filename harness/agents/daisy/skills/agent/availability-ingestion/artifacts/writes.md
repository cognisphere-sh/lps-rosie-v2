# Match and write inventory

Read [source precedence](precedence.md) before this procedure.

**1. Pull the nearest existing rows, then decide — never match on a key.**

An exact key (`name_key` + `size`) looks decisive and isn't. Suppliers respell,
re-punctuate, add a cultivar, move a plant between containers, and switch between
the botanical and common name between drops. Every one of those makes an existing
offering look brand new to a key, and the ingest silently duplicates it. So the
procedure is: **retrieve the closest candidates, look at them, and decide.**

```bash
skills/agent/availability-ingestion/scripts/match-candidates \
  --supplier <supplier_id> --entries /tmp/<thread>-parsed.json
```

For paginated sources, feed one verified page's entries for one location at a
time, before moving to the next page; preserve the source page/line in your
ledger. Reconcile each entry with the existing rows and any decisions staged
from earlier pages so repeated offerings cannot produce duplicate inserts or
contradictory updates. Do not commit per-page transactions as a substitute for
whole-document QA; stage decisions and apply them in a transaction after the
entire source/location scope is confirmed whenever possible.

Feed it your parsed offerings as a JSON array — the **three name parts** from [normalization](normalization.md)
(`common_name`, `botanical_name`, `cultivar`), plus `size`, `unit_price`,
`quantity`, `height`, `width`, `caliper` when you have them, so the output puts
your entry and its candidates side by side. For a multi-location drop run it separately for each `supplier_id` in the
[locations](locations.md) mapping, with only that location's entries (one
page/location batch at a time when paginated). `--help` documents the rest; the
defaults are the ones to use.

For each entry it returns up to five of that supplier's **active** rows plus the
single best **retired** one, ranked by trigram similarity on the plant identity
with a size-agreement bonus, showing only the columns that distinguish one
offering from another — `id`, `name`, `cultivar`, `size`/`size_std`,
`unit_price`, `quantity`, `height`/`width`/`caliper`, `is_active`, and `dupes`
(how many identical rows collapsed into that line). Notes are deliberately not
fetched: they are long and they never tell two offerings apart.

**The `SUGGEST` line is a sort aid, not a decision.** It buckets by score alone
and knows nothing about the plant. You decide, per entry:

| What you see | Do |
|---|---|
| One clear match — same plant, same container, price/quantity moved as a new drop would | **Update it** (step 2) |
| Best candidates are all a *different* plant, a different container, or nothing came back | **Insert** — but only after the `search_inventory` check below comes back empty too (step 3) |
| The only good match is `INACTIVE` | **Reactivate and update it** — the supplier dropped this plant and brought it back; never insert a second copy |
| Two or more candidates are equally plausible **and materially different** (different price or printed name) | **Touch none of them.** Report the plant, size and candidate ids under *Flags needing Chris* |
| Several candidates are the *same* offering — same printed name and price, differing only by `dupes` or a stale quantity | **Update the top one, leave the rest**, and list them under *Duplicates found* |

Two things that decide most of the judgement calls:

- **A high score is not identity.** `Abies concolor [Blue Select]` and
  `Abies concolor [Candicans]` are different plants that score close together;
  sibling cultivars are the classic trap. When both your entry and the candidate
  name a cultivar and they disagree, the line is marked **`CULTIVAR MISMATCH`**
  and is excluded from the suggestion — but the mark only fires when *both* sides
  name one. Read the name, don't read the number.
- **No candidates does not mean new — ask `search_inventory` before every
  insert.** `match-candidates` ranks by trigram similarity on the identity key,
  so it comes back empty when the supplier prints the botanical name where they
  used to print the common one (or the reverse), or renames the plant outright.
  The RPC is typo tolerant, matches partially at both ends, and expands the
  query through `plant_aliases`, so it finds what similarity misses. **No entry
  is inserted until it has been searched.** The RPC takes **no supplier filter**
  — search first, then scope to this location in the outer query:

  ```sql
  SELECT id, name, cultivar_variety_trade_name, size, size_std, unit_price,
         quantity, is_active, relevance
  FROM search_inventory('<the entry as the source prints it>')
  WHERE supplier_id = ANY(ARRAY[<this location's supplier_id>])
  ORDER BY relevance DESC LIMIT 10;
  ```

  Run it once per name form the entry gives you — the common name **and** the
  botanical name, since either may be what the row was written under. A hit that
  is the same plant in the same container is an **update** (step 2), however low
  `match-candidates` scored it; feed the id back into the table above. Results
  are ranked, not filtered, so read `relevance` and the returned name parts
  before concluding: a weak tail of unrelated rows is normal, and a species
  returned for a cultivar search is not the selection you parsed. The
  `plant-and-supplier-search` skill covers reading a result set.

**Expect the duplicate row of that table on established suppliers.** As of
2026-08-14, 5,714 `(supplier_id, name_key, size, height, width, caliper)` groups
across 77 suppliers cover more than one active row — about 13,500 rows, roughly
two-thirds of them same-price duplicates left behind by the old
replace-and-retire model. That is a cleanup backlog, not a parse failure, and no
ingest resolves it: update one, report the rest.

**2. Update the matched row** with this drop's values: `source_id` = the new
source id **for that row's location**, `unit_price`, `quantity`, `size`,
`size_std`, `height`/`width`/`caliper` and their `*_std`, `image_url` if the
drop has one, and `is_active = true`. `image_url` is a **link, not a copy** —
the address of a photo on the supplier's own page, written as-is. It is where a
captured URL lands ([photos](photos.md)); a photo we were *given* as a file goes to
`plant_photos` instead, and the two never describe the same image. Notes follow
[note ownership](values-notes.md):

- **`notes` is replaced** with this drop's supplier text under [lean notes](values-notes.md) —
  usually `NULL`, since a plain line item says nothing beyond its columns, and
  a qualifier the drop no longer prints comes off the row. The previous drop's
  file is still in storage as evidence. If this drop doesn't mention the row at
  all, leave `notes` as it is rather than blanking it.
- **`internal_notes` is appended to**, never clobbered — your earlier caveats
  about this row are still true.

`updated_at` is maintained by trigger; don't write it.

**3. Insert a genuinely new offering** — one whose `search_inventory` check in
step 1 returned nothing for this supplier — with the normalized fields from [normalization](normalization.md),
stamping `supplier_id` and `source_id`. `id` defaults to `gen_random_uuid()`.
Write `common_name` / `botanical_name` / `cultivar_variety_trade_name`;
**never write `name` or any `*_key` column** — the trigger derives all of them,
and a value you put there is overwritten. Never match plant names with `=` on
raw text (compare `name_key` / `common_name_key` / `botanical_name_key`, test
`cultivar_keys` with `&&` or `= any`, or wrap the text in
`normalize_plant_key()`).

**4. Insert only approved active alias pairs into `plant_aliases`** as defined
in [normalization](normalization.md), each with its `source_id` and the `source_line` that attests it. A BEFORE INSERT trigger silently drops duplicates, self-pairs, empty
keys and mirrored pairs, so blind-insert without conflict handling; new valid
pairs use `is_active = true` (default).

**Do not run a retirement pass.** No `UPDATE inventory SET is_active = false` and
no `UPDATE inventory_sources SET is_active = false` as part of an ingest.
Retiring an offering is a deliberate, separately approved act — if a supplier
tells you an item is discontinued, record that in `notes` and raise it under
*Flags needing Chris* rather than flipping the flag mid-ingest.

**A brand-new supplier's first ingest** finds nothing to match, so it is all
inserts.

**Multi-location: run steps 1–4 separately per `supplier_id`** in the [locations](locations.md) mapping,
each with its own source id. For paginated material, reconcile one page/location
batch at a time, then apply all verified decisions under the whole-source QA gate.
The parsed values are the same; the `supplier_id`,
the `source_id` and the row each one matches are not — a location is refreshed
only by its own rows, and a location this drop didn't cover keeps everything it
had. Record the per-location counts separately in your report; one total hides a
location that silently got nothing.
