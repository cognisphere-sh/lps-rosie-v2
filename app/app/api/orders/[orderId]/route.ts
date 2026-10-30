import { NextResponse } from 'next/server'

import { orderDetail, setOrderPublic, setOrderStatus, updatePartnerOrder } from '@/lib/order-queries'
import { ORDER_STATUSES, parsePartnerOrderUpdate, positiveId, type OrderStatus } from '@/lib/orders'
import { resolveUser } from '@/lib/session'

export async function PATCH(req: Request, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    const user = await resolveUser(req.headers.get('cookie') ?? '')
    if (user?.role !== 'admin') return NextResponse.json({ error: user ? 'forbidden' : 'unauthorized' }, { status: user ? 403 : 401 })
    const orderId = Number((await params).orderId)
    if (!positiveId(orderId)) return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 })
    const order = await orderDetail(orderId)
    if (!order) return NextResponse.json({ error: 'not found' }, { status: 404 })
    const body: unknown = await req.json()
    if (body && typeof body === 'object' && 'isPublic' in body) {
      if (Object.keys(body).length !== 1 || typeof body.isPublic !== 'boolean') return NextResponse.json({ error: 'isPublic must be a boolean' }, { status: 400 })
      return NextResponse.json({ publicToken: await setOrderPublic(orderId, body.isPublic) })
    }
    // Chris's status dropdown (0155): any status, closed orders included.
    if (body && typeof body === 'object' && 'status' in body && Object.keys(body).length === 1) {
      if (!(ORDER_STATUSES as readonly unknown[]).includes(body.status)) return NextResponse.json({ error: 'Choose an order status' }, { status: 400 })
      await setOrderStatus(orderId, body.status as OrderStatus)
      return NextResponse.json({ ok: true })
    }
    if (order.closed || ['closed_won', 'closed_lost'].includes(order.status)) return NextResponse.json({ error: 'This order is closed' }, { status: 409 })
    await updatePartnerOrder(orderId, order.supplierId, parsePartnerOrderUpdate(body))
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 })
  }
}
