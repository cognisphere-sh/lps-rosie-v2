import { NextResponse } from 'next/server'

import { JobInboxCapacityError, listJobInbox } from '@/lib/job-inbox-queries'

/** Signed-in admin only via proxy.ts; never mounted under the public portal. */
export async function GET() {
  try {
    return NextResponse.json({ jobs: await listJobInbox() })
  } catch (error) {
    if (error instanceof JobInboxCapacityError) {
      return NextResponse.json(
        { error: error.message, code: 'JOB_INBOX_OVER_CAP' },
        { status: 503 },
      )
    }
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
