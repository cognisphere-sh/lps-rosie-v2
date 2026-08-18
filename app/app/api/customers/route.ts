import { NextResponse } from 'next/server'

import {
  type CustomerFilters,
  customerFacets,
  customerSummary,
  listCustomers,
} from '@/lib/customer-queries'

function list(raw: string | null): string[] | undefined {
  if (!raw) return undefined
  const picked = raw.split(',').filter(Boolean)
  return picked.length ? picked : undefined
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const search = url.searchParams.get('q') ?? ''

  try {
    // Option lists and the header totals are fetched on their own so the page
    // can hold them steady while the filters change — the same split every
    // other list here uses.
    if (url.searchParams.get('facets') === '1') {
      const [facets, summary] = await Promise.all([customerFacets(), customerSummary()])
      return NextResponse.json({ facets, summary })
    }

    const rawPage = Number.parseInt(url.searchParams.get('page') ?? '1', 10)
    const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1

    const filters: CustomerFilters = {
      state: list(url.searchParams.get('state')),
      withRequestsOnly: url.searchParams.get('requests') === '1',
    }

    const { customers, total, pageCount } = await listCustomers(search, filters, page)
    return NextResponse.json({ customers, total, pageCount, page })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
