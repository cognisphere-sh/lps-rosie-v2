import { NextResponse } from 'next/server'

import { ensureCustomerThread } from '@/lib/job-chat'

/** Resolve the saved conversation before opening it; never send a message here. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = await params
  const id = Number(raw)
  if (!Number.isSafeInteger(id) || id <= 0) return NextResponse.json({ error: 'bad id' }, { status: 400 })
  try {
    const customer = await ensureCustomerThread(id)
    if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    return NextResponse.json({ threadId: customer.threadId })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
