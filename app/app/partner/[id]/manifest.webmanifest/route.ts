import { NextResponse } from 'next/server'

import { supplierPortalName } from '@/lib/portal-branding-server'
import { partnerManifest } from '@/lib/portal-pwa'

// Public install metadata contains only the same display name as sign-in.
// The .webmanifest extension also keeps browser install checks outside proxy.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id)
  if (!Number.isSafeInteger(id) || id <= 0) return new NextResponse(null, { status: 404 })
  return NextResponse.json(partnerManifest(await supplierPortalName(id), id), {
    headers: { 'content-type': 'application/manifest+json', 'cache-control': 'no-store' },
  })
}
