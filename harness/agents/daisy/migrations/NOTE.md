# Migrations applied by Daisy

> **Historical record — superseded. Not a description of the current schema.**
> `public.rate_charts` has since been renamed to `public.inventory`, and
> `rate_charts` now survives only as a backwards-compatibility *view* over it.
> For the schema as it actually is, read `knowledge/SCHEMA.md` (the shared
> `docs/supabase-schema.md`). This file is kept only to record what was run.

Applied to Supabase project `xyeyiqchadfszewztnrf` (lps-rosie) via the Supabase MCP.

## `0013_legacy_zero_prices_to_null.sql`
Applied 2026-08-04 via Daisy's guarded Supabase runner with explicit Bhoumik
approval. `UPDATE 28998`: all historical `unit_price = 0` rows became `NULL`.
Post-check: zero = 0, null = 28,998, positive = 178,615. No positive prices
changed. Future numeric zero remains valid only when explicitly printed.

## `0012_search_inventory_nulls_last.sql`
Applied 2026-08-04 via Daisy's guarded Supabase runner after Bhoumik applied
0011. Replaces `search_inventory` without changing its signature or matching;
optional server-side sorts now append `NULLS LAST` in either direction. No
inventory rows changed.

## `0011_nullable_inventory_prices.sql`
Applied 2026-08-04 by Bhoumik. Drops the `NOT NULL` constraint from
`inventory.unit_price` and documents that `NULL` means no supplier price was
provided. It rewrites no data; all 28,998 legacy zero rows were left unchanged
for source-level review.

## `0010_purge_inactive_aliases_and_rollback_tables.sql`
Applied 2026-07-31 as `051` / `052`. Deletes the 78,807 retired alias pairs
(13,429 active remain, the whole table now) and drops
`inventory_pre_name_consolidation` and `name_consolidation_map`.

**Two things this permanently changed:**
1. `dedupe_plant_other_names()` blocks a duplicate `(name_key, other_name_key)`
   INSERT *regardless of `is_active`*, so the soft-deleted rows had been acting
   as a blocklist — a retired cultivar alias physically could not come back.
   That is gone. The SOP's alias quality bar is now the only guard. If bad
   aliases recur, add a blocklist table; don't reintroduce soft-deleted rows.
2. The name consolidation is no longer reversible, and the 359 source
   `category` values are gone from the database entirely.

## `0009_residual_merlot_aliases.sql`
Applied 2026-07-31 as `049` + `050`. Deactivates the last four Merlot-class pairs
(`Cercis canadensis x` / `Cercis texensis` ↔ `Merlot Redbud` / `Redbud Merlot` /
`Redbud Merlot Clump`) by id, then sweeps table-wide for the same shape — 19
further pairs (`Sedum rupestre` ↔ `Angelina Stonecrop`, `Ulmus` ↔ `Allee Elm`,
`Hydrangea x` ↔ `Let's Dance Sky View Hydrangea`), all eyeballed, 19/19 correct.

The sweep only works **with trademark corroboration**. The same rule without it
flags 484 pairs and takes genuine common names with it (`Pinus taeda` ↔
`Loblolly Pine`, `Agave vilmoriniana` ↔ `Octopus Agave`, `Rhus trilobata` ↔
`Skunkbush Sumac`). Verified unharmed: Loblolly Pine 59, Octopus Agave 11,
Texas Redbud 57.

The alias graph is now clean for all three reported cultivars: Forest Pansy 45/0,
Ruby Falls 46/0, Merlot Redbud 12/0, with `Texas Redbud` still at 57.

**Still open (not an alias problem):** "Merlot Redbud" shows two `Redbud, Mexican`
rows, and "Pink Pom Pom" ~2,300, purely from pgroonga matching a single shared
token. Genuine hits still rank first. Requiring all query tokens would change
every search in the app, so it is a ranking/product decision.

## `0008_alias_quality_audit.sql`
Applied 2026-07-31 as `047` / `048a`–`048d`. Three parallel audits pruned the
alias directory: generic labels by fan-out (a name used for ≥5 distinct plants
is a category — "Grass" covered 64), non-plant junk (hardgoods, feed
truncations, grade codes), nine hand-verified wrong-taxon pairs, and cultivar
residue on single-word epithets. Active pairs 19,106 → 13,452.

"Forest Pansy" and "Ruby Falls" now return **zero** false positives;
"Merlot Redbud" went 46 → 7.

**Read the file's REJECTED RULES section before attempting more cleanup.** Four
plausible rules were built, measured and thrown out for destroying genuine data
— notably any single-word epithet dictionary (the corpus yields "texas",
"japanese", "rock", "firecracker") and any same-genus rule (~0–1.5% precision;
it is almost entirely accepted synonyms like *Aloe barbadensis* ↔ *A. vera*).
The file also lists what was deliberately left for a human, including 11 pairs
where only a taxonomic authority can say which side is wrong.

## `0007_retire_carryforward_aliases.sql`
Applied 2026-07-31 as `046a`. Retires the 48,269 still-active pairs that 0005's
carry-forward (042e) inserted — the single largest source of search false
positives. It ran before the 0006 cleanup and its filter caught only quoted and
patent-marked cultivars, so unquoted compounds (`Redbud Pink Pom Pom`) and
sibling *species* (`Redbud [Forest Pansy]` ↔ `Cercis mexicana`) came along.

After it: "Forest Pansy" 45 results / 0 false positives, "Ruby Falls" 46 / 0.

**Cost:** of 40,715 active bracketed rows only 4,378 remain reachable through the
alias graph. Rows whose name already contains the botanical name are still found
by text; rows whose common name lived only in the alias graph are not.

**Still open** — do not assume the cultivar cleanup is finished:
- *Merlot-class residue.* Pre-existing pairs on species hubs
  (`Redbud, Texas` ↔ `Merlot Redbud`, `Traveller Redbud`) still cross-match; a
  "Merlot Redbud" search returns ~25 wrong rows. These use single-word epithets.
  A generic rule was built and **rejected**: the only available epithet
  dictionary contains `texas`, `oklahoma`, `eastern`, `rock`, `japanese`, so it
  also deleted genuine names (`Penstemon eatonii` ↔ `Firecracker Penstemon`).
  This needs a curated epithet list or per-hub cleanup like 0004's.
- *Token-OR noise.* "Pink Pom Pom" returns ~2,300 rows matching only "pink"
  (`Acer palmatum [Pink Panther]`). That is pgroonga's any-token matching, not an
  alias fault — genuine hits still rank first. Requiring all query tokens would
  change every search, so it is a product decision, not a cleanup.

## `0006_cultivar_alias_cleanup.sql`
Applied 2026-07-31 as `045a` / `045b` / `045c`. Generalizes 0004's hand-listed
Redbud cleanup, in three passes: quoted cultivar epithets and patent/trademark
markers (`PP21929`, `PPAF`, `™`, `®`); pairs where one whole side is a multi-word
cultivar epithet seen in quotes elsewhere; and the same epithets used as a prefix
to a head noun (`Autumn Blaze Maple`, `Forest Pansy Redbud`). 24,861 of 92,236
pairs are now inactive, and a "Forest Pansy" search returns no sibling cultivars.

Two deliberate guards: single-word epithets are left alone, because "Gala",
"Mango" and "Plum" are as often a real common name; and matching preserves word
boundaries, so the cultivar `Ilex x 'Oak Leaf'` cannot collapse to `oakleaf` and
kill the genuine `Hydrangea quercifolia` ↔ `Oakleaf`.

Known residue: compound aliases built on a *single-word* epithet still slip
through. Catching them needs a fuzzier rule that would take genuine names with
it, so they were left.

## `0005_inventory_name_consolidation.sql`
Applied 2026-07-31 as `042*` / `043*` / `044`, split into small steps because the
guarded runner rejects large multi-statement DDL batches. `inventory.name` now
carries the whole plant identity as `Name [scientific name, variant]`;
`inventory.category` and `inventory.variety` are **dropped**. 101,678 rows had
their variety folded into the name. Each new name also inherited up to three of
its base name's aliases (step 042e) — **that carry-forward was wrong and has
since been retired by 0007**; do not reinstate it without a trustworthy epithet
dictionary.
Both search indexes and both views (`rate_charts`, `inventory_enriched`) were
rebuilt around the drop, and `search_inventory` lost its `category_filter`
parameter along with the two columns. `suppliers.category` is untouched.

The scientific name was **not** backfilled: deriving it from the existing alias
graph was tried and abandoned as too unreliable (`Acer Palmatum` resolved to the
cultivar `Oto hime`). It is captured going forward, from the source.

Pre-change values are preserved in `public.inventory_pre_name_consolidation`
(id, old_name, old_category, old_variety) and the name mapping in
`public.name_consolidation_map`. Drop both once the change has settled.

## `0004_active_plant_aliases.sql`
Applied 2026-07-31 as `041_active_plant_aliases` (prepared 2026-07-30 with
Bhoumik's approval; it had been held back because Daisy's guarded query runner
blocks `ALTER TABLE`). Adds `plant_other_names.is_active`, updates
`search_inventory` so only active aliases power matching/display, and deactivates
the observed Redbud cultivar-to-species pairs that made Forest Pansy searches
return sibling cultivars. Superseded in part by 0005/0006 below, which replaced
`search_inventory` again and generalized the alias cleanup.

## `0003_search_prefix_match.sql`
Applied 2026-07-28 as `040_search_prefix_match`. `CREATE OR REPLACE` of
`search_inventory` and `search_suppliers` only — no tables or indexes touched.
Fixes word-prefix searches returning nothing ("Mexican Sycamor" → 0 rows while
"Mexican Sycamore" → 17): the pgroonga `TokenDelimit` index matches whole
tokens, its fuzzy path misses edits at the end of a token, and the 038 trgm
fallback excludes substring-of-document queries — so typed prefixes fell
between all branches. Both functions now also OR in the normalized query with
a Groonga `*` prefix wildcard on the last token (only when that token is
≥ 3 chars, to keep short tokens like "g" from matching everything).

## `0002_supplier_communication_notes.sql`
Applied 2026-07-27. Adds `suppliers.communication_notes` (nullable text) and
column comments separating it from `suppliers.notes`:

- **`notes`** — durable profile facts with no dedicated column (quirks,
  preferences, price-list format, ordering constraints).
- **`communication_notes`** — append-only contact log, one timestamped entry per
  contact.

Additive only: no rewrite, no backfill, no data touched (~910 rows, all
`communication_notes` null on apply).

## `20260701104209_daisy_availability_versioning`
Source: `0001_availability_versioning.sql`. One migration, applied 2026-07-01.

Changes to `public.rate_charts`:
- Renamed `common_name` → `common_names` (comma-separated list of names).
- Added `category text`, backfilled from `rate_chart_sections.name` via the old
  `section_id` (0 nulls across all 1,470 rows).
- Added `is_active boolean NOT NULL DEFAULT true` (all rows active) + index
  `rate_charts_supplier_active_idx (supplier_id, is_active)` for versioned ingestion.
- Dropped `section_id`.

Also dropped the `public.rate_chart_sections` table.

No data lost; category casing left as-sourced (both `TREES` and `Trees` exist).
RLS remains disabled on these tables — not changed here.
