'use client'

// The chat primitives the operator's agent panel (`chat.tsx`) and the supplier
// portal's chat column (`partner.tsx`) both draw from: markdown bubbles, the
// voice-note player, attachments, the composer with its recorder, and the
// scrolling transcript. Everything here is transport-agnostic — the caller
// supplies the endpoints (file hrefs, upload) and the copy.

import {
  useCallback, useEffect, useLayoutEffect, useRef, useState,
} from 'react'
import { ArrowDown, ArrowUp, Copy, MessagesSquare, Mic, Pause, Paperclip, Play, RefreshCw, Send, Trash2, X } from 'lucide-react'

import { CheckIcon, ChevronRight } from '@/components/workspace/icons'
import { chatWallpaperStyle, type ChatWallpaperId } from '@/lib/chat-appearance'
import {
  chatMarkdownPlainText, joinLineBrokenMarkdownLinks, splitChatMarkdownBlocks, tokenizeChatInline,
  transformChatInlineText, type ChatInlineToken,
} from '@/lib/chat-markdown'
import { cn } from '@/lib/utils'

// --------------------------------------------------------------------- types

export type ChatFile = {
  name: string
  label: string
  mime: string
  size: number
  /** Portal only: present while a freshly uploaded file waits to be sent. */
  ticket?: string
}

export type ChatMessage = {
  id: number
  at: number
  role: 'user' | 'agent'
  text: string
  files: ChatFile[]
  senderName?: string
}

/** A `thread:`/`ar:` link the agent wrote, once the reader can act on it. */
export type MarkdownAction = (scheme: 'thread' | 'ar', target: string) => void

// ------------------------------------------------------------------ markdown

/**
 * The agent writes markdown; this renders the subset that actually shows up in
 * a chat bubble — bold, inline code, links, and bullet lists.
 *
 * ponytail: ~30 lines instead of a markdown dependency. If tables or nested
 * lists ever matter, swap in `marked` + a sanitizer rather than growing this.
 */
function inline(
  text: string,
  key: string,
  onAction?: MarkdownAction,
  displayText: (text: string) => string = (value) => value,
) {
  const render = (tokens: ChatInlineToken[], prefix: string): React.ReactNode[] => tokens.map((token, i) => {
    const k = `${prefix}-${i}`
    if (token.kind === 'text') return token.text
    if (token.kind === 'strong') return <strong key={k}>{render(token.children, k)}</strong>
    if (token.kind === 'code') return <code key={k} className="rounded bg-muted px-1 py-px font-mono text-[13.5px]">{token.text}</code>
    if (token.kind === 'link') {
      return <a key={k} href={token.href} target="_blank" rel="noreferrer" className="underline [overflow-wrap:anywhere]">{token.label}</a>
    }

    // Agent-rendered action buttons: `thread:<id>` switches the panel to that
    // thread, `ar:<id>` opens the availability-request drawer. Readers with
    // nothing to open (the portal) get the plain label instead.
    const arId = Number.parseInt(token.target, 10)
    const valid = token.scheme === 'thread' ? token.target.length > 0 : Number.isInteger(arId)
    if (!valid || !onAction) return token.label
    return (
      <button
        key={k}
        type="button"
        onClick={() => onAction(token.scheme, token.target)}
        className="my-0.5 inline-flex max-w-full cursor-pointer items-center gap-1 whitespace-normal rounded-full border border-lps-edge bg-card px-2.5 py-1 text-left text-[12px] font-bold text-primary [overflow-wrap:anywhere] hover:bg-secondary"
      >
        {token.scheme === 'thread' ? <MessagesSquare size={12} /> : <ChevronRight size={12} />}
        {token.label}
      </button>
    )
  })

  return render(transformChatInlineText(tokenizeChatInline(text), displayText), key)
}

const messageText = (text: string) => text.replace(/\\r\\n|\\n|\\r/g, '\n')

function MarkdownProse({
  text,
  onAction,
  displayText,
}: {
  text: string
  onAction?: MarkdownAction
  displayText?: (text: string) => string
}) {
  const blocks: React.ReactNode[] = []
  const lines = text.split('\n')
  let bullets: string[] = []
  const flush = (key: string) => {
    if (!bullets.length) return
    blocks.push(
      <ul key={`ul-${key}`} className="my-1 list-disc space-y-0.5 pl-4">
        {bullets.map((b, i) => <li key={i}>{inline(b, `${key}-${i}`, onAction, displayText)}</li>)}
      </ul>,
    )
    bullets = []
  }
  lines.forEach((line, i) => {
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line)
    if (bullet) { bullets.push(bullet[1]); return }
    flush(String(i))
    if (line.trim()) blocks.push(<p key={i} className="my-0">{inline(line, String(i), onAction, displayText)}</p>)
  })
  flush('end')
  return blocks
}

function FencedCodeBlock({ language, text }: { language: string; text: string }) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(false), 1600)
    } catch {
      // Clipboard access can be denied; do not falsely report success.
    }
  }

  return (
    <div className="my-1 min-w-0 max-w-full overflow-hidden rounded-lg border border-lps-edge bg-background/80">
      <div className="flex items-center justify-between gap-3 border-b border-lps-edge bg-muted/70 px-3 py-1.5 text-[11px]">
        <span className="truncate font-mono text-muted-foreground">{language || 'code'}</span>
        <button
          type="button"
          onClick={() => { void copy() }}
          className="inline-flex cursor-pointer items-center gap-1 rounded px-1.5 py-0.5 font-sans font-semibold text-foreground hover:bg-background"
          aria-label={copied ? 'Code copied' : 'Copy code'}
        >
          {copied ? <CheckIcon size={12} /> : <Copy size={12} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="max-w-full overflow-x-auto p-3 text-[13px] leading-5"><code className="font-mono">{text}</code></pre>
    </div>
  )
}

export function Markdown({
  text,
  onAction,
  displayText = (value) => value,
}: {
  text: string
  onAction?: MarkdownAction
  displayText?: (text: string) => string
}) {
  // Some CLI replies arrive with JSON-style line breaks as literal `\\n`.
  // Normalize them here so existing transcript entries render correctly too.
  const blocks = splitChatMarkdownBlocks(messageText(text))

  return (
    <div className="flex min-w-0 flex-col gap-1 [overflow-wrap:anywhere]">
      {blocks.map((block, i) => block.kind === 'code'
        ? <FencedCodeBlock key={i} language={block.language} text={displayText(block.text)} />
        : (
            <MarkdownProse
              key={i}
              text={joinLineBrokenMarkdownLinks(block.text)}
              onAction={onAction}
              displayText={displayText}
            />
          ))}
    </div>
  )
}

// ---------------------------------------------------------------- audio bits

const BARS = 40

export const fmtTime = (s: number) =>
  Number.isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '0:00'

/** One AudioContext for the whole panel — browsers cap how many you may open. */
let audioCtx: AudioContext | null = null
function sharedAudioContext(): AudioContext {
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  if (!audioCtx) audioCtx = new Ctor()
  return audioCtx
}

/**
 * RMS amplitude per bucket, for the waveform.
 *
 * Also returns the decoded duration, which is load-bearing: MediaRecorder
 * writes a webm with no duration in the container, so `<audio>.duration` is
 * `Infinity` until the file has fully played. The decoded buffer always knows.
 */
async function loadWaveform(url: string): Promise<{ peaks: number[]; duration: number }> {
  const raw = await (await fetch(url)).arrayBuffer()
  const buf = await sharedAudioContext().decodeAudioData(raw)
  const data = buf.getChannelData(0)
  const size = Math.max(1, Math.floor(data.length / BARS))
  const peaks: number[] = []
  for (let i = 0; i < BARS; i++) {
    let sum = 0
    for (let j = 0; j < size; j++) {
      const v = data[i * size + j] ?? 0
      sum += v * v
    }
    peaks.push(Math.sqrt(sum / size))
  }
  const max = Math.max(...peaks, 1e-4)
  // Floor at 0.08 so silence still reads as a waveform rather than a flat line.
  return { peaks: peaks.map((p) => Math.max(0.08, p / max)), duration: buf.duration }
}

/** Play / pause, a seekable waveform, and elapsed-vs-total — the WhatsApp bubble. */
export function VoicePlayer({ src, mine }: { src: string; mine: boolean }) {
  const audio = useRef<HTMLAudioElement>(null)
  const [peaks, setPeaks] = useState<number[]>([])
  const [duration, setDuration] = useState(0)
  const [at, setAt] = useState(0)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    let alive = true
    loadWaveform(src)
      .then((w) => {
        if (!alive) return
        setPeaks(w.peaks)
        setDuration(w.duration)
      })
      // Decode can fail on an unsupported codec; a flat bar set still plays.
      .catch(() => alive && setPeaks(Array<number>(BARS).fill(0.35)))
    return () => { alive = false }
  }, [src])

  const progress = duration > 0 ? Math.min(1, at / duration) : 0

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = audio.current
    if (!el || !duration) return
    const box = e.currentTarget.getBoundingClientRect()
    const t = ((e.clientX - box.left) / box.width) * duration
    el.currentTime = t
    setAt(t)
  }

  return (
    <div
      className={cn(
        'flex w-[232px] max-w-full items-center gap-2.5 rounded-full px-2.5 py-2',
        mine ? 'bg-primary text-primary-foreground' : 'border border-[var(--chat-bubble-border,var(--lps-hair))] bg-lps-bubble text-foreground',
      )}
    >
      <audio
        ref={audio}
        src={src}
        preload="metadata"
        onTimeUpdate={(e) => setAt(e.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setAt(0) }}
      />
      <button
        type="button"
        onClick={() => (playing ? audio.current?.pause() : audio.current?.play())}
        aria-label={playing ? 'Pause' : 'Play'}
        className={cn(
          'flex size-7 flex-none cursor-pointer items-center justify-center rounded-full',
          mine ? 'bg-primary-foreground/20' : 'bg-primary text-primary-foreground',
        )}
      >
        {playing ? <Pause size={13} fill="currentColor" /> : <Play size={13} fill="currentColor" className="ml-px" />}
      </button>

      <div onClick={seek} className="flex h-6 flex-1 cursor-pointer items-center gap-[2px]" role="presentation">
        {(peaks.length ? peaks : Array<number>(BARS).fill(0.35)).map((p, i) => (
          <span
            key={i}
            className={cn(
              'w-full flex-1 rounded-full transition-opacity',
              i / BARS <= progress ? 'opacity-100' : 'opacity-35',
              mine ? 'bg-primary-foreground' : 'bg-primary',
            )}
            style={{ height: `${Math.round(p * 100)}%` }}
          />
        ))}
      </div>

      <span className="w-8 flex-none text-right text-[10.5px] tabular-nums opacity-80">
        {fmtTime(at > 0 ? at : duration)}
      </span>
    </div>
  )
}

// --------------------------------------------------------------- attachments

export function Attachment({
  href, file, mine, onLoad,
}: {
  /** Where this file streams from — each surface has its own scoped route. */
  href: string
  file: ChatFile
  mine: boolean
  onLoad?: () => void
}) {
  if (file.mime.startsWith('image/')) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className="block">
        {/* Plain <img>: these come from the transcript at runtime, so there
            is nothing for next/image to optimise at build time. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={href} alt={file.label} onLoad={onLoad} className="max-h-52 w-auto rounded-lg border border-lps-hair" />
      </a>
    )
  }
  if (file.mime.startsWith('audio/')) {
    return <VoicePlayer src={href} mine={mine} />
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 rounded-lg border border-lps-hair bg-card px-2.5 py-1.5 text-[11.5px] font-semibold text-foreground hover:bg-muted"
    >
      <Paperclip size={12} />
      <span className="max-w-[180px] truncate">{file.label}</span>
    </a>
  )
}

// ------------------------------------------------------------------ the chat


/**
 * Containers in preference order. Safari (iOS included) cannot produce webm —
 * it records mp4/AAC — so asking for webm unconditionally is how voice notes
 * break on iPhones. `isTypeSupported` picks whatever this browser can actually
 * write, and the extension follows the real `mimeType` rather than a guess.
 */
const REC_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']

function pickRecordingType(): string {
  if (typeof MediaRecorder === 'undefined') return ''
  return REC_TYPES.find((t) => MediaRecorder.isTypeSupported(t)) ?? ''
}

function extForAudio(mime: string): string {
  if (mime.includes('mp4') || mime.includes('aac')) return 'm4a'
  if (mime.includes('ogg')) return 'ogg'
  if (mime.includes('wav')) return 'wav'
  return 'webm'
}

/**
 * Upload + record + paste — the composer's attachment plumbing.
 *
 * `uploadOne` is the caller's: it stores one file wherever that surface's
 * route puts it and returns the attachment to send, or throws with a message
 * worth showing. A throw drops that file only; the rest of a multi-file
 * selection still lands.
 */
export function useComposer(uploadOne: (file: File) => Promise<ChatFile>) {
  const [files, setFiles] = useState<ChatFile[]>([])
  const [busy, setBusy] = useState(false)
  const [recording, setRecording] = useState(false)
  const [levels, setLevels] = useState<number[]>([])
  const [seconds, setSeconds] = useState(0)
  const [notice, setNotice] = useState('')
  const recorder = useRef<MediaRecorder | null>(null)
  const cancelled = useRef(false)

  const upload = useCallback(
    async (list: File[]) => {
      if (!list.length) return
      setBusy(true)
      for (const f of list) {
        try {
          const stored = await uploadOne(f)
          setFiles((prev) => [...prev, stored])
        } catch (cause) {
          setNotice(cause instanceof Error ? cause.message : 'File failed to upload.')
        }
      }
      setBusy(false)
    },
    [uploadOne],
  )

  const stopRecording = useCallback((discard: boolean) => {
    cancelled.current = discard
    recorder.current?.stop()
  }, [])

  const record = useCallback(async () => {
    if (recorder.current) {
      stopRecording(false)
      return
    }
    setNotice('')

    // Why this check exists: `navigator.mediaDevices` is undefined outside a
    // secure context, so on a phone hitting this app over plain http:// the old
    // code threw, was swallowed by the catch, and the button did nothing at all.
    // Say which of the two it is rather than failing silently.
    if (!navigator.mediaDevices?.getUserMedia) {
      setNotice(
        window.isSecureContext
          ? 'This browser can’t record audio.'
          : 'Voice notes need an HTTPS connection — attach an audio file instead.',
      )
      return
    }
    const type = pickRecordingType()
    if (typeof MediaRecorder === 'undefined') {
      setNotice('This browser can’t record audio.')
      return
    }

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (e) {
      const name = (e as DOMException)?.name
      setNotice(
        name === 'NotAllowedError' || name === 'SecurityError'
          ? 'Microphone permission denied.'
          : name === 'NotFoundError'
            ? 'No microphone found.'
            : 'Could not start recording.',
      )
      return
    }

    const rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined)
    const chunks: Blob[] = []

    // Live amplitude for the waveform, straight off the stream.
    const ctx = sharedAudioContext()
    if (ctx.state === 'suspended') await ctx.resume()
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 512
    const source = ctx.createMediaStreamSource(stream)
    source.connect(analyser)
    const frame = new Uint8Array(analyser.frequencyBinCount)
    const started = Date.now()
    const tick = setInterval(() => {
      analyser.getByteTimeDomainData(frame)
      let sum = 0
      for (const v of frame) sum += (v - 128) ** 2
      const rms = Math.sqrt(sum / frame.length) / 128
      setLevels((prev) => [...prev, Math.min(1, Math.max(0.06, rms * 3.2))].slice(-56))
      setSeconds(Math.floor((Date.now() - started) / 1000))
    }, 90)

    const teardown = () => {
      clearInterval(tick)
      source.disconnect()
      stream.getTracks().forEach((t) => t.stop())
      recorder.current = null
      setRecording(false)
      setLevels([])
      setSeconds(0)
    }

    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data) }
    rec.onstop = async () => {
      const discard = cancelled.current
      cancelled.current = false
      teardown()
      if (discard || !chunks.length) return
      const mime = rec.mimeType || type || 'audio/webm'
      const blob = new Blob(chunks, { type: mime })
      await upload([new File([blob], `voice-note.${extForAudio(mime)}`, { type: mime })])
    }

    recorder.current = rec
    rec.start()
    setLevels([])
    setSeconds(0)
    setRecording(true)
  }, [upload, stopRecording])

  // Leaving mid-recording must release the microphone; the take is discarded
  // rather than uploaded into a panel that is no longer there.
  useEffect(() => () => {
    if (recorder.current) {
      cancelled.current = true
      recorder.current.stop()
    }
  }, [])

  const onPaste = useCallback(
    (e: React.ClipboardEvent) => {
      const pasted = Array.from(e.clipboardData.files)
      if (pasted.length) {
        e.preventDefault()
        upload(pasted)
      }
    },
    [upload],
  )

  return {
    files,
    busy,
    recording,
    levels,
    seconds,
    notice,
    upload,
    record,
    cancelRecording: () => stopRecording(true),
    dismissNotice: () => setNotice(''),
    onPaste,
    clear: () => setFiles([]),
    drop: (name: string) => setFiles((prev) => prev.filter((f) => f.name !== name)),
  }
}

// ------------------------------------------------------------------ subviews

export function StatusDot({ pending }: { pending: boolean }) {
  return (
    <span
      className={cn(
        'size-1.5 flex-none rounded-full',
        pending ? 'animate-pulse bg-[var(--lps-warn-dot)]' : 'bg-[#5FAF65]',
      )}
    />
  )
}

/** `2026-08-18 21:26` — the message's own date and time, in the reader's zone.
 *  Fixed shape rather than a locale format: the transcript spans days, and a
 *  bare clock leaves yesterday's message reading as today's. */
export const fmtStamp = (ms: number) => {
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
/**
 * The scrolling half of a chat: history paging, pull-to-refresh, the jump
 * buttons, and the bubbles themselves.
 */
export function Transcript({
  messages, pending, error, hasMore, loadingMore, fileHref, empty, pendingLabel,
  suggestions = [], onSuggest, onAction, onRefresh, onLoadMore, mobile, wallpaper, displayText,
}: {
  messages: ChatMessage[]
  pending: boolean
  error: string
  hasMore: boolean
  loadingMore: boolean
  /** Where one message's file streams from — each surface scopes its own. */
  fileHref: (file: ChatFile) => string
  /** Shown while the transcript is empty — avatar, greeting, whatever fits. */
  empty: React.ReactNode
  /** `Rosie is working…` — who the reader is waiting on. */
  pendingLabel: string
  suggestions?: string[]
  onSuggest?: (s: string) => void
  onAction?: MarkdownAction
  /** Supplier-only copy transform; links and action targets stay untouched. */
  displayText?: (text: string) => string
  onRefresh: () => Promise<void>
  onLoadMore?: () => Promise<void>
  mobile?: boolean
  wallpaper: ChatWallpaperId
}) {
  const box = useRef<HTMLDivElement>(null)
  const pullStart = useRef<number | null>(null)
  // Height before an older page is prepended, so the layout effect below can
  // hold the reader's place instead of letting the new bubbles push it down.
  const anchor = useRef<number | null>(null)
  // Stay pinned to the newest message, but never yank the user back down while
  // they are scrolled up reading history.
  const pinned = useRef(true)
  const [atTop, setAtTop] = useState(true)
  const [atBottom, setAtBottom] = useState(true)
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [copied, setCopied] = useState<number | null>(null)
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (copiedTimer.current) clearTimeout(copiedTimer.current)
  }, [])

  const copyMessage = useCallback(async (message: ChatMessage) => {
    try {
      const text = messageText(message.text)
      await navigator.clipboard.writeText(
        displayText ? chatMarkdownPlainText(text, displayText) : text,
      )
      setCopied(message.id)
      if (copiedTimer.current) clearTimeout(copiedTimer.current)
      copiedTimer.current = setTimeout(() => setCopied(null), 1600)
    } catch {
      // Clipboard access can be denied; leave the affordance in its normal
      // state so it never falsely reports success.
    }
  }, [displayText])

  const updateEdges = useCallback((el: HTMLDivElement) => {
    const bottom = el.scrollHeight - el.scrollTop - el.clientHeight
    pinned.current = bottom < 40
    setAtTop(el.scrollTop < 40)
    setAtBottom(bottom < 40)
  }, [])

  const toBottom = useCallback((smooth = false) => {
    const el = box.current
    el?.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' })
  }, [])

  const toTop = useCallback(() => {
    box.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  // Layout effect, not effect: the jump happens before paint, so a reload opens
  // at the bottom instead of flashing the top of the transcript first.
  useLayoutEffect(() => {
    const el = box.current
    if (el && anchor.current !== null) {
      el.scrollTop += el.scrollHeight - anchor.current
      anchor.current = null
    } else if (pinned.current) {
      toBottom()
    }
    if (el) updateEdges(el)
  }, [messages.length, pending, toBottom, updateEdges])

  const loadMore = useCallback(async () => {
    if (loadingMore || !onLoadMore) return
    anchor.current = box.current?.scrollHeight ?? 0
    await onLoadMore()
  }, [loadingMore, onLoadMore])

  const finishPull = useCallback(async () => {
    pullStart.current = null
    if (pull < 54 || refreshing) {
      setPull(0)
      return
    }
    setRefreshing(true)
    setPull(48)
    try {
      await onRefresh()
    } finally {
      setRefreshing(false)
      setPull(0)
    }
  }, [onRefresh, pull, refreshing])

  return (
    <div className="relative flex min-h-0 flex-1 overflow-hidden">
      <div
      ref={box}
      onScroll={(e) => updateEdges(e.currentTarget)}
      onTouchStart={(e) => {
        if (e.touches.length === 1 && e.currentTarget.scrollTop <= 0) {
          pullStart.current = e.touches[0].clientY
        }
      }}
      onTouchMove={(e) => {
        if (pullStart.current === null || e.touches.length !== 1) return
        const distance = e.touches[0].clientY - pullStart.current
        if (distance <= 0) {
          setPull(0)
          return
        }
        e.preventDefault()
        setPull(Math.min(72, distance * 0.45))
      }}
      onTouchEnd={() => { void finishPull() }}
      onTouchCancel={() => { pullStart.current = null; setPull(0) }}
      className={cn(
        'font-chat flex min-h-0 flex-1 flex-col gap-3 overflow-x-hidden overflow-y-auto overscroll-y-contain',
        mobile ? 'bg-transparent px-4 pb-4 pt-[72px]' : 'bg-background p-4',
      )}
      style={mobile ? undefined : chatWallpaperStyle(wallpaper)}
    >
      {hasMore && onLoadMore && (
        <button
          type="button"
          onClick={() => { void loadMore() }}
          disabled={loadingMore}
          className="mx-auto cursor-pointer rounded-full border border-lps-edge bg-card px-3 py-1.5 text-[12px] font-semibold text-primary hover:bg-secondary disabled:cursor-default disabled:opacity-60"
        >
          {loadingMore ? 'Loading…' : 'Load earlier messages'}
        </button>
      )}

      {messages.length === 0 && !pending && (
        <div className="m-auto max-w-[280px] text-center text-[14px] leading-[1.4] text-muted-foreground">
          {empty}
        </div>
      )}

      {messages.map((m) => (
        <div
          key={m.id}
          className={cn(
            'flex min-w-0 max-w-[88%] flex-col gap-[3px]',
            m.role === 'user' ? 'items-end self-end' : 'items-start self-start',
          )}
        >
          {m.files.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {m.files.map((f) => (
                <Attachment
                  key={f.name}
                  href={fileHref(f)}
                  file={f}
                  mine={m.role === 'user'}
                  // An image finishing after layout pushes the transcript taller,
                  // which would otherwise leave the newest message off-screen.
                  onLoad={() => pinned.current && toBottom()}
                />
              ))}
            </div>
          )}
          {m.text && (
            <div
              className={cn(
                'max-w-full min-w-0 px-3 py-2.5 text-[16px] leading-[1.35] [overflow-wrap:anywhere]',
                m.role === 'user'
                  ? 'rounded-[12px_12px_4px_12px] bg-primary text-primary-foreground'
                  : 'rounded-[12px_12px_12px_4px] border border-[var(--chat-bubble-border,var(--lps-hair))] bg-lps-bubble text-foreground',
              )}
            >
              <Markdown text={m.text} onAction={onAction} displayText={displayText} />
            </div>
          )}
          <div className={cn('flex items-center gap-1 text-lps-dim', m.role === 'user' ? 'pr-1' : 'pl-1')}>
            <span className="text-[11px] leading-none">{fmtStamp(m.at)}</span>
            {m.text && (
              <button
                type="button"
                onClick={() => { void copyMessage(m) }}
                title={copied === m.id ? 'Copied' : 'Copy message'}
                aria-label={copied === m.id ? 'Message copied' : 'Copy message'}
                className="flex size-6 cursor-pointer items-center justify-center rounded-md text-lps-dim hover:bg-muted hover:text-foreground"
              >
                {copied === m.id ? <CheckIcon size={12} /> : <Copy size={12} />}
              </button>
            )}
          </div>
        </div>
      ))}

      {pending && (
        <div className="flex max-w-[88%] flex-col gap-[3px] self-start">
          <div className="flex items-center gap-2 rounded-[12px_12px_12px_4px] border border-[var(--chat-bubble-border,var(--lps-hair))] bg-lps-bubble px-3 py-2.5 text-[16px] text-muted-foreground">
            <span className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="size-1.5 animate-bounce rounded-full bg-lps-dim"
                  style={{ animationDelay: `${i * 140}ms` }}
                />
              ))}
            </span>
            {pendingLabel}
          </div>
        </div>
      )}

      {error && (
        <div className="self-center rounded-lg bg-lps-warn-bg px-3 py-1.5 text-[11.5px] font-semibold text-lps-warn-fg">
          {error}
        </div>
      )}

      {messages.length === 0 && suggestions.length > 0 && onSuggest && (
        <div className={cn('flex flex-wrap gap-1.5', mobile ? '' : 'pl-0.5')}>
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onSuggest(s)}
              className="cursor-pointer rounded-full border border-lps-edge bg-card px-3 py-1.5 text-[12px] font-semibold text-primary hover:bg-secondary"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      </div>

      {(pull > 0 || refreshing) && (
        <div
          className="pointer-events-none absolute left-1/2 top-2 z-20 flex size-9 -translate-x-1/2 items-center justify-center rounded-full border border-border bg-card text-primary shadow-[var(--lps-shadow)]"
          style={{ transform: `translate(-50%, ${Math.max(0, pull - 18)}px)` }}
          aria-live="polite"
        >
          <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          <span className="sr-only">{refreshing ? 'Refreshing conversation' : 'Pull to refresh'}</span>
        </div>
      )}

      {(!atTop || !atBottom) && (
        <div className="absolute bottom-3 right-3 z-20 flex flex-col gap-2">
          {!atTop && (
            <button
              type="button"
              onClick={toTop}
              aria-label="Jump to top of conversation"
              title="Jump to top"
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
              title="Jump to latest"
              className="flex size-9 items-center justify-center rounded-full border border-border bg-card text-primary shadow-[var(--lps-shadow)] hover:bg-muted"
            >
              <ArrowDown size={17} />
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/** The bottom half: staged attachments, the recorder, and the send box. */
export function Composer({
  composer, onSend, draft, setDraft, placeholder, accept, big,
}: {
  composer: ReturnType<typeof useComposer>
  onSend: () => void
  draft: string
  setDraft: (v: string) => void
  /** `Ask Rosie…` — the idle placeholder; uploading overrides it. */
  placeholder: string
  /** Optional `accept` for the file picker, where the route is fussier. */
  accept?: string
  big?: boolean
}) {
  const picker = useRef<HTMLInputElement>(null)
  const box = useRef<HTMLTextAreaElement>(null)
  const canSend = Boolean(draft.trim() || composer.files.length)

  // Grow the textarea with its content up to max-h, then scroll inside it.
  // Runs on every draft change so pastes and the post-send clear resize too.
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    el.style.height = 'auto'
    if (!draft) {
      // An empty box sizes itself from `rows` — Chrome counts a wrapped
      // *placeholder* in `scrollHeight`, so measuring here opens a composer
      // with a long placeholder at two rows.
      el.style.height = ''
      return
    }
    // `scrollHeight` stops at the padding edge, and the box is border-box, so
    // the border has to be added back or the last line is cropped.
    el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`
  }, [draft])

  return (
    <div className="flex-none border-t border-border bg-background">
      {composer.files.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-3.5 pt-2.5">
          {composer.files.map((f) => (
            <span
              key={f.name}
              className="inline-flex items-center gap-1.5 rounded-full border border-lps-edge bg-card py-1 pl-2.5 pr-1.5 text-[11px] font-semibold"
            >
              <span className="max-w-[140px] truncate">{f.label}</span>
              <button
                type="button"
                onClick={() => composer.drop(f.name)}
                aria-label={`Remove ${f.label}`}
                className="flex cursor-pointer items-center rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}

      {composer.notice && (
        <div className="flex items-start gap-2 px-3.5 pt-2.5 text-[11.5px] font-semibold text-lps-warn-fg">
          <span className="flex-1">{composer.notice}</span>
          <button
            type="button"
            onClick={composer.dismissNotice}
            aria-label="Dismiss"
            className="flex cursor-pointer items-center rounded p-0.5 hover:bg-muted"
          >
            <X size={11} />
          </button>
        </div>
      )}

      {composer.recording ? (
        <div className="flex items-center gap-2.5 px-3.5 py-3">
          <button
            type="button"
            onClick={composer.cancelRecording}
            title="Discard recording"
            aria-label="Discard recording"
            className="flex flex-none cursor-pointer items-center justify-center rounded-lg border-none bg-transparent p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive"
          >
            <Trash2 size={big ? 17 : 15} />
          </button>
          <span className="size-2 flex-none animate-pulse rounded-full bg-destructive" />
          <span className="w-8 flex-none text-[11.5px] font-semibold tabular-nums">{fmtTime(composer.seconds)}</span>

          {/* Live level meter — newest sample on the right, like WhatsApp. */}
          <div className="flex h-7 min-w-0 flex-1 items-center justify-end gap-[2px] overflow-hidden">
            {composer.levels.map((l, i) => (
              <span
                key={i}
                className="w-[3px] flex-none rounded-full bg-primary"
                style={{ height: `${Math.round(l * 100)}%`, opacity: 0.35 + (i / Math.max(1, composer.levels.length)) * 0.65 }}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={composer.record}
            title="Stop and attach"
            aria-label="Stop recording and attach"
            className={cn(
              'flex flex-none cursor-pointer items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90',
              big ? 'size-10' : 'size-9',
            )}
          >
            <CheckIcon size={big ? 17 : 15} />
          </button>
        </div>
      ) : (
      <div className="flex items-end gap-2 px-3.5 py-3">
        <input
          ref={picker}
          type="file"
          multiple
          hidden
          accept={accept}
          onChange={(e) => {
            composer.upload(Array.from(e.target.files ?? []))
            e.target.value = ''
          }}
        />
        <button
          type="button"
          onClick={() => picker.current?.click()}
          title="Attach a file"
          aria-label="Attach a file"
          className="mb-1 flex flex-none cursor-pointer items-center justify-center rounded-lg border-none bg-transparent p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Paperclip size={big ? 17 : 15} />
        </button>
        <button
          type="button"
          onClick={composer.record}
          title="Record a voice note"
          aria-label="Record a voice note"
          className="mb-1 flex flex-none cursor-pointer items-center justify-center rounded-lg border-none bg-transparent p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Mic size={big ? 17 : 15} />
        </button>

        <textarea
          ref={box}
          value={draft}
          rows={1}
          onChange={(e) => setDraft(e.target.value)}
          onPaste={composer.onPaste}
          onKeyDown={(e) => {
            // `big` is the mobile sheet: there Enter inserts a newline and
            // only the Send button sends. On desktop Enter sends, Shift+Enter
            // inserts a newline.
            if (e.key === 'Enter' && !e.shiftKey && !big) {
              e.preventDefault()
              onSend()
            }
          }}
          placeholder={composer.busy ? 'Uploading…' : placeholder}
          className={cn(
            'font-chat max-h-40 min-w-0 flex-1 resize-none overflow-y-auto rounded-md border border-input bg-card px-3 text-[16px] leading-6 outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
            big ? 'min-h-10 py-2' : 'min-h-9 py-1.5',
          )}
        />
        <button
          type="button"
          onClick={onSend}
          disabled={!canSend}
          aria-label="Send"
          className={cn(
            'flex flex-none cursor-pointer items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50',
            big ? 'size-10' : 'size-9',
          )}
        >
          <Send size={big ? 16 : 15} />
        </button>
      </div>
      )}
    </div>
  )
}

// ------------------------------------------------------------- thread picker

/** One of the Full / 50% / 30% width presets, lit when the panel matches it. */
export function SizePill({
  label, width, target, onPick,
}: {
  label: string
  width: number
  target: () => number
  onPick: (w: number) => void
}) {
  const [active, setActive] = useState(false)
  // window isn't there during the server render, so compare after mount.
  useEffect(() => { setActive(Math.abs(width - target()) < 8) }, [width, target])
  return (
    <button
      type="button"
      onClick={() => onPick(target())}
      title="Resize panel"
      className={cn(
        'cursor-pointer rounded-full border px-2 py-[3px] text-[10.5px] font-bold',
        active ? 'border-primary bg-secondary text-primary' : 'border-border bg-transparent text-muted-foreground',
      )}
    >
      {label}
    </button>
  )
}
