import { NextResponse } from 'next/server'

import { getSupplierProfile } from '@/lib/queries'

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
    // One payload for the whole profile: on a head-branch id it covers every
    // location of the company, on a farm id that farm alone. See
    // getSupplierProfile — the tabs tag their entries from `locations`.
    const profile = await getSupplierProfile(id)
    if (!profile) return NextResponse.json({ error: 'not found' }, { status: 404 })
    return NextResponse.json(profile)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
