'use client'

// The pieces of an availability request that two apps draw: the supplier
// portal (where the lines are answered) and the admin supplier profile (where
// the answers are read). Nothing here knows which side it is on beyond the
// `editable` prop on the line table.

import { useEffect, useState, type ReactNode } from 'react'

import {
  AR_RESPONSES,
  AR_RESPONSE_META,
  AR_RESPONSE_OPTIONS,
  AR_STATUSES,
  arLineTotal,
  arResponseLabel,
  arResponseTone,
  arStatusLabel,
  arStatusTone,
  arSubtotal,
  type ARItem,
} from '@/lib/availability'
import { ChevronDown } from '@/components/workspace/icons'
import { money, num } from '@/lib/format'
import { toneDot, toneStyle, toneTint, type Tone } from '@/lib/job-requests'
import { cn } from '@/lib/utils'

/** Need · Size · Plant · Status · Avail qty · Price · Line total · Notes. */
const LINE_COLUMNS =
  '56px 90px minmax(200px,1.5fr) 150px 90px 100px 100px minmax(200px,1fr)'
/** Track minima + gaps + row padding/left accent; below this the table scrolls. */
const GRID_MIN = 1070

// A caller may put one column of its own in front of Need — the By-item view
// uses it for the job a line came from, because there a table holds lines from
// several requests at once. Everything after it stays exactly as it is here,
// so the two tables are the same table.
/** The leading column's track, when one is asked for. */
const LEAD_COLUMN = 'minmax(210px,1.3fr)'
/** Its contribution to the scroll threshold: the track minimum plus its gap. */
const LEAD_MIN = 218

// The portal's request page (2026-08-30 design) draws the same table without
// the Line total column and without the tone bar/tint per row: Need · Size ·
// Plant · Status · Avail qty · Price · Nursery notes over plain hairlines.
/** The portal design's tracks — the default's, less Line total. */
const PORTAL_COLUMNS = '56px 90px minmax(220px,1.6fr) 150px 90px 100px minmax(200px,1fr)'
const PORTAL_GRID_MIN = 960
/** Which of the two drawings a table uses. */
type LineTableDesign = 'default' | 'portal'
/** The portal drawing's one accent: what still needs a price. */
const PORTAL_PURPLE = '#8F7CF6'


/**
 * The request's lifecycle pill — New / Processing / Submitted / Closed. With `onChange` it
 * is also the picker for it, the same native-select-under-a-pill the line
 * answers use; without it, a read-only pill.
 */
export function ARStatusPill({
  status,
  onChange,
}: {
  status: string
  onChange?: (next: string) => void
}) {
  return (
    <span
      className={cn(
        'relative inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold',
        onChange && 'cursor-pointer',
      )}
      style={toneStyle(arStatusTone(status))}
    >
      <span className="size-1.5 rounded-full" style={{ background: toneDot(arStatusTone(status)) }} />
      {arStatusLabel(status)}
      {onChange && (
        <select
          aria-label="Request status"
          value={status}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 cursor-pointer opacity-0"
        >
          {AR_STATUSES.map((s) => (
            <option key={s} value={s}>{arStatusLabel(s)}</option>
          ))}
        </select>
      )}
    </span>
  )
}

/**
 * The request's answer strip — the supplier-facing twin of the admin Job
 * Request card's DemandSummary: every answer with its count, then the line
 * count and the subtotal. Zeros are drawn and dimmed rather than dropped, so
 * "nothing is unavailable" and "nobody has looked yet" cannot render alike.
 */
export function ARResponseSummary({
  items,
  answeredCount,
}: {
  items: ARItem[]
  answeredCount: number
}) {
  const counts: Record<string, number> = {}
  for (const item of items) {
    if (item.status) counts[item.status] = (counts[item.status] ?? 0) + 1
  }
  const states = [
    { label: 'Pending', count: items.length - answeredCount, tone: 'grey' as Tone },
    ...AR_RESPONSES.map((status) => ({
      label: AR_RESPONSE_META[status].label,
      count: counts[status] ?? 0,
      tone: AR_RESPONSE_META[status].tone,
    })),
  ]
  return (
    <div className="overflow-x-auto rounded-lg border border-lps-hair bg-secondary/45">
      <div className="grid min-w-[800px] grid-cols-[repeat(6,minmax(92px,1fr))_minmax(92px,1fr)_minmax(118px,1.15fr)] divide-x divide-lps-hair">
        {states.map((state) => (
          <div key={state.label} className={cn('flex flex-col gap-0.5 px-3 py-2', state.count === 0 && 'opacity-45')}>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[.04em] text-muted-foreground">
              <span className="size-1.5 flex-none rounded-full" style={{ background: toneDot(state.tone) }} />
              {state.label}
            </span>
            <span className="text-[13px] font-bold tabular-nums text-foreground">{state.count}</span>
          </div>
        ))}
        <div className="flex flex-col gap-0.5 px-3 py-2">
          <span className="text-[10px] font-bold uppercase tracking-[.04em] text-muted-foreground">Lines</span>
          <span className="text-[13px] font-bold tabular-nums text-foreground">{items.length}</span>
        </div>
        <div className="flex flex-col gap-0.5 px-3 py-2">
          <span className="text-[10px] font-bold uppercase tracking-[.04em] text-muted-foreground">Subtotal</span>
          <span className="text-[13px] font-bold tabular-nums text-foreground">
            {money(arSubtotal(items)) || '—'}
          </span>
        </div>
      </div>
    </div>
  )
}

/** Where a message actually happened — portal, email, text, or internal. */
/**
 * The supplier's per-line answer, as a pill-styled picker.
 *
 * A native <select> under a styled face: the five answers plus the blank
 * "Set status" state, which is a real state (unanswered), not a default.
 */
function ResponseSelect({
  value,
  disabled,
  onChange,
  portal = false,
}: {
  value: string | null
  disabled: boolean
  onChange: (next: string) => void
  /** The portal drawing: a neutral outlined pill, `··· Set Status ⌄`. */
  portal?: boolean
}) {
  const tone = arResponseTone(value)
  return (
    <span
      className={cn(
        'relative inline-flex items-center gap-1.5',
        portal
          ? 'h-7 rounded-full border border-border bg-secondary/60 px-3 text-[12px] font-medium text-muted-foreground'
          : 'rounded-full px-2.5 py-1 text-[11px] font-bold',
        !disabled && 'cursor-pointer',
      )}
      style={portal ? (value ? { color: toneDot(tone) } : undefined) : toneStyle(tone)}
    >
      {portal ? (
        !value && <span className="text-[10px] tracking-[.1em] text-lps-dim">···</span>
      ) : (
        <span className="size-1.5 rounded-full" style={{ background: toneDot(tone) }} />
      )}
      {portal && !value ? 'Set Status' : arResponseLabel(value)}
      {portal && <ChevronDown className="size-3 opacity-70" />}
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
export function AnswerCell({
  value,
  editable,
  align = 'left',
  placeholder,
  display,
  onCommit,
  plain = false,
  attention = false,
}: {
  value: string
  editable: boolean
  align?: 'left' | 'right'
  placeholder: string
  /** How the committed value reads when not editable (money, thousands). */
  display: string
  onCommit: (next: string) => void
  /** The portal drawing: no box — grey text on the row until focused. */
  plain?: boolean
  /** `plain` only: draw the accent box, for a cell that still needs filling. */
  attention?: boolean
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
        'h-7 w-full min-w-0 rounded-md px-1.5 text-[12.5px] outline-none placeholder:text-lps-dim',
        plain
          ? 'border bg-transparent text-muted-foreground focus-visible:text-foreground'
          : 'border border-input bg-background focus-visible:border-ring focus-visible:ring-[2px] focus-visible:ring-ring/50',
        plain && !attention && 'border-transparent',
        align === 'right' && 'text-right tabular-nums',
      )}
      style={plain && attention ? { borderColor: PORTAL_PURPLE, maxWidth: 72, marginLeft: 'auto' } : undefined}
    />
  )
}

/**
 * What the pop-up collects for each answer, and the hint its notes carry.
 *
 * `available` is deliberately absent: it needs nothing asked, so picking it
 * writes straight through with the demand as the available quantity (see
 * `LineRow`). Price is not collected here at all — it arrives prefilled from
 * our own catalogue and is corrected in the table's own Price cell.
 */
const ANSWER_FIELDS: Record<
  string,
  {
    title: string
    /** Whether the answer needs a quantity of its own. */
    qty: boolean
    /** Whether it takes a unit price — an answer that is a supply offer. */
    price?: boolean
    /** Wipe a quantity a previous answer left behind — nothing is available. */
    clearQty?: boolean
    /** Which field opens focused — the first thing this answer needs. */
    focus?: 'qty' | 'notes'
    notesLabel: string
    notesHint: string
  }
> = {
  can_order: {
    title: 'Can order',
    qty: false,
    // Ordering it in is a price as much as a date — asking here saves the
    // supplier a second pass over the Price cell.
    price: true,
    notesLabel: 'ETA / notes',
    notesHint: 'When can you have it? e.g. ready mid-Sep',
  },
  arriving_soon: {
    title: 'Arriving soon',
    qty: false,
    price: true,
    notesLabel: 'Notes',
    notesHint: 'When it lands, and how many — e.g. 40 due the week of Sep 8',
  },
  diff_size_qty_sub: {
    title: 'Diff Size/Qty/Sub',
    // What you can supply instead is priced on its own terms.
    price: true,
    // The answer covers a different size, a short quantity or another plant,
    // so it is the one that still needs a number: what you can actually supply.
    qty: true,
    // Naming what you have comes first; the quantity follows it.
    focus: 'notes',
    notesLabel: 'What instead',
    notesHint: 'Size, quantity or substitute — e.g. Muskogee Crape Myrtle, 30 G',
  },
  unavailable: {
    title: 'Unavailable',
    qty: false,
    clearQty: true,
    notesLabel: 'Notes (optional)',
    notesHint: 'Substitutes welcome — Name, Size @ price $/unit',
  },
}

/**
 * Picking a status opens this pop-up for the rest of the answer, so a line is
 * answered whole in one go: Diff Size/Qty/Sub takes a quantity, a price and
 * the note; Can order and Arriving soon take a price and the note; Unavailable
 * the note alone, with the format hinted. Available asks nothing and never
 * opens this. The inline cells stay for later tweaks.
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
  const spec = ANSWER_FIELDS[status]
  // Demand is the prefill: a short quantity is the common shape of this answer,
  // and correcting a number beats typing one.
  const [qty, setQty] = useState(
    item.availableQuantity != null
      ? String(item.availableQuantity)
      : item.quantity != null
        ? String(item.quantity)
        : '',
  )
  // Whatever we already have on file for this line is the prefill — the
  // supplier corrects a price far more often than they type a fresh one.
  const [price, setPrice] = useState(item.unitPrice == null ? '' : String(item.unitPrice))
  const [notes, setNotes] = useState(item.notes ?? '')
  const [viewport, setViewport] = useState<{ top: number; height: number } | null>(null)

  // Android/iOS keyboards resize and sometimes pan the visual viewport without
  // changing the layout viewport used by `position: fixed`. Pin the dialog to
  // the visible rectangle so its notes and actions stay reachable while typing.
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => setViewport({ top: vv.offsetTop, height: vv.height })
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])

  const save = () => {
    const changes: Record<string, string> = { status, notes: notes.trim() }
    // An empty quantity clears the column, which is what `clearQty` wants and
    // what an emptied box on a Diff Size/Qty/Sub answer means too.
    if (spec.qty) changes.available_quantity = qty.trim()
    else if (spec.clearQty) changes.available_quantity = ''
    // An emptied price box clears the column, exactly as the Price cell does.
    if (spec.price) changes.unit_price = price.trim()
    onSave(changes)
  }

  const field = 'h-9 rounded-md border border-input bg-background px-2 text-[13px] outline-none focus-visible:border-ring'
  const label = 'text-[10.5px] font-bold uppercase tracking-[.05em] text-muted-foreground'

  return (
    <div
      className="fixed inset-x-0 top-0 z-[90] flex items-center justify-center overflow-y-auto bg-black/40 p-4"
      style={{ top: viewport?.top ?? 0, height: viewport?.height ?? '100dvh' }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-full w-full max-w-[420px] flex-col gap-3 overflow-y-auto rounded-2xl border border-border bg-popover p-4 shadow-[var(--lps-shadow)]"
      >
        <div className="flex flex-col gap-0.5">
          <span className="text-[14px] font-bold text-foreground">{spec.title}</span>
          <span className="text-[12px] text-muted-foreground">
            {num(item.quantity) || '—'} × {item.name}
            {item.size ? ` · ${item.size}` : ''}
          </span>
        </div>

        {spec.qty && (
          <label className="flex flex-col gap-0.5">
            <span className={label}>Quantity you can supply</span>
            <input
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              inputMode="decimal"
              placeholder="Qty"
              autoFocus={spec.focus !== 'notes'}
              className={cn(field, 'text-right tabular-nums')}
            />
          </label>
        )}

        {spec.price && (
          <label className="flex flex-col gap-0.5">
            <span className={label}>Price per unit</span>
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              inputMode="decimal"
              placeholder="$/unit"
              autoFocus={spec.focus == null && !spec.qty}
              className={cn(field, 'text-right tabular-nums')}
            />
          </label>
        )}

        <label className="flex flex-col gap-0.5">
          <span className={label}>{spec.notesLabel}</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={spec.notesHint}
            rows={2}
            autoFocus={spec.focus === 'notes' || (!spec.qty && !spec.price)}
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

/**
 * A line's status picker with its answer pop-up — how a status is set anywhere
 * a line is answered (the request page, the By-item view). Picking a status
 * opens the pop-up rather than saving bare. Two answers write straight through
 * instead: clearing back to "Set status", and Available — "all of it, as
 * asked" needs nothing typed, so the demand becomes the available quantity.
 */
export function LineStatusPicker({
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
  return (
    <>
      <ResponseSelect
        value={item.status}
        disabled={!editable}
        onChange={(next) => {
          if (!next) void onPatch?.(item.id, { status: '' })
          else if (next === 'available') {
            void onPatch?.(item.id, {
              status: 'available',
              available_quantity: item.quantity == null ? '' : String(item.quantity),
            })
          } else setAnswering(next)
        }}
      />
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
    </>
  )
}

function LineRow({
  item,
  editable,
  onPatch,
  displayText = (text) => text,
  columns,
  minWidth,
  leading,
  design = 'default',
}: {
  item: ARItem
  editable: boolean
  onPatch?: (itemId: number, changes: Record<string, string>) => Promise<void>
  displayText?: (text: string) => string
  columns: string
  minWidth: number
  /** Rendered as the row's first cell when the table has a leading column. */
  leading?: ReactNode
  design?: LineTableDesign
}) {
  const portal = design === 'portal'
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
      style={
        portal
          ? {
              gridTemplateColumns: columns,
              minWidth,
              minHeight: 72,
              padding: '14px 16px',
              // The comp's accent divider under a line that still needs a price.
              ...(editable && item.unitPrice == null ? { borderBottomColor: PORTAL_PURPLE } : {}),
            }
          : {
              gridTemplateColumns: columns,
              minWidth,
              minHeight: 56,
              padding: '7px 12px',
              borderLeft: `3px solid ${toneDot(tone)}`,
              background: toneTint(tone),
            }
      }
    >
      {leading}
      <span className="px-1 text-[12.5px] font-semibold tabular-nums text-foreground">
        {num(item.quantity) || '—'}
      </span>
      <span className="truncate px-1 text-[12px] text-muted-foreground" title={item.size ?? undefined}>
        {item.size ?? '—'}
      </span>
      <span className="min-w-0 px-1" title={item.name}>
        <span className="block truncate text-[13px] font-semibold text-foreground">{item.name}</span>
        {/* LPS's note to the supplier — a few words, e.g. the alternative
            sourcing mapped. Ours; the supplier's own note is the Notes cell. */}
        {item.lpsNotes && (
          // One line while the table is being scanned; the whole note on
          // hover, unfolded in place rather than in an overlay — the table is
          // its own scroll box and would clip a popup at its edges. The
          // `title` keeps the same text on the pointer.
          <span
            className="block truncate text-[10.5px] text-muted-foreground hover:whitespace-normal"
            title={displayText(item.lpsNotes)}
          >
            {displayText(item.lpsNotes)}
          </span>
        )}
      </span>
      <div className="px-1">
        <LineStatusPicker item={item} editable={editable} onPatch={onPatch} />
      </div>
      <AnswerCell
        value={item.availableQuantity == null ? '' : String(item.availableQuantity)}
        editable={editable}
        align="right"
        placeholder={portal ? '—' : 'Qty'}
        display={num(item.availableQuantity)}
        onCommit={commit('available_quantity')}
        plain={portal}
      />
      <AnswerCell
        value={item.unitPrice == null ? '' : String(item.unitPrice)}
        editable={editable}
        align="right"
        placeholder={portal ? '-' : '$/unit'}
        display={money(item.unitPrice)}
        onCommit={commit('unit_price')}
        plain={portal}
        attention={portal && item.unitPrice == null}
      />
      {/* Quantity × price, never typed — an em dash until the answer carries
          both, so a half-answered line doesn't read as costing nothing. The
          portal drawing leaves it to the subtotal strip. */}
      {!portal && (
        <span className="truncate px-1 text-right text-[12.5px] font-semibold tabular-nums text-foreground">
          {money(arLineTotal(item)) || <span className="font-normal text-lps-dim">—</span>}
        </span>
      )}
      <AnswerCell
        value={item.notes ?? ''}
        editable={editable}
        placeholder={portal ? 'Add note…' : 'Substitute, ETA, conditions…'}
        display={item.notes ?? ''}
        onCommit={commit('notes')}
        plain={portal}
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
export function ARLineTable<T extends ARItem>({
  items,
  editable,
  onPatch,
  displayText,
  leadingHeader,
  renderLeading,
  design = 'default',
}: {
  items: T[]
  editable: boolean
  onPatch?: (itemId: number, changes: Record<string, string>) => Promise<void>
  /** Portal-only transform for LPS notes; admin callers leave it unset. */
  displayText?: (text: string) => string
  /** `portal`: no Line total column, no tone bars, no subtotal footer. */
  design?: LineTableDesign
  /**
   * One extra column in front of Need. Both parts go together — the header
   * names it, the renderer fills it per row. The By-item view uses it for the
   * job a line came from; a table of one request's lines has no need of it.
   */
  leadingHeader?: string
  renderLeading?: (item: T) => ReactNode
}) {
  const subtotal = arSubtotal(items)
  const portal = design === 'portal'
  const lead = leadingHeader != null && renderLeading != null
  const base = portal ? PORTAL_COLUMNS : LINE_COLUMNS
  const columns = lead ? `${LEAD_COLUMN} ${base}` : base
  const minWidth = (portal ? PORTAL_GRID_MIN : GRID_MIN) + (lead ? LEAD_MIN : 0)
  return (
    <div className="w-full min-w-0 max-w-full overflow-x-auto rounded-xl border border-border bg-card">
      <div
        className={cn(
          'grid items-center gap-x-2 border-b border-border text-[11px] font-bold uppercase tracking-[.05em] text-muted-foreground',
          !portal && 'bg-lps-headrow',
        )}
        style={{ gridTemplateColumns: columns, minWidth, padding: portal ? '16px 16px 14px' : '8px 12px' }}
      >
        {lead && <span className="px-1">{leadingHeader}</span>}
        <span className="px-1">Need</span>
        <span className="px-1">Size</span>
        <span className="px-1">Plant</span>
        <span className="px-1">Status</span>
        <span className="px-1 text-right">Avail qty</span>
        <span className="px-1 text-right">Price</span>
        {!portal && <span className="px-1 text-right">Line total</span>}
        <span className="px-1">{portal ? 'Nursery notes' : 'Notes'}</span>
      </div>
      {items.length === 0 && (
        <p className="px-3 py-4 text-[12.5px] text-muted-foreground">
          No lines on this request.
        </p>
      )}
      {items.map((item) => (
        <LineRow
          key={item.id}
          item={item}
          editable={editable}
          onPatch={onPatch}
          displayText={displayText}
          columns={columns}
          minWidth={minWidth}
          leading={lead ? renderLeading(item) : undefined}
          design={design}
        />
      ))}
      {items.length > 0 && !portal && (
        <div
          className="grid items-center gap-x-2 border-t border-border bg-lps-headrow"
          style={{ gridTemplateColumns: columns, minWidth, padding: '8px 12px' }}
        >
          {/* The label spans everything up to Line total, so it still sits
              directly under Price whether or not there is a leading column. */}
          <span
            className="px-1 text-right text-[11px] font-bold uppercase tracking-[.05em] text-muted-foreground"
            style={{ gridColumn: lead ? '1 / 8' : '1 / 7' }}
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
