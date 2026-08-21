import { NextResponse } from 'next/server'

import { availabilityRequest, portalSupplier, updateARItem } from '@/lib/availability-queries'

// See ../../route.ts for why these routes are outside the session gate and how
// they are scoped in its absence.

async function scope(rawSupplier: string, rawAr: string) {
  const supplierId = Number.parseInt(rawSupplier, 10)
  const arId = Number.parseInt(rawAr, 10)
  if (!Number.isInteger(supplierId) || !Number.isInteger(arId)) return null
  const supplier = await portalSupplier(supplierId)
  if (!supplier) return null
  return { supplierId, arId, supplier }
}

/** One availability request, as the supplier may see it. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ supplierId: string; arId: string }> },
) {
  const { supplierId, arId } = await params
  try {
    const s = await scope(supplierId, arId)
    if (!s) return NextResponse.json({ error: 'not found' }, { status: 404 })
    const request = await availabilityRequest(s.arId, { forSupplierId: s.supplierId })
    if (!request) return NextResponse.json({ error: 'not found' }, { status: 404 })
    return NextResponse.json({ request, supplier: s.supplier })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

/**
 * One line's answer. Body: { itemId, changes: { status?, available_quantity?,
 * unit_price?, notes? } } — the ask columns are not writable from here.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ supplierId: string; arId: string }> },
) {
  const { supplierId, arId } = await params
  try {
    const s = await scope(supplierId, arId)
    if (!s) return NextResponse.json({ error: 'not found' }, { status: 404 })
    const body = (await req.json()) as { itemId?: number; changes?: Record<string, string> }
    if (!Number.isInteger(body.itemId) || !body.changes) {
      return NextResponse.json({ error: 'itemId and changes are required' }, { status: 400 })
    }
    await updateARItem(s.arId, body.itemId!, body.changes, { forSupplierId: s.supplierId })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}
