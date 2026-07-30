import { NextResponse } from 'next/server'

import { agentById } from '@/lib/agents'

/**
 * Pass-through to an agent's `webchat` plugin inbox
 * (`<harness>/webhook/<agent>/webchat/api/<action>`).
 *
 * The browser can't call the harness directly — it's on another origin with no
 * CORS headers, and the plugin authenticates with the `pi_sid` cookie, which is
 * scoped to this app's domain. So this route forwards the cookie and the body
 * unchanged; `proxy.ts` has already verified the session before we get here,
 * and the plugin verifies it again on its side.
 *
 * ponytail: one catch-all instead of five route files — every action has the
 *   same shape (forward, return).
 */
const HARNESS_URL = process.env.HARNESS_URL ?? 'http://127.0.0.1:3142'

const ACTIONS = new Set(['messages', 'send', 'upload', 'file', 'reset'])

async function forward(req: Request, path: string[]): Promise<Response> {
  const [agentId, action] = path
  if (!agentById(agentId ?? '') || !ACTIONS.has(action ?? '')) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  const query = new URL(req.url).search
  const target = `${HARNESS_URL}/webhook/${agentId}/webchat/api/${action}${query}`

  const headers: Record<string, string> = { cookie: req.headers.get('cookie') ?? '' }
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
