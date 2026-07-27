# Agent: daisy

**Supplier management & availability-ingestion agent for LPS.** Keeps supplier
and inventory data current in Supabase. Reachable on the Telegram admin thread
and has its own Gmail inbox.

## agent.json

- **name**: `daisy`
- **description**: "Supplier management and coordination agent for LPS —
  onboards new suppliers and keeps availability/inventory data current in
  Supabase. Reachable on the Telegram admin thread."
- **model**: `openai-codex` / `gpt-5.6-terra` / thinkingLevel `medium`
  (`subagentModel` same)
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
Bhoumik (developer), reachable on the Telegram admin thread
(`telegram:-1003988082603`), with its own Gmail inbox
(`chris.r@localplantsupply.com`). Two standing jobs:

1. **Onboard new suppliers** — create/enrich a `suppliers` record via browser
   research and subscribe to availability newsletters.
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
  pending approvals) to `telegram:-1003988082603`, channel `admin`.
- **telegram** — bot; `pollTimeoutSec: 25`, `allowedChatIds: ["-1003988082603"]`
  (locked to the admin group chat).

## Knowledge (`knowledge/`)

- `SCHEMA.md` — **a symlink to [`docs/supabase-schema.md`](../supabase-schema.md)**,
  the single source of truth for the Supabase schema shared by every agent and
  the web app. Daisy reads and corrects it through the symlink; it must never be
  replaced with a copy.
- `suppliers.md` — pointer stub: per-supplier notes now live under
  `workspace/suppliers/[<id>]:<Name>/notes.md` (see `workspace/suppliers/index.md`).
- `gmail-labels.md` — Gmail label ID taxonomy (e.g. `Daisy` = `Label_12`) with a
  live-lookup command if stale.
- `SOPs/supplier-onboarding-and-ingestion.md` — end-to-end SOP a sub-agent
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
- `scripts/scheduler/scheduler-cli`, `scripts/telegram/telegram-cli`.

Extensions: the two shared ones.

## Migrations (`migrations/`)

- `0001_availability_versioning.sql` + `NOTE.md` — **operator-run** DDL applied
  to Supabase project `xyeyiqchadfszewztnrf` (lps-rosie) on 2026-07-01 as
  `20260701104209_daisy_availability_versioning`. Reworks `public.rate_charts`:
  renames `common_name`→`common_names`, adds `category` (backfilled) and
  `is_active` (+ `rate_charts_supplier_active_idx` for versioned ingestion),
  drops `section_id` and the `rate_chart_sections` table. No data lost, RLS
  unchanged. Run by the operator because daisy's own `query` script blocks DDL.

## Skills

None.
