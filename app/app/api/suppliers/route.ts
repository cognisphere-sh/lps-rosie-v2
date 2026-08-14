import { NextResponse } from 'next/server'

import { PAGE_SIZE, itemCounts, listSuppliers } from '@/lib/queries'

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

  const rawPage = Number.parseInt(url.searchParams.get('page') ?? '1', 10)
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1

  try {
    // The page size lives on the server, so the page count is computed here
    // rather than handing the browser a divisor it would have to duplicate.
    const { rows, total } = await listSuppliers(search, page)
    return NextResponse.json({ rows, total, pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)) })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
