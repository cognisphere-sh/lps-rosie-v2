import { NextResponse } from 'next/server'

import { AGENTS } from '@/lib/agents'
import { harnessFetch } from '@/lib/harness'
import { PROVIDER_ID, SCHEDULES_PATH } from '@/lib/harness-settings'
import { resolveUser } from '@/lib/session'

/**
 * Allowlisted pass-through to the harness's authenticated admin API
 * (`<harness>/api/*`), for the settings page.
 *
 * Since 2026-08-30 app users are NOT harness users, so there is no cookie to
 * forward: the app authenticates as itself with the `HARNESS_APP_SECRET`
 * bearer and names the signed-in admin in `X-App-User` (`lib/harness.ts`).
 *
 * That bearer is full operator access, which makes the allowlist the whole
 * security boundary — it is no longer backstopped by the caller's own harness
 * permissions, because the caller no longer has any. Two consequences:
 * **admins only** (a partner session must never reach this), and
 * `/api/agents/:id/fs/file` stays pinned to the one file the scheduler table
 * owns — unpinned it would read *and write* anywhere under an agent's
 * directory, handing the browser its prompts, secrets paths and workspace.
 *
 * ponytail: one catch-all instead of eight route files — same shape as
 *   `api/chat/[...path]`.
 */

const AGENT_IDS = new Set(AGENTS.map((a) => a.id))

function allowed(method: string, path: string[], query: URLSearchParams): boolean {
  const p = path.join('/')

  // Harness-wide settings: the timezone the scheduler fires in.
  if (p === 'harness') return method === 'GET'

  // Google sign-in for an agent's gws plugin. The browser reached these
  // through a `next.config.ts` rewrite while it had a harness cookie of its
  // own; now they need the app's bearer, so they come through here. Only the
  // callback is still rewritten — the harness mounts that one outside its auth.
  if (p === 'gws/oauth') return method === 'GET'
  if (path[0] === 'gws' && path[1] === 'oauth' && AGENT_IDS.has(path[2] ?? '')) {
    const rest = path.slice(3).join('/')
    if (rest === '') return method === 'DELETE'
    if (rest === 'start') return method === 'POST'
  }

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

  // `proxy.ts` has already refused partners everything outside /partner, but
  // this route hands out operator access, so it checks the role itself rather
  // than inheriting the guarantee.
  const user = await resolveUser(req.headers.get('cookie') ?? '')
  if (user?.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const headers: Record<string, string> = {}
  const contentType = req.headers.get('content-type')
  if (contentType) headers['content-type'] = contentType

  try {
    const res = await harnessFetch(`/api/${path.join('/')}${url.search}`, user.username, {
      method: req.method,
      headers,
      body: req.method === 'GET' ? undefined : await req.text(),
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
