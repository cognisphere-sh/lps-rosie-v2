import { NextResponse } from 'next/server'

import { createOrder, listOrders, newOrderDetails, orderLineChoices } from '@/lib/order-queries'
import { parseCreateOrder, positiveId } from '@/lib/orders'
import { resolveUser } from '@/lib/session'

async function admin(req: Request) {
  const user = await resolveUser(req.headers.get('cookie') ?? '')
  return user?.role === 'admin' ? null : NextResponse.json({ error: user ? 'forbidden' : 'unauthorized' }, { status: user ? 403 : 401 })
}

export async function GET(req: Request) {
  try {
    const denied = await admin(req)
    if (denied) return denied
    const url = new URL(req.url)
    const jobId = Number(url.searchParams.get('job'))
    const supplierId = Number(url.searchParams.get('supplier'))
    if (!positiveId(jobId) && !positiveId(supplierId)) return NextResponse.json({ error: 'job or supplier is required' }, { status: 400 })
    const [orders, lines, additionalDetails] = await Promise.all([
      listOrders({ jobRequestId: positiveId(jobId) ? jobId : undefined, supplierId: positiveId(supplierId) ? supplierId : undefined }),
      positiveId(jobId) ? orderLineChoices(jobId) : Promise.resolve([]),
      positiveId(jobId) ? newOrderDetails(jobId) : Promise.resolve(null),
    ])
    return NextResponse.json({ orders, lines, additionalDetails })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const denied = await admin(req)
    if (denied) return denied
    const input = parseCreateOrder(await req.json())
    const id = await createOrder(input)
    return NextResponse.json({ id }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 })
  }
}
