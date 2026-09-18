import { NextResponse } from 'next/server'

import { partnerSupplier } from '@/lib/availability-queries'
import { orderDetail, updatePartnerOrder } from '@/lib/order-queries'
import { parsePartnerOrderUpdate, positiveId } from '@/lib/orders'
import { requirePartnerAccess } from '@/lib/partner-auth'

type Context = { params: Promise<{ id: string; orderId: string }> }

export async function GET(req: Request, { params }: Context) {
  try {
    const { id, orderId } = await params
    const gate = await requirePartnerAccess(req, id)
    if (!gate.ok) return gate.res
    const parsed = Number(orderId)
    if (!positiveId(parsed)) return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 })
    if (!await partnerSupplier(gate.supplierId)) return NextResponse.json({ error: 'not found' }, { status: 404 })
    const order = await orderDetail(parsed, gate.supplierId)
    if (!order) return NextResponse.json({ error: 'not found' }, { status: 404 })
    // Pickup / delivery is Chris's customer-facing arrangement. It is never
    // editable from a supplier portal account, including a supplier admin.
    return NextResponse.json({ order, canEdit: true, canEditFulfillmentMethod: false })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

export async function PATCH(req: Request, { params }: Context) {
  try {
    const { id, orderId } = await params
    const gate = await requirePartnerAccess(req, id)
    if (!gate.ok) return gate.res
    const parsed = Number(orderId)
    if (!positiveId(parsed)) return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 })
    if (!await partnerSupplier(gate.supplierId)) return NextResponse.json({ error: 'not found' }, { status: 404 })
    const order = await orderDetail(parsed, gate.supplierId)
    if (!order) return NextResponse.json({ error: 'not found' }, { status: 404 })
    if (order.closed || ['closed_won', 'closed_lost'].includes(order.status)) return NextResponse.json({ error: 'This order is closed' }, { status: 409 })
    const body: unknown = await req.json()
    if (body != null && typeof body === 'object' && 'fulfillmentMethod' in body) {
      return NextResponse.json({ error: 'Pickup or delivery is managed by Chris' }, { status: 403 })
    }
    await updatePartnerOrder(parsed, gate.supplierId, parsePartnerOrderUpdate(body))
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 })
  }
}
