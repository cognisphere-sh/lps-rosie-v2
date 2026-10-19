import { NextResponse } from 'next/server'

import { addOrderItem, orderDetail } from '@/lib/order-queries'
import { positiveId } from '@/lib/orders'
import { resolveUser } from '@/lib/session'

/** Add a row by hand to an open order; it is edited in place afterwards. */
export async function POST(req: Request, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    const user = await resolveUser(req.headers.get('cookie') ?? '')
    if (user?.role !== 'admin') return NextResponse.json({ error: user ? 'forbidden' : 'unauthorized' }, { status: user ? 403 : 401 })
    const order = Number((await params).orderId)
    if (!positiveId(order)) return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 })
    const detail = await orderDetail(order)
    if (!detail) return NextResponse.json({ error: 'not found' }, { status: 404 })
    if (detail.closed || ['closed_won', 'closed_lost'].includes(detail.status)) return NextResponse.json({ error: 'This order is closed' }, { status: 409 })
    return NextResponse.json({ id: await addOrderItem(order) }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 })
  }
}
