import { NextResponse } from 'next/server'

import { partnerSupplier } from '@/lib/availability-queries'
import { orderDetail, supplierOrderEventContext, updatePartnerOrder } from '@/lib/order-queries'
import { notifySupplierEvent, type OrderHeaderChange } from '@/lib/notify-supplier-events'
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
    return NextResponse.json({ order, canEdit: true })
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
    // The supplier writes their own reply; the order's additional details and change log are LPS's.
    if (body != null && typeof body === 'object' && ('additionalDetails' in body || 'changeLog' in body)) {
      return NextResponse.json({ error: 'Write your note as noteFromSupplier' }, { status: 403 })
    }
    const update = parsePartnerOrderUpdate(body)
    const orderChanges: OrderHeaderChange[] = []
    for (const field of ['status', 'noteFromSupplier'] as const) {
      if (field in update && (order[field] ?? null) !== (update[field] ?? null)) {
        orderChanges.push({ field, previous: order[field] ?? null, value: update[field] ?? null })
      }
    }
    await updatePartnerOrder(parsed, gate.supplierId, update)
    // The write is committed. Notification failures must not make APS retry it.
    if (orderChanges.length) {
      try {
        await notifySupplierEvent({ type: 'order_updated', ...await supplierOrderEventContext(parsed, gate.supplierId), orderChanges })
      } catch (error) {
        console.error('Order saved but Rosie notification failed', error)
      }
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 })
  }
}
