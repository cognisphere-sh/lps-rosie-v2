# Migrations applied by Daisy

> **Historical record — superseded. Not a description of the current schema.**
> `public.rate_charts` has since been renamed to `public.inventory`, and
> `rate_charts` now survives only as a backwards-compatibility *view* over it.
> For the schema as it actually is, read `knowledge/SCHEMA.md` (the shared
> `docs/supabase-schema.md`). This file is kept only to record what was run.

Applied to Supabase project `xyeyiqchadfszewztnrf` (lps-rosie) via the Supabase MCP.

## `0027_cultivar_prefix_intent.sql`

Applied 2026-08-12 as the final approved identity-search follow-up after independent review of 0026. Keeps the same RPC signature/direct-edge alias behavior and adds an explicit normalized word-prefix predicate—using the same predicate for distinguishing-token rarity and the final gate—alongside bounded fuzzy matching. `Crape Myrtle Musko` and reversed return identical 95-row / 19-supplier sets with zero non-Muskogee identities. The app's old zero-result word-splitting fallback was removed, so an invented cultivar such as `Crape Myrtle DefinitelyNotACultivar` remains empty end-to-end instead of broadening to generic Crape Myrtle. No table write.

## `0026_exact_plant_identity_search.sql`

Applied 2026-08-12 as Bhoumik-approved option B after the exact 0025 Crape alias cleanup. The existing `search_inventory` signature is unchanged. Both the RPC and `inventory_enriched` now derive aliases only from reviewed edges directly incident to the row's exact identity; the reverse-hub sibling UNIONs are removed. Multi-word searches choose the least-common query word in the candidate set as distinguishing identity intent and require it in the row's exact name or direct alias with bounded 0.20 fuzzy/prefix tolerance, independent of word order. One-word/generic searches stay broad. The app labels the derived value **Also known as** and no longer runs a second browser alias refinement.

Post-0025 → post-0026: `Crape Myrtle Muskogee` and reversed 442 rows / 30 suppliers / 344 non-Muskogee identities → **98 / 20 / zero**, with identical ID digest `de144abdde245210941c2141d7688a79`. Truncated typo `Muskog` returns 95 / 19 with identical word-order digest. Generic `Crape Myrtle` remains broad at 548 / 35 and retains 87 Muskogee, 107 Natchez, four Tonto and all five bare `Lagerstroemia indica` rows; bare indica displays only direct alias `Crepe Myrtle`. Regression fixtures: Francis Mason Abelia 10 / 9 both orders, Japanese Holly Compacta 4 / 2, Clusia Small Leaf 39 / 9. Combined server dimension bounds returned 76 rows with zero violations. RPC signature count remains one and `inventory_enriched` remains `security_invoker=true`. This migration changes only view/function definitions; no table row changed.

## `0025_retire_crape_myrtle_cultivar_aliases.sql`

Applied 2026-08-12 with Bhoumik's explicit approval (Telegram message 671) after a read-only Crape Myrtle/Muskogee focal audit. Soft-retired exactly **66 active unsafe alias rows**: 59 cultivar/selection/trade/color/form names attached to the bare `Lagerstroemia indica` hub, five Muskogee cultivar identity aliases, and two malformed generic/form bridges. Preserved safe ID **13059**, `Lagerstroemia indica` ↔ `Crepe Myrtle`, and every alias outside the exact reviewed set.

The guarded transaction returned 66 exact IDs (`updated_id_digest=0c9ec61bd06c675747a9921d52fd4b82`). Target alias-state digest changed `653d2dc8aac47e05424079e563b6bc39` → `bf2d87b6846cb1d43ce89a1d8f5cca00`; all 66 targets are inactive and ID 13059 remains active. Just-before → after live RPC: generic `Crape Myrtle` 610/40 → 592 rows/37 suppliers and remains broad (95 Muskogee, 115 Natchez, 4 Tonto, 1 directly connected bare indica row); `Crape Myrtle Muskogee` 486/38 → 442/30 and both word orders now share the same result digest, but 344 non-Muskogee rows remain from backend fuzzy/sibling behavior assigned separately to Nova. No inventory row changed: total 235,976, active 62,523, max updated timestamp and complete inventory-state digest `1b2f0959522394a8febd11274c266425` are byte-identical before/after. Exact rollback and regression artifacts live under `workspace/threads/main/crape-myrtle-alias-audit/`.

## `0024_inventory_dimension_std_backfill.sql`

Applied 2026-08-11 after 0023, with Bhoumik's approval. Backfilled standardized numeric values for **94,297 inventory rows** (26,096 active / 68,201 inactive), deriving only from the corresponding displayed human-readable field: `height_std` 75,357 rows (21,081 active), `width_std` 40,537 (9,385 active), `caliper_std` 22,589 (6,674 active). Height is feet; width/caliper are inches; ranges use the lower bound; explicit conversions retain float8 precision. Null remains unknown/ambiguous.

The exact guarded input is `migrations/artifacts/0024_inventory_dimension_std_backfill.csv.gz` (SHA-256 `ee3e35c0252e67cebcf527ac153c307b21b26d2eed730df070a9d4d57c3a5c6b`). It uses `\N` for SQL null and preserves one genuine empty string. No size/height/width/caliper string, timestamp, identity, source, price, quantity or activation flag changed.

A first rejected artifact rounded conversions and used hidden `size` evidence; it was aborted before commit. The database became temporarily unavailable while PostgreSQL rolled back, then live zero counts/digests proved no partial write. The corrected direct-field-only apply used deterministic guarded chunks. One 2,000-row chunk timed out and rolled back; later a guard caught the CSV null/empty ambiguity and rolled back that chunk. Smaller continuations preserved the empty string and completed safely. Final QA: inventory 232,837 / 69,540 active / 163,297 inactive; nonpositive standards 0; outside-standard digest `2ce8e7a2e2e9764bc7ede1f723128c82`; outside-all-target digest `8920860c8376c6c477ee70c631cd911e`; supplier/source digests unchanged; direct-display and explicit-unit precision regressions passed.

## `0023_numeric_inventory_dimensions.sql`

Applied 2026-08-11 by Nova after the guarded 0022 string cleanup. Adds nullable `double precision` `inventory.height_std` (feet), `width_std` (inches), and `caliper_std` (inches). Human-readable `height` / `width` / `caliper` remain unchanged and continue to power display/evidence. Ranges use Bhoumik's approved conservative lower number; ambiguous values stay `NULL`.

`inventory_enriched`, the backwards-compatible `rate_charts` view and `search_inventory` append all three fields. Both views explicitly retain `security_invoker=true`. `search_inventory` was replaced in one transaction—one unambiguous PostgREST signature—with six nullable inclusive bounds applied before rank/limit and numeric sorting for the three displayed dimensions. Three partial `(supplier_id, *_std)` btrees cover active non-null supplier-page ranges without changing the text-search indexes.

The app sends bounds to PostgreSQL before the 300-row global cap and 100-row supplier pagination, displays the original strings, exposes unit-labelled min/max controls on desktop/mobile, validates API bounds, and clears a companion standard on an unpaired manual string edit. Migration 0024 performs the separately guarded numeric backfill described above.

## `0022_inventory_size_structure_cleanup.sql`

Applied 2026-08-11 through Daisy's guarded Postgres runner with Bhoumik's explicit approval. It audited all 232,837 inventory rows and moved only explicit, evidence-backed dimensions out of `inventory.size` into the existing human-readable `height`, `width`, and `caliper` fields.

**2,309 rows updated: 491 active / 1,818 inactive.** Every changed row had `size` cleaned; 33 `height`, 154 `width`, and 788 `caliper` values were filled. Populated structured fields were retained when semantically identical; 1,660 conflicts (usually a complete range in size versus an existing lower-bound scalar) were held byte-for-byte. 567 explicit dimension-only values became NULL size; no commercial container/root-ball size was nulled. All 5,603 inch box/pot/bag/basket rows were retained unchanged. No row was inserted, deleted, merged, activated, or retired.

The update ran in one transaction guarded on every ID and all four before-values, expected active/inactive counts, the complete inventory digest outside the four target fields, supplier/source digests, and per-supplier inventory counts. `session_replication_role=replica` was transaction-local so the generic timestamp trigger did not alter `updated_at`; only the four approved columns could move.

Post-apply: inventory remains 232,837 total / 69,540 active / 163,297 inactive; outside-target digest remains `8920860c8376c6c477ee70c631cd911e`; suppliers remain 1,383 and sources 2,065 / 759 active with identical digests. The deterministic contamination scanner reports **0 safely classifiable labeled dimensions left in size**. Duplicate groups changed 9,739 → 9,748 (excess rows 14,490 → 14,509) solely because identity facets converged; no rows were merged. Representative gallon, box, B&B, dimension-only and mixed-row searches all passed. Full evidence and exact rollback live under `workspace/threads/main/size-structure-cleanup/`.

The approved numeric standard columns (`height_std` feet, `width_std` / `caliper_std` inches) are a separate follow-up: Nova deploys schema/RPC/app migration 0023, then Daisy applies a distinct guarded 0024 backfill. No numeric values were written by 0022.

## `0021_retire_abelia_cultivar_aliases.sql`

Applied 2026-08-11 with Bhoumik's explicit approval after the focal Francis Mason audit. Retired exactly 15 unsafe bare-species/adjective alias edges that linked sibling Abelia cultivars while preserving four verified `Abelia × grandiflora` / `Glossy Abelia` same-plant mappings. No inventory changed. `Abelia Francis Mason` fell 37 rows / 15 suppliers → 10 / 9; Florida 3 G became exactly Joe's Nursery Francis Mason rather than Francis Mason plus false Rose Creek; generic `Abelia` remained 188 rows / 31 suppliers.

## `0020_enable_rls_size_snapshot.sql`

Applied 2026-08-11 via the Supabase MCP. One statement: enable RLS on
`inventory_pre_size_normalization`, the 0019 rollback snapshot. It was created
after `0011_enable_rls.sql` swept the schema, so it was the one table PostgREST
still served to `anon` (the dashboard's `rls_disabled_in_public` error). No
policies added — only `postgres`/`service_role` (BYPASSRLS) ever read it, and
it is still slated to be **dropped once the size change has settled**.

## `0019_standardize_inventory_sizes.sql`

Applied 2026-08-05 via the Supabase MCP in two steps
(`0019_standardize_inventory_sizes_snapshot`, then `..._rewrite`).
**38,090 of 209,415 `inventory.size` values rewritten**; distinct values
5,255 → 4,974 overall and 2,769 → 2,671 among active rows.

The finding behind it: **`public.normalize_size(text)` has existed all along and
nothing ever called it.** No trigger, no generated column, no default — so the
SOP's size rule only applied when a parsing agent remembered to hand-apply it,
and the column drifted. `1G` (8,533 rows) and `1 G` (7,096 rows) were two values
in the same table; likewise `3G`/`3 G`, `15G`/`15 G`, `45 G / 28"`/`45 G/28"`,
`024 Inch Box`/`24" Box`. This ran the existing function over the existing rows.

**Syntactic only.** It fixes unit spelling, spacing and leading zeros. It does
**not** change what the column carries: `6 G; Bush`, `3 G TRUE`, `1 G <24"`,
`1 G (6ct)` keep their qualifiers, and height/caliper values parked in `size`
(`5-6'`, `2-2.5"`, `B&B 4-5'`) were left alone. Splitting those out is a
semantic change needing source review per SOP §5 — **still open**, and the
reason the app's size filter still lists ~2,671 choices.

**Verified after apply** (all four checks in the `.sql` file): 0 values left
unnormalized outside the exclusion, 0 sizes nulled, **0 rows lost alphanumeric
content** (the only permitted losses are unit words collapsing to symbols —
`GAL`→`G`, `Inch`→`"`, `#`→` G`), 209,415 rows still present, 38,090 changed.
Pre-flight ran the same content check over all 383 affected distinct values and
returned zero. `search_inventory('Agave Americana')` still returns 478 rows.

**12 rows deliberately excluded**, all `#N box|bag`: `#` means gallons per the
SOP, but a box is sized in inches, so `#24 Box` → `24 G Box` may be flat wrong.
They are `#24 Box NET` (3 rows), `#16 Box CG`, `#100 Bag`, `10-12' #100 Bag
BBP`, `8-10' #100 Bag BBP`, `9' #42 box 3X BBP`, `3" #30 box BBP`, `3.5" #30 box
BBP`, `4" #60 box BBP`, `5" #60 box BBP` — one row each. **A human should read
these against the original source**; there is no way to tell gallons from inches
from the string alone.

`public.inventory_pre_size_normalization` (id, old_size, snapshot_at) holds the
38,090 pre-rewrite values. **Drop it once the change has settled.**

The SOP's size rule was expanded in the same change (approved by Bhoumik) from
one line about unit spelling to a full standard: canonical units, word sizes,
the `#N box` exception, what must *not* go in `size` (height/width/caliper,
form and grade codes, pack counts), and a pointer at `normalize_size()` as the
reference implementation.

## `0018_supplier_availability_source.sql`

Applied 2026-08-05 via the Supabase MCP, in two steps — recorded in the
migration history as `supplier_availability_source_columns` and
`search_suppliers_availability_source_columns` (no `0018` prefix, unlike
0014–0017). Adds three nullable columns to `suppliers` describing how a
supplier's availability reaches us: `availability_source_type`
(CHECK `Email | Hosted`), `availability_update_days` (CHECK `> 0`) and
`hosted_availability_url`. Additive — 0 rows rewritten, all 910 start null.

**Null is "not established yet", not "none".** The whole point is to make
filterable what was previously prose in `notes`, so a blank source type is a
to-do. For the same reason there is **no constraint tying the URL to a `Hosted`
source type**: rows are routinely half-filled while someone works out how a
supplier publishes, and a supplier that both emails a sheet and posts one on a
portal is a real case.

`search_suppliers` was dropped and recreated to return the three columns and
accept them as `sort_column` — its return type is fixed, so the app could not
see them otherwise. Nothing else about the function changed: same matching,
same ordering, same contact branch. The pgroonga document and
`suppliers_pgroonga_idx` were **not** rebuilt — an enum, an integer and a URL
are not text worth matching a query against, and the index expression has to
stay byte-identical to the function's concatenation.

App-side: the Suppliers table gained the three columns (source type edits
through a new `select` cell kind, the URL stays a clickable link with a pencil),
`WRITABLE.suppliers` gained all three, and the supplier profile shows them.

## `0017_drop_fax_and_migration_snapshots.sql`

Applied 2026-08-05, closing out the 0014–0017 contact normalization.

`suppliers.fax` was the last contact field on the table; it is gone, and
`suppliers` now carries **no way of contacting a supplier at all** — name,
category, address, coordinates, website, notes, communication_notes only.

The 12 fax numbers were preserved first, into the `notes` of each supplier's
main-line contact (preferring `title_department = 'Main line'`, then the
primary, then the oldest row). **Deliberately not `contacts.phone`:** the app
renders that as a `tel:` link, so a fax number there dials a fax machine.
Verified 12/12 present after the move.

Nothing in the app, `search_suppliers` or the pgroonga document ever referenced
`fax`, so no index or function rebuild was needed.

Also dropped, now that the changes have settled:
`suppliers_notes_pre_contact_extraction` (0015) and `suppliers_contact_pre_move`
(0016). **The 0014–0017 column drops are no longer reversible from this
database.** Post-apply: 0 snapshot tables, `search_suppliers` returns 904,
`search_inventory` unaffected.

## `0016_move_supplier_email_phone_to_contacts.sql`

Applied 2026-08-05, completing what 0014/0015 started. `suppliers.email` and
`suppliers.phone` moved into `contacts` and **both columns were dropped**.
`suppliers` now describes the company only; every contact route is a `contacts`
row. `suppliers.fax` followed in 0017.

One row per supplier is created from the email/phone pair with
`title_department = 'Main line'`. It takes `is_primary` only when no active
primary exists, so the named people 0014/0015 established keep precedence over a
generic `info@`.

**Names are guessed from a hand-curated allowlist, never a pattern.** A
`first.last` regex matches `tynursery.orders`, `treeoflife.gardencenter` and
`customerservice.bhf`; a single-first-name regex matches `howdy`, `fieldgrown`
and `plants`. So both tiers are explicit lists of values actually present here,
reviewed one by one: 9 full names, 6 first-names-plus-company, ~118 recognisable
single-token first names. Everything else keeps `name = NULL`. Ambiguous tokens
were deliberately skipped — `austin` (also a city), `hunter`, `angel`, `cat`,
`chance`, `moe`, `shorty`, `ikey`, `gay`, and every initial+surname form
(`dwinningham`, `bstitt`) whose first name cannot be recovered without inventing
it. **All ~160 guessed rows carry `Name inferred from the email address;
unverified.` in `contacts.notes`.**

**Result:** contacts 76 → 973 across 907 suppliers; 233 have a name.

**Verified after apply**, against the `suppliers_contact_pre_move` snapshot:
**0 emails and 0 phones lost**, 0 multi-primary violations, 0 leftover columns.
`search_suppliers` returns 904 active suppliers, 898 with a primary email, and
searching a full address (`susan.sheffield@acostafarms.com`) resolves to its
supplier through the contacts branch.

One trap worth recording: the first pass reported 11 phones missing. Those were
suppliers whose email already matched a person's contact row — that person had
their own cell, so the "fill phone where null" update never fired and the
company's main line would have vanished with the column. They got their own
nameless `Main line` row. **Anything similar in future: re-run the
snapshot-vs-live check before dropping, not after.**

`public.suppliers_contact_pre_move` (id, email, phone, snapshot_at) holds the
pre-move values. **Drop it once the change has settled.**

Knock-on changes: `suppliers_pgroonga_idx` rebuilt without email/phone;
`search_suppliers` dropped and recreated without the `phone`/`email` return
columns and sort keys (contact matching already covers those values);
`app/lib/columns.ts` lost both supplier columns; the profile lost both fields;
`WRITABLE.suppliers` lost both; and Daisy's supplier-identification query in
`1-agent.md` plus the SOP's onboarding search now join through `contacts`.

## `0015_extract_contacts_from_notes.sql`

Applied 2026-08-05, straight after 0014. Before `contacts` existed, people found
in availability emails and on supplier websites had nowhere to go, so they were
written into `suppliers.notes` as prose. This lifts them out.

All 54 suppliers with non-empty notes were read by hand — 48 active, 6 inactive.
The 6 inactive ones are duplicate-record tombstones whose notes are pure
provenance, and were left alone.

The rule, applied uniformly: a **named person** and their email/phone/role
becomes a `contacts` row, and notes lose only the text that carried that
person's contact details. Everything else stays — hours, addresses, policies,
parsing quirks, business history, and generic/role inboxes (`sales@`, `orders@`,
`avail@`), which are the company's own contact surface and already live on
`suppliers`.

**Result:** 29 contacts inserted (47 → 76 rows, 49 suppliers), 12 existing rows
gained the role the notes described, 3 gained a missing email/phone, 20 supplier
notes trimmed (5 of them to `NULL` because contact details were their whole
content). It also removed the last reference anywhere in the database to the
dropped `poc_email` column (supplier 204).

**Verified after apply**, since trimmed prose cannot be regenerated:

- All 44 people named in the original notes resolve to an active contact row.
- Every email address removed from a note exists on `contacts` or `suppliers` —
  0 lost.
- Every phone number removed from a note likewise, compared on digits only —
  0 lost.
- 47 primaries, 0 multi-primary violations, 0 remaining `poc_*` references.

`public.suppliers_notes_pre_contact_extraction` (id, notes, snapshot_at) holds
the pre-trim text for all 54 suppliers. **Drop it once the change has settled.**

Two judgment calls worth knowing:

1. **New rows are `is_primary = false`.** Where a supplier had no contact at all
   (Tom Dodd, Cox Cactus), nothing was promoted — the notes ranked nobody, and
   `search_suppliers` falls back to the oldest active row, so the supplier still
   displays a contact without anyone asserting who *the* POC is on no evidence.
2. **Supplier 255 now has two Felix Riveros.** The existing `Felix Jr. Rivero`
   and the notes' `Felix Rivero` carry different office, cell and email. They
   are kept separate with the ambiguity recorded on the new row rather than
   merged on a guess.

Six notes that name a person were deliberately left intact, because the sentence
carries a fact rather than a directory entry: 12 Ran-Pro (what Ken Howard sends,
and that the farm shut down), 43 Greenstock (routing instruction), 59 Green Land
(who distributes availability), 297 Davenport (who a list came from), 520 Focal
Point (how to work with John Shearouse), 914 Hand Tree (forwarding provenance).

## `0014_supplier_contacts.sql`

Applied 2026-08-05 in five steps (`0014a`–`0014e`). The `poc_*` drop is
irreversible, so the backfill was reconciled against the source columns first:
**47 rows** inserted — 45 with a name, 41 an email, 37 a phone, 47 primary —
matching all four source counts exactly, with **0 value mismatches** on a
row-by-row comparison. Post-apply: 0 `poc_*` columns remain; `search_suppliers`
returns 904 active suppliers, 42 carrying a primary contact name (the other 3
named contacts belong to inactive suppliers, correctly filtered out); a contact
name whose supplier name does not contain it still finds that supplier;
`search_inventory` is unaffected.

Splits the supplier point of contact out of `suppliers` into `public.contacts`,
one row per person, so a supplier can have more than one. `poc_name` /
`poc_email` / `poc_phone` held exactly one and were used by 47 of 910 rows.

Three things worth knowing:

1. **`contacts.name` is nullable.** Two backfilled rows carry only an email or
   phone (a shared sales inbox). A `NOT NULL` name would have forced inventing
   one.
2. **One active primary per supplier**, via the partial unique index
   `contacts_one_primary_idx (supplier_id) WHERE is_primary AND is_active`.
   Promotion must **demote the incumbent first**; the reverse order trips the
   index. Retired contacts keep their flag as history without blocking anyone.
3. **Contact text left the suppliers search document.** An index expression
   cannot read another table, so `poc_name` could not simply be re-pointed at
   `contacts`. Instead `suppliers_pgroonga_idx` drops it, `contacts_pgroonga_idx`
   covers the contact document, and `search_suppliers` folds matching
   `supplier_id`s in as a precomputed array — the same shape as the existing
   trigram fallback, which keeps the suppliers index usable for the main branch.
   Contact-only matches score 0 and sort after direct matches.

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
