import { NextResponse } from 'next/server'

import { listPortalRequests, partnerSupplier } from '@/lib/availability-queries'
import { requirePartnerAccess } from '@/lib/partner-auth'

// The supplier portal's API. Every route here is gated twice: `proxy.ts` keeps
// out anyone with no session at all, and `requirePartnerAccess` decides whether
// THIS session may read THIS supplier — their own company, or anything at all
// if they are the internal admin. Portal sign-in landed 2026-08-30; before it,
// these routes were public and the id in the URL was the only scoping.
//
// The id checks still stand on top of it: `partnerSupplier` refuses anyone who
// is not an LPS Partner, and reads disclose only what `share_customer_details`
// allows.

/**
 * The portal home: who this is, and their availability requests — each with
 * its lines embedded, so the cards expand, search and filter without a fetch
 * per card (customer details ride along only where the request shares them).
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requirePartnerAccess(req, (await params).id)
  if (!gate.ok) return gate.res
  const id = gate.supplierId
  try {
    const supplier = await partnerSupplier(id)
    if (!supplier) return NextResponse.json({ error: 'not found' }, { status: 404 })
    const requests = await listPortalRequests(id)
    return NextResponse.json({ supplier, requests })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
