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
mapped to a customer later), sourcing coordination, pricing, quotes and the
statuses the Job Requests UI reads. The
division of labor with daisy is the database's own line: rosie writes the
customer tables and only reads the supplier tables; daisy the reverse.

Four hard policies, stated in `system_prompts/1-agent.md` and detailed in the
skills:

1. **Never contacts a supplier** — not by email, not through the supplier
   portal (2026-08-19: the portal briefly looked like her channel and Bhoumik
   ruled it is daisy's). Every supplier-side question the database can't
   answer goes as an agent-message to daisy **on that supplier's own thread**
   (`supplier-<id>` — one conversation per supplier, availability-request
   follow-ups included; `main` only when no supplier is in play yet), with the
   ask mirrored into the
   `supplier_messages` transcript as an `internal` row so the app's chat view
   shows it. Daisy's `1-agent.md` has a matching section: rosie's ask is task
   input, not authorization — whether and how a supplier gets contacted (email
   or their portal) is daisy's `supplier-communications` /
   `availability-requests` rules and Chris's approval.
2. **Never emails a customer unbidden** — draft first, Chris approves the
   specific draft, and (until she has a mailbox) Chris sends it himself. Every
   contact is logged in `customers.communication_notes`.
3. **Read-before-edit.** Her tables are edited concurrently by app users, so:
   `SET app.actor TO 'rosie'` at the top of every write session, re-SELECT
   immediately before UPDATE, guarded status transitions, append-only notes,
   and the last-5 `job_request_changelog` entries loaded with every
   request/item she acts on.
4. **A listing is not availability** (Chris, 2026-08-19, after JR-5 — she
   priced eleven lines off the Austin Plant Supply list and marked them
   `available`, which the skill told her to do). The inventory tables are
   published price lists, Austin Plant Supply's included; a hit fills
   `unit_price` and a `sourcing_notes` line and leaves the item **`pending`**.
   Only two things move it: the supplier's own answer relayed by daisy
   (normally an availability request in their portal — her channel, Chris's
   call), or Chris explicitly saying to treat the line as confirmed. **The ask
   carries every line of the request** — priced, substituted and unmatched
   alike, since a line missing from a price list is the one a supplier is most
   likely to surprise us on; only a line Chris explicitly excluded is left off.
   The confirmation flow is `job-requests` §5.3; daisy's
   `availability-requests` states the same rule from her side, and puts the two
   questions to Chris before a request goes out (all lines or a subset, and
   whether the customer's details are shared).

**She runs each job request's sourcing round in a task thread** —
`main-§-[TASK]-§-jr-<id>-sourcing`, spawned as the last step of intake. The
look-ups, the item writes and the asks to daisy live there (daisy's answers
come back to it via `--from-thread-id`); `main` keeps the conversation with
Chris and the `## Tasks` tracking line. A quote build and any long read get
their own task threads the same way.

Two conventions the same prompt carries, added 2026-08-18 on Chris's
instruction and detailed in the `job-requests` skill:

- **Austin Plant Supply (`suppliers.id = 1`) is the default source.** The house
  yard's catalogue is in the database, so she prices a line from their row
  herself — reading inventory is not contacting a supplier. If they don't have
  the ask she recommends their closest alternative; only when they have neither
  does the line go to other suppliers (through daisy) — and then the price
  stays in the item's `sourcing_notes`, which says why the line left Austin
  Plant Supply, which supplier quoted and what they quoted. Chris or the
  customer naming — or excluding — a supplier overrides the ladder, and a
  supplier named that way is the only one whose price she writes into
  `unit_price`. **Pricing a line is not confirming it** (policy 4): every rung
  of the ladder leaves the item `pending`.
- **`sourcing_notes` is a working sheet, not a log.** Free text she edits in
  place: on an item, a terse line per supplier in one shape — the row that
  supplier has, then `@ $N/unit`, with `Substitute:` in front when the row
  isn't the ask (`APS: Substitute: Thryallis 3 G @ $23/unit`) — updated rather
  than appended to; on a request, only what changed about the job itself.
  `customers.communication_notes` is the exception that stays append-only,
  stamped `[<timestamp>] <Name>:` — a contact happened at a time. (The app's
  own appends there carry the stamp but no name: it resolves the signed-in
  user in `lib/session.ts` but doesn't thread it into
  `appendNote`.)
- **She names the job.** `job_requests.name` (migration 0059) is written at
  intake — what the job is called out loud, NULL rather than an invented
  label.

Pricing writes **one** column: `unit_price`, and it carries an Austin Plant
Supply price — anyone else's stays in `sourcing_notes` until Chris or the
customer sources the line there. `available_quantity` is left to people in the
app, and `total` is generated — the customer's *asked* quantity times the unit
price.

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
himself (`job-requests` skill, §7).

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
| `job-requests` | The core operating procedure: intake (incl. anonymous), concurrency discipline (`app.actor`, re-SELECT, guarded transitions, atomic appends), the free-text `sourcing_notes` (a line per supplier in one shape — the row priced, then its price, `Substitute:`-prefixed when it isn't the ask; renamed from `internal_notes` by migration 0061) against the stamped, append-only contact log, the last-5-changelog fetch rule, the three-notes split — including that `customer_notes` holds only what no structured column already does — and the customer-visibility rule (qty changes / substitutions **named** in `external_notes`, never explained, sizes as `XX G`, and no supplier, supplier price or price list in the shared note at all unless someone explicitly asks for it), the Austin-Plant-Supply-first pricing and sourcing ladder (`unit_price` is the only column she fills, and it carries an Austin Plant Supply price — another supplier's stays in `sourcing_notes` unless Chris or the customer sourced the line there), sourcing via daisy on the supplier's own thread (she owns every supplier conversation, portal included; the ask is mirrored into the `supplier_messages` transcript), the confirmation gate — a catalogue hit prices a line and leaves it `pending`; only a supplier's answer or Chris's word makes it `available`/`alternative_proposed` (§5.3) — the per-request sourcing task thread spawned at intake, the four-word item status vocabulary — the only thing that says a line needs a person, since `needs_attention` was dropped by migration 0060 — and the request lifecycle, the Chris-approved customer-contact flow |
| `plant-and-supplier-search` | Adapted from daisy's — same RPC guidance, plus the read-only framing (findings go to item `sourcing_notes`; data problems get reported to daisy, not fixed; a hit is a listing, never an availability) and the sourcing look-up scoped to Austin Plant Supply. Fold daisy-side search changes in on approval |
| `quote-generation` | Job request → customer-facing HTML/PDF quote: templates, customer-safe-fields-only rule (same explicitly-asked-for exception as the shared note), agent-browser print, upload + sign-url under `rosie_shared/`, artifacts publishing, and the approval gate. A filled `unit_price` is not permission to quote: a priced `pending` line is unconfirmed |
| `create-skill` | Installed by `cognisphere agent new` (template) |
