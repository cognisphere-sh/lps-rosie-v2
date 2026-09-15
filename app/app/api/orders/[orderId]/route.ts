import { NextResponse } from 'next/server'

import { orderDetail, updatePartnerOrder } from '@/lib/order-queries'
import { parsePartnerOrderUpdate, positiveId } from '@/lib/orders'
import { resolveUser } from '@/lib/session'

export async function PATCH(req: Request, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    const user = await resolveUser(req.headers.get('cookie') ?? '')
    if (user?.role !== 'admin') return NextResponse.json({ error: user ? 'forbidden' : 'unauthorized' }, { status: user ? 403 : 401 })
    const orderId = Number((await params).orderId)
    if (!positiveId(orderId)) return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 })
    const order = await orderDetail(orderId)
    if (!order) return NextResponse.json({ error: 'not found' }, { status: 404 })
    if (order.closed || ['closed_won', 'closed_lost'].includes(order.status)) return NextResponse.json({ error: 'This order is closed' }, { status: 409 })
    await updatePartnerOrder(orderId, order.supplierId, parsePartnerOrderUpdate(await req.json()))
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 })
  }
}
