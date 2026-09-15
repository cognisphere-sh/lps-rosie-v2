import { NextResponse } from 'next/server'

import { closeOrder, confirmOrder, orderDetail, setOrderFulfillmentDate } from '@/lib/order-queries'
import { orderDate, positiveId } from '@/lib/orders'
import { resolveUser } from '@/lib/session'

export async function PATCH(req: Request, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    const user = await resolveUser(req.headers.get('cookie') ?? '')
    if (user?.role !== 'admin') return NextResponse.json({ error: user ? 'forbidden' : 'unauthorized' }, { status: user ? 403 : 401 })
    const id = Number((await params).orderId)
    if (!positiveId(id)) return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 })
    const order = await orderDetail(id)
    if (!order) return NextResponse.json({ error: 'not found' }, { status: 404 })
    const body = await req.json() as Record<string, unknown>
    if (body.status === 'confirmed') {
      await confirmOrder(id, order.supplierId, orderDate(body.confirmationDate, 'Confirmation date'), orderDate(body.fulfillmentDate, 'Pickup/delivery date'))
    } else if (body.status === 'closed_won' || body.status === 'closed_lost') {
      await closeOrder(id, body.status)
    } else if (!('status' in body) && 'fulfillmentDate' in body) {
      await setOrderFulfillmentDate(id, orderDate(body.fulfillmentDate, 'Pickup/delivery date'))
    } else return NextResponse.json({ error: 'Choose confirm, close won/lost, or a pickup/delivery date' }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 })
  }
}
