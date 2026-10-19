import { NextResponse } from 'next/server'

import { jobChatParties } from '@/lib/job-chat'

/**
 * The tabs of a job's chat: its suppliers and its customer, each with the
 * conversation id the panel opens filtered to this job (`lib/job-chat.ts`).
 * Mints a missing supplier/customer conversation id, so it is a POST.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number.parseInt((await params).id, 10)
  if (!Number.isSafeInteger(id) || id <= 0) return NextResponse.json({ error: 'bad id' }, { status: 400 })
  try {
    const parties = await jobChatParties(id)
    if (!parties) return NextResponse.json({ error: 'not found' }, { status: 404 })
    return NextResponse.json(parties)
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
