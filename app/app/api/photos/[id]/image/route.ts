import { NextResponse } from 'next/server'

import { signedPhotoUrl } from '@/lib/photos'

/**
 * Redirect to a short-lived signed URL for one photo.
 *
 * The `plant-photos` bucket is private, so this is the only way an image
 * reaches a browser. It takes a **photo id**, never a storage path: the path is
 * read from the row here, which is what stops this endpoint from becoming a
 * signing oracle for anything else in the bucket.
 *
 * Signing per request rather than per row also keeps the grid endpoint cheap
 * and every link fresh — a signature minted when the page rendered would expire
 * while the page sat open.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  // Reject anything that is not a UUID before it reaches the database: the id
  // is a path segment, so it arrives from the browser like any other input.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: 'bad photo id' }, { status: 400 })
  }

  try {
    const url = await signedPhotoUrl(id)
    if (!url) return NextResponse.json({ error: 'unknown photo' }, { status: 404 })
    return NextResponse.redirect(url)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
