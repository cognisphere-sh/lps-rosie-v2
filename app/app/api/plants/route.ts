import { NextResponse } from 'next/server'

import { parseDimensionRanges } from '@/lib/dimension-ranges'
import { getSupplierPlants, searchPlantGroups } from '@/lib/queries'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const search = url.searchParams.get('q') ?? ''
  const supplierId = url.searchParams.get('supplierId')
  let ranges: ReturnType<typeof parseDimensionRanges>
  try {
    ranges = parseDimensionRanges(url.searchParams)
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 })
  }

  try {
    if (supplierId) {
      const id = Number.parseInt(supplierId, 10)
      if (!Number.isInteger(id)) {
        return NextResponse.json({ error: 'bad supplierId' }, { status: 400 })
      }
      const page = Number.parseInt(url.searchParams.get('page') ?? '1', 10)
      return NextResponse.json(
        await getSupplierPlants(id, search, Number.isInteger(page) && page > 0 ? page : 1, ranges),
      )
    }
    if (!search.trim()) return NextResponse.json({ groups: [] })
    return NextResponse.json({ groups: await searchPlantGroups(search, ranges) })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
