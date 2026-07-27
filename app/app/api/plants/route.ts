import { NextResponse } from 'next/server'

import { getSupplierPlants, searchPlantGroups } from '@/lib/queries'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const search = url.searchParams.get('q') ?? ''
  const supplierId = url.searchParams.get('supplierId')

  try {
    if (supplierId) {
      const id = Number.parseInt(supplierId, 10)
      if (!Number.isInteger(id)) {
        return NextResponse.json({ error: 'bad supplierId' }, { status: 400 })
      }
      const page = Number.parseInt(url.searchParams.get('page') ?? '1', 10)
      return NextResponse.json(
        await getSupplierPlants(id, search, Number.isInteger(page) && page > 0 ? page : 1),
      )
    }
    return NextResponse.json({ groups: await searchPlantGroups(search) })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
