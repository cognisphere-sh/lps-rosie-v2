# Plugin: supplier-events

**The app wakes Rosie when a supplier saves order changes or saves/submits availability answers.**
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
  earlier submission and portal answers Rosie typed in for the supplier)
  stays on the supplier thread: no job thread, no Chris, no job notes.
- `availability_submitted` (submit or re-submit) is relayed to every linked
  job through `availability_request_jobs` / `availability_request_item_jobs`.
  Under Chris's standing instruction the job threads update their lines
  directly (status, allocation-bounded quantity, offered size with its own
  price, short customer note) and alert Chris. Shared totals are never copied
  to each job, and the chosen supplier
  (`selected_availability_request_item_id`) is never set from an event.

Cost note: every `availability_updated` wakes the supplier thread (about 52
times and $7 in the week to 2026-09-28). Sending it with `isSilent: true` in
`index.ts` would deliver it as context without a turn; not done yet (needs a
harness restart to verify).

## Endpoint — `POST /webhook/rosie/supplier-events/notify`

Called by the app (`app/lib/notify-supplier-events.ts`), best-effort — the
database write has already committed, so a down harness costs freshness, not
data. `availability_updated` means answers were saved without submitting;
`availability_submitted` means the supplier explicitly submitted answers. A
saved answer is neither submission nor confirmation. Delayed events must not
reopen or edit a closed request, or misrepresent newer unsubmitted edits as
submitted answers: re-read current state and explicit submission evidence.
Both portal and public-link answer routes use these same events. The plugin
still delivers both event types to the supplier thread; this relay boundary is
an agent instruction, not suppression of transport events or a database change.

Body: `{ type, supplierId, supplierName, availabilityRequestId, jobRequestId,
threadId }`. Supplier id/name and availability-request id are required; the
job id and thread id may be null. `jobRequestId` is a legacy compatibility
hint; the agent resolves all current linked jobs from the database instead of
assuming a single owner. Invalid identifiers or an unknown `type`
return 400.

## Order changes

Successful supplier-portal header edits emit `order_updated` with `orderId`
and `orderChanges` (`field`, `previous`, `value`). This covers confirmation
(New → Processing), Order Ready, fulfillment-date changes and supplier notes,
including clearing a note. Unchanged saves and failed writes emit no event.
The existing `order_status_saved` event covers the portal's batch line-status
save; `order_status_updated` supports a single line. All use the supplier's
existing order-coordination chat, not a new conversation for each order.
Rosie receives `OrderId` and `OrderChanges` (or `OrderStatusChanges`, or
`OrderItemId`/`OrderItemStatus`) and re-reads current records before follow-up.
Delivery uses the existing best-effort webhook; no durable retry queue is added.

## Threads — one per supplier

Delivery uses `threadIdOverride`: the event lands on the supplier's
**`suppliers.rosie_thread_id`** thread (`supplier-<slug>`, migration 0068) —
the app reads the column at update/submit time and passes it as `threadId`. A
supplier whose column is still NULL wakes rosie's `main` thread instead,
whose `message-routing` skill mints and records the id and hands off the
pointer to that supplier thread. This fallback is routing only, not permission
to alert Chris or a job thread about a saved edit.

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

The prompt requires Chris approval before response-driven job-line changes.
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
contract and distinct save/submit/re-submit delivery on the supplier thread.
