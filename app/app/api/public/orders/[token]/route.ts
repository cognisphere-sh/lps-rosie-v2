import { NextResponse } from 'next/server'
import { publicOrder } from '@/lib/order-queries'

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const headers = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' }
  try {
    const order = await publicOrder((await params).token)
    if (!order) return NextResponse.json({ error: 'This link is no longer available' }, { status: 404, headers })
    return NextResponse.json({ order }, { headers })
  } catch {
    return NextResponse.json({ error: 'Could not load this order' }, { status: 500, headers })
  }
}
