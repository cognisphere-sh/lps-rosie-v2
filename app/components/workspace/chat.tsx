'use client'

import Image from 'next/image'
import {
  useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type MutableRefObject,
} from 'react'
import { Ellipsis, MessagesSquare, Pencil, Search, Trash2, X } from 'lucide-react'

import {
  Composer, SizePill, Transcript, senderInitials, useComposer,
  type ChatFile, type ChatMessage, type MessageIdentity,
} from '@/components/workspace/chat-kit'
import { ChevronLeft, ChevronRight } from '@/components/workspace/icons'
import { AGENTS, CHAT_AGENTS, chatBlockedReason } from '@/lib/agents'
import { onOpenChat, onRenameThread, openAvailabilityRequest, openChat, renameThread } from '@/lib/chat-bus'
import { markThreadRead, useChatNotifications } from '@/lib/chat-notifications'
import { currentPage } from '@/lib/chat-page'
import {
  chatThemeForAgent, chatThemeStyle, chatWallpaperForAgent, chatWallpaperStyle,
  type ChatAppearance,
} from '@/lib/chat-appearance'
import { subscribeEvents } from '@/lib/chat-events'
import { useJobUpdates } from '@/lib/use-job-updates'
import { cn } from '@/lib/utils'

// Fallback cadence only: the transcript is re-fetched the moment
// `/api/chat/events` says this thread moved. The timer still covers the half
// of the working indicator that lives in the harness queue, not the database.
const POLL_MS = 10_000
const SEND_TIMEOUT_MS = 20_000
const RESET_TIMEOUT_MS = 20_000
const PAGE = 50
const MIN_W = 280
const STORE = 'lps.chat.v1'
const JOB_PAGE_CHAT = 'lps.chat.job-page.v1'

const WORKSPACE_PEEK_W = 240

function fullDesktopChatWidth(peekOpen = false) {
  return Math.max(MIN_W, window.innerWidth - (peekOpen ? WORKSPACE_PEEK_W : 0))
}

function clampDesktopChatWidth(width: number) {
  return Math.min(Math.max(width, MIN_W), fullDesktopChatWidth())
}

// ------------------------------------------------------------------ the chat

interface BoundChatDestination {
  agentId: string
  threadId: string
  /** A job's tab on a supplier/customer conversation: only that job's messages. */
  jobId?: number
  /** Changes on every explicit bind, including away-and-back switches. */
  revision: number
}

const sameDestination = (a: BoundChatDestination, b: BoundChatDestination) =>
  a.revision === b.revision && a.agentId === b.agentId && a.threadId === b.threadId && a.jobId === b.jobId

/** What the panel is on; `job` makes a supplier/customer conversation that job's tab. */
interface ChatThread {
  id: string
  label: string
  job?: { id: number; label: string }
}

const jobOfThread = (threadId: string): number | null => {
  const m = /^jr-([1-9]\d*)$/.exec(threadId)
  return m ? Number(m[1]) : null
}

/** The job whose tabs the panel shows: the job thread itself, or the job a party tab belongs to. */
function jobContext(thread: ChatThread): { id: number; label: string } | null {
  const id = jobOfThread(thread.id)
  if (id !== null) return { id, label: thread.label }
  return thread.job ?? null
}

const canonicalDestinationKey = (destination: Pick<BoundChatDestination, 'agentId' | 'threadId'>) =>
  `${destination.agentId}\0${destination.threadId}`

async function boundedFetch(
  input: RequestInfo | URL,
  init: RequestInit,
  controller: AbortController,
  timeoutMs: number,
): Promise<Response> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort()
      reject(new Error('request timed out'))
    }, timeoutMs)
  })
  try {
    return await Promise.race([
      fetch(input, { ...init, signal: controller.signal }),
      timeout,
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/** Canonical plugin ids occur once; optimistic negative ids stay at the tail. */
function mergeCanonicalMessages(existing: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const canonical = new Map<number, ChatMessage>()
  for (const message of existing) if (message.id > 0) canonical.set(message.id, message)
  for (const message of incoming) if (message.id > 0) canonical.set(message.id, message)
  const optimistic = existing.filter((message) => message.id <= 0)
  const incomingOptimistic = incoming.filter((message) => message.id <= 0)
  return [
    ...[...canonical.values()].sort((a, b) => a.id - b.id),
    ...optimistic,
    ...incomingOptimistic,
  ]
}

interface ActiveSendRequest {
  canonicalKey: string
  settled: Promise<void>
}

/** Everything the panel and the mobile sheet share: transport + composer state. */
function useChat(
  committed: BoundChatDestination,
  active: boolean,
  binding: MutableRefObject<BoundChatDestination>,
) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [canonicalResetError, setCanonicalResetError] = useState('')
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [readyRevision, setReadyRevision] = useState<number | null>(null)
  const [lockedCanonicalKeys, setLockedCanonicalKeys] = useState<Set<string>>(() => new Set())
  const cursor = useRef(0)
  const oldest = useRef(0)
  const mounted = useRef(true)
  const generation = useRef(0)
  const pollSequence = useRef(0)
  const loadSequence = useRef(0)
  const outcomeSequence = useRef(0)
  const operationSequence = useRef(0)
  const optimisticSequence = useRef(0)
  const sendRequests = useRef(new Map<number, ActiveSendRequest>())
  const resetLocks = useRef(new Map<string, symbol>())
  const resetErrors = useRef(new Map<string, string>())
  const controllers = useRef(new Set<AbortController>())
  const resetControllers = useRef(new Set<AbortController>())
  const pollRef = useRef<(preserveError?: boolean) => Promise<void>>(async () => {})

  const isCurrent = useCallback(
    (route: BoundChatDestination, scope: number) =>
      mounted.current && generation.current === scope && sameDestination(binding.current, route),
    [binding],
  )

  const beginRequest = useCallback(() => {
    const controller = new AbortController()
    controllers.current.add(controller)
    return controller
  }, [])

  const finishRequest = useCallback((controller: AbortController) => {
    controllers.current.delete(controller)
  }, [])

  const abortRequests = useCallback(() => {
    for (const controller of controllers.current) controller.abort()
    controllers.current.clear()
  }, [])

  const resetClient = useCallback(() => {
    cursor.current = 0
    oldest.current = 0
    pollSequence.current = 0
    loadSequence.current = 0
    outcomeSequence.current = 0
    operationSequence.current = 0
    setMessages([])
    setPending(false)
    setHasMore(false)
    setLoadingMore(false)
    setError('')
  }, [])

  const settleError = useCallback((order: number, value: string) => {
    if (order < outcomeSequence.current) return
    outcomeSequence.current = order
    setError(value)
  }, [])

  // A revision is a new client lifecycle even when agent/thread text is the
  // same (same-route rebind and ABA). Clear the old transcript in layout phase:
  // the browser can never paint a new destination label over old messages.
  useLayoutEffect(() => {
    setReadyRevision(null)
    generation.current += 1
    abortRequests()
    resetClient()
    setCanonicalResetError(resetErrors.current.get(canonicalDestinationKey(committed)) ?? '')
    setReadyRevision(committed.revision)
    return abortRequests
  }, [committed.revision, abortRequests, resetClient])

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      generation.current += 1
      abortRequests()
      for (const controller of resetControllers.current) controller.abort()
      resetControllers.current.clear()
    }
  }, [abortRequests])

  const poll = useCallback(async (preserveError = false) => {
    const route = committed
    if (!sameDestination(binding.current, route)) return
    const scope = generation.current
    const sequence = ++pollSequence.current
    const order = ++operationSequence.current
    const first = cursor.current === 0
    const controller = beginRequest()
    try {
      const res = await fetch(
        `/api/chat/${route.agentId}/messages?since=${cursor.current}${first ? `&limit=${PAGE}` : ''}&thread=${encodeURIComponent(route.threadId)}${route.jobId ? `&job=${route.jobId}` : ''}&read=1`,
        { cache: 'no-store', signal: controller.signal },
      )
      if (!res.ok) throw new Error(String(res.status))
      const body = (await res.json()) as {
        messages: ChatMessage[]; hasMore: boolean; pending: boolean; cursor: number
      }
      if (!isCurrent(route, scope) || sequence !== pollSequence.current) return
      if (body.messages.length) {
        setMessages((prev) => mergeCanonicalMessages(prev, body.messages))
        const positive = body.messages.filter((message) => message.id > 0).map((message) => message.id)
        if (positive.length) {
          cursor.current = Math.max(cursor.current, body.cursor, ...positive)
          if (!oldest.current) oldest.current = Math.min(...positive)
        }
      } else {
        cursor.current = Math.max(cursor.current, body.cursor)
      }
      if (first) setHasMore(body.hasMore)
      // "Working…" is the server's word only: the agent running on this
      // thread. A message just sent, or still queued, is not work yet.
      setPending(body.pending)
      if (!preserveError && !resetErrors.current.has(canonicalDestinationKey(route))) settleError(order, '')
      markThreadRead(route.agentId, route.threadId, body.cursor)
    } catch (cause) {
      if (
        !preserveError && !resetErrors.current.has(canonicalDestinationKey(route)) &&
        !controller.signal.aborted && isCurrent(route, scope) && sequence === pollSequence.current
      ) {
        settleError(order, 'Can’t reach the agent.')
      }
    } finally {
      finishRequest(controller)
    }
  }, [committed, binding, beginRequest, finishRequest, isCurrent, settleError])

  useLayoutEffect(() => { pollRef.current = poll }, [poll])

  const reloadCanonical = useCallback((canonicalKey: string, recoveryError = '') => {
    // The outcome belongs to the canonical conversation even if its request
    // completes while the user is elsewhere. A later bind reads this map.
    if (recoveryError) resetErrors.current.set(canonicalKey, recoveryError)
    else resetErrors.current.delete(canonicalKey)
    if (!mounted.current || canonicalDestinationKey(binding.current) !== canonicalKey) return
    const revision = binding.current.revision
    setReadyRevision(null)
    generation.current += 1
    abortRequests()
    resetClient()
    setCanonicalResetError(recoveryError)
    setReadyRevision(revision)
    // Recovery must never hold the canonical reset lock. The accessible reset
    // error is already visible if this guarded reload is itself slow/offline.
    void pollRef.current(!!recoveryError)
  }, [binding, abortRequests, resetClient])

  const loadMore = useCallback(async () => {
    const route = committed
    if (!sameDestination(binding.current, route) || !oldest.current) return
    const scope = generation.current
    const sequence = ++loadSequence.current
    const order = ++operationSequence.current
    const before = oldest.current
    const controller = beginRequest()
    setLoadingMore(true)
    try {
      const res = await fetch(
        `/api/chat/${route.agentId}/messages?before=${before}&limit=${PAGE}&thread=${encodeURIComponent(route.threadId)}${route.jobId ? `&job=${route.jobId}` : ''}`,
        { cache: 'no-store', signal: controller.signal },
      )
      if (!res.ok) throw new Error(String(res.status))
      const body = (await res.json()) as { messages: ChatMessage[]; hasMore: boolean }
      if (!isCurrent(route, scope) || sequence !== loadSequence.current) return
      if (body.messages.length) {
        setMessages((prev) => mergeCanonicalMessages(prev, body.messages))
        const positive = body.messages.filter((message) => message.id > 0).map((message) => message.id)
        if (positive.length) oldest.current = Math.min(oldest.current || Infinity, ...positive)
      }
      setHasMore(body.hasMore)
      settleError(order, '')
    } catch {
      if (!controller.signal.aborted && isCurrent(route, scope) && sequence === loadSequence.current) {
        settleError(order, 'Can’t load earlier messages.')
      }
    } finally {
      finishRequest(controller)
      if (isCurrent(route, scope) && sequence === loadSequence.current) setLoadingMore(false)
    }
  }, [committed, binding, beginRequest, finishRequest, isCurrent, settleError])

  useEffect(() => {
    if (!active || !sameDestination(binding.current, committed)) return
    void poll()
    const timer = setInterval(() => void poll(), POLL_MS)
    const off = subscribeEvents(
      '/api/chat/events',
      (data) => {
        const event = data as { type?: string; agent?: string; threadId?: string }
        if (event?.type === 'thread' && event.agent === committed.agentId && event.threadId === committed.threadId) {
          void poll()
        }
      },
      () => void poll(),
    )
    return () => {
      clearInterval(timer)
      off()
    }
  }, [active, committed, binding, poll])

  const send = useCallback(async (text: string, files: ChatFile[], toParty = false) => {
    const route = committed
    // This is the transport-side half of the visible commit gate. A stale DOM
    // event cannot post, even if it was queued in the same act as a rebind.
    if (!sameDestination(binding.current, route)) return false
    const scope = generation.current
    const canonicalKey = canonicalDestinationKey(route)
    if (resetLocks.current.has(canonicalKey)) return false
    const order = ++operationSequence.current
    const optimisticId = -(++optimisticSequence.current)
    const optimistic: ChatMessage = {
      id: optimisticId, at: Date.now(), role: 'user', text, files, senderKind: 'lps',
      ...(toParty ? { portal: true } : {}), ...(route.jobId ? { jobRequestId: route.jobId } : {}),
    }
    setMessages((prev) => [...prev, optimistic])
    const controller = beginRequest()
    let settleRequest!: () => void
    const settled = new Promise<void>((resolve) => { settleRequest = resolve })
    sendRequests.current.set(optimisticId, { canonicalKey, settled })
    try {
      const res = await boundedFetch(`/api/chat/${route.agentId}/send`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          text, attachments: files, threadId: route.threadId, page: currentPage(),
          ...(route.jobId ? { jobRequestId: route.jobId } : {}), ...(toParty ? { toParty: true } : {}),
        }),
      }, controller, SEND_TIMEOUT_MS)
      if (!res.ok) throw new Error(String(res.status))
      const { id } = (await res.json()) as { id: number }
      if (!isCurrent(route, scope)) return false
      setMessages((prev) => {
        const withoutOptimistic = prev.filter((message) => message.id !== optimisticId)
        // A poll may have inserted this canonical row before the POST response.
        // Keep that authoritative row; otherwise upsert the optimistic payload.
        return withoutOptimistic.some((message) => message.id === id)
          ? mergeCanonicalMessages(withoutOptimistic, [])
          : mergeCanonicalMessages(withoutOptimistic, [{ ...optimistic, id }])
      })
      cursor.current = Math.max(cursor.current, id)
      settleError(order, '')
      return true
    } catch {
      if (isCurrent(route, scope)) {
          setMessages((prev) => prev.filter((message) => message.id !== optimisticId))
        if (!controller.signal.aborted) settleError(order, 'Message failed to send.')
      }
      return false
    } finally {
      sendRequests.current.delete(optimisticId)
      settleRequest()
      finishRequest(controller)
    }
  }, [committed, binding, beginRequest, finishRequest, isCurrent, settleError])

  const reset = useCallback(async () => {
    const route = committed
    if (!sameDestination(binding.current, route)) return
    const canonicalKey = canonicalDestinationKey(route)
    if (resetLocks.current.has(canonicalKey)) return
    const token = Symbol('canonical-reset')
    resetLocks.current.set(canonicalKey, token)
    resetErrors.current.delete(canonicalKey)
    setCanonicalResetError('')
    setError('')
    setLockedCanonicalKeys((current) => new Set(current).add(canonicalKey))
    let controller: AbortController | null = null
    let recoveryError = ''
    try {
      // The lock is canonical, not revision-scoped: same-route and away/back
      // binds stay blocked. Every send already issued for this destination is
      // bounded and settles before reset is allowed onto the server queue.
      const sends = [...sendRequests.current.values()]
        .filter((request) => request.canonicalKey === canonicalKey)
        .map((request) => request.settled)
      await Promise.allSettled(sends)
      controller = new AbortController()
      resetControllers.current.add(controller)
      const res = await boundedFetch(`/api/chat/${route.agentId}/reset`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ threadId: route.threadId }),
      }, controller, RESET_TIMEOUT_MS)
      if (!res.ok) throw new Error(String(res.status))
    } catch {
      recoveryError = 'Couldn’t clear the conversation. Try again.'
    } finally {
      if (controller) resetControllers.current.delete(controller)
      if (resetLocks.current.get(canonicalKey) === token) resetLocks.current.delete(canonicalKey)
      if (mounted.current) {
        setLockedCanonicalKeys((current) => {
          const next = new Set(current)
          next.delete(canonicalKey)
          return next
        })
        reloadCanonical(canonicalKey, recoveryError)
      }
    }
  }, [committed, binding, reloadCanonical])

  const ready = readyRevision === committed.revision && sameDestination(binding.current, committed)
  const locked = lockedCanonicalKeys.has(canonicalDestinationKey(committed))
  return {
    messages: ready ? messages : [],
    pending: ready ? pending : false,
    error: ready ? canonicalResetError || error : '',
    hasMore: ready ? hasMore : false,
    loadingMore: ready ? loadingMore : false,
    ready,
    locked,
    send, reset, loadMore, refresh: poll,
  }
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

/** Keep a canonical JR identity visible even when the Job also has a name. */
export function chatDestinationLabel(thread: { id: string; label: string }): string {
  const job = /^jr-([1-9]\d*)$/i.exec(thread.id)
  if (!job) return thread.label || thread.id
  const ref = `JR-${job[1]}`
  const label = thread.label.trim()
  return !label || label.toLowerCase() === thread.id.toLowerCase() || label.toLowerCase() === ref.toLowerCase()
    ? ref
    : `${ref} · ${label}`
}

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
          'flex items-center rounded-xl border transition-colors duration-150 ease-lps',
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
              <span className="flex-none text-[11px] text-muted-foreground">{fmtLastAt(at)}</span>
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
      {error && <span className="px-1 text-[11px] text-[var(--lps-tone-red-fg)]">{error}</span>}
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
        <span className="px-1 text-[11px] font-bold uppercase tracking-[.06em] text-muted-foreground">
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
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-3">
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

// ------------------------------------------------------------------ job tabs

/** One of a job's conversations: Rosie's own, or a supplier's/customer's filtered to the job. */
interface JobTab {
  threadId: string
  name: string
  kind: 'agent' | 'supplier' | 'customer'
  /** An LPS Partner: `@Supplier` messages reach their portal. */
  partner: boolean
}

interface JobParties {
  customer: { id: number; name: string; threadId: string } | null
  suppliers: { id: number; name: string; threadId: string; partner: boolean }[]
}

/** The job's suppliers and customer; re-read when job data changes (a new AR adds a tab). */
function useJobTabs(jobId: number | null): JobTab[] {
  const [parties, setParties] = useState<{ jobId: number; value: JobParties } | null>(null)
  const load = useCallback(async () => {
    if (jobId === null) return
    const res = await fetch(`/api/requests/${jobId}/chat-parties`, { method: 'POST', cache: 'no-store' }).catch(() => null)
    if (!res?.ok) return
    const value = (await res.json()) as JobParties
    setParties({ jobId, value })
  }, [jobId])
  useEffect(() => { void load() }, [load])
  useJobUpdates(load, jobId !== null)
  if (jobId === null) return []
  const value = parties?.jobId === jobId ? parties.value : null
  return [
    { threadId: `jr-${jobId}`, name: 'Rosie', kind: 'agent', partner: false },
    ...(value?.suppliers ?? []).map((sup): JobTab => ({ threadId: sup.threadId, name: sup.name, kind: 'supplier', partner: sup.partner })),
    ...(value?.customer ? [{ threadId: value.customer.threadId, name: value.customer.name, kind: 'customer', partner: false } as JobTab] : []),
  ]
}

/**
 * A job's conversations side by side (2026-10-19): Chris and Rosie on the
 * job's thread, and one group per supplier and for the customer — Chris,
 * Rosie and that party — each the party's conversation filtered to this job.
 */
function JobTabs({ tabs, current, avatar, onPick }: {
  tabs: JobTab[]
  current: string
  avatar: string
  onPick: (tab: JobTab) => void
}) {
  const { isUnread } = useChatNotifications()
  return (
    <div role="tablist" aria-label="Job conversations" className="flex flex-none gap-1.5 overflow-x-auto border-b border-border bg-card px-4 py-2">
      {tabs.map((tab) => {
        const active = tab.threadId === current
        return (
          <button
            key={tab.threadId}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onPick(tab)}
            title={tab.kind === 'agent' ? 'You and Rosie' : `You, Rosie and ${tab.name}${tab.kind === 'customer' ? ' (customer)' : tab.partner ? ' (portal)' : ' (email)'}`}
            className={cn(
              'flex max-w-[180px] flex-none cursor-pointer items-center gap-1.5 rounded-full border py-0.5 pl-0.5 pr-2.5 text-[12px] font-semibold transition-colors duration-150 ease-lps',
              active ? 'border-primary bg-secondary text-foreground' : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {tab.kind === 'agent'
              ? <Image src={avatar} alt="" width={20} height={20} className="size-5 flex-none rounded-full object-cover" />
              : <span aria-hidden="true" className="flex size-5 flex-none items-center justify-center rounded-full bg-muted text-[11px] font-bold text-foreground">{senderInitials(tab.name)}</span>}
            <span className="min-w-0 truncate">{tab.name}</span>
            {tab.kind === 'customer' && <span className="flex-none text-[11px] font-normal text-muted-foreground">customer</span>}
            {isUnread('rosie', tab.threadId) && !active && (
              <span className="size-2 flex-none rounded-full bg-[var(--lps-warn-dot)]" aria-label="Unread messages" />
            )}
          </button>
        )
      })}
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
  onDesktopFull, onDesktopExitFull, onDesktopPeekToggle, focusedIntake, focusedJob,
  hideAgentSelector = false,
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
  /** Reuses this exact chat/hook/composer in the purpose-built JR intake surface. */
  focusedIntake?: { id: number; onExit: () => void; savedPanel?: React.ReactNode }
  /** Open the selected job's Rosie conversation in the desktop right panel. */
  focusedJob?: { id: number; name: string | null }
  /** Hide desktop agent switching and the collapsed agent rail. */
  hideAgentSelector?: boolean
}) {
  const initialJob = focusedIntake ?? (!isMobile ? focusedJob : undefined)
  const [agentId, setAgentId] = useState(initialJob ? 'rosie' : CHAT_AGENTS[0].id)
  const [open, setOpen] = useState(Boolean(initialJob))
  const [width, setWidth] = useState(330)
  const [draft, setDraft] = useState('')
  const [menu, setMenu] = useState(false)
  // Which of the agent's threads the panel is on. Every agent defaults to
  // `main`; the picker (rosie, daisy) and open-chat events move it.
  const [thread, setThread] = useState<ChatThread>(() => initialJob
    ? { id: `jr-${initialJob.id}`, label: focusedJob?.name || `JR-${initialJob.id}` }
    : { id: 'main', label: 'Main' })
  const [picker, setPicker] = useState(false)
  const hydrated = useRef(false)
  const autoOpenedJob = useRef<number | null>(null)
  // A mobile chat-bus action updates AgentChat and Shell independently. This
  // exact handoff lets the subsequent mobileAgentId render preserve only the
  // destination produced by that action — never a stale one-bit skip flag.
  const mobileHandoff = useRef<{ agentId: string; destinationRevision: number } | null>(null)
  // Routing is committed here synchronously, before React schedules the panel
  // identity update. Transport reads this exact binding rather than whichever
  // thread the previous render happened to retain.
  const destination = useRef<BoundChatDestination>({
    agentId: initialJob ? 'rosie' : CHAT_AGENTS[0].id,
    threadId: initialJob ? `jr-${initialJob.id}` : 'main',
    revision: 0,
  })
  const [committedDestination, setCommittedDestination] = useState<BoundChatDestination>(destination.current)

  const activeId = focusedIntake ? 'rosie' : agentId
  const agent = useMemo(() => CHAT_AGENTS.find((a) => a.id === activeId) ?? CHAT_AGENTS[0], [activeId])
  const visible = focusedIntake ? true : isMobile ? mobileOpen : open
  const chat = useChat(committedDestination, visible, destination)
  const uploadOne = useCallback(async (file: File, signal: AbortSignal): Promise<ChatFile> => {
    // This callback belongs to the visibly committed agent render. useComposer
    // owns its destination generation and aborts the fetch on every bind; a
    // response from an old generation is discarded even if the server received
    // enough bytes to leave the same orphan upload behavior it already had.
    const res = await fetch(`/api/chat/${agent.id}/upload`, {
      method: 'POST',
      headers: {
        'x-file-name': encodeURIComponent(file.name),
        'content-type': file.type || 'application/octet-stream',
      },
      body: file,
      signal,
    })
    if (!res.ok) throw new Error(`Couldn’t upload ${file.name}.`)
    return (await res.json()) as ChatFile
  }, [agent.id])
  const composer = useComposer(uploadOne)
  const invalidateComposer = composer.invalidate
  const composerGate = useRef<HTMLFieldSetElement>(null)
  const bindDestination = useCallback((nextAgentId: string, nextThread: ChatThread) => {
    // A party conversation opened from a job is that job's tab; the job
    // thread itself needs no filter.
    const jobId = nextThread.job && jobOfThread(nextThread.id) === null ? nextThread.job.id : undefined
    const next: BoundChatDestination = {
      agentId: nextAgentId,
      threadId: nextThread.id,
      ...(jobId ? { jobId } : {}),
      revision: destination.current.revision + 1,
    }
    // Block the mounted controls synchronously; React removes this imperative
    // gate only in the commit that also paints the new canonical identity.
    if (composerGate.current) {
      composerGate.current.disabled = true
      composerGate.current.setAttribute('aria-disabled', 'true')
    }
    invalidateComposer()
    setDraft('')
    destination.current = next
    setAgentId(nextAgentId)
    setThread(nextThread)
    setCommittedDestination(next)
    setPicker(false)
    return next
  }, [invalidateComposer])
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
  // customer chat chip, a `thread:` button in a transcript. Binding is the
  // synchronous routing boundary; page metadata is added only after the exact
  // destination has already been selected.
  useEffect(
    () =>
      onOpenChat(({ agentId: target, threadId, label, job }) => {
        if (!CHAT_AGENTS.some((a) => a.id === target)) return
        const next = bindDestination(target, {
          id: threadId, label: label ?? threadId,
          ...(job ? { job: { id: job.id, label: job.label || `JR-${job.id}` } } : {}),
        })
        // Shell will render the same target agent after its own chat-bus
        // listener opens the mobile page. Preserve this exact revision only if
        // that prop handoff is actually pending.
        mobileHandoff.current = isMobile && mobileAgentId !== target
          ? { agentId: target, destinationRevision: next.revision }
          : null
        if (!isMobile) setOpen(true)
      }),
    [bindDestination, isMobile, mobileAgentId],
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

  // The real mobile Agents page supplies the chosen agent as a prop. A direct
  // list choice always means that agent's Main conversation. A chat-bus action
  // may hand off one exact already-bound thread; consume only that revision.
  useLayoutEffect(() => {
    if (!isMobile || !mobileOpen || !mobileAgentId) return
    const handoff = mobileHandoff.current
    if (
      handoff?.agentId === mobileAgentId &&
      handoff.destinationRevision === destination.current.revision &&
      destination.current.agentId === mobileAgentId
    ) {
      mobileHandoff.current = null
      return
    }
    mobileHandoff.current = null
    bindDestination(mobileAgentId, { id: 'main', label: 'Main' })
  }, [isMobile, mobileOpen, mobileAgentId, bindDestination])

  useLayoutEffect(() => {
    if (isMobile || !window.matchMedia('(min-width: 900px)').matches || !focusedJob) {
      autoOpenedJob.current = null
      return
    }
    const id = `jr-${focusedJob.id}`
    const label = focusedJob.name || `JR-${focusedJob.id}`
    if (autoOpenedJob.current === focusedJob.id) {
      // Refreshes and renames must preserve a deliberately opened supplier or
      // customer conversation, along with its draft and transcript lifecycle.
      if (destination.current.agentId === 'rosie' && destination.current.threadId === id) {
        setThread((current) => current.label === label ? current : { ...current, label })
      } else if (destination.current.jobId === focusedJob.id) {
        setThread((current) => !current.job || current.job.label === label ? current : { ...current, job: { ...current.job, label } })
      }
      return
    }
    autoOpenedJob.current = focusedJob.id
    bindDestination('rosie', { id, label })
    setOpen(true)
    setWidth(330)
    onDesktopExitFull?.()
  }, [focusedJob?.id, focusedJob?.name, isMobile, bindDestination, onDesktopExitFull])

  // Restore the docked panel's state after mount, so the server render and the
  // first client render agree (same guard the table layout uses).
  useEffect(() => {
    if (focusedIntake || (focusedJob && !isMobile && window.matchMedia('(min-width: 900px)').matches)) {
      // Shell remounts for each route. Remember that this page owns the open
      // chat so the next page can close it, whichever conversation was selected.
      window.sessionStorage.setItem(JOB_PAGE_CHAT, '1')
      setOpen(true)
      hydrated.current = true
      return
    }
    const leavingJobPage = window.sessionStorage.getItem(JOB_PAGE_CHAT) === '1'
    window.sessionStorage.removeItem(JOB_PAGE_CHAT)
    try {
      const raw = window.localStorage.getItem(STORE)
      const saved = raw
        ? (JSON.parse(raw) as {
            open?: boolean
            width?: number
            agent?: string
            thread?: { agent?: string; id?: string; label?: string; job?: { id?: number; label?: string } }
          })
        : null
      setOpen(leavingJobPage ? false : saved?.open ?? window.innerWidth >= 1180)
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
      // docked one.
      const savedThread = saved?.thread
      if (savedThread?.id && savedThread.agent === (desktopViewport ? restoredAgent : activeId)) {
        const savedJob = savedThread.job?.id && Number.isSafeInteger(savedThread.job.id)
          ? { job: { id: savedThread.job.id, label: savedThread.job.label || `JR-${savedThread.job.id}` } }
          : {}
        bindDestination(restoredAgent, { id: savedThread.id, label: savedThread.label ?? savedThread.id, ...savedJob })
      } else if (restoredAgent !== agentId) {
        bindDestination(restoredAgent, { id: 'main', label: 'Main' })
      }
      if (saved?.width) {
        // Migrate the previous Full preset (viewport minus rail + 240px peek)
        // into the new true-Full layout instead of restoring it as an arbitrary
        // wide panel.
        const wasFull = saved.width >= window.innerWidth - 340
        const restored = wasFull ? fullDesktopChatWidth() : clampDesktopChatWidth(saved.width)
        setWidth(restored)
        if (!leavingJobPage && desktopViewport && (wasFull || restored >= fullDesktopChatWidth() - 8)) onDesktopFull?.()
      }
    } catch {
      setOpen(!leavingJobPage && window.innerWidth >= 1180)
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
        thread: { agent: activeId, id: thread.id, label: thread.label, ...(thread.job ? { job: thread.job } : {}) },
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

  useEffect(() => {
    if (!focusedIntake) return
    bindDestination('rosie', { id: `jr-${focusedIntake.id}`, label: `JR-${focusedIntake.id}` })
  }, [focusedIntake?.id, bindDestination])

  const destinationCommitted =
    sameDestination(destination.current, committedDestination) && chat.ready && !chat.locked

  // A job's tabs, and which party (if any) the open tab talks with.
  const job = agent.id === 'rosie' ? jobContext(thread) : null
  const jobTabs = useJobTabs(job?.id ?? null)
  const party = job ? jobTabs.find((tab) => tab.threadId === thread.id && tab.kind !== 'agent') ?? null : null
  // In an LPS Partner's tab "@Supplier" goes to their portal (Rosie hears of it
  // silently); everything else typed there is for Rosie.
  const mention = party?.partner ? `@${party.name}` : null
  const addressed = !!mention && draft.trimStart().toLowerCase().startsWith(mention.toLowerCase())
  const typed = draft.trimStart()
  const suggestMention = !!mention && typed.startsWith('@') && !addressed &&
    mention.toLowerCase().startsWith(typed.toLowerCase())

  const send = (files = composer.files) => {
    const text = (addressed ? typed.slice(mention!.length) : draft).trim()
    // Both click and Enter end here. The mounted fieldset is disabled during a
    // bind, and this exact-revision guard rejects even a synthetic stale event.
    if (!destinationCommitted || (!text && !files.length)) return
    void chat.send(text, files, addressed)
    setDraft('')
    composer.clear()
  }

  const placeholder = party
    ? party.partner ? `Message Rosie · @ to write to ${party.name}` : `Message Rosie about ${party.name}`
    : `Ask ${agent.name}…`

  // Who wrote each bubble: the team on the right, Rosie and the outside party
  // on the left. On a supplier's conversation each LPS message also says
  // whether the supplier sees it.
  const supplierThread = agent.id === 'rosie' && thread.id.startsWith('supplier-')
  const identify = useCallback((m: ChatMessage): MessageIdentity => {
    const kind = m.senderKind ?? (m.role === 'agent' ? 'agent' : m.portal ? 'supplier' : 'lps')
    const partyName = party?.name ?? thread.label
    const tags = [
      ...(!committedDestination.jobId && m.jobRequestId && jobOfThread(thread.id) === null ? [`JR-${m.jobRequestId}`] : []),
      ...(supplierThread && kind !== 'supplier' ? [m.portal ? `Sent to ${partyName}` : 'Internal'] : []),
    ]
    const tag = tags.length ? tags.join(' · ') : undefined
    if (kind === 'agent') {
      return { mine: false, name: agent.name, avatar: <Image src={agent.avatar} alt="" width={28} height={28} className="size-7 object-cover" />, tag }
    }
    if (kind === 'lps') return { mine: true, name: m.senderName || 'You', tag }
    return { mine: false, name: m.senderName?.replace(/\s*\(portal\)$/, '') || partyName, tag }
  }, [agent, party?.name, thread.id, thread.label, supplierThread, committedDestination.jobId])

  const pickTab = (tab: JobTab) => {
    if (!job) return
    if (tab.kind === 'agent') bindDestination('rosie', { id: tab.threadId, label: job.label })
    else bindDestination('rosie', { id: tab.threadId, label: tab.name, job })
  }
  const tabStrip = job && jobTabs.length > 1 && (
    <JobTabs tabs={jobTabs} current={thread.id} avatar={agent.avatar} onPick={pickTab} />
  )

  const composerArea = (big: boolean) => (
    <div className="relative flex flex-none flex-col">
      {suggestMention && (
        <div className="lps-pop lps-pop-up absolute bottom-full left-3 z-30 mb-1">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setDraft(`${mention} `)}
            className="flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-popover px-3 py-2 text-left text-[13px] shadow-[var(--lps-shadow)] hover:bg-muted"
          >
            <span className="font-semibold text-foreground">{mention}</span>
            <span className="text-muted-foreground">message the supplier directly</span>
          </button>
        </div>
      )}
      {addressed && (
        <div className="border-t border-border bg-secondary px-3 py-1 text-[11px] text-muted-foreground" aria-live="polite">
          To <span className="font-semibold text-foreground">{party!.name}</span>&apos;s portal · Rosie is told silently
        </div>
      )}
      <Composer composer={composer} onSend={send} draft={draft} setDraft={setDraft} placeholder={placeholder} big={big} disabled={!destinationCommitted} gateRef={composerGate} gateRevision={committedDestination.revision} />
    </div>
  )

  const destinationLabel = job && party ? `${chatDestinationLabel({ id: `jr-${job.id}`, label: job.label })} · ${party.name}` : chatDestinationLabel(thread)

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
        ? 'absolute inset-x-3 top-[calc(env(safe-area-inset-top)+0.5rem)] z-30 min-h-14 rounded-[22px] border border-border/60 bg-background/95 px-2 py-2 shadow-lg backdrop-blur-xl backdrop-saturate-150 supports-[backdrop-filter]:bg-background/85'
        : 'border-b border-border px-4 py-3',
    )}>
      {big && onMobileBack && (
        <button
          type="button"
          onClick={onMobileBack}
          aria-label={mobileBackLabel}
          title={mobileBackLabel}
          className="flex size-11 flex-none cursor-pointer items-center justify-center rounded-full border-none bg-transparent text-foreground hover:bg-muted/70"
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
          <span className="truncate text-[14px] font-bold leading-tight">{agent.name}</span>
          <span className="inline-flex min-w-0 items-center gap-1.5 text-[11px] leading-tight text-foreground/80">
            <span className="flex-none">{agent.role}</span>
            <span className="truncate" aria-live="polite">· {destinationLabel}</span>
          </span>
        </div>
      ) : (
        <div className="flex min-w-0 flex-1 flex-col gap-px">
          <span className="text-[14px] font-bold">{agent.name}</span>
          <span className="truncate text-[11px] text-muted-foreground" aria-live="polite">
            {destinationLabel}
          </span>
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
            big ? 'size-11' : 'p-1.5',
            picker ? 'bg-muted/70 text-primary' : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground',
          )}
        >
          <MessagesSquare size={16} />
        </button>
      )}
      {/* The other agents, so the docked panel can switch without being closed
          back to the rail. Mobile switches from its own Agents list instead. */}
      {!big && !hideAgentSelector && (
        <div className="flex flex-none items-center gap-1.5">
          {AGENTS.filter((a) => a.id !== agent.id).map((a) => {
            const blocked = chatBlockedReason(a)
            return (
            <button
              key={a.id}
              type="button"
              disabled={!!blocked}
              onClick={() => bindDestination(a.id, { id: 'main', label: 'Main' })}
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

  const intakeHeader = focusedIntake && (
    <div className="flex min-h-[60px] flex-none items-center gap-2 border-b border-border bg-card px-2 pt-[env(safe-area-inset-top)] sm:px-3">
      <button type="button" onClick={focusedIntake.onExit} className="flex min-h-11 min-w-11 items-center gap-2 rounded-lg px-2 text-[12px] font-semibold text-primary" aria-label="Exit focused intake">
        <ChevronLeft size={18} /> Exit
      </button>
      <Image src="/rosie.png" alt="" width={30} height={30} className="rounded-full" />
      <div className="min-w-0 flex-1"><div className="truncate text-[14px] font-bold">JR-{focusedIntake.id} · New request with Rosie</div><div className="text-[11px] text-muted-foreground">Only saved record details appear beside this chat</div></div>
    </div>
  )

  if (focusedIntake) {
    const conversation = <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <Transcript onQuestionnaireSubmit={(text) => chat.send(text, [])} messages={chat.messages} pending={chat.pending} error={chat.error} hasMore={chat.hasMore} loadingMore={chat.loadingMore} fileHref={fileHref} empty={emptyState} pendingLabel={`${agent.name} is working…`} suggestions={agent.suggestions} onSuggest={setDraft} onAction={onMarkdownAction} onRefresh={chat.refresh} onLoadMore={chat.loadMore} mobile={isMobile} wallpaper={chatWallpaperForAgent(appearance, agent.id)} identify={identify} />
      <Composer composer={composer} onSend={send} draft={draft} setDraft={setDraft} placeholder="Tell Rosie about the new request…" big={isMobile} disabled={!destinationCommitted} gateRef={composerGate} gateRevision={committedDestination.revision} />
    </div>
    return <div className={cn('flex min-h-0 flex-1 flex-col bg-background', isMobile ? 'absolute inset-0 z-[80]' : 'w-full')} style={{ ...chatThemeStyle(chatThemeForAgent(appearance, agent.id)), ...chatWallpaperStyle(chatWallpaperForAgent(appearance, agent.id)) }}>
      {intakeHeader}
      <div className="flex min-h-0 flex-1 flex-col min-[900px]:flex-row">{conversation}{focusedIntake.savedPanel}</div>
    </div>
  }

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
            onPick={(t) => bindDestination(agent.id, t)}
            onClose={() => setPicker(false)}
            mobile
          />
        )}
        <Transcript onQuestionnaireSubmit={(text) => chat.send(text, [])}
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
          identify={identify}
        />
        {tabStrip}
        {composerArea(true)}
      </div>
    )
  }

  // ------------------------------------------------------------ desktop rail
  if (!open) {
    if (hideAgentSelector) return null
    return (
      <div className="flex w-[46px] flex-none flex-col items-center gap-3.5 border-l border-border bg-card py-3.5">
        {AGENTS.map((a) => {
          const blocked = chatBlockedReason(a)
          return (
          <button
            key={a.id}
            type="button"
            disabled={!!blocked}
            onClick={() => { bindDestination(a.id, { id: 'main', label: 'Main' }); setOpen(true) }}
            aria-label={a.name}
            title={blocked ? `${a.name} · ${blocked}` : `${a.name} · ${a.role}`}
            className={cn(
              'flex flex-col items-center gap-2.5 border-none bg-transparent p-0 text-muted-foreground transition-colors duration-150',
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
          onPick={(t) => bindDestination(agent.id, t)}
          onClose={() => setPicker(false)}
        />
      )}
      {header()}

      <div className="flex flex-none items-center gap-1 border-b border-border px-4 py-2">
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

        {/* A supplier's or customer's conversation is shared by every job and
            the portal, so it cannot be cleared from one tab. */}
        {!(agent.id === 'rosie' && /^(supplier|customer)-/.test(thread.id)) && <div data-chat-menu className="relative flex-none">
          <button
            type="button"
            onClick={() => setMenu((v) => !v)}
            title="Conversation options"
            aria-label="Conversation options"
            className="flex size-6 cursor-pointer items-center justify-center rounded-[7px] border-none bg-transparent text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
          >
            <Ellipsis size={16} aria-hidden="true" />
          </button>
          {menu && (
            <div className="lps-pop lps-pop-down absolute right-0 top-[calc(100%+6px)] z-[96] min-w-[180px] rounded-xl border border-border bg-popover p-1.5 shadow-[var(--lps-shadow)]">
              <button
                type="button"
                onClick={() => { setMenu(false); chat.reset() }}
                className="flex w-full cursor-pointer items-center gap-2 rounded-lg border-none bg-transparent px-2.5 py-[7px] text-left text-[13px] font-semibold text-[var(--lps-tone-red-fg)] transition-colors duration-150 hover:bg-lps-warn-bg"
              >
                <Trash2 size={13} />
                Clear conversation
              </button>
            </div>
          )}
        </div>}

        <button
          type="button"
          onClick={() => {
            onDesktopExitFull?.()
            setOpen(false)
          }}
          title="Hide panel"
          aria-label="Hide panel"
          className="flex size-6 flex-none cursor-pointer items-center justify-center rounded-[7px] border-none bg-transparent text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
        >
          <span className="flex size-3.5"><ChevronRight /></span>
        </button>
      </div>
      {tabStrip}

      <Transcript onQuestionnaireSubmit={(text) => chat.send(text, [])}
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
        identify={identify}
      />
      {composerArea(false)}
    </div>
  )
}
