import { NextResponse } from 'next/server'

import { customer } from '@/lib/customer-queries'

/** One customer, whole — for their own page, which lists nothing else. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: raw } = await params
  const id = Number.parseInt(raw, 10)
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: 'bad id' }, { status: 400 })
  }

  try {
    const found = await customer(id)
    if (!found) return NextResponse.json({ error: 'not found' }, { status: 404 })
    return NextResponse.json({ customer: found })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
