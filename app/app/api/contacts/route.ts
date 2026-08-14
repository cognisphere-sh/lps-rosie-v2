import { NextResponse } from 'next/server'

import { createContact, getSupplierContacts, setPrimaryContact, unlinkContact } from '@/lib/queries'

// Field edits go through the generic /api/rows handler, which whitelists
// `contacts` like any other table — those write the person. Everything that is
// about the *link* between a contact and one supplier lives here: creating a
// contact under a supplier, promoting one to that supplier's primary (which has
// to demote the incumbent first), and removing one from a supplier without
// touching the other locations they cover.

export async function GET(req: Request) {
  const supplierId = Number.parseInt(new URL(req.url).searchParams.get('supplierId') ?? '', 10)
  if (!Number.isInteger(supplierId)) {
    return NextResponse.json({ error: 'supplierId is required' }, { status: 400 })
  }
  try {
    return NextResponse.json({ contacts: await getSupplierContacts(supplierId) })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { supplierId?: number; fields?: Record<string, string> }
    if (!Number.isInteger(body.supplierId)) {
      return NextResponse.json({ error: 'supplierId is required' }, { status: 400 })
    }
    return NextResponse.json({ contact: await createContact(body.supplierId!, body.fields ?? {}) })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}

/**
 * Body: { id, supplierId, primary: true } — promote this contact to the
 * primary *at that supplier*. The flag is per location, so the supplier is
 * part of the request, not looked up from the contact.
 */
export async function PATCH(req: Request) {
  try {
    const body = (await req.json()) as { id?: number; supplierId?: number; primary?: boolean }
    if (!Number.isInteger(body.id) || !Number.isInteger(body.supplierId)) {
      return NextResponse.json({ error: 'id and supplierId are required' }, { status: 400 })
    }
    if (!body.primary) {
      return NextResponse.json({ error: 'only { primary: true } is supported' }, { status: 400 })
    }
    await setPrimaryContact(body.supplierId!, body.id!)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}

/** Body: { id, supplierId } — take this contact off that one supplier. */
export async function DELETE(req: Request) {
  try {
    const body = (await req.json()) as { id?: number; supplierId?: number }
    if (!Number.isInteger(body.id) || !Number.isInteger(body.supplierId)) {
      return NextResponse.json({ error: 'id and supplierId are required' }, { status: 400 })
    }
    await unlinkContact(body.supplierId!, body.id!)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}
