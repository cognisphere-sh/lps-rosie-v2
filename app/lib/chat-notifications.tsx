'use client'

import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from 'react'

import { CHAT_AGENTS } from '@/lib/agents'

/**
 * Unread-message tracking for the agent chats.
 *
 * "Read" lives in the webchat plugin (`state/read.json`), not in this browser:
 * every thread carries a `readId`, the newest message id the team has seen,
 * and a thread is unread when `lastId > readId`. Opening a thread is what
 * moves it — the chat panel polls with `read=1` while it's open — so reading
 * on a phone clears the dot on the desktop too. Sending marks your own message
 * read plugin-side, which is why nothing here has to special-case the
 * operator's own panel sends any more.
 *
 * One provider (mounted by the Shell) polls every agent's `api/threads`; the
 * rail avatars, the thread picker, the mobile Agents list and the header bell
 * all read the same context. `markThreadRead` is the optimistic half: the
 * panel calls it after each poll so the dots clear immediately instead of
 * waiting up to `POLL_MS` for the next threads sweep to report the new cursor.
 */

const READ_EVENT = 'lps:chat-read'
const POLL_MS = 15_000

/**
 * Ids marked read locally but not yet reflected by a `api/threads` response —
 * purely a latency shim over the server cursors, dropped on reload.
 */
const localRead = new Map<string, number>()

export interface ChatNotification {
  agentId: string
  threadId: string
  lastId: number
  lastAt: number
  /** Who it's from — the agent's name, or the portal sender. */
  from: string
  lastText: string
}

const keyOf = (agentId: string, threadId: string) => `${agentId}/${threadId}`

/** Note locally that a thread has been seen up to `lastId`; the server already knows. */
export function markThreadRead(agentId: string, threadId: string, lastId: number): void {
  if (!Number.isInteger(lastId) || lastId <= 0) return
  const key = keyOf(agentId, threadId)
  if ((localRead.get(key) ?? 0) >= lastId) return
  localRead.set(key, lastId)
  window.dispatchEvent(new Event(READ_EVENT))
}

interface ThreadRow {
  threadId: string
  lastId: number
  lastAt: number
  lastRole: 'user' | 'agent'
  lastSender?: string
  lastText: string
  /** Newest id the team has seen, from the plugin's read.json. */
  readId: number
}

interface ChatNotificationsValue {
  unread: ChatNotification[]
  unreadByAgent: Record<string, number>
  isUnread: (agentId: string, threadId: string) => boolean
  markAllRead: () => void
}

const Ctx = createContext<ChatNotificationsValue>({
  unread: [],
  unreadByAgent: {},
  isUnread: () => false,
  markAllRead: () => {},
})

export const useChatNotifications = () => useContext(Ctx)

export function ChatNotificationsProvider({ children }: { children: React.ReactNode }) {
  const [rows, setRows] = useState<Record<string, ThreadRow[]>>({})
  const [readVersion, setReadVersion] = useState(0)

  useEffect(() => {
    let cancelled = false
    const poll = async () => {
      const next: Record<string, ThreadRow[]> = {}
      await Promise.all(
        CHAT_AGENTS.map(async (a) => {
          try {
            const res = await fetch(`/api/chat/${a.id}/threads`, { cache: 'no-store' })
            if (!res.ok) return
            const body = (await res.json()) as { threads: ThreadRow[] }
            next[a.id] = body.threads
          } catch {
            /* agent unreachable — keep whatever we last knew */
          }
        }),
      )
      if (!cancelled) setRows((prev) => ({ ...prev, ...next }))
    }
    void poll()
    const t = setInterval(() => void poll(), POLL_MS)
    return () => {
      cancelled = true
      clearInterval(t)
    }
  }, [])

  useEffect(() => {
    const bump = () => setReadVersion((v) => v + 1)
    window.addEventListener(READ_EVENT, bump)
    return () => window.removeEventListener(READ_EVENT, bump)
  }, [])

  const unread = useMemo<ChatNotification[]>(() => {
    void readVersion
    const out: ChatNotification[] = []
    for (const agent of CHAT_AGENTS) {
      for (const t of rows[agent.id] ?? []) {
        const seen = Math.max(t.readId ?? 0, localRead.get(keyOf(agent.id, t.threadId)) ?? 0)
        if (t.lastId <= seen) continue
        out.push({
          agentId: agent.id,
          threadId: t.threadId,
          lastId: t.lastId,
          lastAt: t.lastAt,
          from: t.lastSender ?? agent.name,
          lastText: t.lastText,
        })
      }
    }
    return out.sort((a, b) => b.lastAt - a.lastAt)
  }, [rows, readVersion])

  const unreadByAgent = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const n of unread) counts[n.agentId] = (counts[n.agentId] ?? 0) + 1
    return counts
  }, [unread])

  const isUnread = useCallback(
    (agentId: string, threadId: string) =>
      unread.some((n) => n.agentId === agentId && n.threadId === threadId),
    [unread],
  )

  // The one place that marks threads read without opening them, so it needs
  // the plugin's explicit endpoint rather than a panel poll.
  const markAllRead = useCallback(() => {
    for (const n of unread) {
      markThreadRead(n.agentId, n.threadId, n.lastId)
      void fetch(`/api/chat/${n.agentId}/read`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ threadId: n.threadId, lastId: n.lastId }),
      }).catch(() => {
        /* agent unreachable — the dot comes back on the next threads poll */
      })
    }
  }, [unread])

  const value = useMemo(
    () => ({ unread, unreadByAgent, isUnread, markAllRead }),
    [unread, unreadByAgent, isUnread, markAllRead],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
