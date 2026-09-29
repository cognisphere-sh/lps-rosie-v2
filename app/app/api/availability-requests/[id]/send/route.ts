import { NextResponse } from 'next/server'

import { sendAvailabilityRequest } from '@/lib/availability-queries'

/** Send a draft AR: from now on the supplier sees it in their portal (or public link). */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number.parseInt((await params).id, 10)
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'bad id' }, { status: 400 })
  try {
    await sendAvailabilityRequest(id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}
