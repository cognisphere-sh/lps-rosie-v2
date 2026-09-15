import { NextResponse } from 'next/server'

import {
  type JobRequestFilters,
  jobRequestFacets,
  jobRequestSummary,
  listJobRequests,
} from '@/lib/job-request-queries'
import { canonicalRequestStatus, ITEM_STATUSES, REQUEST_STATUSES } from '@/lib/job-requests'

/** Whitelisted: a client never names a status the CHECK would reject anyway. */
function statusList(raw: string | null, allowed: readonly string[]): string[] | undefined {
  if (!raw) return undefined
  const picked = [...new Set(raw.split(',').filter((v) => allowed.includes(v)))]
  return picked.length ? picked : undefined
}

function list(raw: string | null): string[] | undefined {
  if (!raw) return undefined
  const picked = raw.split(',').filter(Boolean)
  return picked.length ? picked : undefined
}

function days(raw: string | null): number | undefined {
  const n = Number.parseInt(raw ?? '', 10)
  return Number.isInteger(n) && n > 0 ? n : undefined
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const search = url.searchParams.get('q') ?? ''

  try {
    // Option lists and the header totals are fetched on their own so the page
    // can hold them steady while the filters change — the same split the photo
    // grid uses.
    if (url.searchParams.get('facets') === '1') {
      const [facets, summary] = await Promise.all([jobRequestFacets(), jobRequestSummary()])
      return NextResponse.json({ facets, summary })
    }

    const rawPage = Number.parseInt(url.searchParams.get('page') ?? '1', 10)
    const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1

    const filters: JobRequestFilters = {
      status: statusList(url.searchParams.get('status')?.split(',').map(canonicalRequestStatus).join(',') ?? null, REQUEST_STATUSES),
      itemStatus: statusList(url.searchParams.get('itemStatus'), ITEM_STATUSES),
      size: list(url.searchParams.get('size')),
      customerId: list(url.searchParams.get('customer'))
        ?.map(Number)
        .filter(Number.isInteger),
      createdWithin: days(url.searchParams.get('created')),
      updatedWithin: days(url.searchParams.get('updated')),
    }

    const { requests, total, pageCount } = await listJobRequests(search, filters, page)
    return NextResponse.json({ requests, total, pageCount, page })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
