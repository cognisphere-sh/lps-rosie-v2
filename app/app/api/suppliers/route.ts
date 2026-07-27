import { NextResponse } from 'next/server'

import { itemCounts, listSuppliers } from '@/lib/queries'

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

  try {
    return NextResponse.json({ rows: await listSuppliers(search) })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
