import { NextResponse } from 'next/server'

import { PLANT_PAGE_SIZE, getSupplierPlants, plantFacets, searchPlantGroups } from '@/lib/queries'
import { MASTER_FILTERS, PLANT_FILTERS, parseFilters } from '@/lib/server-filters'
import { PLANT_SORTS, parseSort } from '@/lib/server-sort'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const search = url.searchParams.get('q') ?? ''
  const supplierId = url.searchParams.get('supplierId')

  // Column filters are applied as SQL over the search result, so they arrive
  // here rather than being applied to whatever page the browser holds.
  let filters
  try {
    filters = [
      ...parseFilters('plant', PLANT_FILTERS, url.searchParams),
      ...parseFilters('master', MASTER_FILTERS, url.searchParams),
    ]
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 })
  }

  // Sorting travels with the request for the same reason the filters do: a
  // header sort is a question about the whole match set, not about this page.
  // Both plant tables — the search's and the profile's Inventory tab — order by
  // the same spec. The supplier panel on the search page is not in it: its rows
  // are that page's groups, so ordering them arranges what already came back.
  const sort = parseSort(PLANT_SORTS, url.searchParams)

  const rawPage = Number.parseInt(url.searchParams.get('page') ?? '1', 10)
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1

  try {
    // The option lists each multiselect offers, for this search and *without*
    // the column filters — otherwise picking one value would remove every
    // other value from its own dropdown. Fetched on its own so it can be
    // cached against the search term while filters change freely.
    if (url.searchParams.get('facets') === '1') {
      const scope = supplierId ? Number.parseInt(supplierId, 10) : undefined
      return NextResponse.json({
        facets: await plantFacets(search, Number.isInteger(scope) ? scope : undefined),
      })
    }
    if (supplierId) {
      const id = Number.parseInt(supplierId, 10)
      if (!Number.isInteger(id)) {
        return NextResponse.json({ error: 'bad supplierId' }, { status: 400 })
      }
      return NextResponse.json(await getSupplierPlants(id, search, page, filters, sort))
    }
    // The page size lives on the server, so the page count is computed here
    // rather than handing the browser a divisor it would have to duplicate.
    const { groups, total } = await searchPlantGroups(search, filters, page, sort)
    return NextResponse.json({ groups, total, pageCount: Math.max(1, Math.ceil(total / PLANT_PAGE_SIZE)) })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
