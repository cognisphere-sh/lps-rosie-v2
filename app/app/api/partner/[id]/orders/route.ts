import { NextResponse } from 'next/server'

import { partnerSupplier } from '@/lib/availability-queries'
import { listOrders } from '@/lib/order-queries'
import { requirePartnerAccess } from '@/lib/partner-auth'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const gate = await requirePartnerAccess(req, (await params).id)
    if (!gate.ok) return gate.res
    const supplier = await partnerSupplier(gate.supplierId)
    if (!supplier) return NextResponse.json({ error: 'not found' }, { status: 404 })
    const orders = await listOrders({ supplierId: gate.supplierId, forSupplier: true })
    return NextResponse.json({ orders, supplier, canEdit: true })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
