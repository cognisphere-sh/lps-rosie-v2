'use client'

// The pieces of an availability request that two apps draw: the supplier
// portal (where the lines are answered) and the admin supplier profile (where
// the answers are read). Nothing here knows which side it is on beyond the
// props that say so — `editable` for the line table, `ownSide` for the thread.

import { useState } from 'react'

import { AGENTS } from '@/lib/agents'
import {
  AR_RESPONSE_OPTIONS,
  CHANNEL_META,
  arResponseLabel,
  arResponseTone,
  arStatusLabel,
  arStatusTone,
  type ARItem,
  type MessageChannel,
  type SupplierMessage,
} from '@/lib/availability'
import { money, num } from '@/lib/format'
import { toneDot, toneStyle, toneTint } from '@/lib/job-requests'
import { cn } from '@/lib/utils'

/** Agent senders draw solid; a person on our side (Chris) draws outlined. */
const AGENT_NAMES = new Set(AGENTS.map((a) => a.id))
const isAgentSender = (name: string | null) => !!name && AGENT_NAMES.has(name.toLowerCase())

/** Need · Size · Plant · Status · Avail qty · Price · Notes. */
const LINE_COLUMNS =
  '56px 90px minmax(200px,1.5fr) 150px 90px 100px minmax(200px,1fr)'
/** Under this the columns would crush, so the table scrolls sideways instead. */
const GRID_MIN = 860

/** `Aug 19, 2:41 PM` — a thread timestamp; the date matters, the zone doesn't. */
export function formatWhen(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

/** The request's lifecycle pill — New / Submitted / Closed. */
export function ARStatusPill({ status }: { status: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold"
      style={toneStyle(arStatusTone(status))}
    >
      <span className="size-1.5 rounded-full" style={{ background: toneDot(arStatusTone(status)) }} />
      {arStatusLabel(status)}
    </span>
  )
}

/** Where a message actually happened — portal, email, text, or internal. */
export function ChannelBadge({ channel }: { channel: MessageChannel }) {
  const meta = CHANNEL_META[channel] ?? { label: channel, tone: 'grey' as const }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border px-1.5 py-px text-[9.5px] font-bold uppercase tracking-wide text-muted-foreground">
      <span className="size-1.5 rounded-full" style={{ background: toneDot(meta.tone) }} />
      {meta.label}
    </span>
  )
}

/**
 * The chat view's key — what each colour and side means, as the design's
 * legend row. The same row on both sides of the conversation, with the side
 * words flipped to the reader: the supplier's copy also drops Internal,
 * because internal messages never reach their thread.
 */
export function ChatLegend({
  ownSide = 'broker',
  supplierLabel = 'Supplier',
}: {
  ownSide?: 'broker' | 'supplier'
  supplierLabel?: string
}) {
  const dot = (tone: Parameters<typeof toneDot>[0]) => (
    <span className="size-2 flex-none rounded-full" style={{ background: toneDot(tone) }} />
  )
  const broker = ownSide === 'broker'
  const ourSide = broker ? 'right' : 'left'
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-lps-hair bg-lps-headrow px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
      <span className="font-bold text-lps-dim">Legend</span>
      <span className="inline-flex items-center gap-1">{dot('green')} Text</span>
      <span className="inline-flex items-center gap-1">{dot('teal')} Email</span>
      <span className="inline-flex items-center gap-1">{dot('lime')} Portal</span>
      {broker && <span className="inline-flex items-center gap-1">{dot('grey')} Internal</span>}
      <span className="normal-case">Agent ({ourSide}, solid)</span>
      <span className="normal-case">Staff ({ourSide}, outlined)</span>
      <span className="normal-case">{broker ? `${supplierLabel} (left)` : 'You (right)'}</span>
    </div>
  )
}

/**
 * The supplier's per-line answer, as a pill-styled picker.
 *
 * A native <select> under a styled face: the four-word vocabulary plus the
 * blank "Set status" state, which is a real state (unanswered), not a default.
 */
function ResponseSelect({
  value,
  disabled,
  onChange,
}: {
  value: string | null
  disabled: boolean
  onChange: (next: string) => void
}) {
  const tone = arResponseTone(value)
  return (
    <span
      className={cn(
        'relative inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold',
        !disabled && 'cursor-pointer',
      )}
      style={toneStyle(tone)}
    >
      <span className="size-1.5 rounded-full" style={{ background: toneDot(tone) }} />
      {arResponseLabel(value)}
      {!disabled && (
        <select
          aria-label="Line status"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 cursor-pointer opacity-0"
        >
          <option value="">Set status…</option>
          {AR_RESPONSE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      )}
    </span>
  )
}

/** One answer field — a small input that saves on blur, or plain text. */
function AnswerCell({
  value,
  editable,
  align = 'left',
  placeholder,
  display,
  onCommit,
}: {
  value: string
  editable: boolean
  align?: 'left' | 'right'
  placeholder: string
  /** How the committed value reads when not editable (money, thousands). */
  display: string
  onCommit: (next: string) => void
}) {
  const [draft, setDraft] = useState(value)
  if (!editable) {
    return (
      <span
        className={cn(
          'truncate px-1 text-[12.5px] tabular-nums',
          align === 'right' && 'text-right',
          display ? 'text-foreground' : 'text-lps-dim',
        )}
        title={display || undefined}
      >
        {display || '—'}
      </span>
    )
  }
  return (
    <input
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft.trim() !== value.trim()) onCommit(draft)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
      }}
      className={cn(
        'h-7 w-full min-w-0 rounded-md border border-input bg-background px-1.5 text-[12.5px] outline-none placeholder:text-lps-dim focus-visible:border-ring focus-visible:ring-[2px] focus-visible:ring-ring/50',
        align === 'right' && 'text-right tabular-nums',
      )}
    />
  )
}

function LineRow({
  item,
  editable,
  onPatch,
}: {
  item: ARItem
  editable: boolean
  onPatch?: (itemId: number, changes: Record<string, string>) => Promise<void>
}) {
  const commit = (column: string) => (next: string) => {
    void onPatch?.(item.id, { [column]: next.trim() })
  }
  // The admin line table's row treatment: the answer's tone as a left accent
  // bar and a tint over the whole row, so a scanned table reads by colour.
  // An unanswered line is grey — pending is a real state, not an absence.
  const tone = arResponseTone(item.status)
  return (
    <div
      className="grid items-center gap-x-2 border-b border-lps-hair last:border-b-0"
      style={{
        gridTemplateColumns: LINE_COLUMNS,
        minWidth: GRID_MIN,
        minHeight: 56,
        padding: '7px 12px',
        borderLeft: `3px solid ${toneDot(tone)}`,
        background: toneTint(tone),
      }}
    >
      <span className="px-1 text-[12.5px] font-semibold tabular-nums text-foreground">
        {num(item.quantity) || '—'}
      </span>
      <span className="truncate px-1 text-[12px] text-muted-foreground" title={item.size ?? undefined}>
        {item.size ?? '—'}
      </span>
      <span className="min-w-0 truncate px-1 text-[13px] font-semibold text-foreground" title={item.name}>
        {item.name}
      </span>
      <div className="px-1">
        <ResponseSelect
          value={item.status}
          disabled={!editable}
          onChange={(next) => void onPatch?.(item.id, { status: next })}
        />
      </div>
      <AnswerCell
        value={item.availableQuantity == null ? '' : String(item.availableQuantity)}
        editable={editable}
        align="right"
        placeholder="Qty"
        display={num(item.availableQuantity)}
        onCommit={commit('available_quantity')}
      />
      <AnswerCell
        value={item.unitPrice == null ? '' : String(item.unitPrice)}
        editable={editable}
        align="right"
        placeholder="$/unit"
        display={money(item.unitPrice)}
        onCommit={commit('unit_price')}
      />
      <AnswerCell
        value={item.notes ?? ''}
        editable={editable}
        placeholder="Substitute, ETA, conditions…"
        display={item.notes ?? ''}
        onCommit={commit('notes')}
      />
    </div>
  )
}

/**
 * The shared lines and their answers.
 *
 * `editable` is the portal; the admin reads. `onPatch` writes one line's
 * answer and re-fetches — the caller owns both, because the two sides write
 * through different routes.
 */
export function ARLineTable({
  items,
  editable,
  onPatch,
}: {
  items: ARItem[]
  editable: boolean
  onPatch?: (itemId: number, changes: Record<string, string>) => Promise<void>
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <div
        className="grid items-center gap-x-2 border-b border-border bg-lps-headrow text-[11px] font-bold uppercase tracking-[.05em] text-muted-foreground"
        style={{ gridTemplateColumns: LINE_COLUMNS, minWidth: GRID_MIN, padding: '8px 12px' }}
      >
        <span className="px-1">Need</span>
        <span className="px-1">Size</span>
        <span className="px-1">Plant</span>
        <span className="px-1">Status</span>
        <span className="px-1 text-right">Avail qty</span>
        <span className="px-1 text-right">Price</span>
        <span className="px-1">Notes</span>
      </div>
      {items.length === 0 && (
        <p className="px-3 py-4 text-[12.5px] text-muted-foreground">
          No lines on this request.
        </p>
      )}
      {items.map((item) => (
        <LineRow key={item.id} item={item} editable={editable} onPatch={onPatch} />
      ))}
    </div>
  )
}

/**
 * One message of the transcript, styled the design's way: the side says who
 * is reading their own words (`ownSide` puts that side on the right), the
 * bubble's colour says which channel it travelled, and the weight says who on
 * our side wrote it — an agent draws solid, a person draws outlined, and an
 * `internal` note (never supplier-facing) draws dashed. The caption sits
 * under the bubble, like the design's `6:55 AM · Lexi`.
 */
export function MessageBubble({
  m,
  ownSide,
  metaOf,
}: {
  m: SupplierMessage
  ownSide: 'broker' | 'supplier'
  metaOf?: (m: SupplierMessage) => React.ReactNode
}) {
  const own = m.sender === ownSide
  const meta = CHANNEL_META[m.channel] ?? { label: m.channel, tone: 'grey' as const }
  const agent = m.sender === 'broker' && isAgentSender(m.senderName)
  const internal = m.channel === 'internal'

  const bubbleStyle = internal
    ? undefined
    : agent
      ? { background: toneTint(meta.tone), borderColor: toneDot(meta.tone) }
      : m.sender === 'broker'
        ? { borderColor: toneDot(meta.tone) }
        : undefined

  return (
    <div className={cn('flex max-w-[85%] flex-col gap-0.5', own ? 'self-end items-end' : 'self-start items-start')}>
      <div
        className={cn(
          'flex flex-col gap-1 rounded-2xl border px-3 py-2',
          own ? 'rounded-br-md' : 'rounded-bl-md',
          internal
            ? 'border-dashed border-lps-edge bg-muted/40'
            : m.sender === 'supplier'
              ? 'border-lps-hair bg-lps-bubble'
              : 'bg-card',
        )}
        style={bubbleStyle}
      >
        <div className="flex flex-wrap items-center gap-1.5">
          <ChannelBadge channel={m.channel} />
          {metaOf?.(m)}
        </div>
        <p className="m-0 whitespace-pre-wrap text-[12.5px] leading-relaxed text-foreground">
          {m.body}
        </p>
      </div>
      <span className="px-1 text-[10px] text-lps-dim">
        {formatWhen(m.createdAt)}
        {' · '}
        {m.senderName ?? (m.sender === 'broker' ? 'Broker' : 'Supplier')}
      </span>
    </div>
  )
}

/**
 * The conversation thread. `ownSide` decides which bubbles sit on the right —
 * each reader sees their own messages there: the supplier in the portal, the
 * broker (Chris or an agent) in the admin app.
 */
export function Thread({
  messages,
  ownSide,
  emptyText,
  metaOf,
}: {
  messages: SupplierMessage[]
  ownSide: 'broker' | 'supplier'
  emptyText: string
  /** Extra chips for a bubble's header — the admin adds farm and request tags. */
  metaOf?: (m: SupplierMessage) => React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      {messages.length === 0 && (
        <p className="text-[12.5px] text-muted-foreground">{emptyText}</p>
      )}
      {messages.map((m) => (
        <MessageBubble key={m.id} m={m} ownSide={ownSide} metaOf={metaOf} />
      ))}
    </div>
  )
}

/** One way the composer can send — a channel with its own label and prompt. */
export interface ComposerMode {
  channel: MessageChannel
  label: string
  placeholder: string
}

/**
 * The thread's composer, mode-first like the design's `[Lexi] [Text] [Email]`
 * row: picking a mode changes both the channel the message is stored on and
 * what the input claims to do — instructing daisy is not the same act as
 * recording a text to the supplier, and the placeholder should say which one
 * is about to happen.
 */
export function Composer({
  modes,
  onSend,
}: {
  /** Offered modes, first one preselected; a single-entry list draws no picker. */
  modes: ComposerMode[]
  onSend: (body: string, channel: MessageChannel) => Promise<void>
}) {
  const [draft, setDraft] = useState('')
  const [at, setAt] = useState(0)
  const [busy, setBusy] = useState(false)
  const mode = modes[Math.min(at, modes.length - 1)]

  const send = async () => {
    const body = draft.trim()
    if (!body || busy) return
    setBusy(true)
    try {
      await onSend(body, mode.channel)
      setDraft('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-2.5">
      {modes.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {modes.map((m, i) => (
            <button
              key={m.channel + m.label}
              type="button"
              onClick={() => setAt(i)}
              className={cn(
                'inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-semibold',
                i === at
                  ? 'border-primary bg-secondary text-primary'
                  : 'border-border bg-card text-muted-foreground',
              )}
            >
              <span
                className="size-1.5 rounded-full"
                style={{ background: toneDot((CHANNEL_META[m.channel] ?? { tone: 'grey' as const }).tone) }}
              />
              {m.label}
            </button>
          ))}
        </div>
      )}
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={mode.placeholder}
        rows={2}
        className="w-full resize-y rounded-lg border border-input bg-background p-2.5 text-[12.5px] leading-relaxed outline-none placeholder:text-lps-dim focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
      />
      <button
        type="button"
        onClick={() => void send()}
        disabled={busy || !draft.trim()}
        className="self-end cursor-pointer rounded-full bg-primary px-4 py-1.5 text-[12px] font-bold text-primary-foreground disabled:opacity-50"
      >
        {busy ? 'Sending…' : 'Send'}
      </button>
    </div>
  )
}
