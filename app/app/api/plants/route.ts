import { NextResponse } from 'next/server'

import { parseDimensionRanges } from '@/lib/dimension-ranges'
import { PLANT_PAGE_SIZE, getSupplierPlants, searchPlantGroups } from '@/lib/queries'

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

  const rawPage = Number.parseInt(url.searchParams.get('page') ?? '1', 10)
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1

  try {
    if (supplierId) {
      const id = Number.parseInt(supplierId, 10)
      if (!Number.isInteger(id)) {
        return NextResponse.json({ error: 'bad supplierId' }, { status: 400 })
      }
      return NextResponse.json(await getSupplierPlants(id, search, page, ranges))
    }
    if (!search.trim()) return NextResponse.json({ groups: [], total: 0, pageCount: 1 })
    // The page size lives on the server, so the page count is computed here
    // rather than handing the browser a divisor it would have to duplicate.
    const { groups, total } = await searchPlantGroups(search, ranges, page)
    return NextResponse.json({ groups, total, pageCount: Math.max(1, Math.ceil(total / PLANT_PAGE_SIZE)) })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
