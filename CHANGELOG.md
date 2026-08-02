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

## 2026-08-02

### Changed

- **Supplier profiles now require deliberate edit mode.** Profile fields are
  read-only until **Edit supplier** is pressed; edits are staged locally and a
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
