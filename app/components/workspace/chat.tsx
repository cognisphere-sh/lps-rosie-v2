'use client'

import Image from 'next/image'
import {
  useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState,
} from 'react'
import { ArrowDown, ArrowUp, Mic, Pause, Paperclip, Play, RefreshCw, Send, Trash2, X } from 'lucide-react'

import { CheckIcon, ChevronLeft, ChevronRight } from '@/components/workspace/icons'
import { AGENTS, CHAT_AGENTS, type Agent } from '@/lib/agents'
import {
  chatThemeForAgent, chatThemeStyle, chatWallpaperStyle,
  type ChatAppearance, type ChatWallpaperId,
} from '@/lib/chat-appearance'
import { cn } from '@/lib/utils'

// --------------------------------------------------------------------- types

type ChatFile = { name: string; label: string; mime: string; size: number }
type ChatMessage = {
  id: number
  at: number
  role: 'user' | 'agent'
  text: string
  files: ChatFile[]
}

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

// ------------------------------------------------------------------ markdown

/**
 * The agent writes markdown; this renders the subset that actually shows up in
 * a chat bubble — bold, inline code, links, and bullet lists.
 *
 * ponytail: ~30 lines instead of a markdown dependency. If tables or nested
 * lists ever matter, swap in `marked` + a sanitizer rather than growing this.
 */
function inline(text: string, key: string) {
  const parts: React.ReactNode[] = []
  const re = /\*\*(.+?)\*\*|`([^`]+)`|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|(https?:\/\/[^\s<]+)/g
  let last = 0
  let m: RegExpExecArray | null
  let i = 0
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    const k = `${key}-${i++}`
    if (m[1]) parts.push(<strong key={k}>{m[1]}</strong>)
    else if (m[2]) parts.push(<code key={k} className="rounded bg-muted px-1 py-px font-mono text-[13.5px]">{m[2]}</code>)
    else if (m[3]) parts.push(<a key={k} href={m[4]} target="_blank" rel="noreferrer" className="underline">{m[3]}</a>)
    else parts.push(<a key={k} href={m[5]} target="_blank" rel="noreferrer" className="underline">{m[5]}</a>)
    last = re.lastIndex
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

function Markdown({ text }: { text: string }) {
  const blocks: React.ReactNode[] = []
  // Some CLI replies arrive with JSON-style line breaks as literal `\\n`.
  // Normalize them here so existing transcript entries render correctly too.
  const lines = text.replace(/\\r\\n|\\n|\\r/g, '\n').split('\n')
  let bullets: string[] = []
  const flush = (key: string) => {
    if (!bullets.length) return
    blocks.push(
      <ul key={`ul-${key}`} className="my-1 list-disc space-y-0.5 pl-4">
        {bullets.map((b, i) => <li key={i}>{inline(b, `${key}-${i}`)}</li>)}
      </ul>,
    )
    bullets = []
  }
  lines.forEach((line, i) => {
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line)
    if (bullet) { bullets.push(bullet[1]); return }
    flush(String(i))
    if (line.trim()) blocks.push(<p key={i} className="my-0">{inline(line, String(i))}</p>)
  })
  flush('end')
  return <div className="flex flex-col gap-1">{blocks}</div>
}

// ---------------------------------------------------------------- audio bits

const BARS = 40

const fmtTime = (s: number) =>
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
function VoicePlayer({ src, mine }: { src: string; mine: boolean }) {
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

function Attachment({
  agent, file, mine, onLoad,
}: {
  agent: string
  file: ChatFile
  mine: boolean
  onLoad?: () => void
}) {
  const href = `/api/chat/${agent}/file?name=${encodeURIComponent(file.name)}`
  if (file.mime.startsWith('image/')) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className="block">
        {/* Plain <img>: these come from the agent's inbox at runtime, so there
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

/** Everything the panel and the mobile sheet share: transport + composer state. */
function useChat(agentId: string, active: boolean) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const cursor = useRef(0)
  // Oldest id held, so "load earlier" knows where the page it has starts.
  const oldest = useRef(0)

  // Switching agents means a different transcript — reset before the next poll.
  useEffect(() => {
    cursor.current = 0
    oldest.current = 0
    setMessages([])
    setPending(false)
    setHasMore(false)
  }, [agentId])

  const poll = useCallback(async () => {
    // First fetch of a transcript takes only the newest page; every poll after
    // it is a delta, so `limit` would be free to drop a message.
    const first = cursor.current === 0
    try {
      const res = await fetch(
        `/api/chat/${agentId}/messages?since=${cursor.current}${first ? `&limit=${PAGE}` : ''}`,
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
    } catch {
      setError('Can’t reach the agent.')
    }
  }, [agentId])

  const loadMore = useCallback(async () => {
    if (!oldest.current) return
    setLoadingMore(true)
    try {
      const res = await fetch(
        `/api/chat/${agentId}/messages?before=${oldest.current}&limit=${PAGE}`,
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
  }, [agentId])

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
          body: JSON.stringify({ text, attachments: files }),
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
    [agentId],
  )

  const reset = useCallback(async () => {
    await fetch(`/api/chat/${agentId}/reset`, { method: 'POST' })
    cursor.current = 0
    oldest.current = 0
    setMessages([])
    setPending(false)
    setHasMore(false)
  }, [agentId])

  return { messages, pending, error, hasMore, loadingMore, send, reset, loadMore, refresh: poll }
}

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

/** Upload + record + paste — the composer's attachment plumbing. */
function useComposer(agentId: string) {
  const [files, setFiles] = useState<ChatFile[]>([])
  const [busy, setBusy] = useState(false)
  const [recording, setRecording] = useState(false)
  const [levels, setLevels] = useState<number[]>([])
  const [seconds, setSeconds] = useState(0)
  const [micError, setMicError] = useState('')
  const recorder = useRef<MediaRecorder | null>(null)
  const cancelled = useRef(false)

  const upload = useCallback(
    async (list: File[]) => {
      if (!list.length) return
      setBusy(true)
      for (const f of list) {
        try {
          const res = await fetch(`/api/chat/${agentId}/upload`, {
            method: 'POST',
            // Header values must be ASCII; the display name travels in the
            // send payload instead, so mangling here is harmless.
            headers: { 'x-file-name': encodeURIComponent(f.name), 'content-type': f.type || 'application/octet-stream' },
            body: f,
          })
          if (!res.ok) continue
          const stored = (await res.json()) as { name: string }
          setFiles((prev) => [
            ...prev,
            { name: stored.name, label: f.name, mime: f.type || 'application/octet-stream', size: f.size },
          ])
        } catch {
          /* one failed upload shouldn't drop the rest */
        }
      }
      setBusy(false)
    },
    [agentId],
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
    setMicError('')

    // Why this check exists: `navigator.mediaDevices` is undefined outside a
    // secure context, so on a phone hitting this app over plain http:// the old
    // code threw, was swallowed by the catch, and the button did nothing at all.
    // Say which of the two it is rather than failing silently.
    if (!navigator.mediaDevices?.getUserMedia) {
      setMicError(
        window.isSecureContext
          ? 'This browser can’t record audio.'
          : 'Voice notes need an HTTPS connection — attach an audio file instead.',
      )
      return
    }
    const type = pickRecordingType()
    if (typeof MediaRecorder === 'undefined') {
      setMicError('This browser can’t record audio.')
      return
    }

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (e) {
      const name = (e as DOMException)?.name
      setMicError(
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
    micError,
    upload,
    record,
    cancelRecording: () => stopRecording(true),
    dismissMicError: () => setMicError(''),
    onPaste,
    clear: () => setFiles([]),
    drop: (name: string) => setFiles((prev) => prev.filter((f) => f.name !== name)),
  }
}

// ------------------------------------------------------------------ subviews

function StatusDot({ pending }: { pending: boolean }) {
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
const fmtStamp = (ms: number) => {
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function Transcript({
  agent, messages, pending, error, hasMore, loadingMore, onSuggest, onRefresh, onLoadMore,
  mobile, wallpaper,
}: {
  agent: Agent
  messages: ChatMessage[]
  pending: boolean
  error: string
  hasMore: boolean
  loadingMore: boolean
  onSuggest: (s: string) => void
  onRefresh: () => Promise<void>
  onLoadMore: () => Promise<void>
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
    if (loadingMore) return
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
      className="font-chat flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-y-contain bg-background p-4"
      style={chatWallpaperStyle(wallpaper)}
    >
      {hasMore && (
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
        <div className="m-auto max-w-[260px] text-center text-[14px] leading-[1.4] text-muted-foreground">
          <Image src={agent.avatar} alt="" width={56} height={56} className="mx-auto mb-3 rounded-full" />
          {agent.intro}
        </div>
      )}

      {messages.map((m) => (
        <div
          key={m.id}
          className={cn(
            'flex max-w-[88%] flex-col gap-[3px]',
            m.role === 'user' ? 'items-end self-end' : 'items-start self-start',
          )}
        >
          {m.files.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {m.files.map((f) => (
                <Attachment
                  key={f.name}
                  agent={agent.id}
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
                'px-3 py-2.5 text-[16px] leading-[1.35]',
                m.role === 'user'
                  ? 'rounded-[12px_12px_4px_12px] bg-primary text-primary-foreground'
                  : 'rounded-[12px_12px_12px_4px] border border-[var(--chat-bubble-border,var(--lps-hair))] bg-lps-bubble text-foreground',
              )}
            >
              <Markdown text={m.text} />
            </div>
          )}
          <span className={cn('text-[11px] leading-none text-lps-dim', m.role === 'user' ? 'pr-1' : 'pl-1')}>
            {fmtStamp(m.at)}
          </span>
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
            {agent.name} is working…
          </div>
        </div>
      )}

      {error && (
        <div className="self-center rounded-lg bg-lps-warn-bg px-3 py-1.5 text-[11.5px] font-semibold text-lps-warn-fg">
          {error}
        </div>
      )}

      {messages.length === 0 && (
        <div className={cn('flex flex-wrap gap-1.5', mobile ? '' : 'pl-0.5')}>
          {agent.suggestions.map((s) => (
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

function Composer({
  agent, composer, onSend, draft, setDraft, big,
}: {
  agent: Agent
  composer: ReturnType<typeof useComposer>
  onSend: () => void
  draft: string
  setDraft: (v: string) => void
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
    el.style.height = `${el.scrollHeight}px`
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

      {composer.micError && (
        <div className="flex items-start gap-2 px-3.5 pt-2.5 text-[11.5px] font-semibold text-lps-warn-fg">
          <span className="flex-1">{composer.micError}</span>
          <button
            type="button"
            onClick={composer.dismissMicError}
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
          placeholder={composer.busy ? 'Uploading…' : `Ask ${agent.name}…`}
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

// -------------------------------------------------------------------- panels

/**
 * Desktop: a resizable docked panel, or a 46px rail when hidden.
 * Mobile: a full-screen sheet, opened from the bottom tab bar.
 *
 * Rendered by `shell.tsx`; `mobileOpen` is owned there so the active bottom
 * agent tab can toggle the sheet without a redundant close button.
 */
export function AgentChat({
  isMobile, mobileOpen, mobileAgentId, appearance, onMobileBack,
  desktopFull = false, desktopPeekOpen = false,
  onDesktopFull, onDesktopExitFull, onDesktopPeekToggle,
}: {
  isMobile: boolean
  mobileOpen: boolean
  /** Mobile only: which agent the Agents list picked — the sheet has no rail. */
  mobileAgentId?: string
  appearance: ChatAppearance
  /** Returns the mobile conversation to the Agents channel list. */
  onMobileBack?: () => void
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
  const hydrated = useRef(false)

  const activeId = isMobile ? mobileAgentId ?? CHAT_AGENTS[0].id : agentId
  const agent = useMemo(() => CHAT_AGENTS.find((a) => a.id === activeId) ?? CHAT_AGENTS[0], [activeId])
  const visible = isMobile ? mobileOpen : open
  const chat = useChat(agent.id, visible)
  const composer = useComposer(agent.id)

  // Restore the docked panel's state after mount, so the server render and the
  // first client render agree (same guard the table layout uses).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORE)
      const saved = raw
        ? (JSON.parse(raw) as { open?: boolean; width?: number; agent?: string })
        : null
      setOpen(saved?.open ?? window.innerWidth >= 1180)
      // Every page mounts its own Shell, so without this the panel would drop
      // back to the first agent on each navigation or refresh.
      if (saved?.agent && CHAT_AGENTS.some((a) => a.id === saved.agent)) setAgentId(saved.agent)
      if (saved?.width) {
        // Migrate the previous Full preset (viewport minus rail + 240px peek)
        // into the new true-Full layout instead of restoring it as an arbitrary
        // wide panel.
        const wasFull = saved.width >= window.innerWidth - 340
        const restored = wasFull ? fullDesktopChatWidth() : clampDesktopChatWidth(saved.width)
        setWidth(restored)
        // `useIsMobile()` begins false until its media-query effect runs. Check
        // the real viewport before restoring desktop-only Shell state, or a
        // saved Full width can zero out the mobile workspace during hydration.
        const desktopViewport = window.matchMedia('(min-width: 900px)').matches
        if (desktopViewport && (wasFull || restored >= fullDesktopChatWidth() - 8)) onDesktopFull?.()
      }
    } catch {
      setOpen(window.innerWidth >= 1180)
    }
    hydrated.current = true
  }, [])

  useEffect(() => {
    if (!hydrated.current) return
    window.localStorage.setItem(STORE, JSON.stringify({ open, width, agent: agentId }))
  }, [open, width, agentId])

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
      'flex flex-none items-center gap-2.5 border-b border-border',
      big ? 'px-3 py-2' : 'px-4 py-3',
    )}>
      {big && onMobileBack && (
        <button
          type="button"
          onClick={onMobileBack}
          aria-label="Back to Agents"
          className="flex size-8 flex-none cursor-pointer items-center justify-center rounded-full border-none bg-transparent text-foreground hover:bg-muted"
        >
          <ChevronLeft size={18} />
        </button>
      )}
      <Image
        src={agent.avatar}
        alt=""
        width={30}
        height={30}
        className={cn('flex-none rounded-full object-cover', big ? 'size-[26px]' : 'size-[30px]')}
      />
      {big ? (
        <div className="flex min-w-0 flex-1 items-center gap-1.5 text-[12px]">
          <span className="flex-none text-[14px] font-bold">{agent.name}</span>
          <span className="text-lps-dim">·</span>
          <span className="flex-none text-muted-foreground">{agent.role}</span>
          <span className="text-lps-dim">·</span>
          <span className="inline-flex min-w-0 items-center gap-1.5 truncate text-muted-foreground">
            <StatusDot pending={chat.pending} />
            {chat.pending ? 'Working…' : 'Online'}
          </span>
        </div>
      ) : (
        <div className="flex min-w-0 flex-1 flex-col gap-px">
          <span className="text-[13.5px] font-bold">{agent.name}</span>
          <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <StatusDot pending={chat.pending} />
            {chat.pending ? 'Working…' : 'Online'}
          </span>
        </div>
      )}
      {/* The other agents, so the docked panel can switch without being closed
          back to the rail. Mobile switches from its own Agents list instead. */}
      {!big && (
        <div className="flex flex-none items-center gap-1.5">
          {AGENTS.filter((a) => a.id !== agent.id).map((a) => (
            <button
              key={a.id}
              type="button"
              disabled={a.upcoming}
              onClick={() => setAgentId(a.id)}
              aria-label={`Switch to ${a.name}`}
              title={a.upcoming ? `${a.name} · Coming soon` : `Switch to ${a.name} · ${a.role}`}
              className={cn(
                'flex size-[22px] flex-none border-none bg-transparent p-0',
                a.upcoming ? 'cursor-not-allowed opacity-35' : 'cursor-pointer opacity-55 hover:opacity-100',
              )}
            >
              <Image src={a.avatar} alt="" width={22} height={22} className="size-[22px] rounded-full object-cover" />
            </button>
          ))}
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
        style={chatThemeStyle(chatThemeForAgent(appearance, agent.id))}
      >
        {header(true)}
        <Transcript
          agent={agent}
          messages={chat.messages}
          pending={chat.pending}
          error={chat.error}
          hasMore={chat.hasMore}
          loadingMore={chat.loadingMore}
          onSuggest={setDraft}
          onRefresh={chat.refresh}
          onLoadMore={chat.loadMore}
          mobile
          wallpaper={appearance.wallpaper}
        />
        <Composer agent={agent} composer={composer} onSend={send} draft={draft} setDraft={setDraft} big />
      </div>
    )
  }

  // ------------------------------------------------------------ desktop rail
  if (!open) {
    return (
      <div className="flex w-[46px] flex-none flex-col items-center gap-3.5 border-l border-border bg-card py-3.5">
        {AGENTS.map((a) => (
          <button
            key={a.id}
            type="button"
            disabled={a.upcoming}
            onClick={() => { setAgentId(a.id); setOpen(true) }}
            aria-label={a.name}
            title={a.upcoming ? `${a.name} · Coming soon` : `${a.name} · ${a.role}`}
            className={cn(
              'flex flex-col items-center gap-2.5 border-none bg-transparent p-0 text-muted-foreground',
              a.upcoming ? 'cursor-not-allowed opacity-45' : 'cursor-pointer hover:text-foreground',
            )}
          >
            <span className="relative inline-flex">
              <Image src={a.avatar} alt="" width={26} height={26} className="size-[26px] rounded-full object-cover" />
              {a.id === agentId && chat.pending && (
                <span className="absolute -bottom-px -right-px size-2 rounded-full border border-card bg-[var(--lps-warn-dot)]" />
              )}
            </span>
            <span className="text-[11px] font-bold uppercase tracking-[.08em] [writing-mode:vertical-rl]">
              {a.name}
            </span>
          </button>
        ))}
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
        agent={agent}
        messages={chat.messages}
        pending={chat.pending}
        error={chat.error}
        hasMore={chat.hasMore}
        loadingMore={chat.loadingMore}
        onSuggest={setDraft}
        onRefresh={chat.refresh}
        onLoadMore={chat.loadMore}
        wallpaper={appearance.wallpaper}
      />
      <Composer agent={agent} composer={composer} onSend={send} draft={draft} setDraft={setDraft} />
    </div>
  )
}

/** One of the Full / 50% / 30% width presets, lit when the panel matches it. */
function SizePill({
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
