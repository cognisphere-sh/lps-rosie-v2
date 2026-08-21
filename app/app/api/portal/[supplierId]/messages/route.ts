import { NextResponse } from 'next/server'

import {
  addSupplierMessage,
  listSupplierMessages,
  portalSupplier,
} from '@/lib/availability-queries'
import { notifySupplierEvent } from '@/lib/notify-supplier-events'

// The supplier's ONE chat thread with Local Plant Supply — the conversation is
// per supplier, never per availability request (2026-08-19). See
// ../route.ts for why these routes are outside the session gate and how they
// scope themselves in its absence.

/** The thread as the supplier may see it — `internal` messages never cross. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ supplierId: string }> },
) {
  const { supplierId: raw } = await params
  const supplierId = Number.parseInt(raw, 10)
  if (!Number.isInteger(supplierId)) {
    return NextResponse.json({ error: 'bad id' }, { status: 400 })
  }
  try {
    if (!(await portalSupplier(supplierId))) {
      return NextResponse.json({ error: 'not found' }, { status: 404 })
    }
    const messages = await listSupplierMessages([supplierId], { supplierFacing: true })
    return NextResponse.json({ messages })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

/** A supplier-side message on their thread. Body: { body }. Wakes daisy. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ supplierId: string }> },
) {
  const { supplierId: raw } = await params
  const supplierId = Number.parseInt(raw, 10)
  if (!Number.isInteger(supplierId)) {
    return NextResponse.json({ error: 'bad id' }, { status: 400 })
  }
  try {
    const supplier = await portalSupplier(supplierId)
    if (!supplier) return NextResponse.json({ error: 'not found' }, { status: 404 })

    const body = (await req.json()) as { body?: string }
    const text = body.body?.trim()
    if (!text) return NextResponse.json({ error: 'body is required' }, { status: 400 })

    const message = await addSupplierMessage({
      supplierId,
      sender: 'supplier',
      senderName: supplier.name,
      channel: 'app',
      body: text,
    })
    await notifySupplierEvent({
      type: 'supplier_message',
      supplierId,
      supplierName: supplier.name,
      availabilityRequestId: null,
      jobRequestId: null,
      message: text,
    })
    return NextResponse.json({ message })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}
