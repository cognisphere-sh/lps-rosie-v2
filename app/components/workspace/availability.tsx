'use client'

// The pieces of an availability request that two apps draw: the supplier
// portal (where the lines are answered) and the admin supplier profile (where
// the answers are read). Nothing here knows which side it is on beyond the
// `editable` prop on the line table.

import { useState } from 'react'

import {
  AR_RESPONSE_OPTIONS,
  arResponseLabel,
  arResponseTone,
  arStatusLabel,
  arStatusTone,
  type ARItem,
} from '@/lib/availability'
import { money, num } from '@/lib/format'
import { toneDot, toneStyle, toneTint } from '@/lib/job-requests'
import { cn } from '@/lib/utils'

/** Need · Size · Plant · Status · Avail qty · Price · Notes. */
const LINE_COLUMNS =
  '56px 90px minmax(200px,1.5fr) 150px 90px 100px minmax(200px,1fr)'
/** Under this the columns would crush, so the table scrolls sideways instead. */
const GRID_MIN = 860


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
