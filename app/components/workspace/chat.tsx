'use client'

import Image from 'next/image'
import {
  useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState,
} from 'react'
import { Mic, Pause, Paperclip, Play, Send, Trash2, X } from 'lucide-react'

import { CheckIcon, ChevronRight } from '@/components/workspace/icons'
import { AGENTS, CHAT_AGENTS, type Agent } from '@/lib/agents'
import { chatThemeStyle, type ChatAppearance } from '@/lib/chat-appearance'
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
const MIN_W = 280
const STORE = 'lps.chat.v1'

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
    else if (m[2]) parts.push(<code key={k} className="rounded bg-muted px-1 py-px font-mono text-[11.5px]">{m[2]}</code>)
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
        mine ? 'bg-primary text-primary-foreground' : 'border border-lps-hair bg-lps-bubble text-foreground',
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
  const cursor = useRef(0)

  // Switching agents means a different transcript — reset before the next poll.
  useEffect(() => {
    cursor.current = 0
    setMessages([])
    setPending(false)
  }, [agentId])

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/chat/${agentId}/messages?since=${cursor.current}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(String(res.status))
      const body = (await res.json()) as { messages: ChatMessage[]; pending: boolean; cursor: number }
      if (body.messages.length) {
        setMessages((prev) => [...prev, ...body.messages])
        cursor.current = body.messages[body.messages.length - 1].id
      }
      setPending(body.pending)
      setError('')
    } catch {
      setError('Can’t reach the agent.')
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
    setMessages([])
    setPending(false)
  }, [agentId])

  return { messages, pending, error, send, reset }
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

function Transcript({
  agent, messages, pending, error, onSuggest, mobile, wallpaper,
}: {
  agent: Agent
  messages: ChatMessage[]
  pending: boolean
  error: string
  onSuggest: (s: string) => void
  mobile?: boolean
  wallpaper?: boolean
}) {
  const box = useRef<HTMLDivElement>(null)
  // Stay pinned to the newest message, but never yank the user back down while
  // they are scrolled up reading history.
  const pinned = useRef(true)

  const toBottom = useCallback(() => {
    const el = box.current
    if (el) el.scrollTop = el.scrollHeight
  }, [])

  // Layout effect, not effect: the jump happens before paint, so a reload opens
  // at the bottom instead of flashing the top of the transcript first.
  useLayoutEffect(() => {
    if (pinned.current) toBottom()
  }, [messages.length, pending, toBottom])

  return (
    <div
      ref={box}
      onScroll={(e) => {
        const el = e.currentTarget
        pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40
      }}
      className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto bg-background p-4"
      style={wallpaper ? {
        backgroundImage: "url('/desert-plants-chat.svg')",
        backgroundRepeat: 'repeat',
        backgroundSize: '320px 320px',
      } : undefined}
    >
      {messages.length === 0 && !pending && (
        <div className="m-auto max-w-[240px] text-center text-[12.5px] text-muted-foreground">
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
                'px-3 py-2.5 text-[12.5px] leading-[1.5]',
                m.role === 'user'
                  ? 'rounded-[12px_12px_4px_12px] bg-primary text-primary-foreground'
                  : 'rounded-[12px_12px_12px_4px] border border-lps-hair bg-lps-bubble text-foreground',
              )}
            >
              <Markdown text={m.text} />
            </div>
          )}
          <span className={cn('text-[10.5px] text-lps-dim', m.role === 'user' ? 'pr-1' : 'pl-1')}>
            {new Date(m.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
          </span>
        </div>
      ))}

      {pending && (
        <div className="flex max-w-[88%] flex-col gap-[3px] self-start">
          <div className="flex items-center gap-2 rounded-[12px_12px_12px_4px] border border-lps-hair bg-lps-bubble px-3 py-2.5 text-[12.5px] text-muted-foreground">
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
  const canSend = Boolean(draft.trim() || composer.files.length)

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
      <div className="flex items-center gap-2 px-3.5 py-3">
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
          className="flex flex-none cursor-pointer items-center justify-center rounded-lg border-none bg-transparent p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Paperclip size={big ? 17 : 15} />
        </button>
        <button
          type="button"
          onClick={composer.record}
          title="Record a voice note"
          aria-label="Record a voice note"
          className="flex flex-none cursor-pointer items-center justify-center rounded-lg border-none bg-transparent p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Mic size={big ? 17 : 15} />
        </button>

        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onPaste={composer.onPaste}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              onSend()
            }
          }}
          placeholder={composer.busy ? 'Uploading…' : `Ask ${agent.name}…`}
          className={cn(
            'min-w-0 flex-1 rounded-md border border-input bg-card px-3 text-[12.5px] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
            big ? 'h-10' : 'h-9',
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
  isMobile, mobileOpen, mobileAgentId, appearance,
}: {
  isMobile: boolean
  mobileOpen: boolean
  /** Mobile only: which agent the tab bar picked — the sheet has no rail. */
  mobileAgentId?: string
  appearance: ChatAppearance
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
      const saved = raw ? (JSON.parse(raw) as { open?: boolean; width?: number }) : null
      setOpen(saved?.open ?? window.innerWidth >= 1180)
      if (saved?.width) setWidth(saved.width)
    } catch {
      setOpen(window.innerWidth >= 1180)
    }
    hydrated.current = true
  }, [])

  useEffect(() => {
    if (!hydrated.current) return
    window.localStorage.setItem(STORE, JSON.stringify({ open, width }))
  }, [open, width])

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
    const startX = e.clientX
    const startW = width
    const move = (ev: MouseEvent) =>
      setWidth(Math.min(Math.max(startW + (startX - ev.clientX), MIN_W), Math.max(320, window.innerWidth - 260)))
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
        style={chatThemeStyle(appearance.theme)}
      >
        {header(true)}
        <Transcript
          agent={agent}
          messages={chat.messages}
          pending={chat.pending}
          error={chat.error}
          onSuggest={setDraft}
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
      style={{ width, ...chatThemeStyle(appearance.theme) }}
    >
      <div
        onMouseDown={startResize}
        title="Drag to resize"
        className="absolute -left-[3px] bottom-0 top-0 z-20 w-[7px] cursor-col-resize hover:bg-lps-edge"
      />
      {header()}

      <div className="flex flex-none items-center gap-1 border-b border-border px-3 py-2">
        {([['Full', () => Math.max(320, window.innerWidth - 260)], ['50%', () => Math.round(window.innerWidth * 0.5)], ['30%', () => Math.round(window.innerWidth * 0.3)]] as const).map(
          ([label, w]) => (
            <SizePill key={label} label={label} width={width} target={w} onPick={setWidth} />
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
          onClick={() => setOpen(false)}
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
        onSuggest={setDraft}
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
