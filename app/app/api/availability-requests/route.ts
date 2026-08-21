import { NextResponse } from 'next/server'

import { createAvailabilityRequest, listAvailabilityRequests } from '@/lib/availability-queries'
import { resolveUser } from '@/lib/session'

/** Ids out of `?supplier=1,2,3` — anything non-numeric is simply dropped. */
const idsOf = (raw: string | null): number[] =>
  (raw ?? '')
    .split(',')
    .map((s) => Number.parseInt(s.trim(), 10))
    .filter((n) => Number.isInteger(n))

/**
 * The availability requests of a supplier (all its locations at once) or of
 * one job request — the two lists the admin app draws.
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const supplierIds = idsOf(url.searchParams.get('supplier'))
  const jobRaw = url.searchParams.get('job')
  const jobRequestId = jobRaw ? Number.parseInt(jobRaw, 10) : null

  if (!supplierIds.length && !Number.isInteger(jobRequestId)) {
    return NextResponse.json({ error: 'supplier or job is required' }, { status: 400 })
  }

  try {
    const requests = await listAvailabilityRequests({
      supplierIds: supplierIds.length ? supplierIds : undefined,
      jobRequestId: Number.isInteger(jobRequestId) ? (jobRequestId as number) : undefined,
    })
    return NextResponse.json({ requests })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

/**
 * Create one availability request from a job request's selected lines.
 * Body: { jobRequestId, supplierId, shareCustomerDetails, itemIds }.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      jobRequestId?: number
      supplierId?: number
      shareCustomerDetails?: boolean
      itemIds?: number[]
    }
    if (
      !Number.isInteger(body.jobRequestId) ||
      !Number.isInteger(body.supplierId) ||
      !Array.isArray(body.itemIds)
    ) {
      return NextResponse.json(
        { error: 'jobRequestId, supplierId and itemIds are required' },
        { status: 400 },
      )
    }
    const user = await resolveUser(req.headers.get('cookie') ?? '')
    const id = await createAvailabilityRequest({
      jobRequestId: body.jobRequestId!,
      supplierId: body.supplierId!,
      shareCustomerDetails: !!body.shareCustomerDetails,
      itemIds: body.itemIds.filter((n) => Number.isInteger(n)),
      // The harness username, given its display casing ("chris" → "Chris").
      senderName: user ? user.charAt(0).toUpperCase() + user.slice(1) : null,
    })
    return NextResponse.json({ id })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}
