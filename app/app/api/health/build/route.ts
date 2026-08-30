import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export function GET() {
  const buildId = process.env.LPS_RELEASE_BUILD_ID ?? ''
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(buildId)) {
    return NextResponse.json({ error: 'build identity unavailable' }, { status: 503 })
  }
  return NextResponse.json({ buildId }, { headers: { 'Cache-Control': 'no-store' } })
}
