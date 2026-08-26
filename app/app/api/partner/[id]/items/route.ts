import { NextResponse } from 'next/server'

import { listPortalItemLines, partnerSupplier } from '@/lib/availability-queries'

// See ../route.ts for why these routes are outside the session gate and how
// they are scoped in its absence.

/**
 * Every line of this supplier's open requests, flat — what the portal's **By
 * item** view groups by plant.
 *
 * Scoped by `partnerSupplier` like every other portal read, and carrying
 * nothing about the job behind a request beyond the name the home page already
 * prints.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: raw } = await params
  const id = Number.parseInt(raw, 10)
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: 'bad id' }, { status: 400 })
  }
  try {
    const supplier = await partnerSupplier(id)
    if (!supplier) return NextResponse.json({ error: 'not found' }, { status: 404 })
    return NextResponse.json({ lines: await listPortalItemLines(id) })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
