import { NextResponse } from 'next/server'

import {
  availabilityRequest,
  setAvailabilityRequestPublic,
  setAvailabilityRequestStatus,
  updateARItem,
} from '@/lib/availability-queries'

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

/**
 * The admin edits: the request's own status (`{status}`, usually → `closed`),
 * or one line's answer (`{itemId, changes}`) — the same columns the portal
 * writes, entered on the supplier's behalf when they answer by phone or email.
 */
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
    const body = (await req.json()) as {
      isPublic?: boolean
      status?: string
      itemId?: number
      changes?: Record<string, string>
    }
    if ('isPublic' in body) {
      if (typeof body.isPublic !== 'boolean') return NextResponse.json({ error: 'isPublic must be a boolean' }, { status: 400 })
      const token = await setAvailabilityRequestPublic(id, body.isPublic)
      return NextResponse.json({ publicToken: token })
    }
    if (body.changes) {
      if (!Number.isInteger(body.itemId)) {
        return NextResponse.json({ error: 'itemId is required' }, { status: 400 })
      }
      await updateARItem(id, body.itemId!, body.changes)
      return NextResponse.json({ ok: true })
    }
    if (!body.status) {
      return NextResponse.json({ error: 'status or changes is required' }, { status: 400 })
    }
    await setAvailabilityRequestStatus(id, body.status)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}
