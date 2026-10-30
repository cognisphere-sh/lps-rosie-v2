import { NextResponse } from 'next/server'

import { NotAnImageError } from '@/lib/photo-prepare'
import { PHOTO_PAGE_SIZE, addPhoto, photoFacets, searchPhotos } from '@/lib/photos'
import { PHOTO_FILTERS, parseFilters } from '@/lib/server-filters'
import { resolveUser } from '@/lib/session'

/** What a phone can send; the stored copy is far smaller after preparing. */
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024

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

/**
 * One photo from the Photos page's camera or attach button, catalogued at once
 * (`addPhoto`). The raw file is the body; the sender's note, which is required,
 * rides in `x-photo-note` (URI-encoded) so it lands in the row's `source`.
 */
export async function POST(req: Request) {
  const user = await resolveUser(req.headers.get('cookie') ?? '')
  if (user?.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  let note: string
  try {
    note = decodeURIComponent(req.headers.get('x-photo-note') ?? '').trim()
  } catch {
    note = ''
  }
  if (!note) return NextResponse.json({ error: 'Say what the photo is.' }, { status: 400 })

  const bytes = Buffer.from(await req.arrayBuffer())
  if (!bytes.length) return NextResponse.json({ error: 'empty file' }, { status: 400 })
  if (bytes.length > MAX_UPLOAD_BYTES) return NextResponse.json({ error: 'Photo is over 25 MB.' }, { status: 413 })

  try {
    return NextResponse.json(await addPhoto(bytes, user.username, note))
  } catch (e) {
    if (e instanceof NotAnImageError) {
      return NextResponse.json({ error: 'That file isn’t a photo the catalogue can read.' }, { status: 415 })
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
