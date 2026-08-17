import { NextResponse } from 'next/server'

import { PHOTO_PAGE_SIZE, photoFacets, searchPhotos } from '@/lib/photos'
import { PHOTO_FILTERS, parseFilters } from '@/lib/server-filters'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const search = url.searchParams.get('q') ?? ''

  let filters
  try {
    filters = parseFilters('photo', PHOTO_FILTERS, url.searchParams)
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 })
  }

  // An offset rather than a page: the grid appends, and "after what I already
  // hold" survives a photo being deleted out of the middle of the set.
  const rawOffset = Number.parseInt(url.searchParams.get('offset') ?? '0', 10)
  const offset = Number.isInteger(rawOffset) && rawOffset >= 0 ? rawOffset : 0

  try {
    // The option lists, fetched separately so they can be cached against the
    // search term while the filters change freely — see `photoFacets`.
    if (url.searchParams.get('facets') === '1') {
      return NextResponse.json({ facets: await photoFacets(search) })
    }
    const { photos, total } = await searchPhotos(search, filters, offset)
    // `total` is the whole match set; the browser knows there is more to load
    // when what it holds is short of it. The batch size stays on the server.
    return NextResponse.json({ photos, total, offset, batchSize: PHOTO_PAGE_SIZE })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
