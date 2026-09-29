import { NextResponse } from 'next/server'

import { addCandidateToRequest, deleteCandidate, selectCandidate } from '@/lib/job-request-queries'

type Params = { params: Promise<{ id: string; itemId: string; candidateId: string }> }

async function ids({ params }: Params) {
  const raw = await params
  const out = [raw.id, raw.itemId, raw.candidateId].map((v) => Number.parseInt(v, 10))
  return out.every(Number.isInteger) ? out as [number, number, number] : null
}

/**
 * Act on one candidate of a job line. Body: `{ action: 'select' }` copies it
 * onto the line; `{ action: 'add', arId }` adds it to one of this job's ARs.
 */
export async function POST(req: Request, ctx: Params) {
  const parsed = await ids(ctx)
  const body = (await req.json().catch(() => ({}))) as { action?: unknown; arId?: unknown }
  const arId = Number(body.arId)
  if (!parsed || (body.action !== 'select' && !(body.action === 'add' && Number.isInteger(arId)))) {
    return NextResponse.json({ error: 'bad request' }, { status: 400 })
  }
  try {
    const done = body.action === 'select' ? await selectCandidate(...parsed) : await addCandidateToRequest(...parsed, arId)
    if (!done) return NextResponse.json({ error: 'not found' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

/** The bin: soft-delete the candidate. */
export async function DELETE(_req: Request, ctx: Params) {
  const parsed = await ids(ctx)
  if (!parsed) return NextResponse.json({ error: 'bad id' }, { status: 400 })
  try {
    if (!await deleteCandidate(...parsed)) return NextResponse.json({ error: 'not found' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
