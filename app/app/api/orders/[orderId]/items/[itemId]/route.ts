import { NextResponse } from 'next/server'

import { orderDetail, updatePartnerOrderItem } from '@/lib/order-queries'
import { parseOrderItemUpdate, positiveId } from '@/lib/orders'
import { resolveUser } from '@/lib/session'

export async function PATCH(req: Request, { params }: { params: Promise<{ orderId: string; itemId: string }> }) {
  try {
    const user = await resolveUser(req.headers.get('cookie') ?? '')
    if (user?.role !== 'admin') return NextResponse.json({ error: user ? 'forbidden' : 'unauthorized' }, { status: user ? 403 : 401 })
    const { orderId, itemId } = await params
    const order = Number(orderId); const item = Number(itemId)
    if (!positiveId(order) || !positiveId(item)) return NextResponse.json({ error: 'Invalid order or line ID' }, { status: 400 })
    const detail = await orderDetail(order)
    if (!detail || !detail.items.some((line) => line.id === item)) return NextResponse.json({ error: 'not found' }, { status: 404 })
    if (detail.closed || ['closed_won', 'closed_lost'].includes(detail.status)) return NextResponse.json({ error: 'This order is closed' }, { status: 409 })
    const status = parseOrderItemUpdate(await req.json()).status
    await updatePartnerOrderItem(order, detail.supplierId, item, status)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 })
  }
}
