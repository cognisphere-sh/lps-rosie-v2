import { CHAT_AGENTS } from '@/lib/agents'
import { onJobEvent, onThreadEvent, sseResponse } from '@/lib/chat-realtime'

/**
 * Server-sent events for the team's chat surfaces: one `thread` event per
 * change to any chattable agent's `threads` row (new message, read mark,
 * working indicator), plus `jobs` invalidations for saved job data.
 * Internal-session-gated by `proxy.ts` like every other team /api
 * route. The bell updates its rows from the event; an open panel re-polls
 * its thread. See lib/chat-realtime.ts.
 */
export const dynamic = 'force-dynamic'

export function GET(req: Request) {
  const agents = new Set(CHAT_AGENTS.map((a) => a.id))
  return sseResponse(req, (send) => {
    const offThread = onThreadEvent((ev) => {
      if (agents.has(ev.agent)) send(ev)
    })
    const offJob = onJobEvent(send)
    return () => { offThread(); offJob() }
  })
}
