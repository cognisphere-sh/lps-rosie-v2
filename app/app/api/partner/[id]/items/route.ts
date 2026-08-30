import { NextResponse } from 'next/server'

import { listPortalItemLines, partnerSupplier } from '@/lib/availability-queries'
import { requirePartnerAccess } from '@/lib/partner-auth'

// See ../route.ts for how these routes are gated and scoped.

/**
 * Every line of this supplier's open requests, flat — what the portal's **By
 * item** view groups by plant.
 *
 * Scoped by `partnerSupplier` like every other portal read, and carrying
 * nothing about the job behind a request beyond the name the home page already
 * prints.
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
    return NextResponse.json({ lines: await listPortalItemLines(id) })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
