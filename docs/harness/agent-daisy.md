# Agent: daisy

**Supplier management & availability-ingestion agent for LPS.** Keeps supplier
and inventory data current in Supabase. Reachable on the Telegram main thread
and in the web app's chat panel — **both route to the same `main` thread**, so
they are one conversation, not two — and has its own Gmail inbox.

## agent.json

- **name**: `daisy`
- **description**: "Supplier management and coordination agent for LPS —
  onboards new suppliers and keeps availability/inventory data current in
  Supabase. Reachable on the Telegram main thread and in the web app's chat
  panel, which route to the same thread."
- **model**: `openai-codex` / `gpt-5.6-terra` / thinkingLevel `medium`
- **threadIdStrategy**: `plugin_channel`
- **maxConcurrentSlots**: 5 · **maxAttempts**: 3 · **runtime**: `subprocess`
- **devAgent**: no
- **secretsSchema** (required: `SUPABASE_PROJECT_ID`, `SUPABASE_SECRET_KEY`):
  - `SUPABASE_PROJECT_ID` — Supabase project ref
  - `SUPABASE_SECRET_KEY` — `sb_secret_*`, used by `upload` / `sign-url` over HTTP
  - `SUPABASE_DB_PASSWORD` — Postgres password for the `query` psql script
  - `SUPABASE_URL` — project URL

## Purpose

Daisy is the supplier management & coordination agent for LPS (Local Plant
Supply), a wholesale plant-supply platform. It works for Chris (admin) and
Bhoumik (developer), reachable on the Telegram main thread (`main` — the
admin group chat `-1003988082603` routes there via a telegram routing rule),
with its own Gmail inbox
(`chris.r@localplantsupply.com`). Two standing jobs:

1. **Onboard new suppliers** — create/enrich a `suppliers` record via browser
   research, record how that supplier's availability reaches us
   (`availability_source_type` / `availability_update_days` /
   `hosted_availability_url`), and subscribe to availability newsletters.
2. **Keep availability current** — ingest supplier price lists / availability
   (email body, PDF, spreadsheet, image, or website) into Supabase `inventory`,
   with provenance in `inventory_sources` and name aliases in
   `plant_aliases`.

Availability arrives via supplier emails (the **gws** plugin wakes it) or
ad-hoc admin requests. Everything persists in **Supabase**; `workspace/` holds
its per-thread notes and daily notes, and `knowledge/` its cross-thread
reference docs and memory.

## Plugins

- **admin** — admin chat channel; visible text reaches the human admin.
- **agent-messaging** (config `{}`) — internal inter-/intra-agent messaging.
  Send via `scripts/agent-msg/send --to-agent <id> --thread-id <id> --message …`;
  identity is harness-set (not spoofable); a disallowed sender gets HTTP 403.
  No inbox restriction configured here.
- **gws** (Google Workspace/Gmail) — polls Gmail server-side, emits one
  `email_received` per inbound message; outbound via the `gws` CLI. Config:
  `pollIntervalSec: 300`, `gmailQuery: "in:inbox -label:daisy after:2026-07-01
  is:unread"`, `firstOfThreadOnly: false`, `allowedSenders: "*"`,
  `requireAgentInTo: false`.
- **scheduler** — one active schedule: `daisy-daily-9am-checkin`, cron
  `0 9 * * *`, posts a daily 9 AM Telegram summary (completed work, blockers,
  pending approvals) to thread `main`, channel `admin`.
- **telegram** — bot; `pollTimeoutSec: 25`, `allowedChatIds: ["-1003988082603"]`
  (locked to the admin group chat). One routing rule
  (`plugins/telegram/state/routes.json`, managed by `scripts/telegram/routes`):
  chat `-1003988082603` → thread `main`, overriding the `plugin_channel`
  strategy so the group chat lands in the `main` thread.
- **webchat** (user-space, [`plugin-webchat.md`](plugin-webchat.md)) — the web
  app's chat panel. Config `{"threadId": "main"}`, so web messages land on the
  **same thread as Telegram** and share one context. Outbound via
  `scripts/webchat/webchat-cli send`.

## Knowledge (`knowledge/`)

`index.md` indexes the reference docs, which live under `files/` (harness
0.8.18 moved them there from the `knowledge/` root):

- `files/SCHEMA.md` — **a symlink to [`docs/supabase-schema.md`](../supabase-schema.md)**,
  the single source of truth for the Supabase schema shared by every agent and
  the web app. Daisy reads and corrects it through the symlink; it must never be
  replaced with a copy.
- `files/suppliers.md` — pointer stub: per-supplier notes now live under
  `workspace/suppliers/[<id>]:<Name>/notes.md` (see `workspace/suppliers/index.md`).
- `files/gmail-labels.md` — Gmail label ID taxonomy (e.g. `Daisy` = `Label_12`) with a
  live-lookup command if stale, plus the `gws`-binary-location gotcha. Reference
  IDs only — *which* label to apply is the `availability-drop-intake` skill.

`knowledge/memory.md` is Daisy's cross-thread memory — one grep-able file of
sections separated by `-----$-----$-----$-----`, each with `name`,
`lastUpdated` and `description`. It replaced `workspace/memory/*.md` in harness
0.8.18 and holds the standing supplier-email approval policy, the outbound
identity/signature rules, GWS thread-routing rules, the notification threshold,
processing-efficiency and geographic-search rules, the daily-note concurrent
write safeguard, and two historical harness-upgrade validation records.

`knowledge/SOPs/` is gone: procedures are skills as of harness 0.8.12 (below).

## Scripts & extensions

`scripts/agent/` (shared toolset) plus:

- `scripts/agent/supabase/` — `query` (psql; SELECT/INSERT/UPDATE/WITH/EXPLAIN
  only, **DDL blocked by design**), `sign-url` (pre-signed Storage URL),
  `upload` (upload to a Storage bucket).
- `scripts/agent-msg/send` — inter-/intra-agent messaging CLI (seeded by
  agent-messaging).
- `scripts/gws/` — `format-email` CLI + `format-email-lib.mjs`/`.d.mts` (decode
  Gmail message JSON to plain-text body + attachments).
- `scripts/scheduler/scheduler-cli`, `scripts/telegram/telegram-cli`,
  `scripts/webchat/webchat-cli`.

Extensions: the four shared ones.

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

`migrations/NOTE.md` carries the full record, including 0028–0032 and 0035.

## Skills (`skills/agent/`)

Daisy's procedural memory. `system_prompts/1-agent.md` names the situation that
triggers each one and otherwise carries identity/persona/behaviour only.

- **supplier-onboarding-and-ingestion** (v3.4.0) — the end-to-end procedure a
  task thread runs to onboard a supplier and ingest one availability drop, and
  the owner of **every database write in the ingestion path**: mapping each
  availability row to its location within a `supplier_groups` group, browser
  enrichment and newsletter signup, `contacts`/`supplier_contacts` linking,
  source conversion, parsing and normalization (the three name parts with
  `name` derived, the size standard and `size_std` buckets, price, dimensions,
  `notes` vs `internal_notes`), the typed `plant_aliases` quality bar,
  provenance, updating `inventory` rows in place, post-ingestion QA,
  and the canonical report contract. Ships
  `scripts/match-candidates` — for each parsed entry it returns the closest five
  **active** rows for that supplier plus the best **retired** one, ranked by
  trigram similarity on the plant identity with a size-agreement bonus, over a
  narrow column set, marking any candidate whose cultivar contradicts the
  entry's as `CULTIVAR MISMATCH` and excluding it from the suggestion. Rows are matched by reading those candidates, **not** by an
  exact `(supplier_id, name_key, size)` key, because a respelled or re-sized name
  is invisible to a key and an update-in-place ingest would duplicate it. Since
  v3.4.0 no entry is inserted until `search_inventory` — scoped to that location
  in the outer query, since the RPC takes no supplier filter — also comes back
  empty, which catches the renames trigram similarity misses.
- **availability-drop-intake** (v2.0.2) — the coordinator loop, and **no database
  writes at all**: identify the supplier from sender/domain/name and pass the
  whole group along, dispatch the task thread against the canonical brief
  contract, answer its follow-ups, digest its report, apply the Gmail status
  labels.

The two are deliberately mutually exclusive: intake coordinates and talks to
humans, ingestion writes rows and talks to no one. Each points at the other for
the shared contracts (the brief, the report) rather than restating them.
- **plant-and-supplier-search** (v1.4.0) — `search_inventory` /
  `search_suppliers` usage, the split plant identity and typed alias edges,
  filter relaxation, key-column rules, answer shape.
- **supplier-communication-log** (v1.0.0) — appending to
  `suppliers.communication_notes`, and which of `communication_notes` / `notes` /
  workspace `notes.md` a fact belongs in.
- **supplier-email-reply** (v1.0.0) — the never-reply-unbidden rule, the
  draft-and-approve step, sending as Chris in the existing Gmail thread, and the
  main-thread redirect.
- **share-file-with-user** (v1.0.0) — upload to `lps` under
  `daisy_shared/YYYY-MM-DD/`, then share a pre-signed URL only.
- **create-skill** (v1.1.0) — shipped with the harness; how to author or bump one
  of the above. **Changes to any LPS skill need Chris's or Bhoumik's approval**
  first, then a version bump.
