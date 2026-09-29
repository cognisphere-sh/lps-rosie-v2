# Daisy configuration and integrations

## agent.json

- **name**: `daisy`
- **description**: "Supplier discovery, onboarding and availability-ingestion
  agent for LPS — one dedicated thread per supplier company
  (suppliers.daisy_thread_id), fed by a router thread and per-supplier gws
  routing rules. Reachable on the
  Telegram main thread and in the web app's chat panel, which route to the
  same thread."
- **model**: `openai-codex` / `gpt-6-astra` / thinkingLevel `medium`
- **threadIdStrategy**: `plugin_channel`
- **maxConcurrentSlots**: 10 · **maxAttempts**: 3 · **runtime**: `subprocess`
- **devAgent**: no
- **secretsSchema** (required: `SUPABASE_PROJECT_ID`, `SUPABASE_SECRET_KEY`):
  - `SUPABASE_PROJECT_ID` — Supabase project ref
  - `SUPABASE_SECRET_KEY` — `sb_secret_*`, used by `upload` / `sign-url` over HTTP
  - `SUPABASE_DB_PASSWORD` — Postgres password for the `query` psql script
  - `SUPABASE_URL` — project URL

## Plugins

- **admin** — admin chat channel; visible text reaches the human admin.
- **agent-messaging** (config `{}`) — internal inter-/intra-agent messaging.
  Send via `scripts/agent-msg/send --to-agent <id> --thread-id <id> --message …`;
  identity is harness-set (not spoofable); a disallowed sender gets HTTP 403.
  No inbox restriction configured here.
- **supplier-events** — *dropped from daisy 2026-08-23* (was: the app waking
  her on portal activity and chat-view instructions, added 2026-08-19).
  Recreated the same day, lean, on **rosie** — see
  [plugin-supplier-events.md](plugin-supplier-events.md).
- **gws** (Google Workspace/Gmail) — polls Gmail server-side, emits one
  `email_received` per inbound message. Since harness 0.8.22 that notification
  is a **preview** — header, first two lines of the sender's own text, and
  attachment names only; the message itself is read with `scripts/gws/email
  read <MessageId> [--attachments]`. Outbound via the `gws` CLI. Ships the
  plugin-owned skills `read-email`, `search-email` and `route-email`. Operator
  config (`plugins/gws/config.json`): `pollIntervalSec: 300`, `gmailQuery:
  "in:inbox -label:daisy after:2026-07-01 is:unread"`, `firstOfThreadOnly:
  false`, `allowedSenders: "*"`, `requireAgentInTo: false` — every key the
  harness 0.9.0 defaults flipped (`pollIntervalSec` 60 → 900,
  `requireAgentInTo` true → false) is set explicitly here, so that release did
  not change Daisy's behaviour. Since 0.9.0 Daisy also **owns her own
  notification settings**: `scripts/gws/settings show|set|reset` writes an
  overlay at `plugins/gws/state/settings.json` that takes precedence over the
  operator config for `pollIntervalSec` (`-1` silences email entirely),
  `gmailQuery`, `allowedSenders` and `requireAgentInTo` — re-read every poll,
  and re-announced to her as a `gws_settings` message on each harness start.
  `firstOfThreadOnly` stays operator-only. Since 2026-08-23 the routing state
  (`plugins/gws/state/routes.json`) holds per-supplier `--from` rules the
  router adds as senders prove stable, then a catch-all (`router-all`,
  `from: "."`) sending everything else to the `router` thread. First match
  wins and `routes add` appends, so the router re-adds the catch-all after
  every rule it adds to keep it last; per-exchange rules stay retired.
- **artifacts** — publishes self-contained HTML pages on the app's domain.
  Config `{"appBaseUrl": "https://lps.cognisphere.sh/a/daisy"}` — the `/a/daisy`
  prefix is what keeps its links distinct from Nova's, since the plugin appends
  `/<public|private>/artifacts/<slug>` itself. Secret `ARTIFACTS_APP_SECRET`,
  shared with Nova and the app (written by `scripts/app/secrets.sh`). Ships the
  plugin-owned `publish-artifact` skill and `scripts/artifacts/artifact`. See
  [`../app/README.md`](../app/README.md) § *Agent artifacts*.
- **scheduler** — one active schedule: `daisy-daily-9am-checkin`, cron
  `0 9 * * *`, fires into thread `daily-9am-checkin`, which follows the
  `daily-summary` skill and hands the text to `main` to post on Telegram as-is.
  The 3 AM daily onboarding cohort and the June backfill are paused; one-shot
  schedules apply future-dated supplier lists on their effective date.
- **telegram** — bot (ships the plugin-owned `route-chats` skill);
  `pollTimeoutSec: 25`, `allowedChatIds: ["-1003988082603"]`
  (locked to the admin group chat). One routing rule
  (`plugins/telegram/state/routes.json`, managed by `scripts/telegram/routes`):
  chat `-1003988082603` → thread `main`, overriding the `plugin_channel`
  strategy so the group chat lands in the `main` thread.
- **webchat** (user-space, [`plugin-webchat.md`](plugin-webchat.md)) — the web
  app's chat panel. Config `{"threadId": "main"}`, so web messages land on the
  **same thread as Telegram** and share one context. Since 2026-08-25 the
  panel's **Conversations** picker also opens her per-supplier threads
  (`suppliers.daisy_thread_id`), the way rosie's has since the restructure;
  `router` and the per-email threads stay deep-link only. Outbound via
  `scripts/webchat/webchat-cli send`. Secrets `WEBCHAT_SUPABASE_URL` /
  `WEBCHAT_SUPABASE_SECRET_KEY` (2026-08-26): transcripts live in `threads` /
  `thread_messages`, migration 0078.
  Contact history lives in that internal transcript. The
  [supplier-communications skill](../../harness/agents/daisy/skills/agent/supplier-communications/SKILL.md)
  owns broadcast/direct formatting and exact approval rules.
