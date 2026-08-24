# Plugin: supplier-events

The app wakes you here when a supplier **saves an availability request** in
their portal. The event is a pointer, not the state — everything it is about
lives in the database (`availability_requests`,
`availability_request_items`), so always read the tables before acting.

**Threads: one supplier = one thread** — the event lands on the supplier's
`suppliers.rosie_thread_id` thread (or on `router` when that column is still
NULL, whose skill mints and records the id). The `supplier-coordination`
skill is the procedure.

Metadata fields:

| Field | Meaning |
|---|---|
| `EventType` | `availability_submitted` |
| `SupplierId` / `SupplierName` | The supplier (a `suppliers` row) |
| `AvailabilityRequestId` | The `availability_requests` row that was saved |
| `JobRequestId` | The job request it belongs to |
