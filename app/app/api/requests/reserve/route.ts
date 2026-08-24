import { NextResponse } from 'next/server'

import { reserveJobRequestId } from '@/lib/job-request-queries'

/**
 * Reserve the id of a job request that does not exist yet — the Job Requests
 * page's **New job request** button.
 *
 * Deliberately creates nothing: the row is rosie's to write, from the
 * conversation this id opens (`jr-<id>`). All the app needs is a number no
 * other request will take, so the thread can be named before there is
 * anything to name it after.
 */
export async function POST() {
  try {
    const id = await reserveJobRequestId()
    return NextResponse.json({ id })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
