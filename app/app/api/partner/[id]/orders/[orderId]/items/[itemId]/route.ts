import { NextResponse } from 'next/server'

import { partnerSupplier } from '@/lib/availability-queries'
import { orderDetail, updatePartnerOrderItemPrice, updatePartnerOrderItem } from '@/lib/order-queries'
import { parseOrderItemPrice, parseOrderItemUpdate, positiveId } from '@/lib/orders'
import { requirePartnerAccess } from '@/lib/partner-auth'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; orderId: string; itemId: string }> }) {
  try {
    const { id, orderId, itemId } = await params
    const gate = await requirePartnerAccess(req, id)
    if (!gate.ok) return gate.res
    const order = Number(orderId); const item = Number(itemId)
    if (!positiveId(order) || !positiveId(item)) return NextResponse.json({ error: 'Invalid order or line ID' }, { status: 400 })
    if (!await partnerSupplier(gate.supplierId)) return NextResponse.json({ error: 'not found' }, { status: 404 })
    const detail = await orderDetail(order, gate.supplierId)
    if (!detail || !detail.items.some((line) => line.id === item)) return NextResponse.json({ error: 'not found' }, { status: 404 })
    if (detail.closed || ['closed_won', 'closed_lost'].includes(detail.status)) return NextResponse.json({ error: 'This order is closed' }, { status: 409 })
    const body: unknown = await req.json()
    if (body && typeof body === 'object' && 'unitPrice' in body) {
      await updatePartnerOrderItemPrice(order, gate.supplierId, item, parseOrderItemPrice(body))
    } else {
      const update = parseOrderItemUpdate(body)
      await updatePartnerOrderItem(order, gate.supplierId, item, update.status, update.noteFromSupplier)
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 })
  }
}
