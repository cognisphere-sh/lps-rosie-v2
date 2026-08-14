# Migrations applied by Daisy

> **Historical record — superseded. Not a description of the current schema.**
> `public.rate_charts` has since been renamed to `public.inventory`, and
> `rate_charts` now survives only as a backwards-compatibility *view* over it.
> For the schema as it actually is, read `knowledge/SCHEMA.md` (the shared
> `docs/supabase-schema.md`). This file is kept only to record what was run.

Applied to Supabase project `xyeyiqchadfszewztnrf` (lps-rosie) via the Supabase MCP.

> Gap: `0028` and `0029` are applied but were never recorded here.

## `0035_inventory_name_cultivar_delimiter.sql`

Applied 2026-08-14 with Bhoumik's approval. Drafted as 0033, so its DDL step
appears in the Supabase history as `0033_inventory_name_delimiter_snapshot`;
0033/0034 were taken by a concurrent session two minutes earlier and an applied
migration cannot be renamed. Rewrites the cultivar delimiter in
`inventory.name` to the SOP's bracket form — `Acer palmatum 'Bloodgood'` and
`Thuja occidentalis ['Smaragd']` become `… [Bloodgood]` / `… [Smaragd]`.
**2,965 distinct names / 7,691 active rows.** Active rows only (0031's call);
20,334 matching inactive rows were left as printed.

**This is the format half of the SOP name rule and nothing more.** The
scientific and common names are *not* backfilled into the bracket — the SOP
requires the bracket to carry what the source printed, 0005 already tried
deriving it from the alias graph and abandoned it, and 0005's companion
carry-forward became the largest source of false positives (retired by 0007).
Filling the missing halves means re-parsing the 491 stashed sources per
supplier under SOP §5. Still open.

**Why it was safe to run mechanically:** `normalize_plant_key()` strips every
non-alpha character and `normalize_search_text()` maps punctuation to a space,
so all three spellings already shared one key *and* one token stream. Verified
after apply: **0 `name_key` changes, 0 token-stream changes** (924 rows differ
only in whitespace runs, which `TokenDelimit` ignores). No alias edge moved, so
the 0007 failure mode could not fire, and no row's membership in any search
result could change. Distinct active names **26,491 → 25,478** — 1,013
duplicate display identities collapsed, which is the actual user-visible win:
`Thuja occidentalis` Smaragd was three separate plants on the plants page.

Guards (all passed, else abort): exact snapshot count 7,691; zero `name_key`
drift; zero alphanumeric content change; zero residual quotes in rewritten
rows; active total still 62,572. Fixtures after apply: `Abelia Francis Mason`
10/9 and `Japanese Holly Compacta` 4/2, both matching the 0021/0026 baselines.
`Crape Myrtle Muskogee` reads 102/21 against 0026's 98/20 — that delta is
inventory ingested since 2026-08-12, and the four renamed rows among them are
genuine Muskogee rows that matched identically before the rewrite.

**Deliberately not touched: 642 names / 1,386 active rows** that still carry a
quoted cultivar, because each needs a judgment a regex cannot make — trailing
form/grade words the SOP bans from `name` at all (`Buxus x 'Green Mountain'
Globe`, `Picea pungens 'Globosa' Low Graft`), dash-separated trade names
(`Acer palmatum 'Wolff' - Emperor 1®` — Chris's `Crape Myrtle - 'Muskogee'`
case, which needs the typed-identity work), a foot mark beside a cultivar
(`Prunus serrulata 'Kwanzan' 4' Graft`), an apostrophe inside the cultivar or
base (`Magnolia grandiflora 'Bracken's Brown Beauty'`, `Coreopsis Li'l Bang
'Daybreak'` — a naive rewrite yields `Euonymus f. 'Emerald [n Gold]`), and
unbalanced source quotes (`Pinus heldreichii 'Irish Bells`).

`public.inventory_pre_name_delimiter` (id, old_name, snapshot_at) holds all
7,691 pre-rewrite names, RLS enabled per 0020's lesson. **Drop it once the
change has settled.**

## `0038_retire_riley_fuzzel_farm.sql`

Applied 2026-08-14 at Bhoumik's call, closing the question 0037 left open.
**Riley Fuzzel Farm (963) is Newton Nurseries Spring (1320) under its
pre-acquisition name** — Newton acquired Riley Fuzzel in 2023 and the site
trades as "Riley Fuzzel - Newton Nurseries". Both rows were created by the
2026-08-05 backfill from different angles (963 from source list Wholesale
Nurseries Texas::R118, 1320 from the duplicate re-screen) and landed on the same
street address.

963 soft-deleted. **Nothing was lost:** 0 inventory rows, 0 `inventory_sources`,
0 `availability_queries`, empty notes. Its one contact was
`info@rileyfuzzelfarm.com`, the acquired company's inbox, now closed — 0037 had
already taken that route off the Newton row.

**First production run of 0034's new cascade, and it behaved:** deactivating the
supplier retired its `supplier_contacts` link and then contact 1212 itself,
because 963 was that contact's last active location. Under the old
one-supplier-per-contact column this would have been indistinguishable from any
other cascade; here it is the whole point.

1320 also took the address it should have had — Newton relocated the Spring yard
from 630 Riley Fuzzel Rd (77373) to **21121 N Fwy Service Rd, Spring TX 77388**,
keeping the phone, so the contact 0037 wrote is still correct. Because the
retirement note on 1320 names Riley Fuzzel and `suppliers.notes` is in the search
document, `search_suppliers('riley fuzzel')` now returns exactly one row: Newton
Nurseries Spring, at the current address.

Left alone deliberately: `latitude`/`longitude` stay null on 1320 rather than
inherit 963's, which point at the *old* site; and `category` stays `Other`,
which all three backfilled Newton rows carry — a gap across the set, not
something this merge should half-fix.

## `0037_fix_newton_spring_and_ycnursery_contacts.sql`

Applied 2026-08-14, following the two items 0036 flagged.

**Newton Nurseries Spring (1320) was reading a closed company's inbox.** 0036
called this "a Newton location carrying another farm's contact details";
researching it first showed that read was half wrong. **Newton acquired Riley
Fuzzel in 2023** (their own release), the site trades as "Riley Fuzzel - Newton
Nurseries" at 630 Riley Fuzzel Rd, and **the phone `281-355-5495` is genuinely
that yard's** — not a stray value, and not changed. The *email* was the problem:
`info@rileyfuzzelfarm.com` is the acquired company's inbox, and Yelp now lists
Riley Fuzzel Farm as closed, so availability requests for the Spring yard were
going to the old owner. 1320 now has its own `Main line` contact (1848) with the
verified phone and **no email** — `spring-sales@newnurseries.com` matches the
three siblings on file but is printed nowhere we can read, and the SOP forbids
the guess. The shared row (1212) is unlinked from 1320 and untouched on 963.

Left for Chris on purpose: **963 and 1320 look like one business before and
after the acquisition** (same street address; Newton's page for it is
`/rileyfuzzel-spring/`), which is a supplier-level merge, not a contact fix. And
**1320's address is stale** — Newton has relocated the Spring nursery to 21121 N
Fwy Service Rd, Spring TX 77388. Which row should carry that depends on the
merge question, so neither was touched.

**A phone stored with a leading colon.** Contact 1782 (Lynn Agee, YC Nursery -
Prosper) held `:214-213-0962`; the delimiter is stripped. The digits are left
as printed — 1782 and 979 differ in the last digit (…0961 vs …0962), which is
either two real lines or a typo in the source, and a migration cannot tell.

## `0036_merge_duplicate_contacts.sql`

Applied 2026-08-14 at Bhoumik's request, the follow-up to 0034. Folds **33
contact rows into 13**, keeping every link: Jim Ord is now one contact with six
nurseries instead of six contacts, Ken Howard one with five. 20 rows retired
(`is_active = false`, each noting where it went), one link deleted — contacts
1013 and 1754 were both on Tree of Life Garden Center, the only duplicate
*within* a single supplier.

**The rule was deliberately narrow: same normalized email AND same normalized
phone, with no field of one contradicting the other.** `'Main line'` is
provenance from 0016, not a title, so it never counts as a conflict and yields
to a real title (contact 786 became "George Gianaris / Manager").

**Matching on email alone would have been wrong.** A shared company inbox is not
a duplicate person — `info@calloways.com` has three rows, three phone numbers
and two different named store managers — and because the phone lives on the
contact rather than the link, merging them would delete working numbers. Twelve
such groups (28 rows) were left untouched and are listed at the bottom of the
migration file.

Verified after apply: 0 links lost (every pre-merge supplier still reaches the
same route), 0 links left on a retired contact, 0 suppliers with two active
primaries, primaries unchanged at 1,083, and no name, real title or note from a
merged row dropped. Reversible from `contacts_merge_map`, `contacts_pre_merge`
and `supplier_contacts_pre_merge`.

Flagged here, then corrected by **0037**: `info@rileyfuzzelfarm.com` and its
phone sat on **Newton Nurseries Spring** as well as Riley Fuzzel Farm. The two
rows really were one route, so they merged — but only the phone turned out to
be right for Newton. See 0037.

## `0034_contact_supplier_links.sql`

Applied 2026-08-14 at Bhoumik's request, immediately after 0033. Splits the
contact ↔ supplier relationship into `supplier_contacts`, so **one contact can
be the PoC for several nurseries**. `contacts.supplier_id` and
`contacts.is_primary` are gone; both moved onto the link, because neither the
supplier nor "is this the one who answers" is a property of a person who covers
four farms. Applied in four DDL steps (table + backfill, column drop, cascade
trigger, `search_suppliers`) — the Supabase history names them
`contact_supplier_links_table`, `contacts_drop_single_supplier_columns`,
`cascade_supplier_deactivation_via_links` and `search_suppliers_via_contact_links`.

**1,843 links for 1,843 contacts, one each — nothing merged.** The per-location
duplicates the old column forced (the same rep entered once per farm) are still
separate contact rows; merging two into one person with two links is a
source-checked judgment call, not a bulk update, and one deliberate near-duplicate
pair already exists on supplier 255. 1,833 links active, 1,083 primaries — every
count identical to the columns they came from.

Two levels of `is_active` now: the person left (`contacts`) vs. they stopped
covering this location (`supplier_contacts`). `cascade_supplier_deactivation`
retires the links and retires the contact only when it was their last one.

## `0033_supplier_locations.sql`

Applied 2026-08-14 at Bhoumik's request. Adds `supplier_groups` +
`suppliers.group_id` so a multi-location company's locations are enumerable.
**Each location stays its own `suppliers` row** — no rows were merged, moved or
retired; the migration only names the company they belong to.

16 groups covering **57 supplier rows**, biggest first: Moon Valley Nurseries
17, Everde Growers 5, Newton Nurseries 4, then ArborGen / Calloway's / Devil
Mountain / Sunscape / Tree of Life (RGV) at 3 and eight pairs. Identified by
hand from a shared brand name **and** a shared website domain; families matching
only one half are listed at the bottom of the migration file for Chris to
confirm, along with three same-city sets that look like duplicates wanting a
merge rather than locations.

The set is not recoverable from names — `Everde Growers`, `Everde Growers - Glen
Flora Farm` and `EVERDE GROWERS - BUNNELL` share no parseable prefix, Newton
uses no dash and Calloway's an em dash — which is why the SOP now reads
`group_id` instead of guessing. `group_id IS NULL` means one location, not
unknown.

## `0032_size_std_bb_and_pot.sql`

Applied 2026-08-13, hours after 0031, at Bhoumik's request: the two biggest
occupants of `other` were real containers a buyer would filter on. Adds `B&B`
as a word grade and `<N>" Pot` as a third open numbered family beside `<N>G`
and `<N>" Box`, then remaps the 350 affected pairs (two subagents, same
pair-level method as 0031). All 240 B&B pairs took the bucket — none named a
competing container, so the "a real container still wins" exception never
fired. 66 bare diameters are pots, 6 are unlabelled boxes (desert growers print
`36"` for a box), 8 are not containers at all and took 0031's move-and-clear,
and 33 stay `other` because the diameter describes merchandise — Austin Plant
Supply prices planters, bowls and hand tools by diameter in the same column.

Also lifted the heights and calipers hiding inside B&B strings (`B&B; 3-4' HT`,
`4 - 5'; B&B`) into their own columns — **added only where the column was
empty**, never substituted, and only at high confidence. 13 pairs were held
back: topiary standards that print both a stem height and a head size, and
sheared globes whose diameter is arguably width rather than height. Unlike
0031, `size` keeps its printed text here — these rows have a real container in
it. `other` 8,589 → 3,326; buckets 52 → 66.

## `0031_size_std_backfill.sql`

Applied 2026-08-13, active rows only (Bhoumik decision — retired history keeps
`size_std` NULL). 12 subagents classified all 2,783 active
`(supplier_id, size)` pairs against one shared ruleset, which is now the
ingestion SOP's *Size standard*. The grain is the **pair**, not the string:
`2.5"` is a caliper at supplier 100 and a pot at supplier 73, so each agent saw
the pair's row count, sample plant names, and how often `height`/`width`/
`caliper` were already populated. Three consistency overrides were applied over
their output: supplier 86 (Bold Spring) prints sheared FORM codes, so `N' BOX`
there is `other` not a box; a low-confidence measurement reading does not move
data (47 pairs kept their `size` and took `other`); `0 G` is not a container.

Ran in two passes. The first moved a misfiled measurement only into an empty
dimension column or one already holding the same text. Its conflict rule proved
too strict — `size = '4/5'''` beside `height = '4'` is one measurement, not a
clash, and 2,501 rows sat in `other` for that reason — so a second pass moved
those too, replacing the lower-bound-only text with the fuller range wherever
the column's `*_std` already equalled the standard the mapping computed.
Nothing was overwritten with a *different* value in either pass.

## `0030_inventory_size_std.sql`

Applied 2026-08-13. Adds `inventory.size_std`, the standardized container that
pairs with the printed `size` the way `height_std` pairs with `height`.
Vocabulary approved by Bhoumik: `<N>G`, `<N>" Box`, `Bare Root`, `Liners`,
`Plug`, `Trays`, `Field Grown`, `Grow Bags`, `Root Pruned`, `other`. The gallon
and box families are open sets, so `inventory_size_std_check` tests the shape
rather than enumerating values. `inventory_enriched` was recreated to carry the
column (appended last — `CREATE OR REPLACE VIEW` cannot reorder columns — and
`security_invoker = true` re-set), `search_inventory` was dropped and recreated
because a `RETURNS TABLE` change cannot go through `CREATE OR REPLACE`, with its
`anon`/`authenticated`/`service_role` grants restored and `size_std` added to
the sort whitelist. Adds partial index `inventory_supplier_size_std_idx`. The
pgroonga document is unchanged — raw `size` already carries every spelling.

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
