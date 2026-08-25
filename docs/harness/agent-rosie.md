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
   request in an **LPS Partner**'s portal (`suppliers.is_lps_partner`) is the
   supplier thread's standing job — but what reaches the supplier follows the
   gates: `share_customer_details` is the remembered per-supplier preference
   in `suppliers.notes` or Chris's answer (recorded as the preference), and a
   non-Partner email is drafted, Chris-approved, and sent by Chris or by
   daisy's supplier thread from the shared mailbox (rosie has none).
2. **Never messages a customer unbidden** — draft first, Chris approves the
   specific draft, Chris sends it (no mailbox). Runs on the customer's thread,
   whose web chat is the contact record (`customers.communication_notes` was
   dropped 2026-08-25, migration 0073).
3. **Read-before-edit.** Her tables are edited concurrently by app users:
   `SET app.actor TO 'rosie'`, re-SELECT immediately before UPDATE, guarded
   transitions, last-5 `job_request_changelog` entries loaded with every
   request/item acted on.
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

### Feedback and feature ideas go to lily (2026-08-25)

Two things reach [lily](agent-lily.md) from rosie's threads: Chris
**designing** rather than asking (how the app should behave, a capability that
doesn't exist, a change to how the work is run), and Chris **complaining about
how the work goes** — "this always takes forever", a workaround he's invented.
Both go to her by agent message (`--to-agent lily --thread-id main`) in his own
words; for a design conversation rosie also tells him to carry it on with
Lily on Telegram. The complaint is not small talk — it is the raw material her
log exists for. Either way the operational question in front of rosie still
gets answered. `1-agent.md` § *Chris & Bhoumik*.

## Plugins

Enabled now (core `admin` / `scheduler` / `agent-messaging` need no dirs):

| Plugin | Config (`plugins/<id>/config.json`) | Note |
|---|---|---|
| `artifacts` | `{ "appBaseUrl": "https://lps.cognisphere.sh/a/rosie" }` | `rosie` is in `ARTIFACTS_AGENTS` (deploy `config`), so the restart writes her `ARTIFACTS_APP_SECRET` |
| `webchat` | `{ "threadId": "main" }` | **Live** (2026-08-18; multi-thread since 2026-08-23). The app's chat panel reaches her at `/api/chat/rosie/*` — default thread `main` (shared with Telegram), and the panel's thread picker opens any of her threads (`jr-<id>`, supplier, customer, `router`). Also carries the secret `WEBCHAT_APP_SECRET` for the supplier portal's chat (`--portal` replies are the only messages the portal shows). Since 2026-08-25 a **supplier** thread's transcript is that supplier's contact history, as a customer thread's has been since migration 0073: every contact posted in the same task — direct communication quoted in full (subject, from/to, Gmail deep link where a message id is known), a forwarded broadcast header-only — alongside the milestones she already posts, and never `--portal`. Her supplier `notes.md` keeps only open follow-ups (`supplier-coordination` 1.2.0). See [plugin-webchat.md](plugin-webchat.md) |
| `telegram` | `{ "pollTimeoutSec": 25, "allowedChatIds": ["-1004491410854"] }` | **Live** — bot `lps_rosie_bot`, token in secrets as `rosie.telegram.TELEGRAM_BOT_TOKEN`. `state/routes.json` maps that chat to `main` |
| `supplier-events` | `{}` | **Live** (2026-08-23) — the app's availability-save webhook, delivered to the supplier's `rosie_thread_id` thread (fallback `router`). See [plugin-supplier-events.md](plugin-supplier-events.md) |
| `gws` | `{ "pollIntervalSec": -1, "gmailQuery": "in:inbox is:unread", "firstOfThreadOnly": false, "allowedSenders": "*", "requireAgentInTo": false, "oauthScopes": "" }` | **Configured, awaiting sign-in** (2026-08-25). Her mailbox is **`chris@localplantsupply.com`** (*Christopher Runyon*) — she owns all order/job-request correspondence from it. Everything is set except `pollIntervalSec`, deliberately left at `-1` so no poll runs before the credential exists; flip it to `300` after sign-in. `state/routes.json` carries the `router-all` catch-all → her `router` thread. `oauthScopes` is empty (Gmail only — `gmail.modify` is always requested); adding Calendar/Drive later means signing in again. See below |

### Email (gws) — configured, awaiting sign-in

**Her mailbox is `chris@localplantsupply.com`, sending as *Christopher
Runyon*** (decided 2026-08-25; may change). It is the **correspondence**
mailbox: every communication about an order or a job request, supplier and
customer alike. Daisy's `chris.r@localplantsupply.com` stays the **lifecycle**
mailbox — price lists, newsletters, onboarding, account setup — and the two are
permanent, so each agent hands the other what belongs to it (see
*Boundary with daisy* below).

Still passive: `pollIntervalSec: -1` means the poll loop only re-reads
settings, never touches Gmail, so no notifications fire and nothing is marked
read. The credential does not exist yet, so the plugin reports `failed` on
start; the agent itself keeps running (per-plugin failures don't sink an agent)
and the plugin's seed — the `plugin-gws.md` prompt fragment, `scripts/gws/` and
the `read-email` / `search-email` / `route-email` skills — is copied in
regardless.

To finish the enable:

1. `oauthScopes` is already set (empty — Gmail only). Change it *before*
   signing in if she needs Calendar/Drive: `gmail.modify` (Google's read/write
   Gmail tier, which the poll loop needs) is always requested, so no Gmail
   scope choice is offered, and changing scopes later means signing in again.
2. Sign in as the mailbox: console → **rosie → Settings tab → gws plugin
   card → Sign in with Google** (since harness 0.11.0 this lives on the
   agent, not the app-level Settings page, which now only holds the shared
   OAuth client id/secret already saved for daisy). The callback writes
   `harness/.secrets/gws/rosie/credentials.json`, points
   `rosie.gws.GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE` at it, and soft-reloads
   her — no hand-edit of `secrets.json`, and no `gws auth login`/`export`
   (that path was removed in 0.11.0).
3. Confirm the plugin is `running`, then **set `pollIntervalSec` to `300`** —
   operator-side in `config.json`, or by rosie herself via
   `scripts/gws/settings set` (an overlay at `plugins/gws/state/settings.json`
   that wins over the config and is picked up within a minute). Until this
   step she receives nothing. Routing is already in place:
   `state/routes.json` holds the `router-all` catch-all (`from: "."`) →
   `router`, and her `message-routing` skill promotes stable senders to their
   own `--from` rules, re-adding the catch-all last so it keeps matching last.
   Update this file and the README comparison table.

### The jr thread is the source for its order (2026-08-25)

**Everything job-related that needs Chris is put to him on that order's
`jr-<id>` thread** — an approval, a decision, a trade-off — never on the
customer's or supplier's thread (`1-agent.md` rule 5). Those threads own their
channel and their contact history, and they **route their inputs back to the jr
thread**: what the supplier answered, what the customer said, a changed date, a
cut scope. So one thread knows the order's whole state, and Chris has one place
to look.

What goes out is **drafted on the jr thread** (customer-safe fields only,
`job-requests` §4.2 — and it is the thread holding the unsafe data, so the
filter belongs at the draft), approved there, then routed verbatim to the
customer's or supplier's thread, which sends it **exactly as approved**. A
sending thread that spots a problem returns it for re-approval rather than
editing an approved draft. Contact with no job order behind it is owned,
decided and approved on the thread it belongs to, and an LPS Partner's portal
availability request needs no approval at all.

### Boundary with daisy

**The line is the subject, not the party.** Daisy owns supplier **lifecycle
management** — discovery, onboarding, account setup, paperwork, how
availability reaches us, record corrections, availability ingestion — and the
communication about it, from `chris.r@localplantsupply.com`. Rosie owns every
communication about an **order or job request**, supplier and customer alike,
from `chris@localplantsupply.com`. A lifecycle matter is daisy's even while
rosie is mid-order with that supplier; an order matter is rosie's even on
first contact.

Neither can read the other's mailbox, so each hands over what isn't hers:
rosie's `router` passes lifecycle mail to daisy (`message-routing` §2c), and
daisy's `router` passes order mail to rosie (`supplier-email-routing` §4),
both as an agent message carrying `MessageId` / `GmailThreadId` / sender /
subject, with `gws gmail +forward` when the other actually needs the message
body. One email carrying both — an availability drop plus a question about an
open order — is split: each ingests or answers its own half.

Note: passive suppresses inbound-mail notifications only. On every harness
start the plugin still posts one `gws_settings` message to her `main` channel
with the effective settings — that is how she re-asserts her preferences, and
it can't be turned off.

Until she is signed in, customer email ends with Chris sending the approved text
himself (`customer-coordination`), and non-Partner supplier outreach goes
through Chris or daisy's mailbox (`supplier-coordination` §4).

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
| `customer-coordination` | Runs on a customer's `rosie_thread_id` thread (minted on first contact) — the draft → Chris-approves → Chris-sends flow, the contact record on that thread's own web chat (migration 0073 dropped the `communication_notes` column), durable preferences in `customers.notes`, relaying answers to the owning jr thread |
| `message-routing` | Runs on the `router` thread — identify the owning `jr-<id>` / supplier / customer thread for unmapped messages, mint missing `rosie_thread_id` values, forward pointers, escalate to `main` only what needs a human |
| `plant-and-supplier-search` | Adapted from daisy's — same RPC guidance, plus the read-only framing (findings go to item `sourcing_notes`; data problems get reported to daisy, not fixed; a hit is a listing, never an availability) and the sourcing look-up scoped to Austin Plant Supply |
| `quote-generation` | Job request → customer-facing HTML/PDF quote: templates, customer-safe-fields-only rule, agent-browser print, upload + sign-url under `rosie_shared/`, artifacts publishing, and the approval gate. A filled `unit_price` is not permission to quote |
| `text-quote-format` | The plain-text quote shape for chat/Telegram delivery |
| `create-skill` | Installed by `cognisphere agent new` (template) |
