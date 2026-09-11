# Plugin: supplier-events

**The app wakes rosie when a supplier saves or submits availability answers.**
User-space plugin at `harness/plugins/supplier-events/`; enabled on
[`rosie`](agent-rosie.md) only — she owns order-side supplier coordination,
partner portals and public request links included.

An event is a pointer, not the state: everything it is about lives in the
database (`availability_requests`, `availability_request_items`), so the
notification carries identifiers only. What rosie does with one is her
`supplier-coordination` skill. The supplier thread relays job-specific answers
to the job thread to keep each plant's per-supplier sourcing rows current.

## Endpoint — `POST /webhook/rosie/supplier-events/notify`

Called by the app (`app/lib/notify-supplier-events.ts`), best-effort — the
database write has already committed, so a down harness costs freshness, not
data. `availability_updated` means answers were saved without submitting;
`availability_submitted` means the supplier explicitly submitted answers. A
saved answer is not confirmation, and delayed events must not reopen a closed
request. Both portal and public-link answer routes use these same events.

Body: `{ type, supplierId, supplierName, availabilityRequestId, jobRequestId,
threadId }`. Supplier id/name and availability-request id are required; the
job id and thread id may be null. Invalid identifiers or an unknown `type`
return 400.

## Threads — one per supplier

Delivery uses `threadIdOverride`: the event lands on the supplier's
**`suppliers.rosie_thread_id`** thread (`supplier-<slug>`, migration 0068) —
the app reads the column at update/submit time and passes it as `threadId`. A
supplier whose column is still NULL wakes rosie's `main` thread instead,
whose `message-routing` skill mints and records the id.

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
