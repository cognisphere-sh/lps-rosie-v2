import 'server-only'

import { EventEmitter } from 'node:events'

import { supabase } from '@/lib/supabase'

/**
 * The app server's ONE subscription to Supabase Realtime for the chat
 * surfaces, fanned out to browsers over SSE (`/api/chat/events`,
 * `/api/partner/:id/chat/events`).
 *
 * Only the `threads` table is watched: every message bumps its thread's
 * preview by trigger (migration 0078), and read marks and the working
 * indicator are columns on the same row, so one UPDATE per thread change
 * carries everything the bell needs. Message bodies are not pushed — a
 * browser that learns its open thread moved re-polls the plugin for the
 * delta, the same fetch it always made, just no longer on a timer.
 *
 * Browsers cannot subscribe themselves: no key reaches them and app users
 * are not Supabase auth users, so this relay is what keeps the secret key
 * server-side. It uses the existing service client; `service_role` bypasses
 * RLS for postgres_changes as it does for queries.
 *
 * Kept on `globalThis` so dev hot-reloads reuse one channel instead of
 * opening one per reload.
 */
export interface ThreadEvent {
  type: 'thread'
  agent: string
  threadId: string
  lastId: number
  lastAt: number
  lastRole: 'user' | 'agent' | null
  lastSender: string | null
  lastText: string
  webReadId: number
  portalReadId: number
  pending: boolean
  /** Closed with its job request (migration 0080): hidden from picker and bell. */
  closed: boolean
}

export interface ThreadRow {
  agent: string
  thread_id: string
  last_seq: number | null
  last_at: string | null
  last_role: 'user' | 'agent' | null
  last_sender: string | null
  last_text: string | null
  web_read_id: number
  portal_read_id: number
  pending_since: string | null
  closed_at: string | null
}

const KEY = '__lps_chat_realtime'
const g = globalThis as unknown as Record<string, EventEmitter | undefined>

function emitter(): EventEmitter {
  if (g[KEY]) return g[KEY]!
  const em = new EventEmitter()
  em.setMaxListeners(0)
  g[KEY] = em
  supabase
    .channel('lps-threads')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'threads' },
      (payload) => {
        const row = payload.new as Partial<ThreadRow>
        if (!row?.agent || !row.thread_id) return
        const ev: ThreadEvent = {
          type: 'thread',
          agent: row.agent,
          threadId: row.thread_id,
          lastId: row.last_seq ?? 0,
          lastAt: row.last_at ? Date.parse(row.last_at) : 0,
          lastRole: row.last_role ?? null,
          lastSender: row.last_sender ?? null,
          lastText: row.last_text ?? '',
          webReadId: row.web_read_id ?? 0,
          portalReadId: row.portal_read_id ?? 0,
          pending: Boolean(row.pending_since),
          closed: Boolean(row.closed_at),
        }
        em.emit('thread', ev)
      },
    )
    .subscribe((status, err) => {
      if (err) console.error('[chat-realtime]', status, err.message)
    })
  return em
}

/** Listen for thread changes; returns the unsubscribe. */
export function onThreadEvent(listener: (ev: ThreadEvent) => void): () => void {
  const em = emitter()
  em.on('thread', listener)
  return () => em.off('thread', listener)
}

/** An SSE response that streams `events` until the request is aborted. */
export function sseResponse(
  req: Request,
  subscribe: (send: (data: unknown) => void) => () => void,
): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      const send = (data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        } catch {
          /* closed */
        }
      }
      // A comment line every 25s keeps proxies from closing an idle stream.
      const beat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': ping\n\n'))
        } catch {
          /* closed */
        }
      }, 25_000)
      const off = subscribe(send)
      req.signal.addEventListener('abort', () => {
        clearInterval(beat)
        off()
        try {
          controller.close()
        } catch {
          /* already closed */
        }
      })
    },
  })
  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
    },
  })
}
