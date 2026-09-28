import { NextResponse } from 'next/server'

import { selectSupplierResponse } from '@/lib/job-request-queries'

/**
 * Choose one supplier's AR answer for a job line. Body: `{ arItemId }`.
 * The answer must be linked to this line, and the line must be this job's.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const { id: rawId, itemId: rawItemId } = await params
  const id = Number.parseInt(rawId, 10)
  const itemId = Number.parseInt(rawItemId, 10)
  const body = (await req.json().catch(() => ({}))) as { arItemId?: unknown }
  const arItemId = Number(body.arItemId)
  if (!Number.isInteger(id) || !Number.isInteger(itemId) || !Number.isInteger(arItemId)) {
    return NextResponse.json({ error: 'bad id' }, { status: 400 })
  }

  try {
    const selected = await selectSupplierResponse(id, itemId, arItemId)
    if (!selected) return NextResponse.json({ error: 'not found' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
