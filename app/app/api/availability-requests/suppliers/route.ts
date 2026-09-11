import { NextResponse } from 'next/server'

import { listAvailabilitySuppliers } from '@/lib/availability-queries'

/** The suppliers an availability request can go to — the dialog's dropdown. */
export async function GET() {
  try {
    const suppliers = await listAvailabilitySuppliers()
    return NextResponse.json({ suppliers })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
