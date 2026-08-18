import { NextResponse } from 'next/server'

import { jobRequest } from '@/lib/job-request-queries'

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
