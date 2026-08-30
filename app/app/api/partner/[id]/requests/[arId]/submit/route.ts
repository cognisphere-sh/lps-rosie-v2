import { NextResponse } from 'next/server'

import { partnerSupplier, submitAvailabilityRequest } from '@/lib/availability-queries'
import { notifySupplierEvent } from '@/lib/notify-supplier-events'
import { requirePartnerAccess } from '@/lib/partner-auth'

/** The supplier pressed Save: stamp the request and wake rosie. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; arId: string }> },
) {
  const { id: rawSupplier, arId: rawAr } = await params
  const gate = await requirePartnerAccess(req, rawSupplier)
  if (!gate.ok) return gate.res
  const supplierId = gate.supplierId
  const arId = Number.parseInt(rawAr, 10)
  if (!Number.isInteger(arId)) {
    return NextResponse.json({ error: 'bad id' }, { status: 400 })
  }
  try {
    if (!(await partnerSupplier(supplierId))) {
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
