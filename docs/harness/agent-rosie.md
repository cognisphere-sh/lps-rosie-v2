# Agent: rosie

Rosie owns LPS job requests, customer communication and order-side supplier
coordination. Her mailbox is `chris@localplantsupply.com`, sending as
Christopher Runyon. Daisy owns supplier onboarding, supplier records and
inventory ingestion, including communication about those activities, from
`chris.r@localplantsupply.com`. Product feedback goes to Lily while Rosie
continues the operational task.

## Workflow

Rosie creates/reuses a job, its `jr-<id>` thread and supplied item rows before
quote output or clarification, preserving unknown values as NULL. A job starts
at **Quote**; **Active** is retired. Supplied expected install dates belong in
`job_requests.expected_install_date`, and pickup/delivery in
`job_requests.fulfillment_method`. A pricing-only question creates no job.

**LPS currently works exclusively with APS (`suppliers.id = 1`).** Rosie
produces the APS price-list quote before any availability request. An explicit
quick-quote-only request stops after the quote and creates/sends no AR. For an
ordinary request, she then asks Chris whether to send the availability request
to APS and waits for his approval, retaining an explicit approval already given
for the exact action. Creating a private APS portal request publishes it, so
that creation is also approval-gated. Customer-details sharing preferences
still apply. Other suppliers, including consolidated grower sourcing, require
Chris's explicit exception.

Rosie completes independent record creation, price research and supported
updates before asking about unresolved details, and resolves material quote or
AR scope questions before the affected output. Quotes do not imply stock or a
reservation. APS-scoped job rows, including quick quotes, carry concise APS
price/gap notes and supported alternatives under `job-requests`; alternative
quote and AR approvals remain separate. General supplier research is answered
in Chris's original chat and does not itself authorize outreach or notes.

Supplier replies and portal submissions are evidence for Chris. Rosie reports
them and maintains qualifying sourcing notes, then applies response-driven
job-line status or availability changes only after Chris approves the specific
scope. Portal answers remain as entered. She does not infer supplier selection
from the first available or cheapest response. JR sourcing notes contain one
compact current row outcome (selected supplier/price or the actual pending
Chris decision), followed by one latest snapshot per supplier: size/name/variant,
price, current AR state and relevant availability/alternative. Updates replace
superseded facts rather than append event history; current constraints and
approval scope remain. Quick-quote rows can state their quote price and that
availability was not requested. `job-requests` section 3 owns the exact format
and examples; history remains in the changelog and supplier transcript.

| Job label | Stored key | Meaning |
|---|---|---|
| Quote | `quoted` | Initial request and APS quote; quick-quote-only work stops here. |
| Availability | `availability` | Chris-approved availability request delivered. |
| Committed | `committed` | Customer acceptance recorded and supplier orders created. |
| Won / Lost | `closed_won` / `closed_lost` | Explicit closure with the actual outcome. |

`record_job_workflow_event(job_id, event)` records `pricing_fetched`,
`quote_shared`, `availability_sent`, and `customer_confirmed` (Committed).
The compatibility `supplier_confirmed` job event never changes a job stage;
`confirm_order` changes only the supplier Order to Confirmed and records its
dates. Linked Job Requests remain Committed until Won/Lost closure. Pricing/
quote work never regresses later stages or reopens terminal jobs. A draft is
not customer delivery and an AR submission is not order confirmation.
`archived` is a legacy terminal state. Migration 0092 moves historical
customer-confirmed jobs to Committed without fabricating supplier orders, and
moves Active/`sourcing` jobs to Quote. Migration 0093 retires the job
`confirmed` status by mapping it to `committed`; Orders retain Confirmed and
their confirmation dates.

Availability requests and supplier orders have independent tables and
many-to-many allocations:

- `availability_request_jobs` links AR headers to jobs;
  `availability_request_item_jobs` links AR rows to job items with quantities.
  `create_availability_request(...)` atomically creates the request, item
  snapshots and allocations. Known positive allocations sum to the requested
  quantity; if any allocation is unknown, its quantity and the combined total
  remain NULL. Supplier orders require explicit positive allocations.
- `orders` and `order_items` store customer-accepted supplier commitments.
  `order_item_job_request_items` maps order rows and quantities to job items;
  order rows retain their source `availability_request_item_id`.
  `create_order(...)` requires actual customer acceptance and creates
  Committed orders, mapping AR `can_order` to order `need_to_order`
  (**Need to Order**). Orders appear in each linked job's Orders tab and the
  supplier portal's Orders tab.
- Supplier orders retain **Committed → Confirmed → Won/Lost**.
  `confirm_order(...)` makes the Order Confirmed and records `confirmation_date`
  and the agreed `fulfillment_date` (pickup/delivery date), while its linked
  Job Requests remain Committed. A shared order's
  `fulfillment_method` is `pickup` or `delivery`. These dates are separate
  from each job's expected install date. `close_order(...)` records Won/Lost.
  Automatic job closure requires all active demand to be known and fully
  allocated to terminal orders; partial or unknown demand stays open for
  Chris's explicit closure decision. Closed order outcomes cannot be
  reclassified through that RPC.

A job can have multiple ARs and orders, while an AR, AR row or order can serve
several jobs. This supports large-plant grower consolidation without losing
original demand. Legacy scalar job/item ids are compatibility hints only.
Supplier threads resolve junction tables and relay updates to every affected
job thread, retaining each quantity allocation and each original approval
conversation. A combined supplier quantity is never copied to each job as its
own available amount. One customer's acceptance cannot commit another job.

| AR label | Stored key | Meaning |
|---|---|---|
| New | `new` | No supplier work yet. |
| Processing | `processing` | Supplier saved work awaiting submission. |
| Completed | `submitted` | Explicitly submitted. |
| Closed | `closed` | Supplier edits refused. |

Editing Completed returns to Processing. Shared ARs close only after all linked
jobs are terminal/inactive; reopening a job restores the remembered AR stage
and uses a fresh public link. Public/private answer routes and
`answer_availability_request(...)` use the same database locks and lifecycle
checks. Rosie uses the answer RPC only on Chris's explicit instruction for AR
changes. Supplier order confirmation is a separate operation.

Partner requests use their private portal; explicitly authorized non-partner
requests use a public AR URL and the approved HTML email containing it.
Creating a link does not mean email delivery or authorize an extra send.

## Threads and approvals

| Thread | Owns |
|---|---|
| `main` | Coordination with Chris/Bhoumik and dispatch of general/unmapped work. |
| `jr-<id>` | A job's records, sourcing, status and quote; coordinates with contact threads. |
| `customers.rosie_thread_id` | All communication with that customer, across every job; relays job updates to their job threads. |
| `suppliers.rosie_thread_id` | All order-side communication with that supplier company; creates approved ARs, coordinates shared orders and relays results to all linked jobs. |

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
| `job-requests` | Quote-first intake, concurrency, approval gates, compact latest supplier snapshots and row outcomes, many-to-many allocations, supplier orders, fulfillment dates and lifecycle. Its database-access artifact documents SQL/storage tools. |
| `plant-and-supplier-search` | Search RPCs, exact identity/size checks, pricing evidence and instructed wider searches. |
| `supplier-coordination` | Approved private/public AR creation, consolidated allocations, supplier responses, order confirmation and follow-ups. |
| `customer-coordination` | Customer drafts/delivery, contact history and job-update/confirmation relays. |
| `message-routing` | Thread dispatch, origin metadata, approval handoffs and email routing. |
| `quote-generation` | Quick quotes, the default text format and approved HTML/PDF output. Replaces the former `text-quote-format` skill. |
| `create-skill` | Harness-supplied skill maintenance procedure. |

The `quote-generation` skill owns the default copyable text quote format,
including quantity, size, plant, unit price, line total and subtotal. Actual
prices come from APS's price list. Its approved HTML template lives in
`harness/agents/rosie/skills/agent/quote-generation/artifacts/` alongside the
procedure; historical templates remain in knowledge as references only.
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
