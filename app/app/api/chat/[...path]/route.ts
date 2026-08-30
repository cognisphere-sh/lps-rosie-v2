import { NextResponse } from 'next/server'

import { agentById } from '@/lib/agents'
import { harnessAuthHeaders } from '@/lib/harness'
import { resolveUser } from '@/lib/session'

/**
 * Pass-through to an agent's `webchat` plugin inbox
 * (`<harness>/webhook/<agent>/webchat/api/<action>`) — the internal team's
 * agent chat panels.
 *
 * The browser can't call the harness directly: it's on another origin with no
 * CORS headers. It also no longer has anything the harness would accept —
 * since 2026-08-30 app users are not harness users — so this route attaches
 * the app's own bearer and names the signed-in admin, and the plugin verifies
 * that pair by forwarding it to `/api/auth/me` exactly as it used to forward
 * the cookie.
 *
 * The supplier portal's chat does NOT come through here: it has no harness
 * identity at all and uses the plugin's `api/app-*` endpoints with
 * `WEBCHAT_APP_SECRET` instead (`lib/partner-chat.ts`).
 *
 * ponytail: one catch-all instead of five route files — every action has the
 *   same shape (forward, return).
 */
const HARNESS_URL = process.env.HARNESS_URL ?? 'http://127.0.0.1:3142'

const ACTIONS = new Set(['messages', 'send', 'upload', 'file', 'reset', 'threads', 'read'])

async function forward(req: Request, path: string[]): Promise<Response> {
  const [agentId, action] = path
  const agent = agentById(agentId ?? '')
  // `reachOn` agents have no webchat plugin to forward to at all.
  if (!agent || agent.upcoming || agent.reachOn || !ACTIONS.has(action ?? '')) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  // Agent chat is the internal team's. A partner reaches their own thread
  // through the portal's `app-*` endpoints, never this one.
  const user = await resolveUser(req.headers.get('cookie') ?? '')
  if (user?.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const query = new URL(req.url).search
  const target = `${HARNESS_URL}/webhook/${agentId}/webchat/api/${action}${query}`

  const headers: Record<string, string> = harnessAuthHeaders(user.username)
  for (const h of ['content-type', 'x-file-name']) {
    const v = req.headers.get(h)
    if (v) headers[h] = v
  }

  try {
    const res = await fetch(target, {
      method: req.method,
      headers,
      body: req.method === 'GET' ? undefined : req.body,
      // Streaming an upload body through undici needs this; without it, a
      // ReadableStream body is rejected outright.
      duplex: 'half',
      cache: 'no-store',
    } as RequestInit)
    return new Response(res.body, {
      status: res.status,
      headers: {
        'content-type': res.headers.get('content-type') ?? 'application/json',
        ...(res.headers.get('content-disposition')
          ? { 'content-disposition': res.headers.get('content-disposition')! }
          : {}),
      },
    })
  } catch {
    // Harness down, or the agent/plugin isn't running — the panel shows this
    // rather than hanging on a poll that never resolves.
    return NextResponse.json({ error: 'agent unreachable' }, { status: 502 })
  }
}

export async function GET(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  return forward(req, (await params).path)
}

export async function POST(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  return forward(req, (await params).path)
}
