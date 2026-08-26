import { NextResponse } from 'next/server'

import {
  availabilityRequest,
  partnerSupplier,
  setARItemMapping,
  updateARItem,
} from '@/lib/availability-queries'

// See ../../route.ts for why these routes are outside the session gate and how
// they are scoped in its absence.

async function scope(rawSupplier: string, rawAr: string) {
  const supplierId = Number.parseInt(rawSupplier, 10)
  const arId = Number.parseInt(rawAr, 10)
  if (!Number.isInteger(supplierId) || !Number.isInteger(arId)) return null
  const supplier = await partnerSupplier(supplierId)
  if (!supplier) return null
  return { supplierId, arId, supplier }
}

/** One availability request, as the supplier may see it. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; arId: string }> },
) {
  const { id: supplierId, arId } = await params
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
 * One line's answer — body `{ itemId, changes: { status?, available_quantity?,
 * unit_price?, notes? } }`; the ask columns are not writable from here.
 *
 * Or one line's catalogue mapping — body `{ itemId, mappedInventoryId }`,
 * which is what the By-item view's drag writes. It goes through
 * `setARItemMapping` rather than the `changes` whitelist so a mapping can
 * never ride in on an answer write, or the reverse, and the row it names must
 * belong to this supplier's own company.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; arId: string }> },
) {
  const { id: supplierId, arId } = await params
  try {
    const s = await scope(supplierId, arId)
    if (!s) return NextResponse.json({ error: 'not found' }, { status: 404 })
    const body = (await req.json()) as {
      itemId?: number
      changes?: Record<string, string>
      mappedInventoryId?: string | null
    }
    if (!Number.isInteger(body.itemId)) {
      return NextResponse.json({ error: 'itemId is required' }, { status: 400 })
    }
    // The key's *presence* selects the branch: `null` is a real value here,
    // the one that unmaps a line.
    if ('mappedInventoryId' in body) {
      await setARItemMapping(s.arId, body.itemId!, body.mappedInventoryId ?? null, {
        forSupplierId: s.supplierId,
      })
      return NextResponse.json({ ok: true })
    }
    if (!body.changes) {
      return NextResponse.json({ error: 'changes or mappedInventoryId is required' }, { status: 400 })
    }
    await updateARItem(s.arId, body.itemId!, body.changes, { forSupplierId: s.supplierId })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}
