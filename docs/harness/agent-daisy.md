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
  `email_received` per inbound message. Since harness 0.8.22 that notification
  is a **preview** — header, first two lines of the sender's own text, and
  attachment names only; the message itself is read with `scripts/gws/email
  read <MessageId> [--attachments]`. Outbound via the `gws` CLI. Ships the
  plugin-owned skills `read-email`, `search-email` and `route-email`. Config:
  `pollIntervalSec: 300`, `gmailQuery: "in:inbox -label:daisy after:2026-07-01
  is:unread"`, `firstOfThreadOnly: false`, `allowedSenders: "*"`,
  `requireAgentInTo: false`.
- **artifacts** — publishes self-contained HTML pages on the app's domain.
  Config `{"appBaseUrl": "https://lps.cognisphere.sh/a/daisy"}` — the `/a/daisy`
  prefix is what keeps its links distinct from Nova's, since the plugin appends
  `/<public|private>/artifacts/<slug>` itself. Secret `ARTIFACTS_APP_SECRET`,
  shared with Nova and the app (written by `scripts/app/secrets.sh`). Ships the
  plugin-owned `publish-artifact` skill and `scripts/artifacts/artifact`. See
  [`../app/README.md`](../app/README.md) § *Agent artifacts*.
- **scheduler** — one active schedule: `daisy-daily-9am-checkin`, cron
  `0 9 * * *`, posts a daily 9 AM Telegram summary (completed work, blockers,
  pending approvals) to thread `main`, channel `admin`.
- **telegram** — bot (ships the plugin-owned `route-chats` skill);
  `pollTimeoutSec: 25`, `allowedChatIds: ["-1003988082603"]`
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
- `files/brand/` — LPS logo assets.
- `files/credentials/` — **sensitive**, mode `0700`: supplier portal logins
  (currently Garden Center Plants LLC / Buchholz, supplier 22). Values are never
  printed or forwarded.
- `files/plans/` — long-lived plan documents.
- `files/templates/` — reusable output templates, with their own `index.md`.
- `files/plant-reference-photos/` — Chris-provided plant reference intake, one
  dated dir per drop, each with an `index.md` manifest. Reference photos only:
  not supplier availability, and not linked to `inventory` rows.

The last five moved here from the `workspace/` root on 2026-08-16 — reference
material that is neither thread- nor supplier-scoped belongs in `knowledge/`,
leaving `workspace/` to `index.md`, `threads/`, `suppliers/` and `daily_notes/`.

Moving the other way on the same date: the **Gmail label ID table** left
`files/gmail-labels.md` for
`skills/agent/availability-drop-intake/artifacts/gmail-labels.md`. Only that one
skill reads it, so it travels with the skill rather than sitting in shared
knowledge — the rule being that `knowledge/` holds what several threads or
skills consult, and a single skill's lookup table is one of its artifacts.

`knowledge/memory.md` is Daisy's cross-thread memory — one grep-able file of
sections separated by `-----$-----$-----$-----`, each with `name`,
`lastUpdated` and `description`. It replaced `workspace/memory/*.md` in harness
0.8.18. Since 2026-08-15 it holds **episodic events and facts only**: every
standing rule that had accumulated in it moved to the place that governs the
behaviour — `1-agent.md` when it holds everywhere, the relevant skill when it
governs one procedure (see *Skills* below). One record remains, the 2026-07-22
harness-upgrade validation. The file's own header states the rule, so a memory
written later doesn't reintroduce procedure.

`knowledge/SOPs/` is gone: procedures are skills as of harness 0.8.12 (below).

## Scripts & extensions

`scripts/agent/` (shared toolset) plus:

- `scripts/agent/supabase/` — `query` (psql; SELECT/INSERT/UPDATE/WITH/EXPLAIN
  only, **DDL blocked by design**), `sign-url` (pre-signed Storage URL),
  `upload` (upload to a Storage bucket).
- `scripts/agent-msg/send` — inter-/intra-agent messaging CLI (seeded by
  agent-messaging).
- `scripts/gws/` — `email` CLI (`read`/`thread`/`search`/`labels`/`label`) +
  `format-email-lib.mjs`/`.d.mts` (decode Gmail message JSON to plain-text body
  + attachments), and `routes` (thread-routing rules).
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

`migrations/NOTE.md` carries the full record, including 0028–0032 and 0035.

## Skills (`skills/agent/`)

Daisy's procedural memory. The harness appends the `<available_skills>` block to
her prompt, so `1-agent.md` no longer lists them — it carries
identity/persona/behaviour only, and points at skills by name where a rule needs
one.

- **availability-ingestion** — the procedure a task thread runs to ingest one
  availability drop, and the owner of **every inventory-side database write**:
  mapping each availability row to its location within the company's head branch,
  source conversion (including the tab-per-farm workbook, whose sheet headings
  are what the location mapping reads), parsing and normalization (the three name parts with
  `name` derived, the size standard and `size_std` buckets, price, dimensions,
  `notes` vs `internal_notes` — and the bar that keeps
  observations the row itself answers out of `internal_notes`: a missing price
  or quantity, when the row was last updated, when the drop was ingested, a
  restatement of the size or name), the `plant_aliases` quality bar (edges are
  untyped since migration 0050, so the bar is the whole of the protection),
  provenance, updating `inventory` rows in place, post-ingestion QA,
  and the canonical report contract. Ships
  `scripts/match-candidates` — for each parsed entry it returns the closest five
  **active** rows for that supplier plus the best **retired** one, ranked by
  trigram similarity on the plant identity with a size-agreement bonus, over a
  narrow column set, marking any candidate whose cultivar contradicts the
  entry's as `CULTIVAR MISMATCH` and excluding it from the suggestion. Rows are matched by reading those candidates, **not** by an
  exact `(supplier_id, name_key, size)` key, because a respelled or re-sized name
  is invisible to a key and an update-in-place ingest would duplicate it. No
  entry is inserted until `search_inventory` — scoped to that location
  in the outer query, since the RPC takes no supplier filter — also comes back
  empty, which catches the renames trigram similarity misses.
  Since 1.1.0 it also owns two rules that are about the drop rather than the
  parse. **The newest source wins**: the drop being ingested beats whatever an
  older file put there, with three qualifications — silence is not a value (an
  omitted field is left alone, so a partial list blanks nothing), the email body
  outranks its own attachment, and the exception has to be *quotable* (the
  brief, the source itself, or knowingly replaying a file older than the row's
  current source — `inventory_sources.created_at` is when **we** ingested, not
  when the file is from, so a January sheet replayed in August would clobber
  current data under a naive "latest wins"). And **the drop's photographs get
  catalogued**: §1 sorts every image into a source, a plant photo or a
  logo/signature, and §6 hands the **attached** plant ones to
  `plant-photo-catalogue` with the supplier §0 resolved — only when the drop
  mapped to exactly one location — while refusing to let the sheet beside a photo
  become evidence about it. **We hold bytes only for photos someone handed us**:
  a photo that exists as a URL is captured as a URL, in `inventory.image_url`
  when it belongs to a row being ingested and otherwise in the report, and is
  never downloaded into our bucket.
- **supplier-onboarding** — the owner of **every supplier-side database write**:
  confirming a supplier is genuinely new before inserting (several hits for one
  company are usually its locations), the `suppliers` row, `head_branch_id` for a
  new location of a known company, browser enrichment and newsletter signup, the
  three availability-source columns, `contacts` rows for the main line and each
  person, and `supplier_contacts` linking — one person across however many
  locations the source actually shows them at, `is_primary` per location,
  retiring rather than deleting. It parses no plant row — and notes a supplier's
  plant-photo gallery in its report rather than cataloguing it, since harvesting
  one is scheduled work rather than a side effect of onboarding.
- **availability-drop-intake** — the coordinator loop, and **no database
  writes at all**: identify which *company* a drop came from — the exact
  `contacts` join for a sender address, `search_suppliers` for a name Chris gives
  — and pass every matched row plus the `head_branch_id`, dispatch the task
  thread against the canonical brief contract (**every image and the verbatim
  body included**, since sorting plants from logos is the thread's job and a
  photo left out of the brief is one nobody sees again), answer its follow-ups,
  digest its report — now including its *Photos* and *Overrides withheld*
  blocks — apply the Gmail status labels, where `Catalogued` also covers an email
  that carried no availability but did carry photos worth keeping. It deliberately does **not** enumerate
  the company's locations: `availability-ingestion` §0 fans out from the head
  branch itself, and its query carries the city/state that resolving a farm name
  depends on.

These are deliberately mutually exclusive, split by what each one writes:
intake coordinates and talks to humans, `availability-ingestion` writes
`inventory` / `inventory_sources` / `plant_aliases`, `supplier-onboarding` writes
`suppliers` / `contacts` / `supplier_contacts`, `plant-photo-catalogue` writes
`plant_photos`, and no worker talks to anyone. They point at each other for the
shared contracts (the brief, the report) rather than restating them.

**The worker skills call each other, and the main agent dispatches one
thread.** `availability-ingestion` §0 decides which location every parsed row
belongs to; when the sender matches no supplier at all, or the file names a farm
the company has no row for, it follows `supplier-onboarding` to create it and
comes back with the id. In the other direction, a supplier onboarded directly
that arrives with availability attached is handed to `availability-ingestion`.
So intake's brief names `availability-ingestion` only — whether onboarding is in
scope is discovered during the ingest, not decided when the brief is written —
and the *Onboarding* block folds into the ingestion report so one report reaches
the main agent. Intake's brief names the skill **without a version**; the task
thread resolves the name against its own `<available_skills>`.

Skill versions are deliberately absent from the list above: a version belongs in
the skill's own frontmatter and `CHANGELOG.md`, never in a document that
references it. Historical `since vX.Y.Z` notes below are statements about when
something changed and stay true.
- **plant-and-supplier-search** — `search_inventory` /
  `search_suppliers` usage, the split plant identity and untyped alias edges,
  listing straight from `inventory` (0050 dropped `inventory_enriched`),
  filter relaxation, key-column rules, answer shape.
- **plant-photo-catalogue** — the owner of every `plant_photos` write: the
  intake checklist (hash → dedupe on `sha256` → upload to the private
  `plant-photos` bucket at an id-built path → insert), the evidence rules that
  keep a reference photo from being read as an availability claim (supplier,
  size and dimensions are written only when a source stated them, size is never
  inferred from apparent scale, and a conflict between two sources is preserved
  in `notes` rather than reconciled), `search_plant_photos` and filtering over
  its result, sharing with a signed URL, and soft-retiring. Its search half
  points at `plant-and-supplier-search` for how the ranking thinks rather than
  restating it — the two RPCs run the same algorithm over different documents.
- **supplier-communications** — one skill for talking to a supplier and
  recording it (merges the former `supplier-communication-log` and
  `supplier-email-reply`): the never-reply-unbidden rule, the main-thread
  redirect, the draft-and-approve step, sending as Chris in the existing Gmail
  thread, the Gmail-thread-scoped `gws` routing rule that brings the reply back
  (never a sender-wide one — it would swallow their next availability drop),
  appending to `suppliers.communication_notes`, and which of
  `communication_notes` / `notes` / workspace `notes.md` a fact belongs in. A
  routine availability drop is **not** logged as a contact.
- **create-skill** — shipped with the harness; how to author or bump one
  of the above. **Changes to any LPS skill need Chris's or Bhoumik's approval**
  first, then a version bump.

Handing a file to a user is **not** a skill (`share-file-with-user` was retired
2026-08-15): upload to `lps` under `daisy_shared/YYYY-MM-DD/` and sign the URL,
both documented in `1.1-supabase.md` next to the scripts themselves, with the
bucket-is-public caveat stated there and in SCHEMA.md's *Storage buckets*.
