import { NextResponse } from 'next/server'

import { createDraftAvailabilityRequest } from '@/lib/availability-queries'

const idList = (v: unknown) => Array.isArray(v) && v.every((n) => Number.isSafeInteger(n) && n > 0) ? v as number[] : null

/**
 * Create AR on the job card: a draft for one supplier. Body: `{ supplierId,
 * candidateIds, originalItemIds, shareCustomerDetails }`. Returns `{ id }`.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const jobRequestId = Number.parseInt((await params).id, 10)
  const body = (await req.json().catch(() => ({}))) as {
    supplierId?: unknown; candidateIds?: unknown; originalItemIds?: unknown; shareCustomerDetails?: unknown
  }
  const candidateIds = idList(body.candidateIds ?? [])
  const originalItemIds = idList(body.originalItemIds ?? [])
  if (!Number.isInteger(jobRequestId) || !Number.isSafeInteger(body.supplierId) || !candidateIds || !originalItemIds) {
    return NextResponse.json({ error: 'supplierId, candidateIds and originalItemIds are required' }, { status: 400 })
  }
  try {
    const id = await createDraftAvailabilityRequest(jobRequestId, {
      supplierId: body.supplierId as number, candidateIds, originalItemIds,
      shareCustomerDetails: body.shareCustomerDetails === true,
    })
    return NextResponse.json({ id })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}
