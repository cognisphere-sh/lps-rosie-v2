# Plugin: supplier-events

**The app wakes rosie when a supplier saves an availability request.**
User-space plugin at `harness/plugins/supplier-events/`; enabled on
[`rosie`](agent-rosie.md) only — she owns order-side supplier coordination,
the portal included. First built 2026-08-19 for daisy; removed and recreated
lean 2026-08-23 for rosie's restructure (the `supplier_message` /
`instruction` event kinds died with the portal chat and the
`supplier_messages` table).

An event is a pointer, not the state: everything it is about lives in the
database (`availability_requests`, `availability_request_items`), so the
notification carries identifiers only. What rosie does with one is her
`supplier-coordination` skill §3.

## Endpoint — `POST /webhook/rosie/supplier-events/notify`

Called by the app (`app/lib/notify-supplier-events.ts`), best-effort — the
database write has already committed, so a down harness costs freshness, not
data. One `type`: `availability_submitted` — the supplier pressed **Save** on
an availability request in their portal (each save re-notifies).

Body: `{ type, supplierId, supplierName, availabilityRequestId, jobRequestId,
threadId }`. Anything missing, or an unknown `type`, is a 400 naming what is
wrong.

## Threads — one per supplier

Delivery uses `threadIdOverride`: the event lands on the supplier's
**`suppliers.rosie_thread_id`** thread (`supplier-<slug>`, migration 0068) —
the app reads the column at submit time and passes it as `threadId`. A
supplier whose column is still NULL wakes rosie's `router` thread instead,
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
