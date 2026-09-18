import { NextResponse } from 'next/server'

import { partnerSupplier } from '@/lib/availability-queries'
import { orderDetail, supplierOrderEventContext } from '@/lib/order-queries'
import { notifySupplierEvent } from '@/lib/notify-supplier-events'
import { ORDER_ITEM_STATUSES, positiveId } from '@/lib/orders'
import { requirePartnerAccess } from '@/lib/partner-auth'

export async function POST(req: Request, { params }: { params: Promise<{ id: string; orderId: string }> }) {
  try {
    const { id, orderId } = await params; const gate = await requirePartnerAccess(req, id)
    if (!gate.ok) return gate.res
    const order = Number(orderId)
    if (!positiveId(order) || !await partnerSupplier(gate.supplierId)) return NextResponse.json({ error: 'not found' }, { status: 404 })
    const detail = await orderDetail(order, gate.supplierId)
    const body = await req.json() as { changes?: { itemId?: unknown; status?: unknown; note?: unknown }[] }
    if (!detail || !Array.isArray(body.changes) || !body.changes.length || body.changes.length > 500) throw new Error('Order status changes are required')
    const changes = body.changes.map((change) => {
      if (!positiveId(change.itemId) || !detail.items.some((item) => item.id === change.itemId) || !(ORDER_ITEM_STATUSES as readonly string[]).includes(change.status as string) || typeof change.note !== 'string' || change.note.length > 10000) throw new Error('Invalid order status change')
      return { itemId: change.itemId, status: change.status as string, note: change.note.trim() }
    })
    await notifySupplierEvent({ type: 'order_status_saved', ...await supplierOrderEventContext(order, gate.supplierId), changes })
    return NextResponse.json({ ok: true })
  } catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 400 }) }
}
