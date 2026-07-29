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

## 2026-07-29

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
