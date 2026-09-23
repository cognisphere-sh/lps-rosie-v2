# Daisy migration history

Historical engineering reference; ordinary supplier tasks do not need this file.
The current database contract is [the shared schema](../supabase-schema.md).

## Migrations (`migrations/`)

**Operator-run** DDL against Supabase project `xyeyiqchadfszewztnrf` (lps-rosie),
because daisy's own `query` script blocks DDL. `NOTE.md` records what was applied
and when; the summaries below are one line each.

- `0001_availability_versioning.sql` — 2026-07-01. Reworks `public.rate_charts`:
  renames `common_name`→`common_names`, adds `category` (backfilled) and
  `is_active` (+ `rate_charts_supplier_active_idx` for versioned ingestion),
  drops `section_id` and the `rate_chart_sections` table. No data lost, RLS
  unchanged.
- `0002_supplier_communication_notes.sql` — 2026-07-27. Adds
  `suppliers.communication_notes` and the column comments separating it from
  `suppliers.notes`.
- `0003_search_prefix_match.sql` — 2026-07-28. Adds trailing-word prefix matching
  to `search_inventory` / `search_suppliers`.
- `0004_active_plant_aliases.sql` — 2026-07-31. Adds `plant_other_names.is_active`
  so only active aliases power search and display.
- `0005_inventory_name_consolidation.sql` — 2026-07-31. Moves the whole plant
  identity into `inventory.name` as `Name [scientific name, variant]` and
  **drops** `inventory.category` and `inventory.variety`; rebuilds both search
  indexes, both views, and `search_inventory` (which loses `category_filter`).
- `0006_cultivar_alias_cleanup.sql` — 2026-07-31. Deactivates cultivar and
  trade-name alias pairs, which made sibling cultivars match each other.
- `0007_retire_carryforward_aliases.sql` — 2026-07-31. Retires 0005's alias
  carry-forward, which had become the largest source of search false positives.
- `0008_alias_quality_audit.sql` — 2026-07-31. Audits and prunes the alias
  directory (generic labels, junk, wrong taxa, cultivar residue); 19,106 → 13,452
  active pairs. Records the rules that were **rejected** for destroying genuine
  names — read it before writing another cleanup.
- `0011_nullable_inventory_prices.sql` — applied 2026-08-04. Makes
  `inventory.unit_price` nullable so missing supplier prices remain `NULL`
  instead of being represented as zero; it deliberately leaves legacy zero rows
  untouched pending source-level review.
- `0012_search_inventory_nulls_last.sql` — nullable-price follow-up. Replaces
  `search_inventory` without changing its signature/search behavior so optional
  server-side sorts keep missing values last in both directions.
- `0013_legacy_zero_prices_to_null.sql` — approved 2026-08-04. One-time cleanup
  converting all historical `unit_price = 0` placeholders to `NULL`; future
  numeric zero remains reserved for a supplier-explicit printed zero.
- `0021_retire_abelia_cultivar_aliases.sql` — approved/applied 2026-08-11.
  Retires 15 audited sibling-cultivar/bare-hub Abelia edges while preserving
  legitimate Glossy Abelia species/common mappings; no inventory changed.
- `0022_inventory_size_structure_cleanup.sql` — approved/applied 2026-08-11.
  Guarded 2,309-row cleanup moving explicit dimensions out of `inventory.size`
  into the existing human-readable height/width/caliper fields without touching
  containers, conflicts, provenance, timestamps or inventory identity.
- `0023_numeric_inventory_dimensions.sql` — approved/applied 2026-08-11 by
  Nova. Adds standardized numeric feet/inch companions, view/RPC contracts,
  pre-pagination range bounds and partial supplier/dimension indexes; Daisy's
  ingestion skill requires future ingests to write the preserved source string
  and reviewed numeric companion together.
- `0024_inventory_dimension_std_backfill.sql` — approved/applied 2026-08-11.
  Guarded direct-field-only backfill: 94,297 rows gained at least one numeric
  standard (height feet; width/caliper inches) without changing any human
  string or other inventory field; exact values live in the checksummed
  compressed artifact under `migrations/artifacts/`.
- `0025_retire_crape_myrtle_cultivar_aliases.sql` — approved/applied 2026-08-12.
  Retires 66 audited Crape Myrtle sibling-cultivar/form edges while preserving
  the safe `Lagerstroemia indica` / `Crepe Myrtle` common-name edge.
- `0026_exact_plant_identity_search.sql` — approved/applied 2026-08-12.
  Removes reverse-hub sibling traversal from RPC/view aliases and enforces a
  bounded distinguishing token for multi-word cultivar intent without changing
  the RPC signature; the app displays direct aliases as **Also known as**.
- `0027_cultivar_prefix_intent.sql` — approved/applied 2026-08-12.
  Uses an explicit word-prefix predicate alongside bounded fuzzy intent, and
  pairs with removal of the app's unsafe zero-result split-word fallback.
- `0033_supplier_locations.sql` — approved/applied 2026-08-14. Adds
  `supplier_groups` + `suppliers.group_id` so a multi-location company's
  locations are enumerable instead of guessed from names; each location stays
  its own `suppliers` row. 16 groups seeded over 57 rows, no row merged.
- `0034_contact_supplier_links.sql` — approved/applied 2026-08-14. Moves the
  contact ↔ supplier relationship (and `is_primary`) onto a `supplier_contacts`
  link table so one contact can be the PoC for several nurseries. 1,843 links
  backfilled one-to-one; nothing merged.
- `0036_merge_duplicate_contacts.sql` — approved/applied 2026-08-14. Merges the
  duplicates 0034 left behind: 33 contact rows into 13, every link kept, matched
  on email **and** phone with no conflicting field. Shared inboxes with
  per-location phones were deliberately not merged.
- `0037_fix_newton_spring_and_ycnursery_contacts.sql` — approved/applied
  2026-08-14. Newton Nurseries Spring gets its own `Main line` contact instead
  of reading `info@rileyfuzzelfarm.com`, the inbox of the company Newton
  acquired in 2023 and since closed; the phone was already correct. Also strips
  a leading colon from one stored phone number.
- `0038_retire_riley_fuzzel_farm.sql` — approved/applied 2026-08-14. Retires
  supplier 963, which is Newton Nurseries Spring (1320) under its
  pre-acquisition name; no inventory, sources or queries were attached. 1320
  takes the site's current address.

- `0039_inventory_internal_notes.sql` — approved/applied 2026-08-14. Adds
  `inventory.internal_notes` and splits the two kinds of note that had shared
  `inventory.notes`: `notes` is what the **supplier** said about an offering
  (dated status, lead time, their row description), `internal_notes` is what
  **we** concluded (split sizes, tentative quantities, parse caveats, QA
  exceptions). Column comments lock the split; `inventory_enriched` gains the
  column, `search_inventory` deliberately does not. Additive, no backfill —
  pre-0039 `notes` content was not reclassified.
- `0040_typed_plant_identity.sql` — approved/applied 2026-08-14. Splits the
  plant identity into `common_name` / `botanical_name` /
  `cultivar_variety_trade_name`, each holding only what the source printed, and
  makes `inventory.name` trigger-composed from them (bracketed then; dash-delimited since 0043) —
  the format the SOP already required, so no existing row and no search index
  moved. Replaces `plant_other_names` with **typed** `plant_aliases`: a `plant`
  edge is matched against a row's common/botanical name, a `cultivar` edge
  against its cultivar column alone, which structurally closes the failure mode
  0006/0007/0021/0025/0028/0029 each cleaned up after. Pairs now carry
  `source_id` + `source_line`, and the dedupe trigger rejects mirrored
  orientations. `search_inventory` recreated with the three parts and
  `internal_notes` in its return type. No backfill, by instruction — the
  catalogue is being dropped and re-ingested.
- `0041_multi_name_cultivar_keys.sql` — approved/applied 2026-08-14, correcting
  0040 the same day. `cultivar_variety_trade_name` captures **everything the
  printed name carries that the common and botanical name don't**, not just the
  cultivar, so its key becomes the array `cultivar_keys` — one per
  comma-separated name — and alias matching moves from `=` to overlap. Without
  it a row naming two selections keyed as one string and silently matched
  neither.
- `0042_alias_query_term_expansion.sql` — approved/applied 2026-08-14. An alias
  edge is now reached by **any contiguous run of query words**, not only by the
  whole query. pgroonga's `&@~` is AND across tokens, so `Live Oak Boardwalk`
  could never reach the `Live Oak` ↔ `Quercus virginiana` edge; the cases that
  appeared to work were the pg_trgm fallback firing on string similarity.
  Additive — every prior condition is still OR'd in — and admission is still
  exact key equality behind the unchanged identity-intent gate.
- `0043_dash_delimited_plant_name.sql` — approved/applied 2026-08-14. The
  derived `inventory.name` joins its three parts with ` - ` instead of wrapping
  the tail in brackets. One separator between every part: the comma stopped
  being available when 0041 made the cultivar column comma-separated. Function
  only, no row rewritten; bracket and dash forms share an identity key and a
  token array, so no search result moves.
- `0044_search_inventory_cultivar_keys_out.sql` — approved/applied 2026-08-14.
  Adds `cultivar_keys` to the RPC's projection so the app can filter the
  cultivar in SQL over the result. Part of moving every column filter off the
  browser: filtering the page the server already truncated made 32 of 105
  matching `15G` rows unreachable on a `Crape Myrtle` search.
- `0045_alias_query_expansion_no_params.sql` — approved/applied 2026-08-14.
  Strips every filter and sort parameter from `search_inventory` (now just
  `search`, `fuzzy_ratio`) and switches aliases from key matching to **query
  expansion**: `live oak boardwalk` becomes
  `((live oak) OR (quercus virginiana)) boardwalk`. Alias-reached rows now score
  instead of ranking at a structural 0. **Trade-off:** `alias_type` no longer
  constrains matching, so a bad species↔cultivar pair again fans a cultivar
  search out across the species — the SOP quality bar is the only defence.
- `0046_bm25_search.sql` — approved/applied 2026-08-14. Rewrites search:
  matches names/size/notes, typo tolerant, **partial at both ends** (`ycamor`
  finds `sycamore`), alias-expanded, and ranked by **IDF-weighted term
  coverage** instead of gated. Two pgroonga indexes over one expression — bigram
  for substring, word for fuzzy — because fuzzy is meaningless on a bigram
  lexicon (`mvskogee`: 0 rows vs 188). Drops the identity-intent gate, the
  pg_trgm fallback and two superseded indexes. **Result sets are much larger by
  design** (OR retrieval, ranked tail).
- `0047_size_as_ranking_group.sql` — approved/applied 2026-08-14. A size typed
  into a query becomes one phrase group, so `15g Live Oak` **ranks** 15 G first
  instead of filtering — and instead of contributing the two least selective
  tokens in the corpus (`g` is in 63% of rows; the query used to return 42,099
  rows with no size signal). Retires the app's client-side size chip.
- `0050_drop_other_names_and_alias_type.sql` — approved/applied 2026-08-15.
  Drops `inventory_enriched`, the `plant_alias_names()` function behind its
  `other_names` column, that column from `search_inventory`'s projection (now 30
  columns), and `plant_aliases.alias_type`. **Retrieval is unchanged** — since
  0045 the query expander never read the type — and this was verified after
  apply rather than assumed: a botanical-name search still reaches 85 rows whose
  own name does not contain the term. Uniqueness becomes
  `(name_key, other_name_key)`; `dedupe_plant_aliases()` loses its type leg.
- `0049_supplier_head_branch.sql` — approved/applied 2026-08-15. Replaces the
  `supplier_groups` table with `suppliers.head_branch_id`: every supplier points
  at its company's head branch, and a head branch — like every single-site
  supplier — points at itself, so the column is never null and never chains. The
  16 heads were picked from the contacts on file and confirmed against each
  company's published head-office address; the table is dropped.
- `0051_plant_photo_catalogue.sql` — approved/applied 2026-08-16. The searchable
  photo catalogue: `public.plant_photos`, the **private** `plant-photos` bucket,
  and `search_plant_photos` — `search_inventory`'s ranking over a photo's name,
  size, caption, tags and notes, so the alias graph reaches photos too. Purely
  additive; nothing existing was touched. Deliberately an MVP of the plan in
  `knowledge/files/plans/searchable-photo-catalogue-plan.md`: one table rather
  than the plan's seven, and **no review/approval gate**.
- `0052_plant_photos_name_key.sql` — approved/applied 2026-08-16. Adds
  `plant_photos.name_key`, generated with the expression `inventory.name_key`
  uses, so the two tables join on identity; `search_plant_photos` is recreated
  to project it (33 columns). A **whole-identity** key — `= normalize_plant_key`
  of the *composed* name — not a plant-name one. `height_std` / `width_std` /
  `caliper_std` remain the one deliberate difference from `inventory`.
- `0053_plant_photos_bucket_normalised.sql` — approved/applied 2026-08-16.
  Bucket config only: `plant-photos` narrows to **`image/webp`, 8 MB**. Follows
  the decision that the catalogue is a **reference library, not an archive** —
  photos are normalised before upload (`prepare-photo`), so the narrow type list
  is what enforces the pipeline rather than the skill merely describing it. Gates
  uploads only; the 44 existing JPEGs are untouched and deliberately not
  backfilled.
- `0054_plant_photo_reclaimable.sql` — approved/applied 2026-08-16. Adds
  `plant_photo_reclaimable(older_than_days)`, listing bucket objects no **active**
  catalogue row points at — retired photos' tombstoned objects and true orphans
  from a failed insert. `SECURITY DEFINER` (PostgREST cannot see
  `storage.objects`) granted to `service_role` only, so the safety rule — an
  active photo's object is never a candidate — lives in the database rather than
  in a script's arguments.

- `0081_quoted_literal_substring_plant_search.sql` — approved and applied
  2026-08-29. Replaces `search_inventory`'s quoted exact-identity branch with
  escaped case-insensitive literal-substring matching over the composed and
  split identity fields only; size and notes cannot qualify. It bypasses aliases,
  normalization, token partials and fuzzy matching; unquoted discovery and the
  RPC signature/projection are unchanged.

- `0064_supplier_daisy_thread_id.sql` — applied 2026-08-23. Adds
  `suppliers.daisy_thread_id` — the company's one dedicated daisy thread
  (`supplier-<slug of head-branch name>`, one per head branch, every location
  row carries the head's value). 1,395 rows backfilled, 1,335 threads.
- `0065_inventory_notes_boilerplate_cleanup.sql` — applied 2026-08-23,
  data-only. Strips provenance boilerplate ("available as of" dates,
  source-file names, verbatim row restatements) from active `inventory.notes`
  per Chris's lean-notes rule; 18,162 of 48,771 noted rows cleared, text
  halved. Backup: `inventory_notes_backup_20260823`.
- `0066_drop_supplier_messages.sql` — applied 2026-08-23. Drops the
  `supplier_messages` chat transcript (its UI left the supplier page and
  portal the same day); 213 rows snapshotted to
  `supplier_messages_backup_20260823`, `communication_notes` stays as the
  frozen pre-0063 archive.
- `0067_supplier_type_tags.sql` — applied 2026-08-23. Chris's supplier Type
  vocabulary: `category` CHECK narrowed to `Grower` | `Wholesale Supplier` |
  `Retail` | `Broker/Platform` (NULL = insufficient evidence), 697 of 1,395
  rows reclassified in a reviewed per-company pass (rationale:
  `migrations/artifacts/0067_supplier_type_review.csv`). Backup:
  `supplier_category_backup_20260823`.
- `0068_rosie_thread_ids.sql` — applied 2026-08-23 (rosie's restructure).
  Adds `suppliers.rosie_thread_id` (backfilled with the same
  `supplier-<slug>` values as `daisy_thread_id` — per-agent namespaces) and
  `customers.rosie_thread_id` (minted by rosie on first contact; table empty
  on apply). Daisy's onboarding sets both supplier columns.

`migrations/NOTE.md` carries the full record, including 0028–0032 and 0035.

- `0111_directional_notes.sql` — rename job, AR and order note columns to the
  singular `note_from_customer`, `note_from_supplier`, `note_internal`,
  `note_for_customer` and `note_for_supplier` contract. Preserve mixed legacy
  order-line notes by source, update note-dependent RPCs, and add the missing
  order customer/supplier directions. Disposable PostgreSQL fixtures verify
  data/audit preservation, note ownership, public submissions and order snapshots.

- `0112_drop_order_item_availability_anchor.sql` — applied 2026-09-23 13:44 UTC.
  Drops the direct order-item AR pointer; existing job-item allocations resolve
  related supplier requests and remaining quantities. Preserves all order
  snapshots and junctions, updates creation and whole-job deletion, and serializes
  same-supplier order creation. Rehearsal and apply verify unchanged retained
  data across 12 tables and unchanged unrelated functions/privileges.

- `0114_public_orders.sql` — pending deployment. Adds nullable unique order public
  tokens, cleared by order closure/deactivation. Anonymous access remains in the
  app's read-only token route; database grants are unchanged.
