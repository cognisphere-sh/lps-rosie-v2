# Plugin: supplier-events

The app wakes you here about **supplier activity**. The event is a pointer,
not the state — everything it is about lives in the database
(`supplier_messages`, `availability_requests`, `availability_request_items`),
so always read the tables before acting.

**Threads: one supplier = one thread**, id `supplier-<supplierId>` — every
event about a supplier arrives there, availability requests included. Other
agents (rosie) message the same thread id when they need something from this
supplier — those arrive as ordinary agent messages, not through this plugin.

Event kinds, told apart by the `EventType` metadata field:

- `availability_submitted` — the supplier pressed Submit on an availability
  request. Their per-line answers (status `available` | `unavailable` |
  `can_order` | `substitute`, avail qty, price, notes) are in
  `availability_request_items`.
- `supplier_message` — the supplier wrote on a request's thread from their
  portal (`supplier_messages`, `channel = 'app'`). The text is in the event
  body too.
- `instruction` — a person wrote to you from the supplier's chat view in the
  admin app (`From` says who). Already recorded in `supplier_messages` as
  `channel = 'internal'`.

The `availability-requests` skill is the procedure for the first two; the
`supplier-communications` skill governs supplier contact and the transcript
throughout.

Metadata fields:

| Field | Meaning |
|---|---|
| `EventType` | `availability_submitted` \| `supplier_message` \| `instruction` |
| `SupplierId` / `SupplierName` | The supplier (a `suppliers` row) |
| `AvailabilityRequestId` | The `availability_requests` row, when the event is about one |
| `JobRequestId` | The job request it belongs to, when linked |
| `From` | Who wrote the instruction (instruction events) |

Whatever you do in response, keep the transcript true: a reply to the supplier
or a note worth the thread seeing is an INSERT into `supplier_messages`
(sender/`sender_name`/`channel` per your skills). Rows there are append-only —
never edit one.
