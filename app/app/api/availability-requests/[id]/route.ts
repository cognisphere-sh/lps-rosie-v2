import { NextResponse } from 'next/server'

import {
  availabilityRequest,
  setAvailabilityRequestNote,
  setAvailabilityRequestPublic,
  setAvailabilityRequestStatus,
  updateARItem,
  updateARItemDetails,
  supplierAvailabilityEventContext,
} from '@/lib/availability-queries'
import { notifySupplierEvent } from '@/lib/notify-supplier-events'

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
 * its note for the supplier (`{noteForSupplier}`), one line's answer (`{itemId, changes}`), or its requested plant details
 * (`{itemId, details}`). Only admins can correct the ask itself.
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
      details?: Record<string, string>
      noteForSupplier?: unknown
    }
    if ('isPublic' in body) {
      if (typeof body.isPublic !== 'boolean') return NextResponse.json({ error: 'isPublic must be a boolean' }, { status: 400 })
      const token = await setAvailabilityRequestPublic(id, body.isPublic)
      return NextResponse.json({ publicToken: token })
    }
    if ('noteForSupplier' in body) {
      if (typeof body.noteForSupplier !== 'string') return NextResponse.json({ error: 'noteForSupplier must be a string' }, { status: 400 })
      await setAvailabilityRequestNote(id, body.noteForSupplier)
      await notifySupplierEvent({ type: 'availability_updated', ...await supplierAvailabilityEventContext(id) })
      return NextResponse.json({ ok: true })
    }
    if ('details' in body || body.changes) {
      if (!Number.isInteger(body.itemId)) {
        return NextResponse.json({ error: 'itemId is required' }, { status: 400 })
      }
      if ('details' in body && 'changes' in body) {
        return NextResponse.json({ error: 'Save plant details and answers separately' }, { status: 400 })
      }
      if ('details' in body) await updateARItemDetails(id, body.itemId!, body.details!)
      else await updateARItem(id, body.itemId!, body.changes!)
      await notifySupplierEvent({ type: 'availability_updated', ...await supplierAvailabilityEventContext(id) })
      return NextResponse.json({ ok: true })
    }
    if (!body.status) {
      return NextResponse.json({ error: 'status, changes or details is required' }, { status: 400 })
    }
    await setAvailabilityRequestStatus(id, body.status)
    if (body.status === 'submitted') {
      await notifySupplierEvent({ type: 'availability_submitted', ...await supplierAvailabilityEventContext(id) })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: /closed/i.test((e as Error).message) ? 409 : 400 })
  }
}
