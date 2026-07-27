import { NextResponse } from 'next/server'

import { signedSourceUrl } from '@/lib/queries'

/**
 * Redirect to a short-lived signed URL for a source file.
 *
 * Signing on click rather than per row keeps the list endpoints cheap (a page
 * of suppliers can reference dozens of files) and keeps every link fresh —
 * a signature minted at render time would expire while the page sat open.
 */
export async function GET(req: Request) {
  const path = new URL(req.url).searchParams.get('path')
  if (!path) return NextResponse.json({ error: 'path is required' }, { status: 400 })

  try {
    const url = await signedSourceUrl(path)
    if (!url) return NextResponse.json({ error: 'unknown source file' }, { status: 404 })
    return NextResponse.redirect(url)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
