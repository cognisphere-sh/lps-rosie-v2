import { NextResponse } from 'next/server'

import { portalSupplier, submitAvailabilityRequest } from '@/lib/availability-queries'

/** The supplier pressed Save: stamp the request. (The agent notification was
 * retired 2026-08-23 with the supplier-events plugin; it returns with rosie.) */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ supplierId: string; arId: string }> },
) {
  const { supplierId: rawSupplier, arId: rawAr } = await params
  const supplierId = Number.parseInt(rawSupplier, 10)
  const arId = Number.parseInt(rawAr, 10)
  if (!Number.isInteger(supplierId) || !Number.isInteger(arId)) {
    return NextResponse.json({ error: 'bad id' }, { status: 400 })
  }
  try {
    if (!(await portalSupplier(supplierId))) {
      return NextResponse.json({ error: 'not found' }, { status: 404 })
    }
    await submitAvailabilityRequest(arId, supplierId)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}
