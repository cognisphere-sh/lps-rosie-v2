# Changelog

Notable changes to this app home — the app (`app/`), the harness data dir
(`harness/`), and the deploy scripts. Loosely [Keep a
Changelog](https://keepachangelog.com/en/1.1.0/); dates are `YYYY-MM-DD` in
`America/Chicago`.

This project is deployed from `main` rather than tagged, so entries are dated,
not versioned. The `cognisphere-harness` dependency has its own version, called
out when it moves — its upstream changelog is
[`docs/base-harness/CHANGELOG.md`](docs/base-harness/CHANGELOG.md) (read-only
here).

> Entries before 2026-07-27 were reconstructed from git history when this file
> was started, so they are coarser than what follows. `git log` remains the
> complete record.

## 2026-08-11

### Changed

- **Supplier geography/type filters are now searchable multiselects in both list-page toolbars.** Plant Search and Suppliers expose Supplier type, City and State beside the natural search field; multiple selections use OR within one field while type/city/state combine with each other and the text query. The controls share the existing column-filter state rather than creating a second filtering path, work in the wrapped mobile toolbar, remain visible before and during a Plant Search rather than appearing only after results load, and Clear all resets them with the other page filters. Plant Search keeps supplier-name and price in its mobile filter sheet without duplicating the three new toolbar controls.
- **Inventory dimensions now separate source evidence from numeric filtering.** Approved migration 0022 moved 2,309 explicit dimensions out of `inventory.size` into the existing human-readable height/width/caliper fields with exact guards. Migration 0023 adds nullable `height_std` (feet), `width_std` and `caliper_std` (inches), preserves lower-bound range semantics, appends the fields to both views and `search_inventory`, and applies six inclusive bounds before global result caps or supplier pagination. Desktop column headers and mobile filters show unit-labelled min/max controls while cells/cards retain source strings; invalid API bounds return 400, null standards remain unknown, and an unpaired manual string edit clears its numeric companion rather than leaving stale evidence. Guarded migration 0024 then backfilled 94,297 rows directly from their displayed fields: height 75,357, width 40,537 and caliper 22,589. Exact float conversions, full outside-target digests and display/filter regressions passed; no human string, timestamp, identity, source, price, quantity or activation value changed.

### Security

- **RLS enabled on `inventory_pre_size_normalization`** (migration
  `harness/agents/daisy/migrations/0020_enable_rls_size_snapshot.sql`). The
  0019 rollback snapshot was created after the 0011 RLS sweep, so it was the
  one table PostgREST still served to `anon` — flagged by the dashboard's
  `rls_disabled_in_public` linter. No policies: only `postgres`/`service_role`
  read it, and it is still slated to be dropped once the size change settles.

## 2026-08-05

### Added

- **Suppliers record how their availability reaches us.** Migration 0018 adds
  three nullable columns to `suppliers` — `availability_source_type`
  (`Email` | `Hosted`), `availability_update_days` (a whole number of days) and
  `hosted_availability_url` — and the Suppliers table and supplier profile show
  and edit all three. This was previously prose in `notes` ("sends an XLSX every
  Monday"), which nothing could filter or sort on. Null means **not established
  yet**, not "none", so every one of the 910 rows starts blank, and nothing ties
  the URL to a `Hosted` source type: half-filled rows are normal while someone
  works out how a supplier publishes, and suppliers that both email a sheet and
  post one exist. `search_suppliers` was recreated to return the three columns
  (its return type is fixed, so the app cannot see a new column otherwise) and
  to accept them as sort keys; the pgroonga document was deliberately left
  alone, so searching "Hosted" does not find hosted suppliers — filter the
  column instead. Editing the source type uses a new `select` cell kind that
  saves on change, and the hosted URL is the first editable `url` cell: it keeps
  its link and puts the editor behind a hover pencil.
  Daisy's onboarding SOP now tells her to fill the three columns during browser
  enrichment and to report which she set (**approved by Bhoumik, 2026-08-05** —
  the SOP requires approval to edit). Two rules in that wording matter: the
  refresh interval is recorded **only when the supplier states it**, never
  inferred from two drops falling a week apart, and an existing non-null value
  is never overwritten without evidence it changed.
- **Supplier contacts are their own table.** `public.contacts` holds one row per
  person at a supplier (`name`, `email`, `phone`, `title_department`, `notes`,
  `is_primary`, `is_active`, `supplier_id`), replacing the single
  `suppliers.poc_name` / `poc_email` / `poc_phone` triple — a supplier can now
  have as many contacts as it has people. A partial unique index allows one
  active primary each, so promoting a contact means demoting the incumbent
  first. The supplier profile gains a **Contacts** tab of cards with edit, add,
  make-primary and remove; the Suppliers and Plant Search tables swap the three
  `PoC` columns for **Primary contact / email / phone** (read-only, resolved
  from the primary) plus an **Other contacts** column listing `Name [Title]` and
  deep-linking to that tab.
- **Supplier search reaches through people.** `search_suppliers` returns
  `primary_contact_*` from a lateral join over `contacts`, and matches a
  supplier when any of its active contacts matches on name, email, phone or
  title. Because an index expression cannot read another table, contact text
  left `suppliers_pgroonga_idx` for a new `contacts_pgroonga_idx`, and matching
  `supplier_id`s are folded in as a precomputed array — the same shape as the
  existing trigram fallback, so the main branch still uses its index.
  Contact-only matches score 0 and sort after direct matches.

### Changed

- **38,090 legacy `inventory.size` values standardised (migration 0019).** The
  cause was worth the dig: `normalize_size(text)` has been in the database all
  along and **nothing ever called it** — no trigger, no generated column, no
  default — so the SOP's size rule applied only when a parsing agent remembered
  to hand-apply it. `1G` (8,533 rows) and `1 G` (7,096 rows) were two values in
  the same table, as were `3G`/`3 G`, `15 G / 17"`/`15 G/17"` and `024 Inch
  Box`/`24" Box`. Running the existing function over the existing rows took
  distinct sizes 5,255 → 4,974 (2,769 → 2,671 active), which is what collapsed
  the duplicate checkboxes in the new size filter.
  **Syntactic only** — unit spelling, spacing and leading zeros. Qualifiers
  (`6 G; Bush`, `3 G TRUE`, `1 G <24"`) and height/caliper values parked in
  `size` (`5-6'`, `2-2.5"`) were left untouched; separating those is a semantic
  change needing source review, and it is why the filter still lists ~2,671
  choices. 12 `#N box|bag` rows were excluded because `#` means gallons but a
  box is sized in inches, so `#24 Box` → `24 G Box` may be flat wrong — they are
  listed in the migration NOTE for a human to check against the source.
  Verified: 0 rows lost alphanumeric content, 0 sizes nulled, row count
  unchanged, search unaffected. `inventory_pre_size_normalization` holds the
  pre-rewrite values until this settles.

- **Daisy's size rule became a size standard** (SOP §2, approved by Bhoumik).
  One line about unit spelling grew into: canonical units with a conversion
  table, `normalize_size()` named as the reference implementation, the `#N box`
  exception, when a word (`B&B`, `Field Grown`, `Quart`) is a valid size, and an
  explicit list of what must **not** go in `size` — height/width/caliper, form
  and grade codes, pack counts, and anything guessed. It also tells her not to
  bulk-fix legacy rows as a side effect of an ingest.

- **The Plant Search size filter now lists the raw `size` values, not
  categories.** The selector used to normalize each row into commercial buckets
  — collapsing `15 G`, `15G` and `15 G/17"` into one `15 gal` choice, splitting
  a `3–5 G` range into its endpoints, and inferring gallon/box/caliper types
  with plausibility guards (calipers had to be inch-qualified and ≤ 20 to keep
  known source noise like `caliper = 215` out). It read as tidy but hid what the
  rows actually say, and any size the classifier did not recognize was simply
  unfilterable. It is now a checkbox list of every distinct `size` string in the
  current matches, matched by exact text, which is what the Size column filter
  on desktop already did. Stored selections moved to
  `lps.plant-search.size-choice.v2` because the old keys (`gallon:15`) mean
  nothing now; the v1 key is cleaned up on load. Size typed *into the query*
  (`15g Agave Americana`) is unchanged — it still parses the token out of the
  plant name and matches by value, so it finds a row listed as `15 gal`.

- **Multiselect column filters have a search box.** Their options come from the
  rows on screen, so Size, City and similar columns list hundreds of values and
  finding one meant scrolling the whole dropdown. The search narrows the visible
  list only — selections outside the current search stay selected. Matches the
  supplier multiselect, which already had one.

- **Contact people moved out of `suppliers.notes`.** All 54 suppliers with notes
  were read by hand; the people written into that prose before `contacts`
  existed are now rows — 29 inserted (47 → 76), 12 existing rows gained the role
  the notes described, 3 a missing email or phone. 20 notes were trimmed, 5 of
  them to empty. Notes keep hours, addresses, policies, parsing quirks and
  business history. Verified after the fact: every name resolves to a contact
  row, and **no email or phone was lost**.

- **`contacts` is now the only place a supplier can be reached.**
  `suppliers.email` and `suppliers.phone` moved in and the columns were dropped,
  so `suppliers` describes the company and `contacts` holds every route to it —
  the main line included, as a row with `title_department = 'Main line'`. Where
  a name was recoverable from an address it came from a hand-curated allowlist
  of the values actually present, never a pattern, and each of those ~160 rows
  is stamped `Name inferred from the email address; unverified.` Most contacts
  have no name at all, which is expected: the add/edit form marks name optional
  and a contact needs only one of name / email / phone. Contacts 76 → 973 across
  907 suppliers. Supplier search now finds an address through the contacts
  branch rather than the supplier document.
- **The old `lps-rosie` app's public supplier form moved onto the service-role
  key** (that app lives outside this repo, at
  `projects/local_plant_supply/lps-rosie`). `/availability/[id]`, its three API
  routes and `/api/upload` are reachable without a login — suppliers open them
  from an emailed link — so they ran as `anon` and would have broken. They now
  use a new `lib/supabase/service.ts` client; the unguessable `friendly_id` in
  the URL remains the capability token, as before. Logged-in paths still use
  the anon-key + cookie client so per-user policies keep applying.

  One deliberate regression: that page's Realtime subscription on
  `availability_queries` subscribes as `anon` from the browser and now receives
  no events. It was redundant cross-tab sync — every edit, voice note and form
  upload already returns the updated rows in its own response — so the form
  itself is unaffected. Restoring it would mean giving `anon` read access to
  every availability query, which is the hole this change closed.

### Removed

- **`suppliers.poc_name` / `poc_email` / `poc_phone` are gone.** All 47 rows
  that used them were reconciled against the new `contacts` table before the
  drop — matching counts on every field and no value mismatches — so nothing was
  lost, but the drop is irreversible. Supplier deactivation now cascades to
  `contacts` alongside `inventory` and `inventory_sources`.
- **`suppliers.email` and `suppliers.phone` are gone too**, verified against a
  snapshot as **0 emails and 0 phones lost**. Anything that matched a supplier
  by `suppliers.email` must now join through `contacts` — Daisy's
  supplier-identification query and the onboarding SOP were updated to do so,
  and both tables plus the profile lost their Email/Phone fields.
- **`suppliers.fax` is gone**, and with it the last contact field on the table —
  `suppliers` now describes the company and nothing else. The 12 fax numbers
  moved into their supplier's main-line contact `notes` rather than `phone`,
  which the app renders as a dialable `tel:` link.
- **The 0015/0016 rollback snapshots were dropped.** `suppliers_notes_pre_contact_extraction`
  and `suppliers_contact_pre_move` are gone, so **the 0014–0017 column drops are
  no longer reversible from the database.** Every one was reconciled against its
  snapshot before the drop.

### Security

- **Row level security is on for every table.** `suppliers`, `inventory`,
  `chat_sessions`, `users` and `availability_queries` were running with RLS
  *disabled* — four of them already carried policies, which were therefore
  inert. Since `anon` holds table grants across `public`, the publishable key
  was in practice a full read-write handle on the whole database, `users`
  (which stores Gmail OAuth tokens) included. Migration
  `harness/agents/daisy/migrations/0011_enable_rls.sql` enables RLS on all
  five and gives `availability_queries` the `authenticated` full-access policy
  it never had. Verified against the live REST API: `anon` now returns `[]`
  for every table and both views.

  Nothing in this repo had to change to keep working — agents connect as
  `postgres` and the app uses the secret key, both of which hold `BYPASSRLS`.
  Both were re-verified after the migration (daisy's `query` bin, the search
  RPCs, and `inventory_enriched` over REST).

- **`inventory_enriched` and `rate_charts` are now `security_invoker`.** Both
  views are owned by `postgres`, so with Postgres's default they ran with the
  owner's `BYPASSRLS` rights and would have served `anon` the entire catalogue
  regardless of RLS on `inventory` — enabling RLS without this would have been
  security theatre. Any future `CREATE OR REPLACE VIEW` over these tables must
  set the option again; it is not inherited.

## 2026-08-04

### Changed

- **Inventory rows expose source ingestion time.** Plant rows now derive
  **Ingested** from their active source timestamp, and supplier list/profile
  views show the newest active-source **Last ingestion**. Manual/source-less
  rows remain blank; ingestion time is explicitly not the source's effective
  availability date.
- **Desktop Full chat uses the full canvas.** Selecting Full hides both the
  navigation and workspace; a centered edge handle reveals or hides a 240px
  supplier/search peek pane on demand. Restored Full state keeps that layout,
  while 50%/30%, resizing or hiding chat exits it. Desktop Full restoration is
  blocked/reset at the mobile breakpoint so it cannot zero-width Supplier or
  Plant Search during hydration.
- **Missing inventory prices retain their meaning.** The approved nullable-price
  migration stores an omitted supplier price as `NULL`; a follow-up cleanup
  converts all 28,998 historical zero-price placeholders to `NULL`. The app
  displays them as unavailable rather than `$0.00`; blank edits, range filters,
  and client/`search_inventory` sorting preserve the distinction and keep
  missing values last. Future numeric zero remains valid only when explicitly
  printed by the supplier.
- **Mobile agent navigation is consolidated.** One **Agents** bottom tab now
  opens Daisy, Rosie and Nova as channels; selecting an active agent opens the
  same existing conversation and Back returns to Agents. This is UI-only — no
  chat transport, routing, thread, model or API behavior changed.
- **Desktop supplier rows are uniform height.** Inventory sources show the
  newest filename as a direct link plus `+N` when older files exist; `+N`
  deep-links to that supplier's Files tab. Source counts no longer enlarge rows,
  and no API, source-record or ingestion behavior changes.

## 2026-08-03

### Added

- **The app installs as a PWA.** A static manifest, a service worker and a
  generated leaf icon set make the workspace installable to a phone home screen
  or a desktop dock, launching full screen at `/suppliers`. Chrome gets a
  one-per-session install offer; the desktop rail and mobile **⋯ More** both
  carry a manual **Install app** entry, which falls back to iOS
  Share → Add to Home Screen instructions on Safari and to an explanation when
  the browser cannot install (already installed, or a LAN address rather than
  HTTPS/localhost). The worker is network-first and caches only whole-page
  loads, so an offline launch shows the last page instead of a browser error
  while supplier data itself is never served stale. See
  [`docs/app/README.md`](docs/app/README.md#installable-app-pwa).

### Changed

- **Desert Night is available as a chat wallpaper.** The rights-confirmed
  user-provided cactus/agave pattern keeps its deep-black base while the icon
  strokes are selectively dimmed, including a further 20% reduction after live
  review. CSS color blending preserves luminance and subtly tints only the
  artwork forest/coral/violet with the active agent. Incoming bubbles now use a
  stronger tinted surface/border, while solid outgoing bubbles force white text;
  None and the original light line-art wallpaper remain available in Settings.
- **Pull-to-refresh works across mobile workspace pages.** Pulling down from a
  page pane's top refreshes its route; Suppliers and Plant Search additionally
  rerun the active client query while preserving its term and filters.
- **Chat history has edge navigation and pull-to-refresh.** Contextual arrows
  jump to the first/latest message, and pulling down from transcript top runs an
  immediate message poll without re-enabling unsafe document overscroll.
- **Keyboard-open PWA layout follows the visual viewport pan.** The Shell now
  tracks `visualViewport.offsetTop` as well as height; mobile bottom navigation
  hides while typing so the composer sits directly above the keyboard and
  returns when focus leaves the field.
- **PWA scrolling stays inside content panes.** The workspace Shell is fixed to
  the visual viewport and locks document overflow, so transcript/list swipes no
  longer move the header off-screen or leave blank space below the bottom nav.
- **Nova now recognizes its shared Telegram group.** Its system prompt records
  group `-1004330045748` as the communication channel with Bhoumik Shah and
  Chris and explicitly treats posts there as group-visible.
- **Mobile Plant Search opens a supplier only from its name.** The whole card
  header used to be the link, so a tap meant to read the category, location or
  match count navigated away. Only the underlined supplier name now navigates;
  the rest of the header is inert and the chevron still expands the plant list.
- **More → Settings works from an agent chat on mobile.** The chat sheet is a
  full-screen overlay over the outgoing page, which stays mounted until the new
  route commits — so the tap looked ignored. Both More-menu route entries now
  close the sheet as they navigate.
- **The viewport now declares `viewport-fit=cover`.** The mobile bottom tab bar
  already padded itself with `env(safe-area-inset-bottom)`, which resolves to
  zero without it — so the bar sat under the home indicator on notched phones,
  which the installed full-screen app would have made obvious.

## 2026-08-02

### Changed

- **Mobile navigation stays inside the Android PWA viewport.** The Shell now
  tracks the live visual viewport rather than trusting standalone-mode
  `100dvh`, keeping the bottom bar above system chrome through resize,
  orientation and keyboard changes.
- **Chat appearance is now a responsive Settings page.** `/settings` is enabled
  in the desktop rail and mobile More uses the same **Settings** label and route.
  The redundant
  mobile Back button/overlay are gone, so tapping another bottom-nav item always
  navigates normally.
- **Chat colors now follow each agent's profile art.** Daisy defaults to Forest
  Green, Rosie to Coral Rose and Nova to Electric Violet. The earlier Garden
  Green, Fuchsia Bloom and Agave Blue remain optional; Chat appearance can
  customize each mapping independently while wallpaper remains shared.
- **Agent chat uses Telegram-like typography.** Message bubbles, the composer
  and Chat appearance preview now use 16px Roboto with compact line spacing;
  timestamps remain small and the inventory/search workspace remains on Inter.
- **Mobile More is always visible.** All seven bottom-nav items now share the
  available width instead of overflowing horizontally, so Chat appearance and
  other More actions remain discoverable without swiping the tab bar.
- **Chat appearance settings are available on mobile.** More → Chat appearance
  provides a live preview, Garden Green / Fuchsia Bloom / Agave Blue palettes, an
  optional original dense cactus-agave-yucca-sun doodle wallpaper in green,
  blue and fuchsia, plus Reset. Preferences
  persist per device and remain scoped to chat rather than recoloring the app.
- **Generic list-page headers are removed on mobile.** Suppliers and Plant
  Search now start with their primary controls; highlighted bottom tabs already
  identify those pages. Desktop headers and supplier-specific identity headers
  remain unchanged.
- **Mobile chat now uses one compact header.** Avatar, agent name, short role
  (`Suppliers`, `Customers`, or `Developer`) and live status align on one line. Opening an agent
  replaces the underlying page-title row rather than stacking
  both headers above the conversation. The redundant close icon is removed;
  the highlighted active-agent tab remains the close toggle.
- **Mobile supplier profiles now prioritize inventory space.** The supplier
  name/category live in one sticky header; the duplicate title and mobile back
  link are gone. The pencil appears only at the bottom of expanded Supplier
  details, making expand → edit an intentional safety gate. Company data is
  collapsed behind a compact Supplier details summary by default, with one-tap
  call, email, website and
  map actions. The pencil expands the safe staged-edit form automatically;
  desktop details and its back link remain visible.
- **Supplier profiles now open directly to Inventory.** Tabs are ordered
  Inventory, Communications, Notes and Files; all four use compact mobile
  sizing and remain on one line.
- **Supplier profiles now require deliberate edit mode.** Profile fields are
  read-only until the pencil icon (**Edit supplier**) is pressed; edits are staged locally and a
  single **Save changes** action writes only changed fields atomically. Cancel
  warns before discarding changes, and reload/close gets an unsaved-change
  warning, preventing accidental mobile taps from entering or saving edits.
- **Mobile Plant Search rows now show availability specifications.** Height,
  width/spread and caliper appear beside the source size when present, rather
  than being stored correctly but hidden from mobile results. Tapping a row
  expands full other names, notes, update date and source link inline without
  leaving the supplier comparison.
- **Common-name + cultivar searches now recover from alias-combination gaps.**
  When a full multi-word search returns zero, the server searches its individual
  words in parallel and uses the smallest non-empty result set. `Live oak
  boardwalk` now reaches the same 32 Boardwalk rows as `Quercus boardwalk`,
  without adding fallback calls to normal successful searches.
- **Multi-word Plant Search now respects the full identity.** Broad fuzzy/alias
  results are refined to rows whose own name or aliases contain every requested
  word (with prefix support), falling back to the broad result only when none
  qualify. `Agave Americana` no longer pulls in unrelated `americana` trees,
  and their caliper sizes no longer contaminate its available-size selector.
- **Simplified size filtering in Plant Search.** Removed the permanent
  unit/min/max form. Users can type a natural query such as `15g Agave
  Americana`, or search the plant name first and choose from a compact selector
  containing conservative commercial categories from those matches. Gallon/box
  spellings collapse without inventing cross-unit equivalences; range descriptions
  contribute their endpoint categories; and bare dimensions, untyped numbers and
  implausible source-column values stay on result rows instead of becoming menu
  options. The compact selector now accepts multiple categories with OR logic;
  repeated URL parameters and browser storage preserve the selected set across
  navigation.
- **Plant Search now starts with a useful state instead of an unexplained
  sample.** A blank search shows a prompt and makes no catalogue request. The
  last term is restored from the URL or browser storage when returning, current
  results are fetched afresh, browser Back/Forward is honored, and Clear forgets
  the saved term.

## 2026-07-31

### Changed

- **Increased dark-mode contrast in the search workspace.** Muted labels,
  empty-state text, input outlines, borders, header rows, resize affordances and
  table hairlines are now brighter and easier to distinguish.
- **`cognisphere-harness` 0.8.7 → 0.8.11.** Two seeded artifacts moved, both
  re-seeded into daisy and nova (clean forks, no local edits): `context-meta.ts`
  now emits checkpoints as standalone prune-safe messages
  (`customType: "context-meta.checkpoint"`) instead of stamps fused onto
  neighboring messages — 0.8.9 fixed an 0.8.8 infinite-LLM-call regression and
  0.8.10 lands turn-ending checkpoints on `agent_settled` — and
  `0-base_prompt.md` documents the checkpoint messages as FYI-only telemetry.
  0.8.11 (no data migration) makes pi's own models.json mirror
  `.secrets/models.json` overrides, so spawned pi children and the dashboard
  agree on context windows. Scaffold refresh was a no-op apart from
  `docs/base-harness/CHANGELOG.md`; the local Supabase env wiring in
  `server.sh`/`config.example` was untouched upstream.

- **Plant identity now lives entirely in `inventory.name`.** The name is written
  `Name [scientific name, variant]` — the printed name in full, plus the
  scientific name and cultivar/trade name when the source gives them. The
  ingestion SOP (`harness/agents/daisy/knowledge/SOPs/`) and `SCHEMA.md` were
  rewritten to match; both had said the opposite ("botanical preferred; marketing
  names go to `plant_other_names`, never into `inventory.name`").
- **Dropped `inventory.category` and `inventory.variety`**
  (`harness/agents/daisy/migrations/0005_inventory_name_consolidation.sql`). The
  source's own grouping is no longer tracked, and the cultivar is part of the
  name. 101,678 rows had their variety folded in; both search indexes, the
  `rate_charts` and `inventory_enriched` views and `search_inventory` were
  rebuilt around the drop, and the RPC lost its `category_filter` parameter.
  `suppliers.category` is untouched. The app drops the plants table's Category
  and Variety columns to match. Pre-change values are kept in
  a rollback table (since dropped — see below); the scientific name was **not**
  backfilled, because deriving it from the existing alias graph proved
  unreliable (`Acer Palmatum` resolved to the cultivar `Oto hime`).
- **Purged the retired aliases and the rollback scaffolding**
  (`0010_purge_inactive_aliases_and_rollback_tables.sql`): 78,807 deactivated
  pairs deleted, leaving 13,429 — the entire table, all active — and both
  rollback tables dropped. Two consequences worth knowing: the name
  consolidation can no longer be reversed and the source `category` values are
  gone for good; and because the dedupe trigger ignores `is_active`, the retired
  rows had been silently acting as a blocklist against bad aliases returning.
  That guard is now the ingestion SOP's job alone.
- **Aliases are search equivalents only.** `plant_other_names.other_name` may now
  hold only another name for the *same plant* — common name, scientific name,
  synonym, abbreviation, spelling variant — never a cultivar, variant, trade name
  or patent code. Those linked a species to one of its selections, so every
  sibling cultivar matched every other one; the cultivar is searchable in the
  name instead (`0006_cultivar_alias_cleanup.sql`).
- **Retired 0005's alias carry-forward** (`0007_retire_carryforward_aliases.sql`),
  which turned out to be the largest single source of search false positives: it
  ran before the cleanup and copied unquoted cultivar compounds and sibling
  *species* onto cultivar rows, so `Redbud [Forest Pansy]` inherited
  `Cercis mexicana`. 48,269 pairs retired; 19,106 of 92,236 remain active.
  "Forest Pansy" and "Ruby Falls" now return zero false positives. The cost is
  that only 4,378 of 40,715 bracketed rows are still reachable through the alias
  graph — the durable fix is reparsing sources so the name carries the printed
  common-first identity. Cultivar cleanup is **not finished**: see
  `migrations/NOTE.md` for the Merlot-class residue and the token-OR noise, both
  left deliberately rather than fixed with a rule that deleted genuine names.
- **Audited and pruned the alias directory** (`0008_alias_quality_audit.sql`):
  generic category labels by fan-out ("Grass" was an alias for 64 distinct
  plants), non-plant junk (hardgoods, 31-char feed truncations, grade codes),
  nine hand-verified wrong-taxon pairs, and cultivar residue on single-word
  epithets. Active pairs 19,106 → 13,452; "Forest Pansy" and "Ruby Falls" return
  zero false positives and "Merlot Redbud" went 46 → 7. Four plausible rules
  were built, measured and **rejected** for destroying genuine names — the
  migration records why, so they don't get retried.
- **Cleared the last cultivar aliases** (`0009_residual_merlot_aliases.sql`): the
  four Merlot/Cercis pairs, plus a table-wide sweep for the same shape that found
  19 more (`Sedum rupestre` ↔ `Angelina Stonecrop`, `Ulmus` ↔ `Allee Elm`). The
  sweep is gated on trademark corroboration — ungated it also flags `Pinus taeda`
  ↔ `Loblolly Pine` and `Agave vilmoriniana` ↔ `Octopus Agave`, which are real
  names. Forest Pansy, Ruby Falls and Merlot Redbud now have **no alias false
  positives**; Loblolly Pine, Octopus Agave and Texas Redbud are unharmed.
- **The ingestion SOP now sets an explicit alias quality bar** — same plant only,
  no cultivars/trade names, nothing generic, names not data, and "when in doubt
  insert nothing", because search hops between siblings so one bad pair pollutes
  a neighbourhood. It also requires the printed **common name first** in
  `inventory.name`, since the name is the only place a printed common name
  survives.

### Added

- **Applied `0004_active_plant_aliases.sql`**, which had been prepared on
  2026-07-30 but held back because daisy's guarded query runner blocks
  `ALTER TABLE`. Adds `plant_other_names.is_active`, so inactive pairs power
  neither search nor the derived "Other names" column.

## 2026-07-30

### Changed

- **`cognisphere-harness` 0.8.6 → 0.8.7.** Fixes the gap we hit testing
  0.8.6: `context-meta.ts` (re-seeded into daisy and nova) now replays its
  stamping state machine over the persisted session on spawn, so
  `CheckpointTokens` stamps span batch boundaries — plain chat turns get
  stamped from a thread's second message on, instead of only tool
  results/steers within a single batch. No other seeded files changed.

- **`cognisphere-harness` 0.8.5 → 0.8.6.** Ships context-window telemetry
  for agents: a new seeded extension `context-meta.ts` (copied into daisy
  and nova) stamps per-step `CheckpointTokens` deltas into the session and
  injects ephemeral `Model`/`ContextUsage` figures into each LLM call, and
  the seeded `0-base_prompt.md` documents both (re-seeded in both agents —
  clean forks). Scaffold refresh was a no-op apart from
  `docs/base-harness/CHANGELOG.md`; the local Supabase env wiring in
  `server.sh`/`config.example` was untouched upstream.

- **Nova's webchat re-pointed to the `main` thread**
  (`harness/agents/nova/plugins/webchat/config.json`, now with the other
  keys' defaults spelled out), matching the telegram main-route pattern;
  daisy's `config.json` was dropped as redundant (the plugin default is
  already `main`). Nova's telegram bot is live (`lps_nova_bot`), but until
  a `main` chat route exists in its `plugins/telegram/state/routes.json`
  (runtime state, like daisy's), telegram messages still land on the
  `single` strategy's `default` thread rather than sharing `main` with the
  panel.

- **Harness upgraded 0.8.3 → 0.8.5.** Task-thread ids move to the
  unambiguous `<ThreadId>-§-[TASK]-§-<task-slug>` form and the admin UI
  groups task threads under their parent thread (no data migration —
  old-format threads keep working). Migration re-seeded both agents'
  `0-base_prompt.md`, `plugin-agent-messaging.md`, and `session-reader`
  (all were clean forks), and refreshed the harness-owned scaffold
  (`.claude/skills/`, `.agents/skills/`, `docs/base-harness/`); the local
  Supabase env wiring in `scripts/server.sh` / `config.example` was
  untouched upstream and survives intact. 0.8.4 also reworked the upgrade
  skill's scaffold refresh to audit local edits before copying.

### Added

- **Nova is now chattable from the web app**: the `webchat` plugin is enabled
  on `nova` (`harness/agents/nova/plugins/webchat/config.json` with
  `threadId: "default"` — the thread nova's `single` strategy computes, so the
  panel and Telegram share one conversation) and its seed CLI/prompt are
  checked in. In the app, Nova's `upcoming` flag is removed in `lib/agents.ts`
  (with dev-flavoured starter suggestions), the panel's empty-state line is now
  a per-agent `intro` instead of Daisy's hardcoded one, and the mobile tab
  bar's agent tabs now select which agent the chat sheet opens with (same tab
  toggles it closed). Rosie remains the only "Coming soon" agent.

- **Animated search loader**: while a search is in flight on Plant search, the
  Suppliers list or a supplier profile's Inventory tab, the results area dims
  under three sprouting seedlings (`components/workspace/search-loader.tsx`,
  theme-coloured, staggered, honours `prefers-reduced-motion`). The loader
  starts on the first keystroke — it also covers the 300ms debounce window that
  already gated the search RPCs — and empty states no longer flash while a
  search is pending. The caption under the seedlings rotates every 1.6s
  through a quirky set per search flavour (plant searches vs the suppliers
  list) instead of one fixed line per page. Its caption rotates through a set of quirky lines per
  search flavour ("Watering the seedlings…", "Ringing the nurseries…", …).

- **Know your Agents page (`/agents`)**: one card per agent showing its
  profile banner (`app/public/*_profile.png`) with an Active / Coming soon
  badge. Reachable from the nav rail's bottom section (above the user entry)
  on desktop and the ⋯ More menu on mobile.
- **Rosie and Nova listed as upcoming agents** in `lib/agents.ts` — they appear
  in the chat selector, the collapsed rail and the mobile tab bar as disabled
  "Coming soon" entries, and the chat proxy refuses them until the flag is
  removed. Daisy remains the only chattable agent.
- **New avatars for all three agents** (`daisy.png` replaced, `rosie.png` and
  `nova.png` added), cropped from the profile banners.

### Changed

- **Chat panel header simplified** — the agent selector tabs are gone; the
  header keeps only the Full / 50% / 30% size presets. Agents are picked from
  the collapsed rail.
- **Mobile chat no longer covers the bottom tab bar.** The sheet overlays the
  page content only, so navigation stays visible and usable while chatting.
- **Mobile bottom bar gained a ⋯ More menu** (Settings, theme toggle, Know
  your Agents, signed-in user + log out), replacing the bare Theme tab.

- **Upgraded `cognisphere-harness` 0.8.1 → 0.8.3.** No data-dir breaking
  changes (0.8.2 fixes `HARNESS_BASE_URL` export in the runner itself). Per
  0.8.3's new upgrade procedure, refreshed the harness-owned scaffold from the
  package: `scripts/` (upstream refactor of aws/contabo setup into
  `scripts/lib/remote-bootstrap.sh`; default `HARNESS_PORT` now 3142; dropped
  the now-redundant `HARNESS_BASE_URL` systemd line and the auto-retire of
  stale units), `config.example`, `docs/base-harness/`, and the
  `cognisphere-upgrade` skill (in `.claude/skills/`, `.agents/skills/`, and
  nova's `skills/agent/` mirror). Re-applied the local Supabase env wiring
  (`SUPABASE_URL`/`SUPABASE_SECRET_KEY` in `config.example` +
  `scripts/server.sh` gen_secrets) that the refresh reverted.

- **Upgraded `cognisphere-harness` 0.8.0 → 0.8.1** (prompt/script corrections
  from upstream): re-seeded `0-base_prompt.md` (drops the `ddgs -o json`
  advice, routes plugin requests to `nova` instead of the operator) and the
  `scripts/agent/` wrappers (`session-reader` help reflects the task-thread
  session layout; wrapper headers no longer cite the removed `pi -p` CLI) on
  both agents. Daisy's local `cd /tmp` guard in the `ddgs` wrapper was
  re-applied on top of the new seed.

- **Upgraded `cognisphere-harness` 0.7.1 → 0.8.0** (two-phase: dependency bump +
  data-dir migration per the upstream CHANGELOG window):
  - Sub-agent CLI removed upstream — deleted the seeded
    `scripts/agent/subagent` + `sub-agent-prompt.md` from both agents, and
    removed `subagentModel` from daisy's `agent.json`. Delegation now runs
    through **task threads** (self-messages via the core agent-messaging
    plugin); daisy's `1-agent.md` ingestion workflow was reworded accordingly.
  - `0.1-main-agent.md` merged upstream into `0-base_prompt.md` — replaced both
    agents' base prompt with the new seed (forks were pristine; daisy's former
    local edits are already covered by her `1-agent.md`) and deleted
    `0.1-main-agent.md`. Roster renamed `0.3-agent-directory.md` →
    `0.1-agent-directory.md`.
  - agent-messaging became a core plugin — removed daisy's now-redundant enable
    dir (config was `{}`, inbox/state empty).
  - Developer agent id frozen upstream to `nova` — renamed `agents/dory/` →
    `agents/nova/`, updated `agent.json`, daisy's roster entry, and the docs
    (`docs/harness/agent-dory.md` → `agent-nova.md`); replaced the pristine
    `1-dev-agent.md` fork with the new nova seed.

## 2026-07-29

### Changed

- **Harness upgraded 0.7.0 → 0.7.1.** Adds gws thread-routing on the raw
  Gmail thread id (`scripts/gws/routes add --gmail-thread-id RE`) — the
  precise way to keep replies to one mail in one thread; daisy's forked
  `scripts/gws/routes` and `system_prompts/plugin-gws.md` were pristine
  0.7.0 seeds and took the 0.7.1 seeds unchanged. (The registry publish
  lagged the git tag by a couple of hours; a briefly vendored tarball was
  replaced with the registry package once 0.7.1 appeared.)

### Fixed

- Agent chat now renders literal `\\n` sequences from CLI replies as line
  breaks, fixing paragraphs and bullet lists in both new and existing messages.

## 2026-07-28

### Changed

- Removed the delete/deactivate buttons from the Suppliers and Plant Search
  tables; their rightmost action columns now contain only the view-local hide
  control.

### Fixed

- **Word-prefix search returned nothing** — `search_inventory('Mexican
  Sycamor')` found 0 rows while the full word found 17. The pgroonga
  `TokenDelimit` index only matches whole tokens, its fuzzy path doesn't cover
  edits at the end of a token, and the trgm fallback excludes queries that are
  substrings of the document — typed prefixes fell between every branch. Both
  search RPCs now OR in a Groonga `*` prefix match on the query's last token
  (when ≥ 3 chars). Migration `040_search_prefix_match`
  (`harness/agents/daisy/migrations/0003_search_prefix_match.sql`); no app
  code changed.

## 2026-07-27

### Added

- **Agent chat in the app.** A chat panel for `daisy`, built on the Supplier
  Workspace design: a resizable docked panel on desktop, a 46px collapsed rail,
  and a full-screen sheet on mobile opened from the bottom tab bar. Panel state
  persists to `localStorage` (`lps.chat.v1`).
- **`webchat` harness plugin** (`harness/plugins/webchat/`) — the first
  user-space plugin in this deployment. HTTP inbox at
  `/webhook/<agent>/webchat/api/*`, replies via the seeded
  `scripts/webchat/webchat-cli`. Configured with `threadId: "main"`, so the web
  panel and Telegram **share one thread and one context** rather than being two
  separate conversations.
- **Attachments both ways.** Users can attach files, paste images, and record
  voice notes; the agent can return files with `--file`. Images render inline,
  audio in a player, everything else as a download.
- **Voice notes** with a WhatsApp-style player — play/pause, a seekable
  waveform decoded from real RMS amplitude, elapsed time — and a live level
  meter while recording.
- **"Working…" indicator** while the agent owes a reply: a typing bubble, an
  amber status dot, and a badge on the collapsed rail avatar.
- `lib/agents.ts` — the single list of chattable agents, driving the selector,
  rail, mobile tab and the `/api/chat/<id>/…` allowlist.
- `docs/harness/plugin-webchat.md`, and this changelog.
- Mobile filters on plant search, plus a shared `FilterControl` component.

### Changed

- **Mobile supplier cards on plant search collapse.** A chevron on each card
  toggles its plant list; the card header still opens the supplier profile.
- **Mobile bottom tab bar alignment.** Tabs stretch to equal height, so a
  two-line label ("Plant search") no longer knocks its icon out of line.
- **Plant search mobile filters** are now a fixed, useful set — supplier,
  supplier category, state, city, size, price — instead of mirroring every
  filterable plant column (plant name, other names, quantity are gone).
- Harness dependency upgraded to **0.7.0**.
- Root `README.md` no longer claims the app "does not talk to agents" — it now
  does.
- Daisy's `agent.json` description and docs note both reachable channels.

### Fixed

- **Voice notes could never have worked on iPhones.** Safari cannot record
  webm — it produces mp4/AAC — but the recorder hardcoded `.webm` /
  `audio/webm`. The container is now chosen with
  `MediaRecorder.isTypeSupported` and the extension follows the recorder's real
  `mimeType`.
- **The mic button failed silently off `localhost`.** `navigator.mediaDevices`
  is `undefined` outside a secure context, and the resulting `TypeError` was
  swallowed by a bare `catch`, so nothing happened at all. It now reports the
  cause — insecure origin, unsupported browser, denied permission, or no device.
  (Recording over plain `http://` remains impossible; the app must be served
  over HTTPS for it to work on a phone.)
- `api/file` sends `Content-Length` from `stat` rather than the client-declared
  size, which could truncate or hang a response, and adds `Accept-Ranges` so
  audio is seekable.
- `webchat-cli` builds its URL from `$PI_WEBHOOK_BASE` instead of a hardcoded
  port — the harness serves on **3142** here, not the library default, so the
  original fallback would have failed on every send.
- The transcript now scrolls to the bottom on load (a layout effect, so there is
  no flash of the top), unpins while the user reads history, and re-pins when a
  late image changes the height.
- `next.config.ts`: `allowedDevOrigins` type error that had been failing
  `pnpm build` and `pnpm typecheck`.

### Security

- Browser-facing `webchat` endpoints require a resolved harness session — the
  plugin forwards the cookie to `/api/auth/me` rather than trusting that
  `pi_sid` is present, since it is a signed stateless token. `api/reply`
  requires `COGNISPHERE_WEBHOOK_SECRET`. Attachment paths are rejected if they
  escape the inbox/outbox or the agent dir, and uploads are capped (25MB).
- **Chat transcripts are no longer committed.** `webchat`'s `state/` and
  `inbox/` are gitignored and the transcript that had been committed was
  untracked — it is session data (`CLAUDE.md` §6). Scoped to `webchat` so that
  telegram's `routes.json` and scheduler's `schedules.json`, which are real
  config, stay tracked.

## 2026-07-24

### Added

- Per-agent documentation under `docs/harness/` (`agent-daisy.md`,
  `agent-dory.md`) and system prompts for the developer agent.

## 2026-07-22

### Changed

- **App-home restructure** to the 0.4.0 layout: harness data dir moved to
  `harness/` (from `lps-harness/`), the web app to `app/` (from `web/`).
- Telegram and internal-messaging plugin documentation clarified.

### Added

- Contabo provisioning scripts; the S3 backup script made S3-compatible.

## 2026-07-15 – 2026-07-17

### Added

- User-scope **telegram** plugin override with its own CLI.
- Gmail message decoding and attachment handling (`format-email`).
- **agent-messaging** plugin for inter-/intra-agent communication.

## 2026-07-06 – 2026-07-14

### Added

- **`daisy`** — the supplier-onboarding and availability-ingestion agent, with
  Gmail labelling to track processing status.
- S3 backups on a cron job; AWS setup script made version-flexible.

### Fixed

- Supabase reached via the IPv4 pooler with a direct-host fallback.
- Agent bootstrap installs all dependencies reliably; shebang scripts made
  executable.

## 2026-06-17 – 2026-06-29

Initial build.

### Added

- The harness, and `rosie` as Austin Plant Supply's supplier-side agent (since
  removed — the deployment keeps the name as deploy identity).
- The Supplier Workspace UI: catalogue tables, customer/job workspace, an
  availability-request flow and a stock-check form (both since removed).
- Deploy scripts, systemd units, config template and the root README.
