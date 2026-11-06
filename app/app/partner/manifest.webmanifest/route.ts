import { NextResponse } from 'next/server'

import { partnerPortalName } from '@/lib/portal-branding'
import { partnerManifest } from '@/lib/portal-pwa'

export function GET() {
  return NextResponse.json(partnerManifest(partnerPortalName()), {
    headers: { 'content-type': 'application/manifest+json' },
  })
}
