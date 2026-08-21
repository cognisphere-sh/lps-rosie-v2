import 'server-only'

// Wake daisy on supplier activity: a portal availability submission, a portal
// thread message, or an instruction typed into a supplier's chat view. Posts
// to her `supplier-events` plugin webhook; the shared secret is wired by
// scripts/app/secrets.sh into both app/.env.local and the plugin's secrets
// bucket, the same pattern the artifacts secret uses.
//
// Daisy owns every supplier conversation — the portal included — which is why
// there is exactly one target agent here. Rosie is reached by daisy (or by a
// person), never by this webhook.
//
// Best-effort by design: the database write the notification is about has
// already committed, and a harness that is down must not turn a supplier's
// submission into an error. A miss costs freshness, not data — the tables
// carry everything.

const HARNESS_URL = process.env.HARNESS_URL ?? 'http://127.0.0.1:3142'
const SECRET = process.env.SUPPLIER_EVENTS_APP_SECRET

export interface SupplierEvent {
  type: 'availability_submitted' | 'supplier_message' | 'instruction'
  supplierId: number
  supplierName: string
  availabilityRequestId: number | null
  jobRequestId: number | null
  /** The message body — `supplier_message` and `instruction` events. */
  message?: string
  /** Who wrote it — `instruction` events (the signed-in user). */
  from?: string
}

export async function notifySupplierEvent(event: SupplierEvent): Promise<void> {
  if (!SECRET) return // not wired on this box — the tables still carry everything
  try {
    const res = await fetch(`${HARNESS_URL}/webhook/daisy/supplier-events/notify`, {
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
