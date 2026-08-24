import { NextResponse } from 'next/server'

import { portalSupplier, submitAvailabilityRequest } from '@/lib/availability-queries'
import { notifySupplierEvent } from '@/lib/notify-supplier-events'

/** The supplier pressed Save: stamp the request and wake rosie. */
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
    const submitted = await submitAvailabilityRequest(arId, supplierId)
    await notifySupplierEvent({
      type: 'availability_submitted',
      supplierId: submitted.supplierId,
      supplierName: submitted.supplierName,
      availabilityRequestId: arId,
      jobRequestId: submitted.jobRequestId,
      threadId: submitted.rosieThreadId,
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}
