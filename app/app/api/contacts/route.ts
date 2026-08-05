import { NextResponse } from 'next/server'

import { createContact, getSupplierContacts, setPrimaryContact } from '@/lib/queries'

// Field edits and deactivation go through the generic /api/rows handler, which
// whitelists `contacts` like any other table. This route covers the two things
// that aren't a plain column write: creating a contact under a supplier, and
// promoting one to primary (which has to demote the incumbent first).

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

/** Body: { id, primary: true } — promote this contact to the supplier's primary. */
export async function PATCH(req: Request) {
  try {
    const body = (await req.json()) as { id?: number; primary?: boolean }
    if (!Number.isInteger(body.id)) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }
    if (!body.primary) {
      return NextResponse.json({ error: 'only { primary: true } is supported' }, { status: 400 })
    }
    await setPrimaryContact(body.id!)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}
