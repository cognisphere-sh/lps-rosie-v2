import { CHAT_AGENTS } from '@/lib/agents'
import { onThreadEvent, sseResponse } from '@/lib/chat-realtime'

/**
 * Server-sent events for the team's chat surfaces: one `thread` event per
 * change to any chattable agent's `threads` row (new message, read mark,
 * working indicator). Session-gated by `proxy.ts` like every other /api
 * route. The bell updates its rows from the event; an open panel re-polls
 * its thread. See lib/chat-realtime.ts.
 */
export const dynamic = 'force-dynamic'

export function GET(req: Request) {
  const agents = new Set(CHAT_AGENTS.map((a) => a.id))
  return sseResponse(req, (send) =>
    onThreadEvent((ev) => {
      if (agents.has(ev.agent)) send(ev)
    }),
  )
}
