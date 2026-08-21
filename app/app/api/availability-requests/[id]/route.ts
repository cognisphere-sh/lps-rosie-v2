import { NextResponse } from 'next/server'

import { availabilityRequest, setAvailabilityRequestStatus } from '@/lib/availability-queries'

/** One availability request, whole — the admin view (no disclosure filter). */
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
    const request = await availabilityRequest(id)
    if (!request) return NextResponse.json({ error: 'not found' }, { status: 404 })
    return NextResponse.json({ request })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

/** The one admin edit on a request: its status (usually → closed). */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: raw } = await params
  const id = Number.parseInt(raw, 10)
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: 'bad id' }, { status: 400 })
  }
  try {
    const body = (await req.json()) as { status?: string }
    if (!body.status) {
      return NextResponse.json({ error: 'status is required' }, { status: 400 })
    }
    await setAvailabilityRequestStatus(id, body.status)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}
