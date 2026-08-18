import { NextResponse } from 'next/server'

import { jobRequestChangelog } from '@/lib/job-request-queries'

/**
 * One request's whole audit trail.
 *
 * Its own endpoint rather than a field on the request: the list is unbounded
 * and only wanted when the history drawer is opened, so paying for it on every
 * page of cards would be paying for it almost always in vain.
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
    return NextResponse.json({ entries: await jobRequestChangelog(id) })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
