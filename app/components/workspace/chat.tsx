'use client'

import Image from 'next/image'
import {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react'
import { MessagesSquare, Pencil, Search, Trash2, X } from 'lucide-react'

import {
  Composer, SizePill, Transcript, useComposer,
  type ChatFile, type ChatMessage,
} from '@/components/workspace/chat-kit'
import { ChevronLeft, ChevronRight } from '@/components/workspace/icons'
import { AGENTS, CHAT_AGENTS, chatBlockedReason } from '@/lib/agents'
import { onOpenChat, onRenameThread, openAvailabilityRequest, openChat, renameThread } from '@/lib/chat-bus'
import { markThreadRead, useChatNotifications } from '@/lib/chat-notifications'
import {
  chatThemeForAgent, chatThemeStyle, chatWallpaperForAgent, chatWallpaperStyle,
  type ChatAppearance,
} from '@/lib/chat-appearance'
import { cn } from '@/lib/utils'

const POLL_MS = 2000
const PAGE = 50
const MIN_W = 280
const STORE = 'lps.chat.v1'

const WORKSPACE_PEEK_W = 240

function fullDesktopChatWidth(peekOpen = false) {
  return Math.max(MIN_W, window.innerWidth - (peekOpen ? WORKSPACE_PEEK_W : 0))
}

function clampDesktopChatWidth(width: number) {
  return Math.min(Math.max(width, MIN_W), fullDesktopChatWidth())
}

// ------------------------------------------------------------------ the chat

/** Everything the panel and the mobile sheet share: transport + composer state. */
function useChat(agentId: string, active: boolean, threadId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const cursor = useRef(0)
  // Oldest id held, so "load earlier" knows where the page it has starts.
  const oldest = useRef(0)
  const threadQ = `&thread=${encodeURIComponent(threadId)}`

  // Switching agents or threads means a different transcript — reset before
  // the next poll.
  useEffect(() => {
    cursor.current = 0
    oldest.current = 0
    setMessages([])
    setPending(false)
    setHasMore(false)
  }, [agentId, threadId])

  const poll = useCallback(async () => {
    // First fetch of a transcript takes only the newest page; every poll after
    // it is a delta, so `limit` would be free to drop a message.
    const first = cursor.current === 0
    try {
      const res = await fetch(
        // `read=1`: this poll only runs while the panel is open on the thread,
        // so it doubles as "the team has seen this" — plugin-side, any device.
        `/api/chat/${agentId}/messages?since=${cursor.current}${first ? `&limit=${PAGE}` : ''}${threadQ}&read=1`,
        { cache: 'no-store' },
      )
      if (!res.ok) throw new Error(String(res.status))
      const body = (await res.json()) as {
        messages: ChatMessage[]; hasMore: boolean; pending: boolean; cursor: number
      }
      if (body.messages.length) {
        setMessages((prev) => [...prev, ...body.messages])
        cursor.current = body.messages[body.messages.length - 1].id
        if (!oldest.current) oldest.current = body.messages[0].id
      }
      if (first) setHasMore(body.hasMore)
      setPending(body.pending)
      setError('')
      // The request above already moved the server cursor; this only clears
      // the dot now instead of at the next threads poll.
      markThreadRead(agentId, threadId, body.cursor)
    } catch {
      setError('Can’t reach the agent.')
    }
  }, [agentId, threadId, threadQ])

  const loadMore = useCallback(async () => {
    if (!oldest.current) return
    setLoadingMore(true)
    try {
      const res = await fetch(
        `/api/chat/${agentId}/messages?before=${oldest.current}&limit=${PAGE}${threadQ}`,
        { cache: 'no-store' },
      )
      if (!res.ok) throw new Error(String(res.status))
      const body = (await res.json()) as { messages: ChatMessage[]; hasMore: boolean }
      if (body.messages.length) {
        setMessages((prev) => [...body.messages, ...prev])
        oldest.current = body.messages[0].id
      }
      setHasMore(body.hasMore)
      setError('')
    } catch {
      setError('Can’t load earlier messages.')
    } finally {
      setLoadingMore(false)
    }
  }, [agentId, threadQ])

  useEffect(() => {
    if (!active) return
    poll()
    const t = setInterval(poll, POLL_MS)
    return () => clearInterval(t)
  }, [active, poll])

  const send = useCallback(
    async (text: string, files: ChatFile[]) => {
      // Optimistic: the poll picks up the canonical row, but the user should
      // see their own message land immediately rather than up to 2s later.
      const optimistic: ChatMessage = { id: -Date.now(), at: Date.now(), role: 'user', text, files }
      setMessages((prev) => [...prev, optimistic])
      setPending(true)
      try {
        const res = await fetch(`/api/chat/${agentId}/send`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ text, attachments: files, threadId }),
        })
        if (!res.ok) throw new Error(String(res.status))
        const { id } = (await res.json()) as { id: number }
        // Adopt the real id so the poll's copy doesn't duplicate this message.
        setMessages((prev) => prev.map((m) => (m.id === optimistic.id ? { ...m, id } : m)))
        cursor.current = Math.max(cursor.current, id)
      } catch {
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
        setPending(false)
        setError('Message failed to send.')
      }
    },
    [agentId, threadId],
  )

  const reset = useCallback(async () => {
    await fetch(`/api/chat/${agentId}/reset`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ threadId }),
    })
    cursor.current = 0
    oldest.current = 0
    setMessages([])
    setPending(false)
    setHasMore(false)
  }, [agentId, threadId])

  return { messages, pending, error, hasMore, loadingMore, send, reset, loadMore, refresh: poll }
}


interface ThreadEntry {
  threadId: string
  title: string
  subtitle: string | null
  lastAt?: number
}

interface ThreadDirectory {
  jobs: ThreadEntry[]
  suppliers: ThreadEntry[]
  customers: ThreadEntry[]
}

const GENERAL_THREADS: ThreadEntry[] = [
  { threadId: 'main', title: 'Main', subtitle: 'Chris & Bhoumik coordination' },
]

/** The agents whose work runs on dedicated threads, so the picker is theirs. */
const THREAD_AGENTS = new Set(['rosie', 'daisy'])

/** `2026-08-23 14:05` → `Aug 23` — the picker's last-activity hint. */
const fmtLastAt = (ms: number) =>
  new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

/**
 * One conversation in the list.
 *
 * Job cards can be renamed from here: the thread is called after its job
 * request, so the pencil writes `job_requests.name` — the same field the Job
 * Requests page edits, through the same whitelisted endpoint. The pencil is a
 * sibling of the card, not a child: a button inside a button is invalid HTML.
 */
function ThreadCard({
  entry, active, unread, at, onPick, onRename,
}: {
  entry: ThreadEntry
  active: boolean
  unread: boolean
  at?: number
  onPick: () => void
  /** Job threads only. Resolves to what went wrong, or null when it landed. */
  onRename?: (name: string) => Promise<string | null>
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const done = useRef(false)

  const commit = async () => {
    if (done.current || !onRename) return
    done.current = true
    const next = draft.trim()
    setEditing(false)
    // An emptied field abandons rather than clearing the job's name: unnaming a
    // job is not what someone reaching for the pencil meant.
    if (!next || next === entry.title) return
    setBusy(true)
    setError((await onRename(next)) ?? '')
    setBusy(false)
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            void commit()
          } else if (e.key === 'Escape') {
            e.preventDefault()
            done.current = true
            setEditing(false)
          }
        }}
        aria-label={`Rename ${entry.title}`}
        className="w-full min-w-0 rounded-xl border border-primary bg-card px-3 py-2 text-[13px] font-semibold text-foreground outline-none"
      />
    )
  }

  return (
    <div className="flex flex-col gap-0.5">
      <div
        className={cn(
          'flex items-center rounded-xl border',
          active ? 'border-primary bg-secondary' : 'border-border bg-card hover:bg-muted',
          busy && 'opacity-50',
        )}
      >
        <button
          type="button"
          onClick={onPick}
          className="flex min-w-0 flex-1 cursor-pointer flex-col gap-px border-none bg-transparent px-3 py-2 text-left"
        >
          <span className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-foreground">
              {entry.title}
            </span>
            {unread && (
              <span className="size-2 flex-none rounded-full bg-[var(--lps-warn-dot)]" aria-label="Unread messages" />
            )}
            {at != null && (
              <span className="flex-none text-[10.5px] text-lps-dim">{fmtLastAt(at)}</span>
            )}
          </span>
          {entry.subtitle && (
            <span className="truncate text-[11px] text-muted-foreground">{entry.subtitle}</span>
          )}
        </button>
        {onRename && (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setDraft(entry.title)
              setError('')
              done.current = false
              setEditing(true)
            }}
            title="Rename this job"
            aria-label={`Rename ${entry.title}`}
            className="mr-2 flex size-6 flex-none cursor-pointer items-center justify-center rounded-md border-none bg-transparent text-muted-foreground opacity-60 hover:bg-muted hover:text-foreground hover:opacity-100"
          >
            <Pencil size={12} />
          </button>
        )}
      </div>
      {error && <span className="px-1 text-[10.5px] text-[#C24C2E]">{error}</span>}
    </div>
  )
}

/**
 * The thread sidebar (#4): the threads the agent is talked to on — main, and
 * then, for rosie, job requests, suppliers and customers, and nothing else
 * (Bhoumik, 2026-08-23); for daisy, the supplier companies she onboards and
 * ingests for. Cards split by category with a search on top. The DB directory
 * supplies the entities; the plugin's transcript list adds last-activity.
 * Working threads outside these categories (router, email and task threads)
 * stay reachable through deep links but are not offered here.
 */
function ThreadPicker({
  agentId, current, onPick, onClose, mobile = false,
}: {
  agentId: string
  current: string
  onPick: (t: { id: string; label: string }) => void
  onClose: () => void
  mobile?: boolean
}) {
  const [dir, setDir] = useState<ThreadDirectory>({ jobs: [], suppliers: [], customers: [] })
  const [lastAt, setLastAt] = useState<Map<string, number>>(new Map())
  const [q, setQ] = useState('')
  const [loaded, setLoaded] = useState(false)
  const { isUnread } = useChatNotifications()

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [dirRes, thrRes] = await Promise.allSettled([
        fetch(`/api/chat-directory?agent=${agentId}`, { cache: 'no-store' }),
        fetch(`/api/chat/${agentId}/threads`, { cache: 'no-store' }),
      ])
      if (cancelled) return
      let directory: ThreadDirectory = { jobs: [], suppliers: [], customers: [] }
      if (dirRes.status === 'fulfilled' && dirRes.value.ok) {
        const body = (await dirRes.value.json()) as ThreadDirectory & { error?: string }
        if (!body.error) directory = body
      }
      setDir(directory)
      if (thrRes.status === 'fulfilled' && thrRes.value.ok) {
        const body = (await thrRes.value.json()) as {
          threads: { threadId: string; lastAt: number }[]
        }
        setLastAt(new Map(body.threads.map((t) => [t.threadId, t.lastAt])))
      }
      setLoaded(true)
    })().catch(() => setLoaded(true))
    return () => {
      cancelled = true
    }
  }, [agentId])

  const needle = q.trim().toLowerCase()
  const matches = (t: ThreadEntry) =>
    !needle ||
    t.title.toLowerCase().includes(needle) ||
    (t.subtitle ?? '').toLowerCase().includes(needle) ||
    t.threadId.toLowerCase().includes(needle)

  /**
   * Rename a job from its card — the write the pencil performs.
   *
   * `jr-<id>` names the row, so the thread's title and the job's name are the
   * same value; this writes it, corrects the list in place rather than
   * refetching the directory, and tells the panel behind the picker.
   */
  const renameJob = async (entry: ThreadEntry, name: string): Promise<string | null> => {
    const id = Number.parseInt(entry.threadId.slice('jr-'.length), 10)
    const res = await fetch('/api/rows', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ table: 'job_requests', id, column: 'name', value: name }),
    }).catch(() => null)
    if (!res?.ok) {
      const body = (await res?.json().catch(() => ({}))) as { error?: string } | undefined
      return body?.error ?? 'Could not rename this job'
    }
    setDir((d) => ({
      ...d,
      jobs: d.jobs.map((j) => (j.threadId === entry.threadId ? { ...j, title: name } : j)),
    }))
    renameThread({ threadId: entry.threadId, label: name })
    return null
  }

  const section = (label: string, entries: ThreadEntry[], renamable = false) => {
    const hits = entries.filter(matches)
    if (!hits.length) return null
    return (
      <div key={label} className="flex flex-col gap-1">
        <span className="px-1 text-[10.5px] font-bold uppercase tracking-[.06em] text-muted-foreground">
          {label}
        </span>
        {hits.map((t) => (
          <ThreadCard
            key={t.threadId}
            entry={t}
            active={t.threadId === current}
            unread={isUnread(agentId, t.threadId)}
            at={t.lastAt ?? lastAt.get(t.threadId)}
            onPick={() => onPick({ id: t.threadId, label: t.title })}
            onRename={renamable ? (name) => renameJob(t, name) : undefined}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-background">
      <div className={cn(
        'flex flex-none items-center gap-2 border-b border-border px-3 pb-2.5',
        mobile ? 'pt-[calc(0.625rem+env(safe-area-inset-top))]' : 'pt-2.5',
      )}>
        <span className="text-[13px] font-bold text-foreground">Conversations</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close thread list"
          className={cn(
            'ml-auto flex cursor-pointer items-center justify-center rounded-full border-none bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
            mobile ? 'size-11' : 'size-7',
          )}
        >
          <X size={14} />
        </button>
      </div>
      <div className="flex flex-none items-center gap-2 border-b border-border px-3 py-2">
        <Search size={13} className="flex-none text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={agentId === 'daisy' ? 'Search suppliers…' : 'Search jobs, suppliers, customers…'}
          autoFocus
          className="min-w-0 flex-1 border-none bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
        />
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
        {section('General', GENERAL_THREADS)}
        {section('Job requests', dir.jobs, true)}
        {section('Suppliers', dir.suppliers)}
        {section('Customers', dir.customers)}
        {loaded &&
          ![...GENERAL_THREADS, ...dir.jobs, ...dir.suppliers, ...dir.customers].some(matches) && (
            <p className="px-1 text-[12px] text-muted-foreground">Nothing matches “{q}”.</p>
          )}
        {!loaded && <p className="px-1 text-[12px] text-muted-foreground">Loading…</p>}
      </div>
    </div>
  )
}

// -------------------------------------------------------------------- panels

/**
 * Desktop: a resizable docked panel, or a 46px rail when hidden.
 * Mobile: a full-screen sheet, opened from the bottom tab bar.
 *
 * Rendered by `shell.tsx`; `mobileOpen` is owned there so the active bottom
 * agent tab can toggle the sheet without a redundant close button.
 */
export function AgentChat({
  isMobile, mobileOpen, mobileAgentId, appearance, onMobileBack, mobileBackLabel = 'Back',
  desktopFull = false, desktopPeekOpen = false,
  onDesktopFull, onDesktopExitFull, onDesktopPeekToggle,
}: {
  isMobile: boolean
  mobileOpen: boolean
  /** Mobile only: which agent the Agents list picked — the sheet has no rail. */
  mobileAgentId?: string
  appearance: ChatAppearance
  /** One step back out of the mobile conversation — the shell decides where. */
  onMobileBack?: () => void
  /** Where the back arrow goes — the shell knows, this only says it. */
  mobileBackLabel?: string
  desktopFull?: boolean
  desktopPeekOpen?: boolean
  /** Coordinates Full chat with the Shell's desktop workspace. */
  onDesktopFull?: () => void
  onDesktopExitFull?: () => void
  onDesktopPeekToggle?: () => void
}) {
  const [agentId, setAgentId] = useState(CHAT_AGENTS[0].id)
  const [open, setOpen] = useState(false)
  const [width, setWidth] = useState(330)
  const [draft, setDraft] = useState('')
  const [menu, setMenu] = useState(false)
  // Which of the agent's threads the panel is on. Every agent defaults to
  // `main`; the picker (rosie, daisy) and open-chat events move it.
  const [thread, setThread] = useState({ id: 'main', label: 'Main' })
  const [picker, setPicker] = useState(false)
  const hydrated = useRef(false)

  const activeId = isMobile ? mobileAgentId ?? CHAT_AGENTS[0].id : agentId
  const agent = useMemo(() => CHAT_AGENTS.find((a) => a.id === activeId) ?? CHAT_AGENTS[0], [activeId])
  const visible = isMobile ? mobileOpen : open
  const chat = useChat(agent.id, visible, thread.id)
  const uploadOne = useCallback(
    async (file: File): Promise<ChatFile> => {
      const res = await fetch(`/api/chat/${agent.id}/upload`, {
        method: 'POST',
        // Header values must be ASCII; the display name travels in the send
        // payload instead, so mangling here is harmless.
        headers: {
          'x-file-name': encodeURIComponent(file.name),
          'content-type': file.type || 'application/octet-stream',
        },
        body: file,
      })
      if (!res.ok) throw new Error(`Couldn’t upload ${file.name}.`)
      const stored = (await res.json()) as { name: string }
      return {
        name: stored.name,
        label: file.name,
        mime: file.type || 'application/octet-stream',
        size: file.size,
      }
    },
    [agent.id],
  )
  const composer = useComposer(uploadOne)
  const { unreadByAgent } = useChatNotifications()

  const fileHref = useCallback(
    (file: ChatFile) => `/api/chat/${agent.id}/file?name=${encodeURIComponent(file.name)}`,
    [agent.id],
  )

  // The buttons the agent writes into a bubble: `thread:` moves this panel,
  // `ar:` opens the availability-request drawer.
  const onMarkdownAction = useCallback(
    (scheme: 'thread' | 'ar', target: string) => {
      if (scheme === 'thread') openChat({ agentId: agent.id, threadId: target })
      else openAvailabilityRequest(Number.parseInt(target, 10))
    },
    [agent.id],
  )

  const emptyState = (
    <>
      <Image src={agent.avatar} alt="" width={56} height={56} className="mx-auto mb-3 rounded-full" />
      {agent.intro}
    </>
  )

  // Deep links from the workspace: a job card's Rosie icon, a supplier or
  // customer chat chip, a `thread:` button in a transcript. The Shell handles
  // the mobile sheet's visibility; the thread itself is set here either way.
  const keepThread = useRef(false)
  useEffect(
    () =>
      onOpenChat(({ agentId: target, threadId, label }) => {
        if (CHAT_AGENTS.some((a) => a.id === target)) {
          keepThread.current = true
          setAgentId(target)
        }
        setThread({ id: threadId, label: label ?? threadId })
        setPicker(false)
        if (!isMobile) setOpen(true)
      }),
    [isMobile],
  )

  // A job renamed anywhere — its card on the Job Requests page, the pencil in
  // the picker — is the same thread this header is naming.
  useEffect(
    () =>
      onRenameThread(({ threadId, label }) =>
        setThread((t) => (t.id === threadId ? { ...t, label } : t)),
      ),
    [],
  )

  // An agent switch from anywhere else (header avatars, rail, the mobile
  // Agents list) lands on that agent's main conversation — a jr thread of
  // rosie's means nothing to daisy.
  useEffect(() => {
    if (keepThread.current) {
      keepThread.current = false
      return
    }
    setThread({ id: 'main', label: 'Main' })
    setPicker(false)
  }, [activeId])

  // Restore the docked panel's state after mount, so the server render and the
  // first client render agree (same guard the table layout uses).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORE)
      const saved = raw
        ? (JSON.parse(raw) as {
            open?: boolean
            width?: number
            agent?: string
            thread?: { agent?: string; id?: string; label?: string }
          })
        : null
      setOpen(saved?.open ?? window.innerWidth >= 1180)
      // `useIsMobile()` begins false until its media-query effect runs. Check
      // the real viewport before restoring desktop-only Shell state, or a
      // saved Full width can zero out the mobile workspace during hydration.
      const desktopViewport = window.matchMedia('(min-width: 900px)').matches
      // Every page mounts its own Shell, so without this the panel would drop
      // back to the first agent on each navigation or refresh.
      const restoredAgent =
        saved?.agent && CHAT_AGENTS.some((a) => a.id === saved.agent) ? saved.agent : agentId
      // …and the thread it was on, so a refresh doesn't drop a job or supplier
      // conversation back to Main. Only for the agent that thread belongs to:
      // on mobile the panel comes back on the Agents list's agent, not the
      // docked one. When the restore also moves the agent, `keepThread` stops
      // the switch reset above from putting the panel back on Main.
      const savedThread = saved?.thread
      if (savedThread?.id && savedThread.agent === (desktopViewport ? restoredAgent : activeId)) {
        keepThread.current = restoredAgent !== agentId
        setThread({ id: savedThread.id, label: savedThread.label ?? savedThread.id })
      }
      if (restoredAgent !== agentId) setAgentId(restoredAgent)
      if (saved?.width) {
        // Migrate the previous Full preset (viewport minus rail + 240px peek)
        // into the new true-Full layout instead of restoring it as an arbitrary
        // wide panel.
        const wasFull = saved.width >= window.innerWidth - 340
        const restored = wasFull ? fullDesktopChatWidth() : clampDesktopChatWidth(saved.width)
        setWidth(restored)
        if (desktopViewport && (wasFull || restored >= fullDesktopChatWidth() - 8)) onDesktopFull?.()
      }
    } catch {
      setOpen(window.innerWidth >= 1180)
    }
    hydrated.current = true
  }, [])

  useEffect(() => {
    if (!hydrated.current) return
    window.localStorage.setItem(
      STORE,
      JSON.stringify({
        open,
        width,
        agent: agentId,
        thread: { agent: activeId, id: thread.id, label: thread.label },
      }),
    )
  }, [open, width, agentId, activeId, thread])

  useEffect(() => {
    if (isMobile) return
    const clamp = () => setWidth((current) => clampDesktopChatWidth(current))
    window.addEventListener('resize', clamp)
    return () => window.removeEventListener('resize', clamp)
  }, [isMobile])

  useEffect(() => {
    if (isMobile || !desktopFull) return
    setWidth(fullDesktopChatWidth(desktopPeekOpen))
  }, [desktopFull, desktopPeekOpen, isMobile])

  useEffect(() => {
    if (!menu) return
    const close = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-chat-menu]')) setMenu(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [menu])

  const send = () => {
    const text = draft.trim()
    if (!text && !composer.files.length) return
    chat.send(text, composer.files)
    setDraft('')
    composer.clear()
  }

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault()
    onDesktopExitFull?.()
    const startX = e.clientX
    const startW = width
    const move = (ev: MouseEvent) => setWidth(clampDesktopChatWidth(startW + (startX - ev.clientX)))
    const up = () => {
      document.removeEventListener('mousemove', move)
      document.removeEventListener('mouseup', up)
    }
    document.addEventListener('mousemove', move)
    document.addEventListener('mouseup', up)
  }

  const header = (big?: boolean) => (
    <div className={cn(
      'flex flex-none items-center gap-2.5',
      big
        ? 'absolute inset-x-3 top-[calc(env(safe-area-inset-top)+0.5rem)] z-30 min-h-14 rounded-[22px] border border-border/50 bg-background/25 px-2 py-2 shadow-lg backdrop-blur-[3px] supports-[backdrop-filter]:bg-background/20'
        : 'border-b border-border px-4 py-3',
    )}>
      {big && onMobileBack && (
        <button
          type="button"
          onClick={onMobileBack}
          aria-label={mobileBackLabel}
          title={mobileBackLabel}
          className="flex size-11 flex-none cursor-pointer items-center justify-center rounded-full border-none bg-transparent text-foreground [filter:drop-shadow(0_1px_1px_rgb(0_0_0/.45))] hover:bg-muted/70"
        >
          <ChevronLeft size={18} />
        </button>
      )}
      <Image
        src={agent.avatar}
        alt=""
        width={30}
        height={30}
        className={cn('flex-none rounded-full object-cover', big ? 'size-9' : 'size-[30px]')}
      />
      {big ? (
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
          <span className="truncate text-[14.5px] font-bold leading-tight [text-shadow:0_1px_1px_rgb(0_0_0/.45)]">{agent.name}</span>
          <span className="inline-flex min-w-0 items-center gap-1.5 text-[11px] leading-tight text-foreground/80 [text-shadow:0_1px_1px_rgb(0_0_0/.45)]">
            <span className="flex-none">{agent.role}</span>
            {thread.id !== 'main' && <span className="truncate">· {thread.label}</span>}
          </span>
        </div>
      ) : (
        <div className="flex min-w-0 flex-1 flex-col gap-px">
          <span className="text-[13.5px] font-bold">{agent.name}</span>
          {thread.id !== 'main' && (
            <span className="truncate text-[11px] text-muted-foreground">{thread.label}</span>
          )}
        </div>
      )}
      {/* The thread list — every conversation this agent can be reached on. */}
      {THREAD_AGENTS.has(agent.id) && (
        <button
          type="button"
          onClick={() => setPicker((v) => !v)}
          title="Conversations"
          aria-label="Open the conversation list"
          className={cn(
            'flex flex-none cursor-pointer items-center justify-center rounded-lg border-none bg-transparent',
            big ? 'size-11 [filter:drop-shadow(0_1px_1px_rgb(0_0_0/.45))]' : 'p-1.5',
            picker ? 'bg-muted/70 text-primary' : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground',
          )}
        >
          <MessagesSquare size={16} />
        </button>
      )}
      {/* The other agents, so the docked panel can switch without being closed
          back to the rail. Mobile switches from its own Agents list instead. */}
      {!big && (
        <div className="flex flex-none items-center gap-1.5">
          {AGENTS.filter((a) => a.id !== agent.id).map((a) => {
            const blocked = chatBlockedReason(a)
            return (
            <button
              key={a.id}
              type="button"
              disabled={!!blocked}
              onClick={() => setAgentId(a.id)}
              aria-label={`Switch to ${a.name}`}
              title={blocked ? `${a.name} · ${blocked}` : `Switch to ${a.name} · ${a.role}`}
              className={cn(
                'flex size-[22px] flex-none border-none bg-transparent p-0',
                blocked ? 'cursor-not-allowed opacity-35' : 'cursor-pointer opacity-55 hover:opacity-100',
              )}
            >
              <span className="relative inline-flex">
                <Image src={a.avatar} alt="" width={22} height={22} className="size-[22px] rounded-full object-cover" />
                {(unreadByAgent[a.id] ?? 0) > 0 && (
                  <span className="absolute -right-px -top-px size-2 rounded-full border border-card bg-[var(--lps-warn-dot)]" aria-label="Unread messages" />
                )}
              </span>
            </button>
            )
          })}
        </div>
      )}
    </div>
  )

  // ------------------------------------------------------------- mobile sheet
  // Overlays the page content only — shell.tsx renders this inside the main
  // column's relative wrapper, so the bottom tab bar stays visible below it.
  if (isMobile) {
    if (!mobileOpen) return null
    return (
      <div
        className="absolute inset-0 z-[70] flex flex-col bg-background"
        style={{
          ...chatThemeStyle(chatThemeForAgent(appearance, agent.id)),
          ...chatWallpaperStyle(chatWallpaperForAgent(appearance, agent.id)),
        }}
      >
        {header(true)}
        {picker && (
          <ThreadPicker
            agentId={agent.id}
            current={thread.id}
            onPick={(t) => { setThread(t); setPicker(false) }}
            onClose={() => setPicker(false)}
            mobile
          />
        )}
        <Transcript
          messages={chat.messages}
          pending={chat.pending}
          error={chat.error}
          hasMore={chat.hasMore}
          loadingMore={chat.loadingMore}
          fileHref={fileHref}
          empty={emptyState}
          pendingLabel={`${agent.name} is working…`}
          suggestions={agent.suggestions}
          onSuggest={setDraft}
          onAction={onMarkdownAction}
          onRefresh={chat.refresh}
          onLoadMore={chat.loadMore}
          mobile
          wallpaper={chatWallpaperForAgent(appearance, agent.id)}
        />
        <Composer composer={composer} onSend={send} draft={draft} setDraft={setDraft} placeholder={`Ask ${agent.name}…`} big />
      </div>
    )
  }

  // ------------------------------------------------------------ desktop rail
  if (!open) {
    return (
      <div className="flex w-[46px] flex-none flex-col items-center gap-3.5 border-l border-border bg-card py-3.5">
        {AGENTS.map((a) => {
          const blocked = chatBlockedReason(a)
          return (
          <button
            key={a.id}
            type="button"
            disabled={!!blocked}
            onClick={() => { setAgentId(a.id); setOpen(true) }}
            aria-label={a.name}
            title={blocked ? `${a.name} · ${blocked}` : `${a.name} · ${a.role}`}
            className={cn(
              'flex flex-col items-center gap-2.5 border-none bg-transparent p-0 text-muted-foreground',
              blocked ? 'cursor-not-allowed opacity-45' : 'cursor-pointer hover:text-foreground',
            )}
          >
            <span className="relative inline-flex">
              <Image src={a.avatar} alt="" width={26} height={26} className="size-[26px] rounded-full object-cover" />
              {a.id === agentId && chat.pending && (
                <span className="absolute -bottom-px -right-px size-2 rounded-full border border-card bg-[var(--lps-warn-dot)]" />
              )}
              {(unreadByAgent[a.id] ?? 0) > 0 && (
                <span className="absolute -right-px -top-px size-2 rounded-full border border-card bg-[var(--lps-warn-dot)]" aria-label="Unread messages" />
              )}
            </span>
            <span className="text-[11px] font-bold uppercase tracking-[.08em] [writing-mode:vertical-rl]">
              {a.name}
            </span>
          </button>
          )
        })}
      </div>
    )
  }

  // ----------------------------------------------------------- docked panel
  return (
    <div
      className="relative flex min-h-0 flex-none flex-col border-l border-border bg-card"
      style={{ width, ...chatThemeStyle(chatThemeForAgent(appearance, agent.id)) }}
    >
      {desktopFull && onDesktopPeekToggle && (
        <button
          type="button"
          onClick={onDesktopPeekToggle}
          title={desktopPeekOpen ? 'Hide supplier search pane' : 'Show supplier search pane'}
          aria-label={desktopPeekOpen ? 'Hide supplier search pane' : 'Show supplier search pane'}
          className="absolute left-0 top-1/2 z-30 flex h-14 w-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-r-xl border border-l-0 border-border bg-card text-primary shadow-[var(--lps-shadow)] hover:bg-muted"
        >
          {desktopPeekOpen ? <ChevronLeft size={15} /> : <ChevronRight size={15} />}
        </button>
      )}
      <div
        onMouseDown={startResize}
        title="Drag to resize"
        className="absolute -left-[3px] bottom-0 top-0 z-20 w-[7px] cursor-col-resize hover:bg-lps-edge"
      />
      {picker && (
        <ThreadPicker
          agentId={agent.id}
          current={thread.id}
          onPick={(t) => { setThread(t); setPicker(false) }}
          onClose={() => setPicker(false)}
        />
      )}
      {header()}

      <div className="flex flex-none items-center gap-1 border-b border-border px-3 py-2">
        {([['Full', () => fullDesktopChatWidth(desktopPeekOpen)], ['50%', () => clampDesktopChatWidth(Math.round(window.innerWidth * 0.5))], ['30%', () => clampDesktopChatWidth(Math.round(window.innerWidth * 0.3))]] as const).map(
          ([label, w]) => (
            <SizePill
              key={label}
              label={label}
              width={width}
              target={w}
              onPick={(next) => {
                if (label === 'Full') onDesktopFull?.()
                else onDesktopExitFull?.()
                setWidth(next)
              }}
            />
          ),
        )}
        <div className="flex-1" />

        <div data-chat-menu className="relative flex-none">
          <button
            type="button"
            onClick={() => setMenu((v) => !v)}
            title="Conversation options"
            aria-label="Conversation options"
            className="flex size-6 cursor-pointer items-center justify-center rounded-[7px] border-none bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            ⋯
          </button>
          {menu && (
            <div className="lps-pop absolute right-0 top-[calc(100%+6px)] z-[96] min-w-[180px] rounded-xl border border-border bg-popover p-1.5 shadow-[var(--lps-shadow)]">
              <button
                type="button"
                onClick={() => { setMenu(false); chat.reset() }}
                className="flex w-full cursor-pointer items-center gap-2 rounded-lg border-none bg-transparent px-2.5 py-[7px] text-left text-[12.5px] font-semibold text-[#C24C2E] hover:bg-lps-warn-bg"
              >
                <Trash2 size={13} />
                Clear conversation
              </button>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            onDesktopExitFull?.()
            setOpen(false)
          }}
          title="Hide panel"
          aria-label="Hide panel"
          className="flex size-6 flex-none cursor-pointer items-center justify-center rounded-[7px] border-none bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <span className="flex size-3.5"><ChevronRight /></span>
        </button>
      </div>

      <Transcript
        messages={chat.messages}
        pending={chat.pending}
        error={chat.error}
        hasMore={chat.hasMore}
        loadingMore={chat.loadingMore}
        fileHref={fileHref}
        empty={emptyState}
        pendingLabel={`${agent.name} is working…`}
        suggestions={agent.suggestions}
        onSuggest={setDraft}
        onAction={onMarkdownAction}
        onRefresh={chat.refresh}
        onLoadMore={chat.loadMore}
        wallpaper={chatWallpaperForAgent(appearance, agent.id)}
      />
      <Composer composer={composer} onSend={send} draft={draft} setDraft={setDraft} placeholder={`Ask ${agent.name}…`} />
    </div>
  )
}
