import { NextResponse } from 'next/server'

import { deleteJobRequest, jobRequest } from '@/lib/job-request-queries'

/**
 * One request, whole.
 *
 * For the pages that show a request without listing them — a customer's card
 * opens its requests one at a time, and only the one opened is worth fetching.
 */
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
    const request = await jobRequest(id)
    if (!request) return NextResponse.json({ error: 'not found' }, { status: 404 })
    return NextResponse.json({ request })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

/**
 * Delete the request and everything hanging off it — permanently.
 *
 * Not a soft delete: an availability request is read in the supplier's portal
 * by supplier id, so retiring the job would leave them answering an ask for a
 * job that is gone. `deleteJobRequest` explains the cascade; the counts come
 * back so the caller can say what went.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: raw } = await params
  const id = Number.parseInt(raw, 10)
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: 'bad id' }, { status: 400 })
  }

  try {
    const deleted = await deleteJobRequest(id)
    if (!deleted) return NextResponse.json({ error: 'not found' }, { status: 404 })
    return NextResponse.json({ ok: true, deleted })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
