import { NextResponse } from 'next/server'

import { CHAT_AGENTS } from '@/lib/agents'
import { CanonicalQueueSaturatedError, enqueueCanonical } from '@/lib/chat-canonical-queue'
import { resolveUser } from '@/lib/session'

/**
 * Pass-through to an agent's `webchat` plugin inbox
 * (`<harness>/webhook/<agent>/webchat/api/<action>`) — the internal team's
 * agent chat panels.
 *
 * The supplier portal's chat does not come through here: it uses the plugin's
 * separately authenticated `api/app-*` endpoints (`lib/partner-chat.ts`).
 */
const HARNESS_URL = process.env.HARNESS_URL ?? 'http://127.0.0.1:3142'
export const CHAT_UPSTREAM_TIMEOUT_MS = 25_000
export const THREAD_ID_MAX_CHARS = 160
export const THREAD_ID_MAX_UTF8_BYTES = 256

const ACTIONS = new Set(['messages', 'send', 'upload', 'file', 'reset', 'threads', 'read'])
const ALLOWED_AGENT_IDS = new Set(CHAT_AGENTS.map(({ id }) => id))
const THREAD_ID_SYNTAX = /^(?:main|jr-[1-9]\d*|(?:supplier|customer)-[\p{L}\p{N}]+(?:[._-][\p{L}\p{N}]+)*)$/u
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/u
const utf8 = new TextEncoder()

function harnessHeaders(username: string): Record<string, string> {
  const secret = process.env.HARNESS_APP_SECRET
  if (!secret) throw new Error('HARNESS_APP_SECRET is not set')
  return { authorization: `Bearer ${secret}`, 'x-app-user': username }
}

/** Exact canonical user-facing thread syntax; never repairs or coerces input. */
export function validCanonicalThreadId(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0) return false
  // Reject impossible giant inputs before trim/normalization/UTF-8 allocation.
  if (value.length > THREAD_ID_MAX_CHARS * 2) return false
  if (value !== value.trim() || value !== value.normalize('NFC') || value !== value.toLowerCase()) return false
  if ([...value].length > THREAD_ID_MAX_CHARS || utf8.encode(value).byteLength > THREAD_ID_MAX_UTF8_BYTES) return false
  if (CONTROL_CHARACTERS.test(value)) return false
  return THREAD_ID_SYNTAX.test(value)
}

/** JSON tuple framing is injective even if either component contains separators. */
function canonicalQueueKey(agentId: string, threadId: string): string {
  return JSON.stringify([agentId, threadId])
}

async function forward(req: Request, path: unknown): Promise<Response> {
  // Authentication happens before body parsing, queue reservation, or any
  // upstream fetch. Agent chat is internal-team-only.
  const user = await resolveUser(req.headers.get('cookie') ?? '')
  if (user?.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  if (!Array.isArray(path) || typeof path[0] !== 'string' || typeof path[1] !== 'string') {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }
  const [agentId, action] = path
  if (!ALLOWED_AGENT_IDS.has(agentId) || !ACTIONS.has(action) || path.length !== 2) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  const query = new URL(req.url).search
  const target = `${HARNESS_URL}/webhook/${agentId}/webchat/api/${action}${query}`
  const headers: Record<string, string> = harnessHeaders(user.username)
  for (const h of ['content-type', 'x-file-name']) {
    const v = req.headers.get(h)
    if (v) headers[h] = v
  }

  let body: BodyInit | null | undefined = req.method === 'GET' ? undefined : req.body
  let canonicalKey: string | null = null
  if (req.method === 'POST' && (action === 'send' || action === 'reset')) {
    const text = await req.text()
    body = text
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      return NextResponse.json({ error: 'invalid json' }, { status: 400 })
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return NextResponse.json({ error: 'invalid conversation' }, { status: 400 })
    }
    const threadId = (parsed as Record<string, unknown>).threadId
    if (!validCanonicalThreadId(threadId)) {
      return NextResponse.json({ error: 'invalid conversation' }, { status: 400 })
    }
    canonicalKey = canonicalQueueKey(agentId, threadId)
  }

  const upstream = async () => {
    // Canonical work deliberately outlives a disconnected browser request:
    // once reserved, its upstream ordering must not be undone by unmount.
    const controller = canonicalKey ? new AbortController() : null
    let timer: ReturnType<typeof setTimeout> | null = null
    const request = fetch(target, {
      method: req.method,
      headers,
      body,
      signal: controller?.signal,
      // Streaming an upload body through undici needs this.
      duplex: 'half',
      cache: 'no-store',
    } as RequestInit)
    const timeout = controller
      ? new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            controller.abort()
            const error = new Error('agent request timed out')
            error.name = 'AbortError'
            reject(error)
          }, CHAT_UPSTREAM_TIMEOUT_MS)
        })
      : null
    try {
      const res = await (timeout ? Promise.race([request, timeout]) : request)
      return new Response(res.body, {
        status: res.status,
        headers: {
          'content-type': res.headers.get('content-type') ?? 'application/json',
          ...(res.headers.get('content-disposition')
            ? { 'content-disposition': res.headers.get('content-disposition')! }
            : {}),
        },
      })
    } finally {
      if (timer) clearTimeout(timer)
    }
  }

  try {
    return canonicalKey ? await enqueueCanonical(canonicalKey, upstream) : await upstream()
  } catch (cause) {
    if (cause instanceof CanonicalQueueSaturatedError) {
      return NextResponse.json({ error: 'conversation busy; try again' }, { status: 429 })
    }
    if (cause instanceof Error && cause.name === 'AbortError') {
      return NextResponse.json({ error: 'agent request timed out' }, { status: 504 })
    }
    return NextResponse.json({ error: 'agent unreachable' }, { status: 502 })
  }
}

export async function GET(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  return forward(req, (await params).path)
}

export async function POST(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  return forward(req, (await params).path)
}
