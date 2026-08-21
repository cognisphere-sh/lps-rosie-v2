import { NextResponse } from 'next/server'

import type { MessageChannel } from '@/lib/availability'
import { MESSAGE_CHANNELS } from '@/lib/availability'
import { addSupplierMessage, listSupplierMessages, supplierDisplayName } from '@/lib/availability-queries'
import { notifySupplierEvent } from '@/lib/notify-supplier-events'
import { resolveUser } from '@/lib/session'

/** Ids out of `?supplier=1,2,3` — anything non-numeric is simply dropped. */
const idsOf = (raw: string | null): number[] =>
  (raw ?? '')
    .split(',')
    .map((s) => Number.parseInt(s.trim(), 10))
    .filter((n) => Number.isInteger(n))

/** A supplier's conversation thread — all its locations at once, oldest first. */
export async function GET(req: Request) {
  const supplierIds = idsOf(new URL(req.url).searchParams.get('supplier'))
  if (!supplierIds.length) {
    return NextResponse.json({ error: 'supplier is required' }, { status: 400 })
  }
  try {
    const messages = await listSupplierMessages(supplierIds)
    return NextResponse.json({ messages })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

/**
 * A broker-side message into a supplier's thread.
 *
 * Body: { supplierId, channel, body, jobRequestId? }. `email`/`text` entries
 * are a *record* of an exchange that happens outside the app; `app` is the
 * supplier's portal thread (one per supplier — never per availability
 * request); and `internal` is an instruction to daisy — recorded in the
 * transcript and then delivered to her supplier thread through the
 * `supplier-events` webhook. The sender is the signed-in user — self-reported
 * names are not accepted.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      supplierId?: number
      channel?: string
      body?: string
      jobRequestId?: number
    }
    if (!Number.isInteger(body.supplierId) || !body.body?.trim()) {
      return NextResponse.json({ error: 'supplierId and body are required' }, { status: 400 })
    }
    if (!MESSAGE_CHANNELS.includes(body.channel as MessageChannel)) {
      return NextResponse.json(
        { error: `channel must be one of: ${MESSAGE_CHANNELS.join(', ')}` },
        { status: 400 },
      )
    }

    const user = await resolveUser(req.headers.get('cookie') ?? '')
    // The harness username, given its display casing ("chris" → "Chris").
    const senderName = user ? user.charAt(0).toUpperCase() + user.slice(1) : null
    const message = await addSupplierMessage({
      supplierId: body.supplierId!,
      sender: 'broker',
      senderName,
      channel: body.channel as MessageChannel,
      body: body.body.trim(),
      jobRequestId: Number.isInteger(body.jobRequestId) ? body.jobRequestId : null,
    })
    // An instruction is FOR daisy, so recording it is only half the job —
    // wake her on the supplier's thread with it.
    if (message.channel === 'internal') {
      await notifySupplierEvent({
        type: 'instruction',
        supplierId: message.supplierId,
        supplierName: await supplierDisplayName(message.supplierId),
        availabilityRequestId: message.availabilityRequestId,
        jobRequestId: message.jobRequestId,
        message: message.body,
        from: senderName ?? 'the app',
      })
    }
    return NextResponse.json({ message })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}
