# Agent: rosie

The **customer-success agent** — owns the customer side of the database the
same way daisy owns the supplier side. Created 2026-08-17 alongside migration
0055 (which added her tables: `customers`, `job_requests`, `job_request_items`,
`job_request_changelog`).

## agent.json

Daisy's shape: model `openai-codex` / `gpt-5.6-terra`, `thinkingLevel: medium`,
`threadIdStrategy: plugin_channel`, `maxConcurrentSlots: 10`, `maxAttempts: 3`,
`runtime: subprocess`. `secretsSchema` is byte-identical to daisy's four
Supabase keys (`SUPABASE_PROJECT_ID` and `SUPABASE_SECRET_KEY` required); the
secret **values** in `harness/.secrets/secrets.json` under `rosie.agent.*` are
the same project credentials daisy uses.

## Purpose

Own customer job requests end-to-end: intake (including anonymous requests
mapped to a customer later), sourcing coordination, pricing, quotes, statuses,
and the `needs_attention` flags the future Job Requests UI will read. The
division of labor with daisy is the database's own line: rosie writes the
customer tables and only reads the supplier tables; daisy the reverse.

Three hard policies, stated in `system_prompts/1-agent.md` and detailed in the
skills:

1. **Never contacts a supplier.** All supplier-side questions go as
   agent-messages to daisy (subject `sourcing: JR <id> — …`). Daisy's
   `1-agent.md` has a matching section: rosie's ask is task input, not
   authorization — supplier contact still runs through daisy's
   `supplier-communications` approval rules.
2. **Never emails a customer unbidden** — draft first, Chris approves the
   specific draft, and (until she has a mailbox) Chris sends it himself. Every
   contact is logged in `customers.communication_notes`.
3. **Read-before-edit.** Her tables are edited concurrently by app users, so:
   `SET app.actor TO 'rosie'` at the top of every write session, re-SELECT
   immediately before UPDATE, guarded status transitions, append-only notes,
   and the last-5 `job_request_changelog` entries loaded with every
   request/item she acts on.

## Plugins

Enabled now (core `admin` / `scheduler` / `agent-messaging` need no dirs):

| Plugin | Config (`plugins/<id>/config.json`) | Note |
|---|---|---|
| `artifacts` | `{ "appBaseUrl": "https://lps.cognisphere.sh/a/rosie" }` | `rosie` is in `ARTIFACTS_AGENTS` (deploy `config`), so the restart writes her `ARTIFACTS_APP_SECRET` |
| `webchat` | `{ "threadId": "main" }` | **Live** (2026-08-18). The app's chat panel reaches her at `/api/chat/rosie/*`; `main` is the same thread telegram routes to, so panel and Telegram are one conversation |
| `telegram` | `{ "pollTimeoutSec": 25, "allowedChatIds": ["-1004491410854"] }` | **Live** — bot `lps_rosie_bot`, token in secrets as `rosie.telegram.TELEGRAM_BOT_TOKEN` (a token supports one poller, so this is her own bot, not daisy's). `state/routes.json` maps that chat to `main`, the thread webchat also uses |

### Pending: email (gws)

**Not enabled** — the gws plugin hard-fails the agent start without its
required credential, so `plugins/gws/` must not exist until a mailbox does.
When rosie gets her own address (which address is an open business decision —
daisy already reads `chris.r@localplantsupply.com`), the enable procedure is:

1. Obtain credentials for the mailbox (`gws auth login` + `gws auth export`)
   and place the file (daisy's lives at `harness/.secrets/gws-credentials.json`;
   use a distinct filename for rosie's).
2. Add `rosie.gws.GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE` → that path to
   `harness/.secrets/secrets.json`.
3. `mkdir harness/agents/rosie/plugins/gws` and write `config.json` (daisy's
   shape):

   ```json
   {
     "pollIntervalSec": 300,
     "gmailQuery": "in:inbox -label:rosie after:2026-08-17 is:unread",
     "allowedSenders": "*",
     "requireAgentInTo": false
   }
   ```

4. Restart the harness; confirm the plugin is `running` and update this file
   and the README comparison table.

Until then, the customer-email flow ends with Chris sending the approved text
himself (`job-requests` skill, §8).

## Knowledge (`knowledge/`)

- `files/SCHEMA.md` — **symlink** to `docs/supabase-schema.md`, per the README
  rule (never a copy).
- `files/templates/` — quote templates; `lps-quote-template.html` is the
  starter/default (structure modeled on daisy's Austin Plant Supply template).
  Maintained via the `quote-generation` skill; a template change needs Chris's
  approval of the rendered look.
- `index.md` + `memory.md` — standard.

## Scripts & extensions

The shared toolset and extensions are the stock template copies (see the
README's *Shared across all agents*). Beyond those:

- `scripts/agent/supabase/{query,upload,sign-url}` — copies of daisy's three.
  Same DDL/DELETE-blocking guard; rosie's sharing path convention is
  `rosie_shared/YYYY-MM-DD/<file>` in the `lps` bucket.
- `system_prompts/0-base_prompt.md` was copied from daisy's so the
  deployment's one local edit (Task-threads bullet, 2026-08-15) carries; the
  `cognisphere-upgrade` local-edit pass now covers three agents.
- `system_prompts/1.1-supabase.md` — adapted from daisy's; documents the two
  rosie-specific gotchas (generated `total`, trigger-written changelog) and
  drops daisy's stale RLS remark.

## Migrations

Rosie-owned tables, but migration files stay in
`harness/agents/daisy/migrations/` — that directory is the deployment's single
sequential record (see its `NOTE.md`, entry 0055). Rosie's own dir has no
`migrations/`.

## Skills (`skills/agent/`)

Each skill's version lives in its own frontmatter and `CHANGELOG.md`; it is
deliberately not repeated here, where it would only go stale.

| Skill | What it is |
|---|---|
| `job-requests` | The core operating procedure: intake (incl. anonymous), concurrency discipline (`app.actor`, re-SELECT, guarded transitions, atomic appends), the last-5-changelog fetch rule, the three-notes split — including that `customer_notes` holds only what no structured column already does — and the customer-visibility rule (qty changes / substitutions explained in `external_notes`), sourcing via daisy, `needs_attention` conventions, the four-word item status vocabulary and the request lifecycle, the Chris-approved customer-contact flow |
| `plant-and-supplier-search` | Adapted from daisy's — same RPC guidance, plus the read-only framing (findings go to item `internal_notes`; data problems get reported to daisy, not fixed). Fold daisy-side search changes in on approval |
| `quote-generation` | Job request → customer-facing HTML/PDF quote: templates, customer-safe-fields-only rule, agent-browser print, upload + sign-url under `rosie_shared/`, artifacts publishing, and the approval gate |
| `create-skill` | Installed by `cognisphere agent new` (template) |
