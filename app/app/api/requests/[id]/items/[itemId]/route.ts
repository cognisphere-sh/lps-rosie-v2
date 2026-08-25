import { NextResponse } from 'next/server'

import { deleteJobRequestItem } from '@/lib/job-request-queries'

/**
 * Delete one line of a job request — permanently.
 *
 * The request id is in the path and in the lookup: a line is deleted as a line
 * *of this request*, so a wrong id cannot reach into another job.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const { id: rawId, itemId: rawItemId } = await params
  const id = Number.parseInt(rawId, 10)
  const itemId = Number.parseInt(rawItemId, 10)
  if (!Number.isInteger(id) || !Number.isInteger(itemId)) {
    return NextResponse.json({ error: 'bad id' }, { status: 400 })
  }

  try {
    const deleted = await deleteJobRequestItem(id, itemId)
    if (!deleted) return NextResponse.json({ error: 'not found' }, { status: 404 })
    return NextResponse.json({ ok: true, deleted })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
