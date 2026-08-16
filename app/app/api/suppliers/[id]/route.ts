import { NextResponse } from 'next/server'

import { getSupplier, getSupplierLocations, getSupplierSources } from '@/lib/queries'

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
    const [supplier, sources, locations] = await Promise.all([
      getSupplier(id),
      getSupplierSources(id),
      getSupplierLocations(id),
    ])
    if (!supplier) return NextResponse.json({ error: 'not found' }, { status: 404 })
    return NextResponse.json({ supplier, sources, locations })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
