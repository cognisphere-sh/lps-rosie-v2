# Agent: rosie

The **order-coordination agent** — owns customer job requests end-to-end and,
since the 2026-08-23 restructure, **all order-side supplier and customer
coordination**. Created 2026-08-17 alongside migration 0055 (her tables:
`customers`, `job_requests`, `job_request_items`, `job_request_changelog`);
restructured 2026-08-23 alongside migration 0068 (the thread-id columns).

## agent.json

Daisy's shape: model `openai-codex` / `gpt-5.6-terra`, `thinkingLevel: medium`,
`threadIdStrategy: plugin_channel`, `maxConcurrentSlots: 10`, `maxAttempts: 3`,
`runtime: subprocess`. `secretsSchema` is byte-identical to daisy's four
Supabase keys (`SUPABASE_PROJECT_ID` and `SUPABASE_SECRET_KEY` required); the
secret **values** in `harness/.secrets/secrets.json` under `rosie.agent.*` are
the same project credentials daisy uses.

## Purpose and thread architecture

Rosie's scope is three things: job requests end-to-end (intake, sourcing,
pricing, statuses, quotes), order-side supplier coordination, and customer
coordination. Daisy keeps supplier discovery, onboarding and availability
ingestion; the shared surface between them is `suppliers.notes` (quirks and
coordination preferences, edited in place).

**Delegation is the architecture** — `main` only talks to Chris/Bhoumik, and
every piece of work runs on the thread that owns it:

| Thread | Owns |
|---|---|
| `main` | Coordination with Chris/Bhoumik (Telegram + web-app chat panel, one thread). **Creates no rows**: a job order arriving here gets an id reserved for it (`nextval` on the `job_requests` sequence) and is handed whole to `jr-<id>`, which writes the rows; anything else is forwarded to the owning thread, via `router` when unknown |
| `jr-<id>` | One per job request, for its life. Opened **before the request exists** — by main's handoff or by the app's **New job request** button (which reserves the id through `reserve_job_request_id()`, migration 0072) — and writes the rows itself: the customer, the request under its own thread's id (`OVERRIDING SYSTEM VALUE`, since `id` is GENERATED ALWAYS), then the items. Then the sourcing round, statuses, the quote. Reaches suppliers and customers only by messaging their threads (`job-requests`) |
| `supplier-<slug>` | One per supplier company — the **`suppliers.rosie_thread_id`** value (migration 0068; same slug daisy uses, distinct per-agent thread). All order-side coordination with that supplier across every job: availability requests, follow-ups, their answers (`supplier-coordination`) |
| `customer-<slug>` | One per customer — the **`customers.rosie_thread_id`** value, minted on first contact. Every conversation with them (`customer-coordination`) |
| `router` | Messages with no known target — from `main`, the `supplier-events` fallback, or future channels — identified and forwarded; missing thread ids minted and recorded (`message-routing`) |

Four hard policies, stated in `system_prompts/1-agent.md` and detailed in the
skills:

1. **Supplier contact only on the supplier's thread, every external send
   gated.** Order-side coordination is hers — creating an availability
   request in an **LPS Partner**'s portal (`suppliers.is_onboarded`) is the
   supplier thread's standing job — but what reaches the supplier follows the
   gates: `share_customer_details` is the remembered per-supplier preference
   in `suppliers.notes` or Chris's answer (recorded as the preference), and a
   non-Partner email is drafted, Chris-approved, and sent by Chris or by
   daisy's supplier thread from the shared mailbox (rosie has none).
2. **Never messages a customer unbidden** — draft first, Chris approves the
   specific draft, Chris sends it (no mailbox). Every contact logged in
   `customers.communication_notes`. Runs on the customer's thread.
3. **Read-before-edit.** Her tables are edited concurrently by app users:
   `SET app.actor TO 'rosie'`, re-SELECT immediately before UPDATE, guarded
   transitions, append-only contact log, last-5 `job_request_changelog`
   entries loaded with every request/item acted on.
4. **A listing is not availability** (Chris, 2026-08-19, after JR-5). A
   catalogue hit fills `unit_price` and a `sourcing_notes` line and leaves the
   item **`pending`**; only the supplier's own answer (through their thread —
   normally a portal availability request) or Chris's explicit word moves it.
   The ask carries every line of the request; only a line Chris explicitly
   excluded is left off.

Conventions unchanged from before the restructure: Austin Plant Supply
(`suppliers.id = 1`) is the default source and `unit_price` only ever carries
their price (or an explicitly instructed one); `sourcing_notes` is a working
sheet edited in place (a line per supplier, `Substitute:` prefix when the row
isn't the ask); she names the job at intake (`job_requests.name`, NULL over an
invented label); `available_quantity` is people's, `total` is generated.

## Plugins

Enabled now (core `admin` / `scheduler` / `agent-messaging` need no dirs):

| Plugin | Config (`plugins/<id>/config.json`) | Note |
|---|---|---|
| `artifacts` | `{ "appBaseUrl": "https://lps.cognisphere.sh/a/rosie" }` | `rosie` is in `ARTIFACTS_AGENTS` (deploy `config`), so the restart writes her `ARTIFACTS_APP_SECRET` |
| `webchat` | `{ "threadId": "main" }` | **Live** (2026-08-18; multi-thread since 2026-08-23). The app's chat panel reaches her at `/api/chat/rosie/*` — default thread `main` (shared with Telegram), and the panel's thread picker opens any of her threads (`jr-<id>`, supplier, customer, `router`). Also carries the secret `WEBCHAT_APP_SECRET` for the supplier portal's chat (`--portal` replies are the only messages the portal shows). See [plugin-webchat.md](plugin-webchat.md) |
| `telegram` | `{ "pollTimeoutSec": 25, "allowedChatIds": ["-1004491410854"] }` | **Live** — bot `lps_rosie_bot`, token in secrets as `rosie.telegram.TELEGRAM_BOT_TOKEN`. `state/routes.json` maps that chat to `main` |
| `supplier-events` | `{}` | **Live** (2026-08-23) — the app's availability-save webhook, delivered to the supplier's `rosie_thread_id` thread (fallback `router`). See [plugin-supplier-events.md](plugin-supplier-events.md) |

### Pending: email (gws)

**Not enabled** — the gws plugin hard-fails the agent start without its
required credential, so `plugins/gws/` must not exist until a mailbox does.
When rosie gets her own address (an open business decision — daisy already
reads `chris.r@localplantsupply.com`), the enable procedure is:

1. Obtain credentials for the mailbox (`gws auth login` + `gws auth export`)
   and place the file (daisy's lives at `harness/.secrets/gws-credentials.json`;
   use a distinct filename for rosie's).
2. Add `rosie.gws.GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE` → that path to
   `harness/.secrets/secrets.json`.
3. `mkdir harness/agents/rosie/plugins/gws` and write `config.json` (daisy's
   shape).
4. Restart the harness; confirm the plugin is `running` and update this file
   and the README comparison table. Her `router` thread is the natural
   catch-all target, mirroring daisy's routing setup.

Until then, customer email ends with Chris sending the approved text himself
(`customer-coordination`), and non-Partner supplier outreach goes through
Chris or daisy's mailbox (`supplier-coordination` §4).

## Knowledge (`knowledge/`)

- `files/SCHEMA.md` — **symlink** to `docs/supabase-schema.md`, per the README
  rule (never a copy).
- `files/templates/` — quote templates; maintained via the `quote-generation`
  skill; a template change needs Chris's approval of the rendered look.
- `index.md` + `memory.md` — standard.

## Scripts & extensions

The shared toolset and extensions are the stock template copies (see the
README's *Shared across all agents*). Beyond those:

- `scripts/agent/supabase/{query,upload,sign-url}` — copies of daisy's three.
  Same DDL/DELETE-blocking guard; rosie's sharing path convention is
  `rosie_shared/YYYY-MM-DD/<file>` in the `lps` bucket.
- `system_prompts/0-base_prompt.md` is the stock seed, byte-identical to
  daisy's and nova's. The deployment's no-version-in-a-skill-reference rule
  moved out of it into `1-agent.md` in the 0.10.2 upgrade (see the README).
- `system_prompts/1.1-supabase.md` — adapted from daisy's; documents the two
  rosie-specific gotchas (generated `total`, trigger-written changelog).

## Migrations

Rosie-owned tables, but migration files stay in
`harness/agents/daisy/migrations/` — that directory is the deployment's single
sequential record (see its `NOTE.md`; hers are 0055 and 0068).

## Skills (`skills/agent/`)

Each skill's version lives in its own frontmatter and `CHANGELOG.md`; it is
deliberately not repeated here, where it would only go stale.

| Skill | What it is |
|---|---|
| `job-requests` | The core operating procedure: intake as a reserved id handed from `main` to the `jr-<id>` thread, which writes the customer, the request and the items and then runs the sourcing round, statuses and quote coordination; concurrency discipline (`app.actor`, re-SELECT, guarded transitions, atomic appends); the three-notes split and the customer-visibility rule; the Austin-Plant-Supply-first pricing and sourcing ladder; availability asks to each supplier's own thread (§5.2) and the confirmation gate (§5.3) — a catalogue hit prices a line and leaves it `pending`; the four-word item status vocabulary and the request lifecycle; customer contact handed to the customer's thread (§7) |
| `supplier-coordination` | Runs on a supplier's `rosie_thread_id` thread — all order-side coordination across jobs: the LPS Partner split, creating availability requests (every line by default, snapshotting, price prefill), per-supplier preferences remembered in `suppliers.notes` (share customer details first among them; Chris asked only when nothing is remembered), `availability_submitted` handling with relay to the jr thread, gated outreach for non-Partners |
| `customer-coordination` | Runs on a customer's `rosie_thread_id` thread (minted on first contact) — the draft → Chris-approves → Chris-sends flow, the append-only `communication_notes` log, durable preferences in `customers.notes`, relaying answers to the owning jr thread |
| `message-routing` | Runs on the `router` thread — identify the owning `jr-<id>` / supplier / customer thread for unmapped messages, mint missing `rosie_thread_id` values, forward pointers, escalate to `main` only what needs a human |
| `plant-and-supplier-search` | Adapted from daisy's — same RPC guidance, plus the read-only framing (findings go to item `sourcing_notes`; data problems get reported to daisy, not fixed; a hit is a listing, never an availability) and the sourcing look-up scoped to Austin Plant Supply |
| `quote-generation` | Job request → customer-facing HTML/PDF quote: templates, customer-safe-fields-only rule, agent-browser print, upload + sign-url under `rosie_shared/`, artifacts publishing, and the approval gate. A filled `unit_price` is not permission to quote |
| `text-quote-format` | The plain-text quote shape for chat/Telegram delivery |
| `create-skill` | Installed by `cognisphere agent new` (template) |
