'use client'

import { PartnerRequestCardLayout } from './partner-request-card-layout'

// The supplier portal's chrome — the admin Shell's `WorkspaceFrame`
// (frame.tsx), filled in for a supplier: their identity and three
// destinations instead of the operator's pages, a chat with Local Plant Supply
// instead of the agent panel, a bell of their own. Log out is real since
// supplier sign-in landed (2026-08-30), and so is Settings since 2026-08-30 —
// it is the supplier's own password, the one portal setting they own. See
// docs/app/README.md (Supplier portal).

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bell, Leaf, MessagesSquare, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import {
  Composer, SizePill, Transcript, useComposer,
  type ChatFile, type ChatMessage, type MessageIdentity,
} from '@/components/workspace/chat-kit'
import { ARStatusPill } from '@/components/workspace/availability'
import { WorkspaceFrame, moreItemClass, useIsMobile, useTheme } from '@/components/workspace/frame'
import {
  ArchiveIcon, ChevronRight, FileIcon, LogoutIcon, RequestsIcon, SettingsIcon,
} from '@/components/workspace/icons'
import {
  CHAT_APPEARANCE_STORE,
  DEFAULT_CHAT_APPEARANCE,
  chatThemeForAgent,
  chatThemeStyle,
  chatWallpaperForAgent,
  chatWallpaperStyle,
  isChatTheme,
  readChatWallpapers,
  type ChatAppearance,
  type ChatWallpaperId,
} from '@/lib/chat-appearance'
import type { ARDetail } from '@/lib/availability'
import { currentPage } from '@/lib/chat-page'
import { mergePartnerMessages } from '@/lib/partner-chat-messages'
import { useHistoryView } from '@/lib/history-view'
import { subscribeEvents } from '@/lib/chat-events'
import { redactPartnerRequestRefs } from '@/lib/partner-display'
import { cn } from '@/lib/utils'

// `settings` is reached from the rail's bottom rather than the nav, so it is
// not one of the destinations `nav` draws — but it still owns the highlight.
export type PartnerTab = 'requests' | 'orders' | 'closed' | 'closed-orders' | 'settings'

// ------------------------------------------------------------------ the chat

// Fallback cadences only: `/api/partner/:id/chat/events` pings the moment the
// thread moves, and both hooks re-fetch on it.
const CHAT_POLL_MS = 15_000
const BELL_POLL_MS = 60_000
const CHAT_PAGE = 50
const CHAT_MIN_W = 280
const CHAT_STORE = 'lps.portal.chat.v1'

/** What the portal's file picker offers — the plugin rejects the rest anyway. */
const CHAT_ACCEPT =
  'image/png,image/jpeg,image/gif,image/webp,.pdf,.txt,.csv,.md,.json,.xlsx,.docx,audio/webm,audio/ogg,audio/mpeg,audio/mp4,audio/wav'

const PARTNER_INTRO =
  'Anything at all — availability, substitutes, timing or delivery. Your message goes straight to Local Plant Supply.'

const PARTNER_SUGGESTIONS = [
  'I have an update on availability',
  'Can we change a delivery date?',
  'I can offer a substitute',
]

/**
 * The supplier's chat with Local Plant Supply — the portal-visible half of
 * the supplier's rosie thread. Their messages reach the team; the team's
 * internal traffic on the same thread never reaches here (the plugin only
 * serves portal-visible rows).
 *
 * Transport only: the bubbles, composer, recorder and voice player are the
 * same components the operator's agent panel draws (`chat-kit.tsx`), so both
 * chats gain a feature at once.
 */
export function usePartnerChat(supplierId: number) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [unavailable, setUnavailable] = useState(false)
  const [error, setError] = useState('')
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const cursor = useRef(0)
  // Oldest id held, so "load earlier" knows where the page it has starts.
  const oldest = useRef(0)

  useEffect(() => {
    cursor.current = 0
    oldest.current = 0
    setMessages([])
    setHasMore(false)
  }, [supplierId])

  const poll = useCallback(async () => {
    // First fetch takes only the newest page; every poll after it is a delta,
    // where `limit` would be free to drop a message.
    const first = cursor.current === 0
    try {
      const res = await fetch(
        // `read=1`: this hook is mounted only while the chat is open, so the
        // poll is the supplier's "seen it" — kept plugin-side, not per browser.
        `/api/partner/${supplierId}/chat?since=${cursor.current}${first ? `&limit=${CHAT_PAGE}` : ''}&read=1`,
        { cache: 'no-store' },
      )
      if (res.status === 404) {
        setUnavailable(true)
        return
      }
      if (!res.ok) throw new Error(String(res.status))
      const body = (await res.json()) as {
        messages: ChatMessage[]; hasMore: boolean
      }
      if (body.messages.length) {
        setMessages((prev) => mergePartnerMessages(prev, body.messages))
        cursor.current = Math.max(cursor.current, ...body.messages.map((m) => m.id))
        oldest.current = Math.min(oldest.current || Infinity, ...body.messages.map((m) => m.id))
      }
      if (first) setHasMore(body.hasMore)
      setError('')
    } catch {
      setError('Can’t reach Local Plant Supply right now.')
    }
  }, [supplierId])

  const loadMore = useCallback(async () => {
    if (!oldest.current) return
    setLoadingMore(true)
    try {
      const res = await fetch(
        `/api/partner/${supplierId}/chat?before=${oldest.current}&limit=${CHAT_PAGE}`,
        { cache: 'no-store' },
      )
      if (!res.ok) throw new Error(String(res.status))
      const body = (await res.json()) as { messages: ChatMessage[]; hasMore: boolean }
      if (body.messages.length) {
        setMessages((prev) => mergePartnerMessages(prev, body.messages))
        oldest.current = Math.min(oldest.current || Infinity, ...body.messages.map((m) => m.id))
      }
      setHasMore(body.hasMore)
      setError('')
    } catch {
      setError('Can’t load earlier messages.')
    } finally {
      setLoadingMore(false)
    }
  }, [supplierId])

  useEffect(() => {
    void poll()
    const t = setInterval(() => void poll(), CHAT_POLL_MS)
    const off = subscribeEvents(`/api/partner/${supplierId}/chat/events`, () => void poll(), () => void poll())
    return () => {
      clearInterval(t)
      off()
    }
  }, [poll, supplierId])

  const send = useCallback(
    async (text: string, files: ChatFile[]) => {
      // Optimistic: the poll picks up the canonical row, but the supplier
      // should see their own message land now rather than seconds later.
      const optimistic: ChatMessage = { id: -Date.now(), at: Date.now(), role: 'user', text, files }
      setMessages((prev) => [...prev, optimistic])
      try {
        const res = await fetch(`/api/partner/${supplierId}/chat`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ text, attachments: files, page: currentPage() }),
        })
        if (!res.ok) throw new Error(String(res.status))
        const { id } = (await res.json()) as { id: number }
        // A live poll may already have received the canonical row.
        setMessages((prev) => mergePartnerMessages(
          [{ ...optimistic, id }], prev.filter((m) => m.id !== optimistic.id),
        ))
        // Only reads advance the cursor: a send could otherwise skip replies
        // that were saved just before this message.
        void poll()
        return true
      } catch {
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
        setError('Message failed to send.')
        return false
      }
    },
    [supplierId, poll],
  )

  return { messages, unavailable, error, hasMore, loadingMore, send, loadMore, refresh: poll }
}

const REF_KIND = { order: 'Order', ar: 'AR', job: 'Job' } as const

/**
 * The supplier's side of their one conversation with LPS: their own messages
 * on the right; everything from LPS — Chris or Rosie alike — on the left as
 * Local Plant Supply, with the job each message is about (2026-10-19).
 */
function partnerIdentity(m: ChatMessage): MessageIdentity {
  const mine = m.senderKind ? m.senderKind === 'supplier' : m.role === 'user'
  const tag = m.ref && (
    <span>
      Ref {REF_KIND[m.ref.kind]}:{' '}
      {m.ref.href
        ? <Link href={m.ref.href} className="font-semibold text-primary underline-offset-2 hover:underline">{m.ref.name}</Link>
        : <span className="font-semibold text-foreground">{m.ref.name}</span>}
    </span>
  )
  return mine
    ? { mine, name: m.senderName?.replace(/\s*\(portal\)$/, '') || 'You', tag }
    : { mine, name: 'Local Plant Supply', avatar: <Leaf className="size-4 text-accent-foreground" aria-hidden="true" />, tag }
}

function PartnerChat({
  supplierId,
  mobile = false,
  wallpaper,
}: {
  supplierId: number
  mobile?: boolean
  wallpaper: ChatWallpaperId
}) {
  const chat = usePartnerChat(supplierId)
  const [draft, setDraft] = useState('')

  const uploadOne = useCallback(
    async (file: File): Promise<ChatFile> => {
      const res = await fetch(`/api/partner/${supplierId}/chat?upload=1`, {
        method: 'POST',
        headers: {
          'content-type': file.type || 'application/octet-stream',
          // Header values must be ASCII; the display name travels in the send
          // payload instead, so mangling here is harmless.
          'x-file-name': encodeURIComponent(file.name),
        },
        body: file,
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error || `Upload failed (${res.status})`)
      }
      // The plugin answers with the staged attachment, ticket included.
      return (await res.json()) as ChatFile
    },
    [supplierId],
  )
  const composer = useComposer(uploadOne)

  const fileHref = useCallback(
    (file: ChatFile) => `/api/partner/${supplierId}/chat?file=${encodeURIComponent(file.name)}`,
    [supplierId],
  )

  const send = (files = composer.files) => {
    const text = draft.trim()
    if (!text && !files.length) return
    void chat.send(text, files)
    setDraft('')
    composer.clear()
  }

  if (chat.unavailable) {
    return (
      <div className="flex flex-1 items-center justify-center p-4 text-center text-[13px] text-muted-foreground">
        Chat isn’t switched on for this portal yet.
      </div>
    )
  }

  return (
    <>
      <Transcript onQuestionnaireSubmit={(text) => chat.send(text, [])}
        messages={chat.messages}
        // No "working" indicator for suppliers: a message is first routed to
        // the job it belongs to, and that job's work is LPS's, not theirs.
        pending={false}
        error={chat.error}
        hasMore={chat.hasMore}
        loadingMore={chat.loadingMore}
        fileHref={fileHref}
        empty={
          <>
            <span className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-accent">
              <Leaf className="size-6 text-accent-foreground" />
            </span>
            {PARTNER_INTRO}
          </>
        }
        pendingLabel="Local Plant Supply is working…"
        suggestions={PARTNER_SUGGESTIONS}
        onSuggest={setDraft}
        onRefresh={chat.refresh}
        onLoadMore={chat.loadMore}
        mobile={mobile}
        wallpaper={wallpaper}
        displayText={redactPartnerRequestRefs}
        identify={partnerIdentity}
      />
      <Composer
        composer={composer}
        onSend={send}
        draft={draft}
        setDraft={setDraft}
        // Short on purpose: the panel narrows to 280px, and Chrome wraps a
        // long placeholder onto a second line the one-row composer clips.
        placeholder="Type a message…"
        accept={CHAT_ACCEPT}
        big={mobile}
      />
    </>
  )
}

// ---------------------------------------------------------- notifications

/** One thing worth telling the supplier about, as the bell lists it. */
export interface PartnerAlert {
  /** Kept for opening the request; never shown to the supplier. */
  id: number
  /** The job name, or a generic request label when the request has none. */
  label: string
  /** `createdAt` in ms, for the row's right-hand time. */
  at: number
}

/** `14:05` today, `Aug 23` before that — the same shape the admin bell uses. */
function fmtAlertAt(ms: number): string {
  const d = new Date(ms)
  return Date.now() - ms < 86_400_000
    ? d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/**
 * The bell — the supplier's twin of the admin Shell's, and the same popover
 * design. Two sources: availability requests still sitting at `new`, and a
 * reply from Local Plant Supply the supplier hasn't opened the chat on. Both
 * clear by being acted on, so there is no "mark all read".
 *
 * `mobile` is the Shell's own second shape: a bottom-bar slot with the icon
 * over an *Alerts* label, its popover opening upward from the left edge. The
 * portal used to keep the bell in the header on both breakpoints; since
 * 2026-08-26 there is no header on mobile, so it lives where the Shell's does.
 */
function PartnerNotificationBell({
  requests, chat, onOpenRequest, onOpenChat, mobile = false,
}: {
  requests: PartnerAlert[]
  chat: { at: number; text: string } | null
  onOpenRequest?: (id: number) => void
  onOpenChat: () => void
  mobile?: boolean
}) {
  const [open, setOpen] = useState(false)
  const count = requests.length + (chat ? 1 : 0)

  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent) => {
      if (!(event.target as HTMLElement).closest('[data-portal-bell]')) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div data-portal-bell className={cn('relative flex-none', mobile && 'w-[52px]')}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Notifications"
        aria-label={count ? `Notifications — ${count} new` : 'Notifications'}
        aria-expanded={open}
        className={cn(
          'cursor-pointer border-none bg-transparent text-muted-foreground transition-colors duration-150 ease-lps hover:bg-muted hover:text-foreground',
          mobile
            ? 'flex w-full flex-col items-center gap-1 rounded-[10px] px-0.5 py-1.5'
            : 'relative flex size-11 items-center justify-center rounded-full',
          open && mobile && 'text-primary',
        )}
      >
        <span className={cn('relative flex items-center justify-center', mobile && 'h-6 w-[18px]')}>
          <Bell size={16} />
          {count > 0 && (
            <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--lps-warn-dot)] px-0.5 text-[11px] font-bold leading-none text-[var(--lps-warn-on-dot)]">
              {count > 9 ? '9+' : count}
            </span>
          )}
        </span>
        {mobile && <span className="text-[11px] font-semibold">Alerts</span>}
      </button>

      {open && (
        <div
          className={cn(
            'lps-pop absolute z-[96] flex max-h-[70vh] flex-col overflow-hidden rounded-xl border border-border bg-popover shadow-[var(--lps-shadow)]',
            mobile
              ? 'lps-pop-up bottom-[calc(100%+6px)] left-0 w-[min(320px,calc(100vw-16px))]'
              : 'lps-pop-down right-0 top-[calc(100%+6px)] w-[min(320px,calc(100vw-24px))]',
          )}
        >
          <div className="flex flex-none items-center gap-2 border-b border-border px-3 py-2">
            <span className="text-[13px] font-bold text-foreground">Notifications</span>
          </div>
          <div className="flex min-h-0 flex-col overflow-y-auto p-1.5">
            {count === 0 && (
              <p className="m-0 px-2 py-3 text-center text-[12px] text-muted-foreground">
                You’re all caught up.
              </p>
            )}

            {chat && (
              <button
                type="button"
                onClick={() => { setOpen(false); onOpenChat() }}
                className="flex w-full cursor-pointer items-start gap-2.5 rounded-lg border-none bg-transparent px-2 py-2 text-left transition-colors duration-150 ease-lps hover:bg-muted"
              >
                <span className="mt-0.5 flex size-[26px] flex-none items-center justify-center rounded-full bg-accent">
                  <Leaf className="size-3.5 text-accent-foreground" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-1.5">
                    <span className="truncate text-[13px] font-bold text-foreground">Local Plant Supply</span>
                    <span className="ml-auto flex-none text-[11px] text-lps-dim">{fmtAlertAt(chat.at)}</span>
                  </span>
                  <span className="block truncate text-[12px] text-muted-foreground">
                    {chat.text || 'Sent an attachment'}
                  </span>
                </span>
              </button>
            )}

            {requests.map((alert) => (
              <button
                key={alert.id}
                type="button"
                onClick={() => { setOpen(false); onOpenRequest?.(alert.id) }}
                className="flex w-full cursor-pointer items-start gap-2.5 rounded-lg border-none bg-transparent px-2 py-2 text-left transition-colors duration-150 ease-lps hover:bg-muted"
              >
                <span className="mt-0.5 flex size-[26px] flex-none items-center justify-center rounded-full bg-secondary text-primary">
                  <span className="flex size-3.5"><RequestsIcon /></span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-1.5">
                    <span className="truncate text-[13px] font-bold text-foreground">{alert.label}</span>
                    <span className="ml-auto flex-none text-[11px] text-lps-dim">{fmtAlertAt(alert.at)}</span>
                  </span>
                  <span className="block truncate text-[12px] text-muted-foreground">
                    New availability request — needs your answer.
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------- the request card

/** What a request reads as when it has no job name of its own. */
export const partnerRequestName = (r: ARDetail) =>
  r.recordName || (r.jobName ? redactPartnerRequestRefs(r.jobName) : 'Availability request')

/** Its customer, where the request shares one. */
export const partnerCustomerLabel = (r: ARDetail) =>
  r.customer ? r.customer.company || r.customer.name : null

/**
 * One availability request as both portal lists draw it — the open ones under
 * their four tabs, and the closed ones on their own page.
 *
 * The card the request had when it expanded in place, less the chevron: it was
 * the toggle, and there is nothing to toggle any more — the whole card is the
 * link to the request's own page. Its gutter went with it, so the customer line
 * and the count strip sit flush under the name.
 */
export function PartnerRequestCard({
  request,
  href,
}: {
  request: ARDetail
  href: string
}) {
  return <PartnerRequestCardLayout request={request} href={href} name={partnerRequestName(request)} status={<ARStatusPill status={request.status} />} />
}

// ------------------------------------------------------------------- frame

export function PartnerFrame({
  supplierId,
  supplierName,
  tab,
  title,
  toolbar,
  headerAction,
  hideHeaderOnDesktop = false,
  alerts = [],
  onOpenAlert,
  onAgentReply,
  children,
}: {
  supplierId: number
  /** Null while loading — the frame draws before the fetch answers. */
  supplierName: string | null
  tab: PartnerTab
  /** The header's page name, in the admin Shell's serif line. */
  title: string
  /** A render slot keeps the PartnerFrame-owned bell in the route's existing toolbar. */
  toolbar?: React.ReactNode | ((rightActions: React.ReactNode) => React.ReactNode)
  headerAction?: React.ReactNode
  hideHeaderOnDesktop?: boolean
  /** Availability requests still at `new`, as the bell lists them. */
  alerts?: PartnerAlert[]
  onOpenAlert?: (id: number) => void
  /**
   * A new reply from Local Plant Supply landed — read or not. Rosie writes a
   * chat-given answer into the request herself (`supplier-coordination`
   * §3.6), so the page under the chat reloads on it rather than showing the
   * table as it was before she answered.
   */
  onAgentReply?: () => void
  children: React.ReactNode
}) {
  const isMobile = useIsMobile()
  const theme = useTheme()
  const router = useRouter()
  // Drop the `app_sid` cookie and go back to the shared sign-in page. Same
  // route the admin Shell uses — there is one session kind now.
  const signOut = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } finally {
      router.push('/login')
      router.refresh()
    }
  }
  // The frame owns the rail; the chat's Full width is what is left beside it.
  const [navOpen, setNavOpen] = useState(false)
  // The chat with Local Plant Supply, opened from the right-hand rail
  // (desktop) or its bottom tab (mobile) — the portal's sibling of the admin
  // agent panel. On mobile it takes the whole column, so it is a page rather
  // than an overlay: a history entry Back pops, instead of leaving the portal.
  const [desktopChatOpen, setDesktopChatOpen] = useState(false)
  const mobileChatView = useHistoryView<'chat'>()
  const chatOpen = isMobile ? mobileChatView.view === 'chat' : desktopChatOpen
  const openChatPanel = () => (isMobile ? mobileChatView.open('chat') : setDesktopChatOpen(true))
  const closeChatPanel = () => (isMobile ? mobileChatView.back() : setDesktopChatOpen(false))
  const [chatWidth, setChatWidth] = useState(340)
  const chatHydrated = useRef(false)
  const [chatAppearance, setChatAppearance] = useState<ChatAppearance>(DEFAULT_CHAT_APPEARANCE)
  const [chatAlert, setChatAlert] = useState<{ at: number; text: string } | null>(null)
  // The newest agent reply the peek poll below has seen, so it can tell a
  // fresh one from last time's. Null until the first tick, which only
  // records — the reply already on screen at load is not news.
  const lastAgentId = useRef<number | null>(null)
  const onAgentReplyRef = useRef(onAgentReply)
  useEffect(() => { onAgentReplyRef.current = onAgentReply }, [onAgentReply])

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(CHAT_APPEARANCE_STORE) ?? 'null') as
        | {
            themes?: Partial<Record<'daisy' | 'rosie' | 'nova', unknown>>
            wallpapers?: Partial<Record<'daisy' | 'rosie' | 'nova', unknown>>
            wallpaper?: unknown
          }
        | null
      if (!saved) return
      const themes = { ...DEFAULT_CHAT_APPEARANCE.themes }
      for (const id of ['daisy', 'rosie', 'nova'] as const) {
        if (isChatTheme(saved.themes?.[id])) themes[id] = saved.themes[id]
      }
      setChatAppearance({ themes, wallpapers: readChatWallpapers(saved) })
    } catch {
      // Malformed local appearance data falls back to the shared defaults.
    }
  }, [])

  // Unread replies for the bell. The chat panel is closed by default, so
  // without this poll a supplier would never learn the team answered. Reading
  // one message is enough: `readId` says what has been seen either way.
  //
  // Deliberately no `read=1` here: this poll is the one that runs while the
  // panel is CLOSED, so marking on it would clear the alert unseen.
  useEffect(() => {
    if (!Number.isInteger(supplierId)) return
    let alive = true
    const tick = async () => {
      try {
        const res = await fetch(`/api/partner/${supplierId}/chat?since=0&limit=1`, { cache: 'no-store' })
        if (!res.ok || !alive) return
        const body = (await res.json()) as {
          messages: { id: number; at: number; role: string; text: string }[]
          readId: number
        }
        if (!alive) return
        const last = body.messages[body.messages.length - 1]
        if (last?.role === 'agent') {
          if (lastAgentId.current != null && last.id > lastAgentId.current) onAgentReplyRef.current?.()
          lastAgentId.current = last.id
        } else if (lastAgentId.current == null) {
          lastAgentId.current = 0
        }
        setChatAlert(
          last && last.role === 'agent' && last.id > (body.readId ?? 0)
            ? { at: last.at, text: redactPartnerRequestRefs(last.text) }
            : null,
        )
      } catch {
        // Offline or chat not wired — the bell simply doesn't update.
      }
    }
    void tick()
    const t = setInterval(() => void tick(), BELL_POLL_MS)
    const off = subscribeEvents(`/api/partner/${supplierId}/chat/events`, () => void tick(), () => void tick())
    return () => { alive = false; clearInterval(t); off() }
  }, [supplierId])

  // Opening the panel is what marks the conversation read.
  useEffect(() => {
    if (chatOpen) setChatAlert(null)
  }, [chatOpen])

  // Full is the viewport minus the nav rail — the portal has no workspace to
  // fold away, so the rail stays put and the chat takes everything else.
  const fullChatWidth = useCallback(
    () => Math.max(CHAT_MIN_W, window.innerWidth - (navOpen ? 232 : 56)),
    [navOpen],
  )
  const clampChatWidth = useCallback(
    (width: number) => Math.min(Math.max(width, CHAT_MIN_W), fullChatWidth()),
    [fullChatWidth],
  )

  // Restore after mount, so the server render and the first client render
  // agree — the same guard the operator's panel uses.
  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(CHAT_STORE) ?? 'null') as
        | { open?: boolean; width?: number }
        | null
      if (saved?.open) setDesktopChatOpen(true)
      if (saved?.width) setChatWidth(clampChatWidth(saved.width))
    } catch {
      // Malformed local panel state just leaves the defaults in place.
    }
    chatHydrated.current = true
    // Restoring once on mount; a later nav-rail toggle must not reopen it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!chatHydrated.current) return
    // The remembered panel is the desktop one; on mobile the chat is a page
    // you navigate to, so it opens closed and Back closes it.
    window.localStorage.setItem(CHAT_STORE, JSON.stringify({ open: desktopChatOpen, width: chatWidth }))
  }, [desktopChatOpen, chatWidth])

  useEffect(() => {
    if (isMobile) return
    const clamp = () => setChatWidth((current) => clampChatWidth(current))
    window.addEventListener('resize', clamp)
    return () => window.removeEventListener('resize', clamp)
  }, [isMobile, clampChatWidth])

  const startChatResize = (event: React.MouseEvent) => {
    event.preventDefault()
    const startX = event.clientX
    const startW = chatWidth
    const move = (moved: MouseEvent) => setChatWidth(clampChatWidth(startW + (startX - moved.clientX)))
    const up = () => {
      document.removeEventListener('mousemove', move)
      document.removeEventListener('mouseup', up)
    }
    document.addEventListener('mousemove', move)
    document.addEventListener('mouseup', up)
  }

  const chatHeader = (floating = false) => (
    <div
      className={cn(
        'flex flex-none items-center gap-2.5',
        floating
          ? 'absolute inset-x-3 top-[calc(env(safe-area-inset-top)+0.5rem)] z-30 min-h-14 rounded-[22px] border border-border/70 bg-background/45 px-2 py-2 shadow-lg backdrop-blur-sm supports-[backdrop-filter]:bg-background/35'
          : 'border-b border-border px-3 py-2.5',
      )}
    >
      <span className={cn('flex flex-none items-center justify-center rounded-full bg-accent', floating ? 'size-9' : 'size-8')}>
        <Leaf className={cn('text-accent-foreground', floating ? 'size-[18px]' : 'size-4')} />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block truncate font-bold leading-tight text-foreground', floating ? 'text-[14px]' : 'text-[13px]')}>
          Local Plant Supply
        </span>
        <span className="inline-flex items-center gap-1.5 text-[11px] leading-tight text-muted-foreground">
          <span>Availability chat</span>
          <span className="text-lps-dim">·</span>
          <span className="size-1.5 rounded-full bg-[var(--lps-tone-green-dot)]" />
          <span>Online</span>
        </span>
      </span>
      {/* Mobile has no toolbar row under the header, so it closes from here. */}
      {floating && (
        <button
          type="button"
          onClick={closeChatPanel}
          aria-label="Hide chat"
          title="Hide chat"
          className="flex size-11 flex-none cursor-pointer items-center justify-center rounded-full border-none bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X size={16} />
        </button>
      )}
    </div>
  )

  // `short` is the mobile bottom bar's label — the rail has room for the whole
  // name and the bar does not. Closed sits last: it is where work goes to rest,
  // not somewhere a supplier starts.
  const nav = [
    { id: 'orders', label: 'Orders', short: 'Orders', href: `/partner/${supplierId}/orders`, Icon: FileIcon },
    { id: 'requests', label: 'Availability Requests', short: 'Requests', href: `/partner/${supplierId}`, Icon: RequestsIcon },
  ]

  const bell = (mobile = false) => (
    <PartnerNotificationBell
      mobile={mobile}
      requests={alerts}
      chat={chatAlert}
      onOpenRequest={onOpenAlert}
      onOpenChat={openChatPanel}
    />
  )

  return (
    <WorkspaceFrame
      title={title}
      toolbar={typeof toolbar === 'function' ? toolbar(!isMobile ? (
        <span className="flex items-center">{bell()}</span>
      ) : null) : toolbar}
      headerAction={headerAction}
      // Since 2026-08-26 every portal page draws no header on mobile, exactly
      // as the Shell's `hideHeaderOnMobile` pages do; the bell moves to the
      // left of the bottom bar, and the page column starts at its own toolbar.
      hideHeaderOnMobile
      hideHeaderOnDesktop={hideHeaderOnDesktop}
      headerExtras={!hideHeaderOnDesktop && bell()}
      theme={theme}
      nav={nav}
      activeId={tab}
      onNavOpenChange={setNavOpen}
      railOpenWidth={232}
      mobileOverlay={{ open: isMobile && chatOpen, close: mobileChatView.close, dismiss: mobileChatView.dismiss }}
      disablePull={isMobile && chatOpen}
      railIdentity={({ navOpen: open }) => (
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-9 flex-none items-center justify-center rounded-full bg-primary">
            <Leaf className="size-4.5 text-primary-foreground" />
          </span>
          {open && (
            <span className="min-w-0">
              <span className="block truncate font-serif text-[14px] font-bold leading-tight text-foreground">
                {supplierName ?? '…'}
              </span>
              <span className="block text-[11px] text-muted-foreground">
                Supplier portal · Local Plant Supply
              </span>
            </span>
          )}
        </div>
      )}
      railBottom={({ navOpen: open, railBtn }) => (
        <>
          <Link href={`/partner/${supplierId}/closed-orders`} title="Order/Request History" className={railBtn(tab === 'closed' || tab === 'closed-orders')}>
            <span className="flex size-4 flex-none items-center justify-center"><ArchiveIcon /></span>
            {open && <span>Order/Request History</span>}
          </Link>
          <Link
            href={`/partner/${supplierId}/settings`}
            title="Settings"
            className={railBtn(tab === 'settings')}
          >
            <span className="flex size-4 flex-none items-center justify-center"><SettingsIcon /></span>
            {open && <span>Settings</span>}
          </Link>

          <button type="button" onClick={() => void signOut()} title="Log out" className={railBtn(false, false)}>
            <span className="flex size-4 flex-none items-center justify-center"><LogoutIcon /></span>
            {open && <span>Log out</span>}
          </button>
        </>
      )}
      moreBottom={() => (
        <>
          <Link href={`/partner/${supplierId}/closed-orders`} className={moreItemClass}><ArchiveIcon size={14} />Order/Request History</Link>
          <Link href={`/partner/${supplierId}/settings`} className={moreItemClass}>
            <SettingsIcon size={14} />
            Settings
          </Link>
          <button type="button" onClick={() => void signOut()} className={moreItemClass}>
            <LogoutIcon size={14} />
            Log out
          </button>
        </>
      )}
      mobileBarLeft={() => bell(true)}
      mobileBarRight={({ closeMoreMenu }) => (
        <button
          type="button"
          onClick={() => {
            if (chatOpen) closeChatPanel()
            else openChatPanel()
            closeMoreMenu()
          }}
          aria-label={chatAlert ? 'Chat with Local Plant Supply — unread messages' : 'Chat with Local Plant Supply'}
          aria-expanded={chatOpen}
          className={cn(
            'flex w-[52px] flex-none cursor-pointer flex-col items-center gap-1 rounded-[10px] border-none bg-transparent px-0.5 py-1.5 transition-colors duration-150 ease-lps hover:bg-muted',
            chatOpen ? 'text-primary' : 'text-muted-foreground',
          )}
        >
          <span className="relative flex h-6 w-[18px] items-center justify-center">
            <MessagesSquare size={17} />
            {chatAlert && !chatOpen && (
              <span className="absolute -right-1.5 -top-1 size-2 rounded-full bg-[var(--lps-warn-dot)]" aria-hidden="true" />
            )}
          </span>
          <span className="text-center text-[11px] font-semibold leading-tight">Chat</span>
        </button>
      )}
      // The chat overlays the page column only, so global navigation stays
      // put — the same rule the admin Shell's mobile sheet follows.
      pageOverlays={() => chatOpen && isMobile && (
        <div
          className="absolute inset-0 z-40 flex flex-col bg-background"
          style={{
            ...chatThemeStyle(chatThemeForAgent(chatAppearance, 'rosie')),
            ...chatWallpaperStyle(chatWallpaperForAgent(chatAppearance, 'rosie')),
          }}
        >
          {chatHeader(true)}
          <PartnerChat supplierId={supplierId} mobile wallpaper={chatWallpaperForAgent(chatAppearance, 'rosie')} />
        </div>
      )}
      // The chat with Local Plant Supply, docked on the right in the admin
      // app's shape: a narrow rail carrying who you'd be talking to, which
      // opens into the panel.
      rightColumn={() => chatOpen ? (
        <aside
          className="relative flex min-h-0 flex-none flex-col border-l border-border bg-card"
          style={{ width: chatWidth, ...chatThemeStyle(chatThemeForAgent(chatAppearance, 'rosie')) }}
        >
          <div
            onMouseDown={startChatResize}
            title="Drag to resize"
            className="absolute -left-[3px] bottom-0 top-0 z-20 w-[7px] cursor-col-resize hover:bg-lps-edge"
          />
          {chatHeader()}

          <div className="flex flex-none items-center gap-1 border-b border-border px-3 py-2">
            {([
              ['Full', fullChatWidth],
              ['50%', () => clampChatWidth(Math.round(window.innerWidth * 0.5))],
              ['30%', () => clampChatWidth(Math.round(window.innerWidth * 0.3))],
            ] as const).map(([label, w]) => (
              <SizePill key={label} label={label} width={chatWidth} target={w} onPick={setChatWidth} />
            ))}
            <div className="flex-1" />
            <button
              type="button"
              onClick={closeChatPanel}
              title="Hide panel"
              aria-label="Hide panel"
              className="relative flex size-6 flex-none cursor-pointer items-center justify-center rounded-[7px] border-none bg-transparent text-muted-foreground transition-colors duration-150 ease-lps hover:bg-muted hover:text-foreground pointer-coarse:after:absolute pointer-coarse:after:-inset-2.5 pointer-coarse:after:content-['']"
            >
              <span className="flex size-3.5"><ChevronRight /></span>
            </button>
          </div>

          <PartnerChat supplierId={supplierId} wallpaper={chatWallpaperForAgent(chatAppearance, 'rosie')} />
        </aside>
      ) : (
        <div className="flex w-[46px] flex-none flex-col items-center border-l border-border bg-card py-3.5">
          <button
            type="button"
            onClick={openChatPanel}
            aria-label={chatAlert ? 'Chat with Local Plant Supply — unread messages' : 'Chat with Local Plant Supply'}
            title="Chat with Local Plant Supply"
            className="flex cursor-pointer flex-col items-center gap-2.5 border-none bg-transparent p-0 text-muted-foreground transition-colors duration-150 hover:text-foreground"
          >
            <span className="relative flex size-[26px] flex-none items-center justify-center rounded-full bg-accent">
              <Leaf className="size-3.5 text-accent-foreground" />
              {chatAlert && (
                <span className="absolute -right-px -top-px size-2 rounded-full border border-card bg-[var(--lps-warn-dot)]" aria-hidden="true" />
              )}
            </span>
            <span className="text-[11px] font-bold uppercase tracking-[.08em] [writing-mode:vertical-rl]">
              Local Plant Supply
            </span>
          </button>
        </div>
      )}
    >
      {children}
    </WorkspaceFrame>
  )
}
