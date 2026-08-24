'use client'

// The supplier portal's chrome — the outside-facing sibling of the admin
// Shell, and deliberately the same design language: a collapsible left nav
// rail on desktop, a chat column docked on the right, a bottom tab bar on
// mobile, and the theme / settings / log-out controls at the left rail's foot.
// A supplier gets their identity and two destinations, not the operator's
// pages or agent chat. Settings and Log out are drawn but disabled: both
// belong to supplier sign-in, which is a deliberately deferred step — see
// docs/app/README.md (Supplier portal).

import Link from 'next/link'
import { ArrowDown, ArrowUp, Bell, Leaf, MessagesSquare, Mic, Paperclip, Send, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

import {
  CheckIcon, ChevronLeft, ChevronRight, FileIcon, LogoutIcon, MoonIcon, RequestsIcon, SettingsIcon, SunIcon,
} from '@/components/workspace/icons'
import { useIsMobile, useTheme } from '@/components/workspace/shell'
import {
  CHAT_APPEARANCE_STORE,
  DEFAULT_CHAT_APPEARANCE,
  chatThemeForAgent,
  chatThemeStyle,
  chatWallpaperStyle,
  isChatTheme,
  isChatWallpaper,
  type ChatAppearance,
} from '@/lib/chat-appearance'
import { cn } from '@/lib/utils'

export type PortalTab = 'requests' | 'orders'

const AUTH_LATER = 'Available once supplier sign-in lands'

// ------------------------------------------------------------------ the chat

interface PortalMessage {
  id: number
  at: number
  role: 'user' | 'agent'
  text: string
  files: PortalFile[]
  senderName?: string
}

interface PortalFile {
  name: string
  label: string
  mime: string
  size: number
  /** Present only while a freshly uploaded file is waiting to be sent. */
  ticket?: string
}

function PortalAttachment({ supplierId, file }: { supplierId: number; file: PortalFile }) {
  const href = `/api/portal/${supplierId}/chat?file=${encodeURIComponent(file.name)}`
  if (file.mime.startsWith('image/')) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border border-border bg-card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={href} alt={file.label} className="max-h-64 w-full object-contain" />
      </a>
    )
  }
  if (file.mime.startsWith('audio/')) {
    return <audio controls preload="metadata" src={href} className="max-w-full" aria-label={file.label} />
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex max-w-full items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-[12px] font-semibold text-foreground hover:bg-muted"
    >
      <Paperclip size={14} className="flex-none" />
      <span className="truncate">{file.label}</span>
    </a>
  )
}

const CHAT_POLL_MS = 5000

/**
 * The supplier's chat with Local Plant Supply — the portal-visible half of
 * the supplier's rosie thread. Their messages reach the team; the team's
 * internal traffic on the same thread never reaches here (the plugin only
 * serves portal-visible rows).
 */
function PortalChat({
  supplierId,
  mobile = false,
  wallpaper,
}: {
  supplierId: number
  mobile?: boolean
  wallpaper: ChatAppearance['wallpaper']
}) {
  const [messages, setMessages] = useState<PortalMessage[]>([])
  const [pending, setPending] = useState(false)
  const [unavailable, setUnavailable] = useState(false)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState('')
  const [uploads, setUploads] = useState<PortalFile[]>([])
  const [uploading, setUploading] = useState(false)
  const [recording, setRecording] = useState(false)
  const [atTop, setAtTop] = useState(true)
  const [atBottom, setAtBottom] = useState(true)
  const cursor = useRef(0)
  const scroller = useRef<HTMLDivElement>(null)
  const composer = useRef<HTMLTextAreaElement>(null)
  const picker = useRef<HTMLInputElement>(null)
  const recorder = useRef<MediaRecorder | null>(null)
  const recordingStream = useRef<MediaStream | null>(null)
  const recordingChunks = useRef<Blob[]>([])
  const cancelRecording = useRef(false)
  const pinned = useRef(true)

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/portal/${supplierId}/chat?since=${cursor.current}`, {
        cache: 'no-store',
      })
      if (res.status === 404) {
        setUnavailable(true)
        return
      }
      if (!res.ok) throw new Error(String(res.status))
      const body = (await res.json()) as { messages: PortalMessage[]; pending: boolean }
      if (body.messages.length) {
        setMessages((prev) => [...prev, ...body.messages])
        cursor.current = body.messages[body.messages.length - 1].id
      }
      setPending(body.pending)
      setError('')
    } catch {
      setError('Can’t reach Local Plant Supply right now.')
    }
  }, [supplierId])

  useEffect(() => {
    cursor.current = 0
    setMessages([])
    void poll()
    const t = setInterval(() => void poll(), CHAT_POLL_MS)
    return () => clearInterval(t)
  }, [poll])

  const updateEdges = useCallback((element: HTMLDivElement) => {
    const bottom = element.scrollHeight - element.scrollTop - element.clientHeight
    pinned.current = bottom < 40
    setAtTop(element.scrollTop < 40)
    setAtBottom(bottom < 40)
  }, [])

  const toBottom = useCallback((smooth = false) => {
    const element = scroller.current
    element?.scrollTo({ top: element.scrollHeight, behavior: smooth ? 'smooth' : 'auto' })
  }, [])

  useEffect(() => {
    if (pinned.current) toBottom()
    if (scroller.current) updateEdges(scroller.current)
  }, [messages.length, pending, toBottom, updateEdges])

  useLayoutEffect(() => {
    const element = composer.current
    if (!element) return
    element.style.height = 'auto'
    element.style.height = `${element.scrollHeight}px`
  }, [draft])

  const uploadFiles = useCallback(async (selected: File[]) => {
    if (!selected.length) return
    setUploading(true)
    try {
      for (const file of selected) {
        const res = await fetch(`/api/portal/${supplierId}/chat?upload=1`, {
          method: 'POST',
          headers: {
            'content-type': file.type || 'application/octet-stream',
            'x-file-name': encodeURIComponent(file.name),
          },
          body: file,
        })
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string }
          throw new Error(body.error || `Upload failed (${res.status})`)
        }
        const staged = (await res.json()) as PortalFile
        // Keep each successful file even if a later selection fails.
        setUploads((current) => [...current, staged])
      }
      setError('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'File failed to upload.')
    } finally {
      setUploading(false)
      if (picker.current) picker.current.value = ''
    }
  }, [supplierId])

  const finishRecording = useCallback((discard: boolean) => {
    cancelRecording.current = discard
    const active = recorder.current
    if (active?.state === 'recording') active.stop()
  }, [])

  const startRecording = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
        throw new Error('Voice recording is not supported by this browser.')
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      recordingStream.current = stream
      const candidates = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm']
      const mimeType = candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate))
      const active = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      recorder.current = active
      recordingChunks.current = []
      cancelRecording.current = false
      active.ondataavailable = (event) => {
        if (event.data.size) recordingChunks.current.push(event.data)
      }
      active.onstop = () => {
        stream.getTracks().forEach((track) => track.stop())
        recordingStream.current = null
        recorder.current = null
        setRecording(false)
        if (cancelRecording.current || !recordingChunks.current.length) return
        const type = active.mimeType || mimeType || 'audio/webm'
        const extension = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm'
        const voice = new File(recordingChunks.current, `voice-note.${extension}`, { type })
        void uploadFiles([voice])
      }
      active.start()
      setRecording(true)
      setError('')
    } catch (cause) {
      recordingStream.current?.getTracks().forEach((track) => track.stop())
      recordingStream.current = null
      setError(cause instanceof Error ? cause.message : 'Couldn’t start voice recording.')
    }
  }, [uploadFiles])

  useEffect(() => () => {
    cancelRecording.current = true
    if (recorder.current?.state === 'recording') recorder.current.stop()
    recordingStream.current?.getTracks().forEach((track) => track.stop())
  }, [])

  const send = async () => {
    const text = draft.trim()
    const attachments = uploads
    if ((!text && !attachments.length) || uploading || recording) return
    setDraft('')
    setUploads([])
    try {
      const res = await fetch(`/api/portal/${supplierId}/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text, attachments }),
      })
      if (!res.ok) throw new Error(String(res.status))
      setPending(true)
      await poll()
    } catch {
      setError('Message failed to send.')
      setDraft(text)
      setUploads(attachments)
    }
  }

  if (unavailable) {
    return (
      <div className="flex flex-1 items-center justify-center p-4 text-center text-[12.5px] text-muted-foreground">
        Chat isn’t switched on for this portal yet.
      </div>
    )
  }

  const stamp = (ms: number) => {
    const date = new Date(ms)
    const pad = (value: number) => String(value).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
  }

  return (
    <>
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <div
          ref={scroller}
          onScroll={(event) => updateEdges(event.currentTarget)}
          className={cn(
            'font-chat flex min-h-[220px] flex-1 flex-col gap-3 overflow-y-auto overscroll-y-contain bg-background px-4 pb-4',
            mobile ? 'pt-[72px]' : 'pt-4',
          )}
          style={chatWallpaperStyle(wallpaper)}
        >
          {messages.length === 0 && !pending && (
            <div className="m-auto flex max-w-[280px] flex-col items-center text-center text-[14px] leading-[1.4] text-muted-foreground">
              <span className="mb-3 flex size-14 items-center justify-center rounded-full bg-accent">
                <Leaf className="size-6 text-accent-foreground" />
              </span>
              Anything at all — availability, substitutes, timing or delivery. Your message goes straight to Local Plant Supply.
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                'flex max-w-[88%] flex-col gap-[3px]',
                message.role === 'user' ? 'items-end self-end' : 'items-start self-start',
              )}
            >
              {!!message.files?.length && (
                <div className={cn('flex max-w-full flex-col gap-2', message.role === 'user' ? 'items-end' : 'items-start')}>
                  {message.files.map((file) => (
                    <PortalAttachment key={file.name} supplierId={supplierId} file={file} />
                  ))}
                </div>
              )}
              {message.text && (
                <div
                  className={cn(
                    'whitespace-pre-wrap px-3 py-2.5 text-[16px] leading-[1.35]',
                    message.role === 'user'
                      ? 'rounded-[12px_12px_4px_12px] bg-primary text-primary-foreground'
                      : 'rounded-[12px_12px_12px_4px] border border-[var(--chat-bubble-border,var(--lps-hair))] bg-lps-bubble text-foreground',
                  )}
                >
                  {message.text}
                </div>
              )}
              <span className={cn('text-[11px] leading-none text-lps-dim', message.role === 'user' ? 'pr-1' : 'pl-1')}>
                {stamp(message.at)}
              </span>
            </div>
          ))}

          {pending && (
            <div className="flex max-w-[88%] flex-col gap-[3px] self-start">
              <div className="flex items-center gap-2 rounded-[12px_12px_12px_4px] border border-[var(--chat-bubble-border,var(--lps-hair))] bg-lps-bubble px-3 py-2.5 text-[16px] text-muted-foreground">
                <span className="flex gap-1">
                  {[0, 1, 2].map((index) => (
                    <span
                      key={index}
                      className="size-1.5 animate-bounce rounded-full bg-lps-dim"
                      style={{ animationDelay: `${index * 140}ms` }}
                    />
                  ))}
                </span>
                Local Plant Supply is working…
              </div>
            </div>
          )}

          {error && (
            <div className="self-center rounded-lg bg-lps-warn-bg px-3 py-1.5 text-[11.5px] font-semibold text-lps-warn-fg">
              {error}
            </div>
          )}
        </div>

        {(!atTop || !atBottom) && (
          <div className="absolute bottom-3 right-3 z-20 flex flex-col gap-2">
            {!atTop && (
              <button
                type="button"
                onClick={() => scroller.current?.scrollTo({ top: 0, behavior: 'smooth' })}
                aria-label="Jump to top of conversation"
                className="flex size-9 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-[var(--lps-shadow)] hover:bg-muted"
              >
                <ArrowUp size={17} />
              </button>
            )}
            {!atBottom && (
              <button
                type="button"
                onClick={() => toBottom(true)}
                aria-label="Jump to latest message"
                className="flex size-9 items-center justify-center rounded-full border border-border bg-card text-primary shadow-[var(--lps-shadow)] hover:bg-muted"
              >
                <ArrowDown size={17} />
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex-none border-t border-border bg-background">
        {!!uploads.length && (
          <div className="flex flex-wrap gap-1.5 px-3.5 pt-2.5">
            {uploads.map((file) => (
              <span key={file.name} className="inline-flex items-center gap-1.5 rounded-full border border-lps-edge bg-card py-1 pl-2.5 pr-1.5 text-[11px] font-semibold">
                <span className="max-w-[140px] truncate">{file.label}</span>
                <button
                  type="button"
                  onClick={() => setUploads((current) => current.filter((candidate) => candidate.name !== file.name))}
                  aria-label={`Remove ${file.label}`}
                  className="flex cursor-pointer items-center rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>
        )}
        {recording ? (
          <div className="flex items-center gap-2.5 px-3.5 py-3">
            <button
              type="button"
              onClick={() => finishRecording(true)}
              aria-label="Discard recording"
              className="flex flex-none cursor-pointer items-center justify-center rounded-lg border-none bg-transparent p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive"
            >
              <Trash2 size={mobile ? 17 : 15} />
            </button>
            <span className="size-2 flex-none animate-pulse rounded-full bg-destructive" />
            <span className="min-w-0 flex-1 text-[11.5px] font-semibold">Recording voice note…</span>
            <button
              type="button"
              onClick={() => finishRecording(false)}
              aria-label="Stop recording and attach"
              className={cn(
                'flex flex-none cursor-pointer items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90',
                mobile ? 'size-10' : 'size-9',
              )}
            >
              <CheckIcon size={mobile ? 17 : 15} />
            </button>
          </div>
        ) : (
          <div className="flex items-end gap-2 px-3.5 py-3">
            <input
              ref={picker}
              type="file"
              multiple
              hidden
              accept="image/png,image/jpeg,image/gif,image/webp,.pdf,.txt,.csv,.md,.json,.xlsx,.docx,audio/webm,audio/ogg,audio/mpeg,audio/mp4,audio/wav"
              onChange={(event) => void uploadFiles(Array.from(event.target.files ?? []))}
            />
            <button
              type="button"
              onClick={() => picker.current?.click()}
              disabled={uploading}
              title="Attach a file"
              aria-label="Attach a file"
              className="mb-1 flex flex-none cursor-pointer items-center justify-center rounded-lg border-none bg-transparent p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
            >
              <Paperclip size={mobile ? 17 : 15} />
            </button>
            <button
              type="button"
              onClick={() => void startRecording()}
              disabled={uploading}
              title="Record a voice note"
              aria-label="Record a voice note"
              className="mb-1 flex flex-none cursor-pointer items-center justify-center rounded-lg border-none bg-transparent p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
            >
              <Mic size={mobile ? 17 : 15} />
            </button>
            <textarea
              ref={composer}
              value={draft}
              rows={1}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey && !mobile) {
                  event.preventDefault()
                  void send()
                }
              }}
              placeholder={uploading ? 'Uploading…' : 'Message Local Plant Supply…'}
              className={cn(
                'font-chat max-h-40 min-w-0 flex-1 resize-none overflow-y-auto rounded-md border border-input bg-card px-3 text-[16px] leading-6 outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
                mobile ? 'min-h-10 py-2' : 'min-h-9 py-1.5',
              )}
            />
            <button
              type="button"
              onClick={() => void send()}
              disabled={(!draft.trim() && !uploads.length) || uploading}
              aria-label="Send"
              className={cn(
                'flex flex-none cursor-pointer items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50',
                mobile ? 'size-10' : 'size-9',
              )}
            >
              <Send size={mobile ? 16 : 15} />
            </button>
          </div>
        )}
      </div>
    </>
  )
}

export function PortalFrame({
  supplierId,
  supplierName,
  tab,
  notificationCount = 0,
  children,
}: {
  supplierId: number
  /** Null while loading — the frame draws before the fetch answers. */
  supplierName: string | null
  tab: PortalTab
  /** New availability requests shown by the supplier's Alerts control. */
  notificationCount?: number
  children: React.ReactNode
}) {
  const isMobile = useIsMobile()
  const { dark, toggle } = useTheme()
  const [navOpen, setNavOpen] = useState(true)
  // The chat with Local Plant Supply, opened from the right-hand rail
  // (desktop) or its bottom tab (mobile) — the portal's sibling of the admin
  // agent panel.
  const [chatOpen, setChatOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [chatAppearance, setChatAppearance] = useState<ChatAppearance>(DEFAULT_CHAT_APPEARANCE)

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(CHAT_APPEARANCE_STORE) ?? 'null') as
        | { themes?: Partial<Record<'daisy' | 'rosie' | 'nova', unknown>>; wallpaper?: unknown }
        | null
      if (!saved) return
      const themes = { ...DEFAULT_CHAT_APPEARANCE.themes }
      for (const id of ['daisy', 'rosie', 'nova'] as const) {
        if (isChatTheme(saved.themes?.[id])) themes[id] = saved.themes[id]
      }
      setChatAppearance({
        themes,
        wallpaper: isChatWallpaper(saved.wallpaper) ? saved.wallpaper : DEFAULT_CHAT_APPEARANCE.wallpaper,
      })
    } catch {
      // Malformed local appearance data falls back to the shared defaults.
    }
  }, [])

  useEffect(() => {
    if (!moreOpen && !notificationsOpen) return
    const close = (event: MouseEvent) => {
      if (!(event.target as HTMLElement).closest('[data-portal-popover]')) {
        setMoreOpen(false)
        setNotificationsOpen(false)
      }
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [moreOpen, notificationsOpen])

  const chatHeader = (floating = false) => (
    <div
      className={cn(
        'flex flex-none items-center gap-2.5',
        floating
          ? 'absolute inset-x-3 top-2 z-30 min-h-14 rounded-[22px] border border-border/70 bg-background/75 px-3 py-2 shadow-lg backdrop-blur-xl supports-[backdrop-filter]:bg-background/60'
          : 'border-b border-border px-3 py-2.5',
      )}
    >
      <span className={cn('flex flex-none items-center justify-center rounded-full bg-accent', floating ? 'size-9' : 'size-8')}>
        <Leaf className={cn('text-accent-foreground', floating ? 'size-[18px]' : 'size-4')} />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block truncate font-bold leading-tight text-foreground', floating ? 'text-[14.5px]' : 'text-[13px]')}>
          Local Plant Supply
        </span>
        <span className="inline-flex items-center gap-1.5 text-[10.5px] leading-tight text-muted-foreground">
          <span>Availability chat</span>
          <span className="text-lps-dim">·</span>
          <span className="size-1.5 rounded-full bg-[#5FAF65]" />
          <span>Online</span>
        </span>
      </span>
      <button
        type="button"
        onClick={() => setChatOpen(false)}
        aria-label="Hide chat"
        title="Hide chat"
        className="flex size-8 flex-none cursor-pointer items-center justify-center rounded-full border-none bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <X size={16} />
      </button>
    </div>
  )

  const nav: { id: PortalTab; label: string; href: string; Icon: typeof RequestsIcon }[] = [
    { id: 'requests', label: 'Availability Requests', href: `/portal/${supplierId}`, Icon: RequestsIcon },
    { id: 'orders', label: 'Orders', href: `/portal/${supplierId}/orders`, Icon: FileIcon },
  ]

  const railBtn = (active: boolean, enabled = true) =>
    cn(
      'flex items-center gap-2.5 rounded-[10px] border-none text-[13px] font-semibold w-full text-left transition-colors',
      navOpen ? 'px-2.5 py-2 justify-start' : 'px-0 py-2 justify-center',
      active ? 'bg-secondary text-primary' : 'text-muted-foreground',
      enabled ? 'cursor-pointer hover:bg-muted hover:text-foreground' : 'cursor-not-allowed opacity-45',
    )

  const identity = (
    <div className="flex min-w-0 items-center gap-2.5">
      <span className="flex size-9 flex-none items-center justify-center rounded-full bg-accent">
        <Leaf className="size-4.5 text-accent-foreground" />
      </span>
      {(!isMobile ? navOpen : true) && (
        <span className="min-w-0">
          <span className="block truncate font-serif text-[14.5px] font-bold leading-tight text-foreground">
            {supplierName ?? '…'}
          </span>
          <span className="block text-[10.5px] text-muted-foreground">
            Supplier portal · Local Plant Supply
          </span>
        </span>
      )}
    </div>
  )

  if (isMobile) {
    return (
      <div className="fixed inset-0 flex flex-col overflow-hidden bg-background">
        <main className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto px-3 py-3">
          {children}
        </main>

        {/* Chat replaces only the page pane; global navigation remains visible. */}
        {chatOpen && (
          <div
            className="absolute inset-x-0 top-0 z-40 flex flex-col bg-background"
            style={{
              bottom: 'calc(52px + env(safe-area-inset-bottom))',
              ...chatThemeStyle(chatThemeForAgent(chatAppearance, 'rosie')),
            }}
          >
            {chatHeader(true)}
            <PortalChat supplierId={supplierId} mobile wallpaper={chatAppearance.wallpaper} />
          </div>
        )}

        {notificationsOpen && (
          <div data-portal-popover className="absolute bottom-[calc(58px+env(safe-area-inset-bottom))] left-2 z-[80] w-[min(320px,calc(100vw-16px))] rounded-xl border border-border bg-popover p-1.5 shadow-[var(--lps-shadow)]">
            <div className="border-b border-border px-2.5 py-2 text-[12.5px] font-bold text-foreground">
              Notifications
            </div>
            {notificationCount > 0 ? (
              <Link
                href={`/portal/${supplierId}`}
                onClick={() => {
                  setNotificationsOpen(false)
                  setChatOpen(false)
                }}
                className="flex flex-col gap-0.5 rounded-lg px-2.5 py-2 text-foreground hover:bg-muted"
              >
                <span className="text-[12.5px] font-semibold">
                  {notificationCount} new availability {notificationCount === 1 ? 'request' : 'requests'}
                </span>
                <span className="text-[11px] text-muted-foreground">Open Requests to review and answer.</span>
              </Link>
            ) : (
              <p className="m-0 px-2.5 py-3 text-[12px] text-muted-foreground">No new notifications.</p>
            )}
          </div>
        )}

        {/* Desktop rail footer actions live under More on mobile, in the same order. */}
        {moreOpen && (
          <div data-portal-popover className="absolute bottom-[calc(58px+env(safe-area-inset-bottom))] right-2 z-[80] min-w-[210px] rounded-xl border border-border bg-popover p-1.5 shadow-[var(--lps-shadow)]">
            <button
              type="button"
              onClick={toggle}
              className="flex w-full cursor-pointer items-center gap-2 rounded-lg border-none bg-transparent px-2.5 py-[7px] text-left text-[12.5px] font-semibold text-foreground hover:bg-muted"
            >
              {dark ? <MoonIcon size={14} /> : <SunIcon size={14} />}
              {dark ? 'Dark mode' : 'Light mode'}
            </button>
            <button
              type="button"
              disabled
              title={AUTH_LATER}
              className="flex w-full cursor-not-allowed items-center gap-2 rounded-lg border-none bg-transparent px-2.5 py-[7px] text-left text-[12.5px] font-semibold text-muted-foreground opacity-45"
            >
              <SettingsIcon size={14} />
              Settings
            </button>
            <button
              type="button"
              disabled
              title={AUTH_LATER}
              className="flex w-full cursor-not-allowed items-center gap-2 rounded-lg border-none bg-transparent px-2.5 py-[7px] text-left text-[12.5px] font-semibold text-muted-foreground opacity-45"
            >
              <LogoutIcon size={14} />
              Log out
            </button>
          </div>
        )}

        {/* Match the main app: fixed global actions at the edges, with three
            destinations visible in an independently scrollable center strip. */}
        <nav className="z-50 flex flex-none items-stretch gap-0.5 overflow-visible border-t border-border bg-card px-1 pt-[5px] pb-[calc(5px+env(safe-area-inset-bottom))]">
          <button
            type="button"
            data-portal-popover
            onClick={() => {
              setNotificationsOpen((open) => !open)
              setMoreOpen(false)
            }}
            aria-label={notificationCount ? `Notifications — ${notificationCount} new` : 'Notifications'}
            aria-expanded={notificationsOpen}
            className={cn(
              'flex w-[52px] flex-none cursor-pointer flex-col items-center gap-1 rounded-[10px] border-none bg-transparent px-0.5 py-1.5',
              notificationsOpen ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            <span className="relative flex size-[18px] items-center justify-center">
              <Bell size={17} />
              {notificationCount > 0 && (
                <span className="absolute -right-2 -top-2 flex min-w-4 items-center justify-center rounded-full bg-[var(--lps-warn-dot)] px-1 text-[9px] font-bold leading-4 text-white">
                  {notificationCount > 99 ? '99+' : notificationCount}
                </span>
              )}
            </span>
            <span className="text-[10.5px] font-semibold">Alerts</span>
          </button>

          <div
            role="group"
            aria-label="Pages"
            className="lps-mobile-nav-scroll flex min-w-0 flex-1 items-stretch overflow-x-auto overflow-y-hidden overscroll-x-contain touch-pan-x"
          >
            {nav.map(({ id, label, href, Icon }) => (
              <Link
                key={id}
                href={href}
                aria-label={label}
                onClick={() => {
                  setChatOpen(false)
                  setMoreOpen(false)
                  setNotificationsOpen(false)
                }}
                className={cn(
                  'flex min-w-0 basis-1/3 shrink-0 cursor-pointer flex-col items-center gap-1 rounded-[10px] border-none bg-transparent px-0.5 py-1.5',
                  tab === id && !chatOpen ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                <span className="flex size-[18px] items-center justify-center"><Icon /></span>
                <span className="text-center text-[10.5px] font-semibold leading-tight">
                  {id === 'requests' ? 'Requests' : label}
                </span>
              </Link>
            ))}
            <button
              type="button"
              data-portal-popover
              onClick={() => {
                setMoreOpen((open) => !open)
                setNotificationsOpen(false)
              }}
              aria-label="More"
              aria-expanded={moreOpen}
              className={cn(
                'flex min-w-0 basis-1/3 shrink-0 cursor-pointer flex-col items-center gap-1 rounded-[10px] border-none bg-transparent px-0.5 py-1.5',
                moreOpen ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              <span className="flex size-[18px] items-center justify-center text-[16px] font-bold leading-none">⋯</span>
              <span className="text-[10.5px] font-semibold">More</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              setChatOpen((open) => !open)
              setMoreOpen(false)
              setNotificationsOpen(false)
            }}
            aria-label="Chat with Local Plant Supply"
            aria-expanded={chatOpen}
            className={cn(
              'flex w-[52px] flex-none cursor-pointer flex-col items-center gap-1 rounded-[10px] border-none bg-transparent px-0.5 py-1.5',
              chatOpen ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            <span className="flex size-[18px] items-center justify-center"><MessagesSquare size={17} /></span>
            <span className="text-center text-[10.5px] font-semibold leading-tight">Chat</span>
          </button>
        </nav>
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh bg-background">
      <nav
        className="sticky top-0 flex h-dvh flex-none flex-col gap-0.5 border-r border-border bg-card"
        style={{ width: navOpen ? 232 : 56, padding: navOpen ? '12px 10px' : '12px 8px' }}
      >
        <div className={cn('mb-2', navOpen ? 'px-1' : 'flex justify-center')}>{identity}</div>

        {nav.map(({ id, label, href, Icon }) => (
          <Link key={id} href={href} title={label} className={railBtn(tab === id)}>
            <span className="flex size-4 flex-none items-center justify-center"><Icon /></span>
            {navOpen && <span>{label}</span>}
          </Link>
        ))}

        <div className="flex-1" />

        <div className="flex flex-col gap-0.5 border-t border-lps-hair pt-2">
          <button type="button" onClick={toggle} title={dark ? 'Dark mode' : 'Light mode'} className={railBtn(false)}>
            <span className="flex size-4 flex-none items-center justify-center">
              {dark ? <MoonIcon /> : <SunIcon />}
            </span>
            {navOpen && (
              <>
                <span>{dark ? 'Dark mode' : 'Light mode'}</span>
                <span className={cn('relative ml-auto h-[17px] w-[30px] flex-none rounded-full', dark ? 'bg-primary' : 'bg-muted')}>
                  <span
                    className="absolute top-[2px] size-[13px] rounded-full bg-card transition-all"
                    style={{ left: dark ? 15 : 2 }}
                  />
                </span>
              </>
            )}
          </button>

          <button type="button" disabled title={`Settings — ${AUTH_LATER.toLowerCase()}`} className={railBtn(false, false)}>
            <span className="flex size-4 flex-none items-center justify-center"><SettingsIcon /></span>
            {navOpen && <span>Settings</span>}
          </button>

          <button type="button" disabled title={`Log out — ${AUTH_LATER.toLowerCase()}`} className={railBtn(false, false)}>
            <span className="flex size-4 flex-none items-center justify-center"><LogoutIcon /></span>
            {navOpen && <span>Log out</span>}
          </button>
        </div>

        <button
          type="button"
          onClick={() => setNavOpen((v) => !v)}
          aria-label={navOpen ? 'Collapse navigation' : 'Expand navigation'}
          title={navOpen ? 'Collapse navigation' : 'Expand navigation'}
          className="mt-1.5 flex h-7 cursor-pointer items-center justify-center rounded-[9px] border border-border bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <span className="flex size-3.5">{navOpen ? <ChevronLeft /> : <ChevronRight />}</span>
        </button>
      </nav>

      <main className="flex min-w-0 flex-1 flex-col">
        <div className="mx-auto flex w-full max-w-[1100px] flex-1 flex-col gap-3 px-4 py-4">
          {children}
        </div>
      </main>

      {/* The chat with Local Plant Supply, docked on the right in the admin
          app's shape: a narrow rail carrying who you'd be talking to, which
          opens into the panel. */}
      {chatOpen ? (
        <aside
          className="sticky top-0 flex h-dvh w-[340px] flex-none flex-col border-l border-border bg-card"
          style={chatThemeStyle(chatThemeForAgent(chatAppearance, 'rosie'))}
        >
          {chatHeader()}
          <PortalChat supplierId={supplierId} wallpaper={chatAppearance.wallpaper} />
        </aside>
      ) : (
        <div className="sticky top-0 flex h-dvh w-[46px] flex-none flex-col items-center border-l border-border bg-card py-3.5">
          <button
            type="button"
            onClick={() => setChatOpen(true)}
            aria-label="Chat with Local Plant Supply"
            title="Chat with Local Plant Supply"
            className="flex cursor-pointer flex-col items-center gap-2.5 border-none bg-transparent p-0 text-muted-foreground hover:text-foreground"
          >
            <span className="flex size-[26px] flex-none items-center justify-center rounded-full bg-accent">
              <Leaf className="size-3.5 text-accent-foreground" />
            </span>
            <span className="text-[11px] font-bold uppercase tracking-[.08em] [writing-mode:vertical-rl]">
              Local Plant Supply
            </span>
          </button>
        </div>
      )}
    </div>
  )
}
