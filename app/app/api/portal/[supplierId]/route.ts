import { NextResponse } from 'next/server'

import { listPortalRequests, portalSupplier } from '@/lib/availability-queries'

// The supplier portal's API. These routes are OUTSIDE the harness-session gate
// (`proxy.ts` exempts /portal and /api/portal): suppliers are not app users,
// and portal auth is a deliberately deferred step (Bhoumik, 2026-08-19). Until
// it lands, the supplier id in the URL is the only scoping — every read here
// must go through `portalSupplier` (which refuses anyone who is not an LPS
// Partner) and disclose only what `share_customer_details` allows.

/**
 * The portal home: who this is, and their availability requests — each with
 * its lines embedded, so the cards expand, search and filter without a fetch
 * per card (customer details ride along only where the request shares them).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ supplierId: string }> },
) {
  const { supplierId: raw } = await params
  const id = Number.parseInt(raw, 10)
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: 'bad id' }, { status: 400 })
  }
  try {
    const supplier = await portalSupplier(id)
    if (!supplier) return NextResponse.json({ error: 'not found' }, { status: 404 })
    const requests = await listPortalRequests(id)
    return NextResponse.json({ supplier, requests })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
