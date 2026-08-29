import { NextResponse } from 'next/server'

import { onThreadEvent, sseResponse } from '@/lib/chat-realtime'
import { partnerChatTarget } from '@/lib/partner-chat'

/**
 * The portal's push signal: a content-free `{type:'ping'}` whenever the
 * supplier's rosie thread changes. Deliberately no preview — the thread's
 * newest message may be the team's internal traffic, which never crosses to
 * the portal; the portal re-fetches the portal-visible half through
 * `/api/partner/:id/chat`, which filters. Public like the rest of the portal.
 */
export const dynamic = 'force-dynamic'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supplierId = Number.parseInt((await params).id, 10)
  const t = Number.isInteger(supplierId) ? await partnerChatTarget(supplierId) : null
  if (!t) return NextResponse.json({ error: 'chat unavailable' }, { status: 404 })
  return sseResponse(req, (send) =>
    onThreadEvent((ev) => {
      if (ev.agent === 'rosie' && ev.threadId === t.threadId) send({ type: 'ping' })
    }),
  )
}
