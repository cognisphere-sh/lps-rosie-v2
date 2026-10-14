import { NextResponse } from 'next/server'

import { availabilityRequest, createAvailabilityRequest, listAvailabilityRequests, ReopenRequired } from '@/lib/availability-queries'

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
 * Create one availability request from selected lines across one or more jobs.
 * Body: { jobRequestId, supplierId, shareCustomerDetails, itemIds, reopen? }.
 * The job's submitted/processing AR is reopened only with `reopen: true` (LPS
 * confirmed); without it the answer is 409 with `reopen: { id, status }`.
 * `reopened` says the lines joined that AR, now New again.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      jobRequestId?: number
      jobRequestIds?: number[]
      supplierId?: number
      isPublic?: boolean
      shareCustomerDetails?: boolean
      itemIds?: number[]
      reopen?: boolean
    }
    if (
      (!Number.isInteger(body.jobRequestId) && (!Array.isArray(body.jobRequestIds) || !body.jobRequestIds.length || !body.jobRequestIds.every((id) => Number.isSafeInteger(id) && id > 0))) ||
      !Number.isInteger(body.supplierId) ||
      !Array.isArray(body.itemIds) || !body.itemIds.length || !body.itemIds.every((id) => Number.isSafeInteger(id) && id > 0)
    ) {
      return NextResponse.json(
        { error: 'jobRequestId, supplierId and itemIds are required' },
        { status: 400 },
      )
    }
    if (body.jobRequestIds !== undefined && (!Array.isArray(body.jobRequestIds) || !body.jobRequestIds.length || !body.jobRequestIds.every((id) => Number.isSafeInteger(id) && id > 0))) {
      return NextResponse.json({ error: 'jobRequestIds must contain positive integer IDs' }, { status: 400 })
    }
    if (body.isPublic !== undefined && typeof body.isPublic !== 'boolean') {
      return NextResponse.json({ error: 'isPublic must be a boolean' }, { status: 400 })
    }
    if (body.reopen !== undefined && typeof body.reopen !== 'boolean') {
      return NextResponse.json({ error: 'reopen must be a boolean' }, { status: 400 })
    }
    const { id, reopened } = await createAvailabilityRequest({
      jobRequestId: body.jobRequestId,
      jobRequestIds: body.jobRequestIds,
      supplierId: body.supplierId!,
      shareCustomerDetails: !!body.shareCustomerDetails,
      isPublic: body.isPublic,
      itemIds: body.itemIds.filter((n) => Number.isInteger(n)),
      reopen: body.reopen,
    })
    const request = await availabilityRequest(id)
    return NextResponse.json({ id, reopened, publicPath: request?.publicToken ? `/public/availability/${request.publicToken}` : null })
  } catch (e) {
    if (e instanceof ReopenRequired) {
      return NextResponse.json({ error: e.message, reopen: { id: e.arId, status: e.status } }, { status: 409 })
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}
