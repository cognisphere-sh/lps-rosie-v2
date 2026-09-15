import { NextResponse } from 'next/server'

import { partnerSupplier } from '@/lib/availability-queries'
import { confirmOrder, orderDetail, setOrderFulfillmentDate } from '@/lib/order-queries'
import { orderDate, positiveId } from '@/lib/orders'
import { requirePartnerAccess } from '@/lib/partner-auth'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; orderId: string }> }) {
  try {
    const { id, orderId } = await params
    const gate = await requirePartnerAccess(req, id)
    if (!gate.ok) return gate.res
    const parsed = Number(orderId)
    if (!positiveId(parsed)) return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 })
    if (!await partnerSupplier(gate.supplierId)) return NextResponse.json({ error: 'not found' }, { status: 404 })
    const order = await orderDetail(parsed, gate.supplierId)
    if (!order) return NextResponse.json({ error: 'not found' }, { status: 404 })
    const body = await req.json() as Record<string, unknown>
    if (body.status === 'confirmed') {
      await confirmOrder(parsed, gate.supplierId, orderDate(body.confirmationDate, 'Confirmation date'), orderDate(body.fulfillmentDate, 'Pickup/delivery date'))
    } else if (!('status' in body) && 'fulfillmentDate' in body) {
      await setOrderFulfillmentDate(parsed, orderDate(body.fulfillmentDate, 'Pickup/delivery date'), gate.supplierId)
    } else return NextResponse.json({ error: 'Suppliers may confirm orders or set a pickup/delivery date' }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 })
  }
}
