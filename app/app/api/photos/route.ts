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

  const rawPage = Number.parseInt(url.searchParams.get('page') ?? '1', 10)
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1

  try {
    // The option lists, fetched separately so they can be cached against the
    // search term while the filters change freely — see `photoFacets`.
    if (url.searchParams.get('facets') === '1') {
      return NextResponse.json({ facets: await photoFacets(search) })
    }
    const { photos, total } = await searchPhotos(search, filters, page)
    return NextResponse.json({
      photos,
      total,
      pageCount: Math.max(1, Math.ceil(total / PHOTO_PAGE_SIZE)),
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
