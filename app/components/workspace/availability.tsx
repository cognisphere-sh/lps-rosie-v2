'use client'

// The pieces of an availability request that two apps draw: the supplier
// portal (where the lines are answered) and the admin supplier profile (where
// the answers are read). Nothing here knows which side it is on beyond the
// `editable` prop on the line table.

import { useState } from 'react'

import {
  AR_RESPONSE_OPTIONS,
  arLineTotal,
  arResponseLabel,
  arResponseTone,
  arStatusLabel,
  arStatusTone,
  arSubtotal,
  type ARItem,
} from '@/lib/availability'
import { money, num } from '@/lib/format'
import { toneDot, toneStyle, toneTint } from '@/lib/job-requests'
import { cn } from '@/lib/utils'

/** Need · Size · Plant · Status · Avail qty · Price · Line total · Notes. */
const LINE_COLUMNS =
  '56px 90px minmax(200px,1.5fr) 150px 90px 100px 100px minmax(200px,1fr)'
/** Under this the columns would crush, so the table scrolls sideways instead. */
const GRID_MIN = 960


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
  // The cell is uncontrolled while it is being typed in, but the committed
  // value can also change underneath it — the answer pop-up writes quantity,
  // price and notes at once, and the page re-fetches. Take the new value when
  // it arrives, or the row would keep showing what the cell was left holding.
  const [committed, setCommitted] = useState(value)
  if (committed !== value) {
    setCommitted(value)
    setDraft(value)
  }
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

/** What the pop-up collects for each answer, and the hint its notes carry. */
const ANSWER_FIELDS: Record<
  string,
  { title: string; qtyPrice: boolean; notesLabel: string; notesHint: string }
> = {
  available: {
    title: 'Available',
    qtyPrice: true,
    notesLabel: 'Notes (optional)',
    notesHint: 'Anything else about this line…',
  },
  can_order: {
    title: 'Can order',
    qtyPrice: true,
    notesLabel: 'ETA / notes',
    notesHint: 'When can you have it? e.g. ready mid-Sep',
  },
  substitute: {
    title: 'Substitute',
    qtyPrice: false,
    notesLabel: 'What instead',
    notesHint: 'Name, Size @ price $/unit — e.g. Muskogee Crape Myrtle, 30 G @ 265 $/unit',
  },
  unavailable: {
    title: 'Unavailable',
    qtyPrice: false,
    notesLabel: 'Notes (optional)',
    notesHint: 'Substitutes welcome — Name, Size @ price $/unit',
  },
}

/**
 * Picking a status opens this pop-up for the rest of the answer, so a line is
 * answered whole in one go: Available / Can order take quantity (prefilled
 * with the demand), price (prefilled where we had one on file) and notes;
 * Substitute and Unavailable take the note, with the format hinted. The
 * inline cells stay for later tweaks.
 */
function StatusAnswerDialog({
  item,
  status,
  onCancel,
  onSave,
}: {
  item: ARItem
  status: string
  onCancel: () => void
  onSave: (changes: Record<string, string>) => void
}) {
  const spec = ANSWER_FIELDS[status] ?? ANSWER_FIELDS.available
  // Demand is the prefill: "we can supply what you asked for" is the common
  // answer, and correcting a number beats typing one.
  const [qty, setQty] = useState(
    item.availableQuantity != null
      ? String(item.availableQuantity)
      : item.quantity != null
        ? String(item.quantity)
        : '',
  )
  const [price, setPrice] = useState(item.unitPrice != null ? String(item.unitPrice) : '')
  const [notes, setNotes] = useState(item.notes ?? '')

  const save = () => {
    const changes: Record<string, string> = { status, notes: notes.trim() }
    if (spec.qtyPrice) {
      changes.available_quantity = qty.trim()
      changes.unit_price = price.trim()
    }
    onSave(changes)
  }

  const field = 'h-9 rounded-md border border-input bg-background px-2 text-[13px] outline-none focus-visible:border-ring'
  const label = 'text-[10.5px] font-bold uppercase tracking-[.05em] text-muted-foreground'

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4" onClick={onCancel}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-[420px] flex-col gap-3 rounded-2xl border border-border bg-popover p-4 shadow-[var(--lps-shadow)]"
      >
        <div className="flex flex-col gap-0.5">
          <span className="text-[14px] font-bold text-foreground">{spec.title}</span>
          <span className="text-[12px] text-muted-foreground">
            {num(item.quantity) || '—'} × {item.name}
            {item.size ? ` · ${item.size}` : ''}
          </span>
        </div>

        {spec.qtyPrice && (
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-0.5">
              <span className={label}>Quantity</span>
              <input
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                inputMode="decimal"
                placeholder="Qty"
                autoFocus
                className={cn(field, 'text-right tabular-nums')}
              />
            </label>
            <label className="flex flex-col gap-0.5">
              <span className={label}>Price $/unit</span>
              <input
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                inputMode="decimal"
                placeholder="$/unit"
                className={cn(field, 'text-right tabular-nums')}
              />
            </label>
          </div>
        )}

        <label className="flex flex-col gap-0.5">
          <span className={label}>{spec.notesLabel}</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={spec.notesHint}
            rows={2}
            autoFocus={!spec.qtyPrice}
            className="min-h-16 resize-none rounded-md border border-input bg-background px-2 py-1.5 text-[13px] outline-none placeholder:text-lps-dim focus-visible:border-ring"
          />
        </label>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="cursor-pointer rounded-full border border-border bg-card px-4 py-1.5 text-[12px] font-semibold text-foreground"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            className="cursor-pointer rounded-full bg-primary px-4 py-1.5 text-[12px] font-bold text-primary-foreground"
          >
            Save answer
          </button>
        </div>
      </div>
    </div>
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
  /** Which status the pop-up is collecting details for; null = closed. */
  const [answering, setAnswering] = useState<string | null>(null)
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
      <span className="min-w-0 px-1" title={item.name}>
        <span className="block truncate text-[13px] font-semibold text-foreground">{item.name}</span>
        {/* LPS's note to the supplier — a few words, e.g. the mapped
            substitute. Ours; the supplier's own note is the Notes cell. */}
        {item.lpsNotes && (
          <span className="block truncate text-[10.5px] text-muted-foreground" title={item.lpsNotes}>
            {item.lpsNotes}
          </span>
        )}
      </span>
      <div className="px-1">
        <ResponseSelect
          value={item.status}
          disabled={!editable}
          // Picking a status opens the answer pop-up rather than saving bare —
          // clearing back to "Set status" is the one direct write.
          onChange={(next) => {
            if (!next) void onPatch?.(item.id, { status: '' })
            else setAnswering(next)
          }}
        />
      </div>
      {answering && (
        <StatusAnswerDialog
          item={item}
          status={answering}
          onCancel={() => setAnswering(null)}
          onSave={(changes) => {
            setAnswering(null)
            void onPatch?.(item.id, changes)
          }}
        />
      )}
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
      {/* Quantity × price, never typed — an em dash until the answer carries
          both, so a half-answered line doesn't read as costing nothing. */}
      <span className="truncate px-1 text-right text-[12.5px] font-semibold tabular-nums text-foreground">
        {money(arLineTotal(item)) || <span className="font-normal text-lps-dim">—</span>}
      </span>
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
  const subtotal = arSubtotal(items)
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
        <span className="px-1 text-right">Line total</span>
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
      {items.length > 0 && (
        <div
          className="grid items-center gap-x-2 border-t border-border bg-lps-headrow"
          style={{ gridTemplateColumns: LINE_COLUMNS, minWidth: GRID_MIN, padding: '8px 12px' }}
        >
          <span
            className="px-1 text-right text-[11px] font-bold uppercase tracking-[.05em] text-muted-foreground"
            style={{ gridColumn: '1 / 7' }}
          >
            Subtotal
          </span>
          <span className="px-1 text-right text-[13px] font-bold tabular-nums text-foreground">
            {money(subtotal) || '—'}
          </span>
        </div>
      )}
    </div>
  )
}
