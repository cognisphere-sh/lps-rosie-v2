'use client'

import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from 'react'

import { CHAT_AGENTS } from '@/lib/agents'

/**
 * Unread-message tracking for the agent chats, entirely client-side.
 *
 * The webchat plugin has no per-user read state, so "read" lives in this
 * browser's localStorage: the last message id seen per (agent, thread). A
 * thread is unread when its newest message is newer than that AND wasn't the
 * operator's own panel send — an agent reply and a supplier's portal message
 * both count, quiet threads don't.
 *
 * One provider (mounted by the Shell) polls every agent's `api/threads`; the
 * rail avatars, the thread picker, the mobile Agents list and the header bell
 * all read the same context. Opening a thread marks it read via the chat
 * panel's own poll (`markThreadRead`), which also fires a window event so
 * every dot updates without waiting for the next poll.
 */

const READ_STORE = 'lps.chat.read.v1'
const READ_EVENT = 'lps:chat-read'
const POLL_MS = 15_000

export interface ChatNotification {
  agentId: string
  threadId: string
  lastId: number
  lastAt: number
  /** Who it's from — the agent's name, or the portal sender. */
  from: string
  lastText: string
}

type ReadMap = Record<string, number>

const keyOf = (agentId: string, threadId: string) => `${agentId}/${threadId}`

function readMap(): ReadMap {
  try {
    return JSON.parse(window.localStorage.getItem(READ_STORE) ?? '{}') as ReadMap
  } catch {
    return {}
  }
}

/** Record the newest message id seen on a thread; no-op if nothing is newer. */
export function markThreadRead(agentId: string, threadId: string, lastId: number): void {
  if (!Number.isInteger(lastId) || lastId <= 0) return
  const map = readMap()
  const key = keyOf(agentId, threadId)
  if ((map[key] ?? 0) >= lastId) return
  map[key] = lastId
  try {
    window.localStorage.setItem(READ_STORE, JSON.stringify(map))
  } catch {
    /* storage full or blocked — dots degrade, nothing breaks */
  }
  window.dispatchEvent(new Event(READ_EVENT))
}

interface ThreadRow {
  threadId: string
  lastId: number
  lastAt: number
  lastRole: 'user' | 'agent'
  lastSender?: string
  lastText: string
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
    window.addEventListener('storage', bump) // another tab marked something read
    return () => {
      window.removeEventListener(READ_EVENT, bump)
      window.removeEventListener('storage', bump)
    }
  }, [])

  const unread = useMemo<ChatNotification[]>(() => {
    void readVersion
    if (typeof window === 'undefined') return []
    const map = readMap()
    const out: ChatNotification[] = []
    for (const agent of CHAT_AGENTS) {
      for (const t of rows[agent.id] ?? []) {
        // The operator's own panel sends carry role 'user' and no sender —
        // those never count. Agent replies and portal messages do.
        const notable = t.lastRole === 'agent' || Boolean(t.lastSender)
        if (!notable) continue
        if (t.lastId <= (map[keyOf(agent.id, t.threadId)] ?? 0)) continue
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

  const markAllRead = useCallback(() => {
    for (const n of unread) markThreadRead(n.agentId, n.threadId, n.lastId)
  }, [unread])

  const value = useMemo(
    () => ({ unread, unreadByAgent, isUnread, markAllRead }),
    [unread, unreadByAgent, isUnread, markAllRead],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
