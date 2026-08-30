import { NextResponse } from 'next/server'

import {
  availabilityRequest,
  partnerSupplier,
  setARItemMapping,
  updateARItem,
} from '@/lib/availability-queries'
import { requirePartnerAccess } from '@/lib/partner-auth'

// See ../../route.ts for how these routes are gated and scoped.

async function scope(req: Request, rawSupplier: string, rawAr: string) {
  const gate = await requirePartnerAccess(req, rawSupplier)
  if (!gate.ok) return { gate }
  const arId = Number.parseInt(rawAr, 10)
  if (!Number.isInteger(arId)) return { gate, s: null }
  const supplier = await partnerSupplier(gate.supplierId)
  if (!supplier) return { gate, s: null }
  return { gate, s: { supplierId: gate.supplierId, arId, supplier } }
}

/** One availability request, as the supplier may see it. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; arId: string }> },
) {
  const { id: supplierId, arId } = await params
  try {
    const { gate, s } = await scope(req, supplierId, arId)
    if (!gate.ok) return gate.res
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
    const { gate, s } = await scope(req, supplierId, arId)
    if (!gate.ok) return gate.res
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
