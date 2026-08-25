import { NextResponse } from 'next/server'

import { AGENTS } from '@/lib/agents'
import { PROVIDER_ID, SCHEDULES_PATH } from '@/lib/harness-settings'

/**
 * Allowlisted pass-through to the harness's authenticated admin API
 * (`<harness>/api/*`), for the settings page.
 *
 * The user's `pi_sid` is forwarded as-is: app users are harness users (that is
 * what `proxy.ts` gates on), so the harness re-checks the very same session it
 * minted. No app-held harness credentials are involved.
 *
 * The allowlist is the security boundary. `/api/agents/:id/fs/file` in
 * particular can read *and write* anywhere under an agent's directory, so it is
 * pinned to the one file the scheduler table owns — an unpinned proxy of it
 * would hand the browser the agent's prompts, secrets paths and workspace.
 *
 * ponytail: one catch-all instead of eight route files — same shape as
 *   `api/chat/[...path]`.
 */
const HARNESS_URL = process.env.HARNESS_URL ?? 'http://127.0.0.1:3142'

const AGENT_IDS = new Set(AGENTS.map((a) => a.id))

function allowed(method: string, path: string[], query: URLSearchParams): boolean {
  const p = path.join('/')

  // Harness-wide settings: the timezone the scheduler fires in.
  if (p === 'harness') return method === 'GET'

  // Global provider config + the OAuth sign-in flow.
  if (p === 'models') return method === 'GET' || method === 'PUT'
  if (p === `models/oauth/${PROVIDER_ID}`) return method === 'DELETE'
  if (p === `models/oauth/${PROVIDER_ID}/status`) return method === 'GET'
  if (p === `models/oauth/${PROVIDER_ID}/login`) return method === 'POST'
  if (p === `models/oauth/${PROVIDER_ID}/input`) return method === 'POST'
  if (p === `models/oauth/${PROVIDER_ID}/cancel`) return method === 'POST'

  // Per-agent: read agent.json, write it back, and the scheduler's state file.
  if (path[0] === 'agents' && AGENT_IDS.has(path[1] ?? '')) {
    const rest = path.slice(2).join('/')
    if (rest === '') return method === 'GET'
    if (rest === 'config') return method === 'PUT'
    if (rest === 'fs/file') {
      return (method === 'GET' || method === 'PUT') && query.get('path') === SCHEDULES_PATH
    }
  }
  return false
}

async function forward(req: Request, path: string[]): Promise<Response> {
  const url = new URL(req.url)
  if (!allowed(req.method, path, url.searchParams)) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  const headers: Record<string, string> = { cookie: req.headers.get('cookie') ?? '' }
  const contentType = req.headers.get('content-type')
  if (contentType) headers['content-type'] = contentType

  try {
    const res = await fetch(`${HARNESS_URL}/api/${path.join('/')}${url.search}`, {
      method: req.method,
      headers,
      body: req.method === 'GET' ? undefined : await req.text(),
      cache: 'no-store',
    })
    return new Response(res.body, {
      status: res.status,
      headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
    })
  } catch {
    return NextResponse.json({ error: 'harness unreachable' }, { status: 502 })
  }
}

type Ctx = { params: Promise<{ path: string[] }> }

export async function GET(req: Request, { params }: Ctx) {
  return forward(req, (await params).path)
}

export async function POST(req: Request, { params }: Ctx) {
  return forward(req, (await params).path)
}

export async function PUT(req: Request, { params }: Ctx) {
  return forward(req, (await params).path)
}

export async function DELETE(req: Request, { params }: Ctx) {
  return forward(req, (await params).path)
}
