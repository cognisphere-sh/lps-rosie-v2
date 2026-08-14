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
   `plant_other_names`.

Availability arrives via supplier emails (the **gws** plugin wakes it) or
ad-hoc admin requests. Everything persists in **Supabase**; `workspace/` is its
notes/memory.

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

- `SCHEMA.md` — **a symlink to [`docs/supabase-schema.md`](../supabase-schema.md)**,
  the single source of truth for the Supabase schema shared by every agent and
  the web app. Daisy reads and corrects it through the symlink; it must never be
  replaced with a copy.
- `suppliers.md` — pointer stub: per-supplier notes now live under
  `workspace/suppliers/[<id>]:<Name>/notes.md` (see `workspace/suppliers/index.md`).
- `gmail-labels.md` — Gmail label ID taxonomy (e.g. `Daisy` = `Label_12`) with a
  live-lookup command if stale.
- `SOPs/supplier-onboarding-and-ingestion.md` — end-to-end SOP a task thread
  follows to onboard a supplier and ingest one availability drop (parse + DB
  writes), with an output contract.

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

Extensions: the three shared ones.

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
  SOP requires future ingests to write the preserved source string and reviewed
  numeric companion together.
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

`migrations/NOTE.md` carries the full record, including 0028–0032 and 0035.

## Skills

None.
