# Plugin: supplier-events

**The app wakes Rosie when a supplier saves order changes or submits availability answers.**
User-space plugin at `harness/plugins/supplier-events/`; enabled on
[`rosie`](agent-rosie.md) only — she owns order-side supplier coordination,
partner portals and public request links included.

An event is a pointer, not the state: everything it is about lives in the
database, so the notification carries identifiers only. The agent prompt
(`seed/system_prompts/plugin-supplier-events.md`, reseeded into Rosie's
`system_prompts/` on start — edit the seed, not the copy) is a table of what
to do per event type; the procedures are Rosie's `supplier-coordination`
(responses, orders) and `job-requests` (supplier responses) skills.

- `availability_updated` (saved, not submitted — including edits after an
  earlier submission and portal answers Rosie typed in for the supplier) is
  accepted and answered `200 { ok: true, delivered: false }`, but **never
  delivered**: a save does not wake Rosie.
- `availability_submitted` (submit or re-submit) is relayed to the AR's one
  job (`availability_requests.job_request_id`). Draft ARs (migration 0120)
  are invisible to suppliers and never produce events. Job lines already
  read their selected candidates' answers (the `job_lines` view, migration
  0130), and the submission moved open lines whose selected asked row offers
  a substitute onto it; the job threads alert Chris and report answers on
  unselected candidates. Rosie never sets the chosen candidate
  (`selected_candidate_id`) from an event.

## Endpoint — `POST /webhook/rosie/supplier-events/notify`

Called by the app (`app/lib/notify-supplier-events.ts`), best-effort — the
database write has already committed, so a down harness costs freshness, not
data. `availability_updated` means answers were saved without submitting;
`availability_submitted` means the supplier explicitly submitted answers. A
saved answer is neither submission nor confirmation. Delayed events must not
reopen or edit a closed request, or misrepresent newer unsubmitted edits as
submitted answers: re-read current state and explicit submission evidence.
Both portal and public-link answer routes use these same events. The app still
sends `availability_updated`; the plugin drops it before delivery, so only
`availability_submitted` reaches the supplier thread.

Body: `{ type, supplierId, supplierName, availabilityRequestId, jobRequestId,
threadId }`. Supplier id/name and availability-request id are required; the
job id and thread id may be null. `jobRequestId` is a legacy compatibility
hint; the agent resolves the AR's job (`availability_requests.job_request_id`)
or an order's job (`orders.job_request_id`) from the database. Invalid identifiers or an unknown `type`
return 400.

## Order changes

Successful supplier-portal header edits emit `order_updated` with `orderId`
and `orderChanges` (`field`, `previous`, `value`, at most two). This covers
confirmation (New → Processing), Order Ready, Completed (0154) and the supplier's own note
(`noteFromSupplier`, 0146), including clearing it. Since 0149 orders have no
date of their own and the supplier never writes LPS's additional details, so
the plugin refuses `fulfillmentDate` and `noteForSupplier`. Unchanged saves and failed writes emit no event.
The existing `order_status_saved` event covers the portal's batch line-status
save; `order_status_updated` supports a single line. All use the supplier's
existing order-coordination chat, not a new conversation for each order.
Rosie receives `OrderId` and `OrderChanges` (or `OrderStatusChanges`, or
`OrderItemId`/`OrderItemStatus`) and re-reads current records before follow-up.
Delivery uses the existing best-effort webhook; no durable retry queue is added.

## Threads — the job's

Delivery uses `threadIdOverride`: since 2026-10-19 the event lands on the
**job's thread**, `jr-<job_request_id>` of the AR or order — the app builds it
at submit/update time (`supplierAvailabilityEventContext`,
`supplierOrderEventContext`, the public-link route) and passes it as
`threadId`. One job thread owns all of that job's supplier work, so there is
no relay from a supplier thread any more. An event without a job wakes rosie's
`main` thread instead, which hands it to the owning job; that fallback is
routing only, not permission to alert Chris about a saved edit.

## Auth

The caller is the **app**, not an in-harness process, so the boot-time
`COGNISPHERE_WEBHOOK_SECRET` is not usable here. A dedicated shared secret is
presented as `X-App-Secret` and checked against the plugin's required secret
`rosie.supplier-events.SUPPLIER_EVENTS_APP_SECRET`; a mismatch is 401.

The wiring is `scripts/app/secrets.sh` (the deployment hook `server.sh
secrets` sources), the same split the artifacts secret uses: one value,
generated once, written to **both** `harness/.secrets/secrets.json` (rosie's
bucket) and `app/.env.local` (`SUPPLIER_EVENTS_APP_SECRET`) on every secrets
run, never rotated implicitly. Without the env var the app's notify helper
silently does nothing — the tables still carry everything.

## Metadata

All PascalCase, documented for the agent in the seeded prompt fragment:
`EventType`, `SupplierId`, `SupplierName`, `AvailabilityRequestId`,
`JobRequestId`.

Job lines change on a submission only through the database (lines read their
selected candidate; the submission's switch to an offered substitute); Rosie
never hand-copies answers or selects a candidate from an event.
An availability submission is not supplier order confirmation: accepted
orders become Committed through `create_order`, and explicit supplier
confirmation makes the Order Processing while linked Job Requests remain
Committed. Jobs have no Confirmed stage. A delayed event must not close
or reopen shared work based on the scalar job hint alone.

The durable instruction source is
`harness/plugins/supplier-events/seed/system_prompts/plugin-supplier-events.md`.
Do not manually edit the generated agent prompt: an operator harness restart
reseeds it from this source and applies the instruction correction. These code changes require an app deployment and harness/plugin restart; no
database migration is required. Regression coverage in
`app/lib/rosie-thread-events.test.ts` checks the seed's submission-only relay
contract, that saves are not delivered, and that submit/re-submit land on the
job thread.
