# Agent: rosie

Rosie owns LPS job requests, customer communication and order-side supplier
coordination. Her mailbox is `chris@localplantsupply.com`, sending as
Christopher Runyon. Daisy owns supplier onboarding, supplier records and
inventory ingestion, including communication about those activities, from
`chris.r@localplantsupply.com`. Product feedback goes to Lily while Rosie
continues the operational task.

## Workflow

- Before asking questions, Rosie completes all authorized work that does not
  depend on an answer: create/reuse the job/thread, create item rows from the
  supplied details, research pricing and save supported updates. Missing
  size/quantity/price stays NULL; unresolved alternatives retain the original
  wording without choosing or duplicating demand. She posts completed work,
  pricing and other findings to the requester.
  She may ask any clarifying question about the order. Remaining uncertainty
  affecting a quote or availability request is resolved before generating
  that output, including quick quotes and automatically published APS ARs.
  She continues independent work while waiting and uses details already
  supplied; a clear request needs no extra questions.
- A new order creates a job and its `jr-<id>` thread in **Active**. Intake may
  reserve an id before the job exists. The job thread creates the row and
  item snapshots; unknown customer/job names stay NULL rather than invented.
- An explicit **quick quote also creates a job/thread**, or uses the existing
  job, but creates/sends **no availability request**. It uses APS or the
  explicitly named supplier's inventory pricing. A simple pricing lookup or
  general question creates neither a job nor an AR.
- APS (`suppliers.id = 1`) is the current default for ordinary jobs. Its
  private portal availability request publishes automatically, with no
  additional send approval. Preserve customer-details sharing preferences.
  Missing APS inventory prompts an offer to search other suppliers; that
  wider search waits for instruction. Future supplier-selection criteria
  are not implemented.
- Partner requests use their portal; non-partner requests use a public AR
  URL plus an HTML email containing that link. The email still follows the
  specific-draft approval rule unless the action is already authorized.
- Inventory prices do not confirm availability. Supplier responses update
  the request through the supplier thread. Each job item has short sourcing
  rows, one per supplier: supplier, price and latest AR/response evidence.
  Changed answers replace that supplier's row rather than adding a log.

| Job label | Stored key | Meaning |
|---|---|---|
| Active | `sourcing` | Intake only; no processing performed. |
| Quote | `quoted` | Pricing fetched or quote shared. |
| Availability | `availability` | Availability request delivered through a partner portal or sent email. |
| Confirmed | `confirmed` | Customer explicitly confirmed the order. |
| Won / Lost | `closed_won` / `closed_lost` | Request explicitly closed with that outcome. |

`record_job_workflow_event(job_id, event)` records `pricing_fetched`,
`availability_sent`, `quote_shared` and `customer_confirmed`. Price writes
and partner request creation also have database hooks. An unsuccessful
inventory search is still completed pricing work; a draft or failed send
is not a shared quote. Pricing/quote work advances Active to Quote; delivered
availability advances Active/Quote to Availability. Customer confirmation
advances any of those three stages to Confirmed. Quick quotes can skip
Availability. Repeated pricing/quote events never regress Availability, and
no workflow event regresses Confirmed or reopens Won/Lost jobs. Migration
0089 restores the separate Availability stage and retains all existing stored
statuses and history.
`archived` remains a legacy stored terminal state, not a selectable stage.

| AR label | Stored key | Meaning |
|---|---|---|
| New | `new` | No supplier work yet. |
| Processing | `processing` | Supplier saved work awaiting submission. |
| Completed | `submitted` | Explicitly submitted. |
| Closed | `closed` | Job/request closed; supplier edits refused. |

Editing a Completed request returns it to Processing until resubmission.
Job closure closes its ARs and revokes public links; job reopening restores
each request's previous stage. Revoked tokens are not reused. Normal active
job-stage changes leave ARs open. Public/private supplier edits and
`answer_availability_request(...)` use the same database lock and closed-job
checks; the agent uses that RPC for answers conveyed through chat/email.

## Threads and approvals

| Thread | Owns |
|---|---|
| `main` | Coordination with Chris/Bhoumik and dispatch of general/unmapped work. |
| `jr-<id>` | A job's records, sourcing, status and quote; coordinates with contact threads. |
| `customers.rosie_thread_id` | All communication with that customer, across every job; relays job updates to their job threads. |
| `suppliers.rosie_thread_id` | All order-side communication with that supplier company, across every job; creates ARs and relays answers. |

Route external messages by correspondent first: a job id in a supplier or
customer message does not bypass their contact thread. Missing entity thread
ids are minted once with guarded writes; supplier branches share the head
branch's thread. Legacy `router` messages only forward to the canonical
owner/main. The runtime email catch-all targets main; its existing
`router-all` rule name is retained for route-maintenance compatibility.

Every handoff preserves **`OriginThreadId` and `OriginChannel`**. Any required
communication approval returns to the **original request chat, even if Chris
has since switched chats**. The supplier/customer thread sends exactly the
approved content and retains contact history; the job thread retains order
state. Main is the only Telegram sender. Internal approvals and sourcing
notes never use portal-visible messages.

The customer/supplier web transcript records contacts in full, including
external emails and relayed texts. Portal messages already in that transcript
are not duplicated. Durable preferences belong in customer/supplier `notes`;
thread notes carry only open follow-ups.

## Prompts and skills

`system_prompts/1-agent.md` contains identity, role boundaries and operating
policy. `1.1-supabase.md` points to shared schema/tool references. Procedures
live in versioned skills; plugin-owned prompts/skills come from their seeds
and are not hand-edited on the agent.

| Skill | Responsibility |
|---|---|
| `job-requests` | Intake, concurrency, supplier rows, sourcing decisions, job events and answer reconciliation. Its database-access artifact documents SQL/storage tools. |
| `plant-and-supplier-search` | Search RPCs, exact identity/size checks, pricing evidence and instructed wider searches. |
| `supplier-coordination` | Private/public AR creation, HTML email, supplier chat answers, AR events and follow-ups. |
| `customer-coordination` | Customer drafts/delivery, contact history and job-update/confirmation relays. |
| `message-routing` | Thread dispatch, origin metadata, approval handoffs and email routing. |
| `quote-generation` | Quick quotes, the default text format and approved HTML/PDF output. Replaces the former `text-quote-format` skill. |
| `create-skill` | Harness-supplied skill maintenance procedure. |

The default text quote is one line per plant/size:

```text
15 G Wax myrtle — $105.00
15 G Mountain laurel — $175.00
```

These are formatting examples; actual prices come from inventory. No quantity
prefix, line total or subtotal appears unless Chris requests a different
format. The approved APS HTML template lives in
`harness/agents/rosie/skills/agent/quote-generation/artifacts/` alongside its
procedure. Historical templates remain in knowledge as references only.
`knowledge/files/SCHEMA.md` remains a symlink to the shared schema document.

## Configuration and plugins

`agent.json` uses `openai-codex` / `gpt-5.6-terra`, medium thinking,
`plugin_channel` thread strategy, ten concurrent slots, three attempts and
subprocess runtime. Supabase schema keys are `SUPABASE_PROJECT_ID`,
`SUPABASE_SECRET_KEY`, `SUPABASE_DB_PASSWORD` and `SUPABASE_URL`; the first
two are required by the declared schema. Never include their values in docs.

| Plugin | Deployment role |
|---|---|
| `admin`, `scheduler`, `agent-messaging` | Core coordination and harness controls. |
| `webchat` | Internal per-thread panel plus authenticated supplier portal chat. Only `--portal` replies reach suppliers. Transcripts use `threads` / `thread_messages`. See [webchat](plugin-webchat.md). |
| `telegram` | Chris/Bhoumik coordination on main via the configured bot/chat route. |
| `supplier-events` | AR draft/submission notifications to the supplier thread, main as fallback. See [supplier events](plugin-supplier-events.md). |
| `artifacts` | Customer-safe HTML sharing under the configured Rosie app origin. |
| `gws` | Order email; direct correspondent/conversation routes with main catch-all. |

The checked-in gws configuration has `pollIntervalSec: -1` (passive),
`gmailQuery: in:inbox is:unread`, `firstOfThreadOnly: false`,
`allowedSenders: *`, `requireAgentInTo: false`, and empty extra OAuth scopes
(Gmail modify is always requested). Passive polling does not establish
whether sign-in currently exists or whether a send will succeed. The deployment
check on 2026-09-10 found Rosie’s gws plugin missing
`GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE`; her mailbox must be connected through
Settings before email can be sent or received. The app, agent and updated
webchat/supplier-events plugins were running.

To enable inbound email, use Rosie's **Settings → gws → Sign in with Google**
for her mailbox, verify the plugin is running, then set polling to `300`
through plugin settings. Credentials are managed by the OAuth callback;
never copy them into prompts or use a different agent's mailbox as fallback.
Preserve existing specific routes when changing the legacy catch-all to main.

SQL/storage helpers are `scripts/agent/supabase/{query,upload,sign-url}`.
Final customer files use `lps/rosie_shared/YYYY-MM-DD/`; intermediates use
`/tmp`. Migrations remain in the shared sequential record at
`harness/agents/daisy/migrations/`. See the shared
[schema](../supabase-schema.md) for lifecycle functions and trigger details.
