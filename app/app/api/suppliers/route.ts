import { NextResponse } from 'next/server'

import { PAGE_SIZE, itemCounts, listSuppliers, supplierFacets } from '@/lib/queries'
import { SUPPLIER_FILTERS, parseFilters } from '@/lib/server-filters'

// Debounced search from the client lands here. proxy.ts has already verified
// the harness session, so anything reaching this handler is signed in.
export async function GET(req: Request) {
  const url = new URL(req.url)
  const search = url.searchParams.get('q') ?? ''

  // `counts=1` is the suppliers page's second pass: the table renders from the
  // first call, then fills in "# Items" when this one returns.
  if (url.searchParams.get('counts')) {
    const ids = (url.searchParams.get('ids') ?? '')
      .split(',')
      .map((s) => Number.parseInt(s, 10))
      .filter(Number.isInteger)
    return NextResponse.json({ counts: await itemCounts(ids) })
  }

  // The values each dropdown offers, for this search and without its own
  // filters applied — otherwise picking one city would hide every other city.
  if (url.searchParams.get('facets') === '1') {
    try {
      return NextResponse.json({ facets: await supplierFacets(search) })
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 500 })
    }
  }

  const rawPage = Number.parseInt(url.searchParams.get('page') ?? '1', 10)
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1

  try {
    // Column filters run as SQL over the RPC result, so the page and the total
    // describe the same set. `# Items` stays client-side: it is not a column
    // `search_suppliers` returns, it is the second-pass count above.
    const filters = parseFilters('supplier', SUPPLIER_FILTERS, url.searchParams)
    // The page size lives on the server, so the page count is computed here
    // rather than handing the browser a divisor it would have to duplicate.
    const { rows, total } = await listSuppliers(search, page, filters)
    return NextResponse.json({ rows, total, pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)) })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
