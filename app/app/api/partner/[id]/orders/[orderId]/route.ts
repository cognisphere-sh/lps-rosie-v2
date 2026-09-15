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
    return NextResponse.json({ order, canEdit: true, canEditFulfillmentMethod: gate.user.role === 'admin' })
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
    if (gate.user.role !== 'admin' && body != null && typeof body === 'object' && 'fulfillmentMethod' in body) {
      return NextResponse.json({ error: 'Only admins can change pickup or delivery' }, { status: 403 })
    }
    await updatePartnerOrder(parsed, gate.supplierId, parsePartnerOrderUpdate(body))
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 })
  }
}
