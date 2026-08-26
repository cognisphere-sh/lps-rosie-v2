import 'server-only'

// Wake rosie when a supplier submits an availability request in their portal.
// Posts to her `supplier-events` plugin webhook; the shared secret is wired by
// scripts/app/secrets.sh into both app/.env.local and the plugin's secrets
// bucket, the same pattern the artifacts secret uses.
//
// Rosie owns order-side supplier coordination — the portal included — which
// is why there is exactly one target agent here. The event lands on the
// supplier's `rosie_thread_id` thread (her router thread when that column is
// still NULL).
//
// Best-effort by design: the database write the notification is about has
// already committed, and a harness that is down must not turn a supplier's
// submission into an error. A miss costs freshness, not data — the tables
// carry everything.

const HARNESS_URL = process.env.HARNESS_URL ?? 'http://127.0.0.1:3142'
const SECRET = process.env.SUPPLIER_EVENTS_APP_SECRET

export interface SupplierEvent {
  type: 'availability_submitted'
  supplierId: number
  supplierName: string
  availabilityRequestId: number
  jobRequestId: number | null
  /** The supplier's `suppliers.rosie_thread_id`; null → rosie's router thread. */
  threadId: string | null
}

export async function notifySupplierEvent(event: SupplierEvent): Promise<void> {
  if (!SECRET) return // not wired on this box — the tables still carry everything
  try {
    const res = await fetch(`${HARNESS_URL}/webhook/rosie/supplier-events/notify`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-app-secret': SECRET },
      body: JSON.stringify(event),
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) console.error(`notifySupplierEvent: harness answered ${res.status}`)
  } catch (e) {
    console.error(`notifySupplierEvent: ${(e as Error).message}`)
  }
}
