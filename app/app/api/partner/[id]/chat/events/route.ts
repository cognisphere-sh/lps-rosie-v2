import { NextResponse } from 'next/server'

import { onThreadEvent, sseResponse } from '@/lib/chat-realtime'
import { requirePartnerAccess } from '@/lib/partner-auth'
import { partnerChatTarget } from '@/lib/partner-chat'

/**
 * The portal's push signal: a content-free `{type:'ping'}` whenever the
 * supplier's rosie thread changes. Deliberately no preview — the thread's
 * newest message may be the team's internal traffic, which never crosses to
 * the portal; the portal re-fetches the portal-visible half through
 * `/api/partner/:id/chat`, which filters. Gated like the rest of the portal —
 * even a content-free ping tells you when someone else's thread moves.
 */
export const dynamic = 'force-dynamic'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requirePartnerAccess(req, (await params).id)
  if (!gate.ok) return gate.res
  const t = await partnerChatTarget(gate.supplierId)
  if (!t) return NextResponse.json({ error: 'chat unavailable' }, { status: 404 })
  return sseResponse(req, (send) =>
    onThreadEvent((ev) => {
      if (ev.agent === 'rosie' && ev.threadId === t.threadId) send({ type: 'ping' })
    }),
  )
}
