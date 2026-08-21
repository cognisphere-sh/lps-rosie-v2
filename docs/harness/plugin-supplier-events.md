# Plugin: supplier-events

**The app wakes daisy on supplier activity.** User-space plugin at
`harness/plugins/supplier-events/`; enabled on [`daisy`](agent-daisy.md) only —
she owns every supplier conversation, the portal included (rosie is reached by
daisy, never by this webhook). Built 2026-08-19 alongside migrations 0062/0063
(availability requests, the supplier portal and the chat transcript —
`docs/app/README.md`, *Supplier portal*).

An event is a pointer, not the state: everything it is about lives in the
database (`availability_requests`, `availability_request_items`,
`supplier_messages`), so the notification carries identifiers and — for
messages and instructions — the text itself. What daisy does with one is her
`availability-requests` skill (portal events) and `supplier-communications`
(the transcript throughout).

## Endpoint — `POST /webhook/daisy/supplier-events/notify`

Called by the app (`app/lib/notify-supplier-events.ts`), best-effort — the
database write has already committed, so a down harness costs freshness, not
data:

| `type` | When |
|---|---|
| `availability_submitted` | The supplier pressed **Save** on an availability request in their portal (each save re-notifies) |
| `supplier_message` | The supplier wrote in their portal chat (one thread per supplier) |
| `instruction` | Someone typed a **Daisy**-mode message in a supplier's admin chat view (`from` says who); already recorded in `supplier_messages` as `channel = 'internal'` |

Body: `{ type, supplierId, supplierName, availabilityRequestId, jobRequestId,
message?, from? }`. Anything missing, or an unknown `type`, is a 400 naming
what is wrong.

## Threads — one per supplier

Delivery uses `threadIdOverride`: **every** event about a supplier lands on
their one thread, `supplier-<supplierId>` — availability requests included.
(Per-request task threads existed for a few hours on 2026-08-19 before Bhoumik
settled on a single conversation per supplier.) Rosie's asks to daisy use the
same thread id (her `job-requests` skill §5.2), which is what makes each
supplier's work one conversation whoever started it.

## Auth

The caller is the **app**, not an in-harness process, so the boot-time
`COGNISPHERE_WEBHOOK_SECRET` is not usable here. A dedicated shared secret is
presented as `X-App-Secret` and checked against the plugin's required secret
`daisy.supplier-events.SUPPLIER_EVENTS_APP_SECRET`; a mismatch is 401.

The wiring is `scripts/app/secrets.sh` (the deployment hook `server.sh
secrets` sources), the same split the artifacts secret uses: one value,
generated once, written to **both** `harness/.secrets/secrets.json` (every
enabled agent's bucket) and `app/.env.local` (`SUPPLIER_EVENTS_APP_SECRET`) on
every secrets run, never rotated implicitly. Without the env var the app's
notify helper silently does nothing — the tables still carry everything.

## Metadata

All PascalCase, documented for the agent in the seeded prompt fragment:
`EventType`, `SupplierId`, `SupplierName`, `AvailabilityRequestId` and
`JobRequestId` (when linked), `From` (instructions).

## Seed / config / secrets

`seed/system_prompts/plugin-supplier-events.md` — the event shapes, the thread
naming, the metadata fields, and pointers to the two skills. No CLI: daisy
reads and writes the tables through her own `scripts/agent/supabase/query`,
and answers a supplier by inserting a `supplier_messages` row. No config; one
required secret (above) — a missing secret fails the plugin, not the agent.
