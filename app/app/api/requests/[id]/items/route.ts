import { NextResponse } from 'next/server'

import { createJobRequestItem } from '@/lib/job-request-queries'

/** Add a blank, immediately editable line to an active job request. */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const id = Number.parseInt((await params).id, 10)
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'bad id' }, { status: 400 })
  try {
    const itemId = await createJobRequestItem(id)
    return NextResponse.json({ ok: true, id: itemId }, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}
