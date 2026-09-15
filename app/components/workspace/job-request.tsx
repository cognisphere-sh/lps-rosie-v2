'use client'

// The pieces of a job request's expanded card, shared by the pages that show
// one. They were the Job Requests page's until a customer's card needed the
// same order details, line table and history under each of their requests —
// nothing here knows which page it is drawn on.

import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { MessagesSquare } from 'lucide-react'

import { Markdown, MarkdownFirstLine } from '@/components/workspace/chat-kit'
import {
  EditableText, EditableTextarea, type EditProps, patchRow,
} from '@/components/workspace/editable'
import {
  CheckIcon, ChevronDown, ChevronRight, MapPinIcon, SuppliersIcon, TrashIcon,
} from '@/components/workspace/icons'
import { useToast } from '@/components/workspace/shell'
import { useOutsideClose } from '@/components/workspace/table-parts'
import {
  availabilityRequestLinkLabel,
  isInProgressARStatus,
  isSubmittedARStatus,
} from '@/lib/availability'
import { openAvailabilityRequest, openChat } from '@/lib/chat-bus'
import { customerThreadId } from '@/lib/customers'
import { formatDate, formatMonthDay, money, num } from '@/lib/format'
import {
  ITEM_STATUS_OPTIONS,
  coverColor,
  coverOf,
  itemPill,
  requestRef,
  requestStatusTone,
  toneDot,
  toneStyle,
  toneTint,
  type Tone,
} from '@/lib/job-requests'
import { JobOrders } from '@/components/workspace/orders'
import type { JobAddress, JobChange, JobNote, JobRequestItem, JobRequestRow } from '@/lib/rows'
import { cn } from '@/lib/utils'

/**
 * The line-item grid, shared by the header and every row so they stay aligned.
 *
 * Select · Demand · Avail · Size · Plant Name · Status · Unit price · Total ·
 * Shared note · Sourcing note. The design draws one Notes column; the two
 * audiences are split here because they are not one field — `external_notes` is
 * written for the customer and `sourcing_notes` is our own working sheet, and
 * a single cell cannot honestly edit both.
 */
const LINE_COLUMNS =
  '66px 66px 72px minmax(170px,1.4fr) 124px 86px 92px minmax(145px,.9fr) minmax(145px,.9fr)'

/** The select column only exists where something can act on a selection. */
const SELECT_COLUMN = 36
/** The trailing column holding a line's delete button, where lines can be deleted. */
const ACTION_COLUMN = 34
const gridOf = (selectable: boolean, deletable = false) =>
  [selectable ? `${SELECT_COLUMN}px` : null, LINE_COLUMNS, deletable ? `${ACTION_COLUMN}px` : null]
    .filter(Boolean)
    .join(' ')

/** Under this the columns would crush, so the card scrolls sideways instead. */
const GRID_MIN = 1050

/** Navigate the visible cells in row order, letting blur save the old editor. */
function navigateLineCells(event: KeyboardEvent<HTMLDivElement>) {
  if (event.key !== 'Tab' || event.ctrlKey || event.metaKey || event.altKey) return
  const cells = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[data-line-row] > *'))
  const index = cells.findIndex((cell) => cell.contains(event.target as Node))
  if (index < 0) return
  const step = event.shiftKey ? -1 : 1
  for (let next = index + step; next >= 0 && next < cells.length; next += step) {
    const cell = cells[next]
    const target = cell.matches('[tabindex="0"]') ? cell
      : cell.querySelector<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled)')
    if (!target) continue
    event.preventDefault()
    target.focus()
    if (target.hasAttribute('data-cell-editor')) target.click()
    return
  }
}

/** "1240 SE Ankeny St · Portland, OR · 97214" on one line. */
export const addressLine = (a: JobAddress) =>
  [a.address, [a.city, a.state].filter(Boolean).join(', '), a.zip].filter(Boolean).join(' · ')

/** Tri-state select box — the design's checkbox, `'some'` being its mixed state. */
export function Check({
  state,
  onChange,
  label,
}: {
  state: boolean | 'some'
  onChange: () => void
  label: string
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={state === 'some' ? 'mixed' : state}
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation()
        onChange()
      }}
      className={cn(
        'inline-flex size-4 flex-none cursor-pointer items-center justify-center rounded-[5px] border',
        state === false
          ? 'border-input bg-background hover:border-primary'
          : 'border-primary bg-primary text-primary-foreground',
      )}
    >
      {state === 'some' ? (
        <span className="h-[2px] w-2 rounded-full bg-current" />
      ) : state ? (
        <CheckIcon size={11} />
      ) : null}
    </button>
  )
}

/** The status menu's width, fixed so it can be placed before it is drawn. */
const MENU_WIDTH = 190

/** The design's status pill, with its click-to-change picker attached. */
export function StatusPill({
  table,
  id,
  column,
  onSaved,
  value,
  label,
  tone,
  options,
  compactLabel,
  accessibleLabel,
  touchTarget = false,
}: EditProps & {
  value: string
  label: string
  tone: Tone
  options: { value: string; label: string }[]
  /** Optional 44px presentation; the picker and accessible name stay full. */
  compactLabel?: string
  accessibleLabel?: string
}) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const pop = useOutsideClose<HTMLSpanElement>(open, () => setOpen(false))
  const trigger = useRef<HTMLButtonElement>(null)
  const [at, setAt] = useState<{ left: number; top?: number; bottom?: number } | null>(null)
  const menuId = `status-menu-${table}-${id}-${column}`
  const fullLabel = accessibleLabel ?? label

  // The menu is positioned `fixed`, measured off the pill. A card clips its own
  // overflow — it has to, for its rounded corners and its sideways-scrolling
  // line table — and an absolutely positioned menu is cut off at the card's
  // bottom edge, which is where a request near the foot of the list always
  // opens its picker. `overflow: hidden` does not clip a fixed descendant.
  useLayoutEffect(() => {
    if (!open) return
    const box = pop.current?.getBoundingClientRect()
    if (!box) return
    // Flip above the pill when the menu would not fit below it. The flipped
    // menu is anchored by its *bottom*, so the estimate only has to be good
    // enough to make the call — it never has to match the drawn height.
    const left = Math.max(8, Math.min(box.left, window.innerWidth - MENU_WIDTH - 8))
    const fits = window.innerHeight - box.bottom > options.length * 30 + 18
    setAt(fits ? { left, top: box.bottom + 6 } : { left, bottom: window.innerHeight - box.top + 6 })
    // A fixed menu does not travel with the card it belongs to, so any scroll
    // underneath it closes it rather than leaving it stranded mid-page.
    const close = () => setOpen(false)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open, pop, options.length])

  const pick = async (next: string) => {
    setOpen(false)
    trigger.current?.focus()
    if (next === value) return
    setBusy(true)
    try {
      await patchRow(table, id, column, next)
      onSaved()
    } catch (e) {
      toast((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const toneOf = (v: string) =>
    table === 'job_requests' ? requestStatusTone(v) : itemPill(v, null, null).tone

  return (
    <span
      ref={pop}
      data-pop
      className={cn('inline-block', compactLabel && 'size-11 flex-none')}
      onKeyDown={(event) => {
        if (!open || event.key !== 'Escape') return
        event.preventDefault()
        event.stopPropagation()
        setOpen(false)
        trigger.current?.focus()
      }}
      onBlurCapture={(event) => {
        if (open && !event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setOpen(false)
        }
      }}
    >
      <button
        ref={trigger}
        type="button"
        title={`Click to update status: ${fullLabel}`}
        aria-label={fullLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        disabled={busy}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        className={cn(
          'cursor-pointer border-none bg-transparent p-0',
          touchTarget && 'min-h-11 min-w-11 outline-none focus-visible:ring-2 focus-visible:ring-ring',
          compactLabel && 'flex size-11 items-center justify-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring',
          busy && 'opacity-50',
        )}
      >
        {compactLabel ? (
          <span
            data-compact-status-token
            aria-hidden="true"
            className="inline-flex max-w-full items-center justify-center whitespace-nowrap rounded-md px-1 text-[10.5px] font-bold leading-none"
            style={toneStyle(tone)}
          >
            {compactLabel}
          </span>
        ) : (
          <span
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold"
            style={toneStyle(tone)}
          >
            <span className="size-[7px] flex-none rounded-full" style={{ background: toneDot(tone) }} />
            {label}
            <ChevronDown size={10} />
          </span>
        )}
      </button>
      {open && at && (
        <div
          id={menuId}
          role="menu"
          aria-label={`Choose status for ${fullLabel}`}
          onClick={(e) => e.stopPropagation()}
          style={{ left: at.left, top: at.top, bottom: at.bottom, width: MENU_WIDTH }}
          className="lps-pop fixed z-[75] rounded-xl border border-border bg-popover p-1.5 shadow-[var(--lps-shadow)]"
        >
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              role="menuitemradio"
              aria-checked={o.value === value}
              onClick={() => void pick(o.value)}
              className={cn(
                'flex w-full cursor-pointer items-center gap-2 rounded-lg border-none bg-transparent px-2 py-1.5 text-left text-[12.5px] hover:bg-muted',
                o.value === value ? 'font-semibold text-foreground' : 'font-normal text-muted-foreground',
              )}
            >
              <span className="size-2 flex-none rounded-full" style={{ background: toneDot(toneOf(o.value)) }} />
              {o.label}
            </button>
          ))}
        </div>
      )}
    </span>
  )
}

/**
 * What the job is worth and where its lines stand, on one line.
 *
 * Every status is drawn, zeros included. A row that only shows the non-empty
 * statuses makes "nothing is unavailable" and "nobody has looked yet" render
 * identically, and those are the two things a card is scanned for — so a zero
 * is dimmed rather than dropped.
 */
export function DemandSummary({
  lineTotal,
  itemCount,
  counts,
  wrap = false,
}: {
  lineTotal: number
  itemCount: number
  counts: Record<string, number>
  /** Keep every count and the subtotal visible in a narrow job workspace. */
  wrap?: boolean
}) {
  const totalItems = (
    <div className="flex items-center justify-center gap-1.5 px-2 py-2">
      <span className="text-[12px] font-bold tabular-nums text-foreground">{itemCount}</span>
      <span className="whitespace-nowrap text-[10.5px] text-muted-foreground">
        Total {itemCount === 1 ? 'item' : 'items'}
      </span>
    </div>
  )
  const subtotal = (
    <div className="flex flex-wrap items-center justify-center gap-1.5 px-2 py-2">
      <span className="text-[10.5px] text-muted-foreground">Subtotal</span>
      <span className="whitespace-nowrap text-[12.5px] font-bold tabular-nums text-foreground">
        {money(lineTotal) || '$0.00'}
      </span>
    </div>
  )
  return (
    <div data-demand-summary className={cn('w-full overflow-x-auto rounded-lg border border-lps-hair bg-secondary/45', wrap && '@container')}>
      {wrap && <div className="flex w-full flex-wrap items-center justify-between border-b border-lps-hair bg-card">{totalItems}{subtotal}</div>}
      <div className={wrap
        ? 'grid w-full grid-cols-2 gap-px bg-lps-hair @[360px]:grid-cols-3 @[660px]:grid-cols-6 [&>div]:bg-card'
        : 'grid min-w-[940px] grid-cols-[repeat(6,minmax(max-content,1fr))_minmax(92px,1fr)_minmax(118px,1.15fr)] divide-x divide-lps-hair'}>
        {ITEM_STATUS_OPTIONS.map((o) => {
          const count = counts[o.value] ?? 0
          return (
            <div
              key={o.value}
              className={cn(
                'flex items-center justify-center gap-1.5 px-2 py-2',
                count === 0 && 'opacity-45',
              )}
            >
              <span
                className="size-[6px] flex-none rounded-full"
                style={{ background: toneDot(itemPill(o.value, null, null).tone) }}
              />
              <span className="text-[12px] font-bold tabular-nums text-foreground">{count}</span>
              <span className={cn('text-[10.5px] text-muted-foreground', wrap ? 'min-w-0 break-words' : 'whitespace-nowrap')}>{o.label}</span>
            </div>
          )
        })}
        {!wrap && <>{totalItems}{subtotal}</>}
      </div>
    </div>
  )
}

export const NOTE_KIND: Record<JobNote['kind'], { label: string; tone: Tone }> = {
  customer: { label: 'Customer', tone: 'amber' },
  shared: { label: 'Shared', tone: 'green' },
  internal: { label: 'Sourcing', tone: 'grey' },
}

/** The parsed entries of one audience, oldest first. */
export const entriesOf = (notes: JobNote[], kind: JobNote['kind']) => notes.filter((n) => n.kind === kind)

/**
 * The most recently written entry across all three audiences.
 *
 * `notes` arrives grouped by audience — customer, then shared, then internal —
 * so the last element is the last *internal* entry, not the newest thing on the
 * request. Stamps sort lexically because they are written `YYYY-MM-DD HH:MM`;
 * an unstamped entry predates the convention and loses to any stamped one.
 */
export function newestNote(notes: JobNote[]): JobNote | null {
  let best: JobNote | null = null
  for (const n of notes) {
    if (!best) best = n
    else if (n.stamp && (!best.stamp || n.stamp > best.stamp)) best = n
  }
  return best
}

/** The stamped entries of an append-only log, read-only by definition. */
function NoteThread({ entries, empty }: { entries: JobNote[]; empty: string }) {
  if (!entries.length) {
    return <span className="px-1 text-[12px] text-lps-dim">{empty}</span>
  }
  return (
    <div className="flex flex-col gap-1.5">
      {entries.map((n, i) => (
        <div key={i} className="flex flex-col gap-1 rounded-xl bg-lps-bubble p-2.5">
          <div className="flex items-center gap-1.5">
            <span
              className="rounded-full px-1.5 py-px text-[9.5px] font-bold uppercase tracking-wide"
              style={toneStyle(NOTE_KIND[n.kind].tone)}
            >
              {NOTE_KIND[n.kind].label}
            </span>
            {n.stamp && (
              <span className="ml-auto flex-none whitespace-nowrap text-[10.5px] text-muted-foreground">
                {n.stamp}
              </span>
            )}
          </div>
          <p className="m-0 whitespace-pre-wrap text-[12.5px] leading-relaxed text-foreground">
            {n.text}
          </p>
        </div>
      ))}
    </div>
  )
}

function renderSourcingNote(text: string) {
  return <Markdown text={text} onAction={(scheme, target) => {
    if (scheme === 'ar') openAvailabilityRequest(Number.parseInt(target, 10))
    else openChat({ agentId: 'rosie', threadId: target })
  }} />
}

/**
 * Both notes use a single-line preview; sourcing notes render their first
 * line as Markdown. Both keep their full original source for editing.
 */
function NoteCell({
  kind,
  table,
  id,
  title,
  value,
  onSaved,
  touchTarget,
}: {
  kind: 'shared' | 'internal'
  table: string
  id: number
  /** What the popover is about — "Bloodgood Maple · 15 gal". */
  title: string
  /** Raw column text — both audiences are one editable field. */
  value: string | null
  onSaved: () => void
  touchTarget: boolean
}) {
  const [open, setOpen] = useState(false)
  const pop = useOutsideClose(open, () => setOpen(false))

  const [position, setPosition] = useState<{ left: number; top?: number; bottom?: number }>({ left: 0 })
  useLayoutEffect(() => {
    if (!open) return
    const box = pop.current?.getBoundingClientRect()
    if (!box) return
    const left = Math.max(8, Math.min(box.right - 340, window.innerWidth - 348))
    setPosition(window.innerHeight - box.bottom >= 368
      ? { left, top: box.bottom + 8 }
      : { left, bottom: window.innerHeight - box.top + 8 })
    const close = (event: Event) => {
      if (event.target instanceof Node && pop.current?.contains(event.target)) return
      setOpen(false)
    }
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open, pop])

  const meta = NOTE_KIND[kind]
  const summary = value?.trim() ?? ''

  return (
    <div ref={pop} data-pop className="relative min-w-0 px-1.5"
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false)
      }}
    >
      <button
        type="button"
        aria-label={kind === 'internal' ? `Edit sourcing note for ${title}` : undefined}
        title={summary || `Add a ${meta.label.toLowerCase()} note`}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        className="flex w-full min-w-0 cursor-pointer flex-col items-start gap-px rounded-md border border-transparent bg-transparent px-1 py-0.5 text-left hover:border-border hover:bg-lps-tint"
      >
        {summary ? (
          <span className="w-full truncate text-[12px] text-foreground">
            {kind === 'internal' ? <MarkdownFirstLine text={summary} /> : summary.replace(/\s+/g, ' ')}
          </span>
        ) : (
          <span className="text-[12px] text-lps-dim">—</span>
        )}
      </button>
      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={position}
          className="lps-pop fixed z-[70] flex max-h-[360px] w-[340px] flex-col gap-2 overflow-auto rounded-2xl border border-border bg-popover p-3 shadow-[var(--lps-shadow)]"
        >
          <div className="flex items-baseline gap-2">
            <span className="text-[12.5px] font-bold text-foreground">{meta.label} note</span>
            {kind !== 'shared' && <span className="min-w-0 truncate text-[11px] text-muted-foreground">{title}</span>}
          </div>
          {kind === 'shared' ? (
              <EditableTextarea
                table={table}
                id={id}
                column="external_notes"
                value={value}
                onSaved={onSaved}
                touchTarget={touchTarget}
                placeholder="Add a shared note…"
              />
          ) : (
            <>
              <EditableTextarea
                table={table}
                id={id}
                column="sourcing_notes"
                value={value}
                onSaved={onSaved}
                touchTarget={touchTarget}
                placeholder="Supplier name, key details and numbers…"
                renderPreview={renderSourcingNote}
                editLabel={`Edit sourcing note for ${title}`}
              />
            </>
          )}
        </div>
      )}
    </div>
  )
}

function ItemRow({
  item,
  selected,
  onSelect,
  onDelete,
  onSaved,
  touchTarget,
}: {
  item: JobRequestItem
  selected: boolean
  /** Omitted where the page has nothing to do with a selection. */
  onSelect?: () => void
  /** Omitted where lines are read, not managed — the customer's own page. */
  onDelete?: () => void
  onSaved: () => void
  touchTarget: boolean
}) {
  const pill = itemPill(item.status, item.quantity, item.availableQuantity)
  const cover = coverOf(item.quantity, item.availableQuantity)
  const edit = { table: 'job_request_items', id: item.id, onSaved, touchTarget }
  const title = [item.name, item.size].filter(Boolean).join(' · ')

  // A selected row reads as selected; otherwise the status tints it. The
  // needs-input amber used to sit between the two, but every line that is not
  // `available` is waiting on somebody by definition, so it painted almost the
  // whole table one colour and hid the statuses underneath it.
  const background = selected ? 'var(--lps-tone-green-bg)' : toneTint(pill.tone)

  return (
    <div
      data-line-row
      className="grid items-center border-b border-lps-hair last:border-b-0"
      style={{
        gridTemplateColumns: gridOf(!!onSelect, !!onDelete),
        minHeight: '48px',
        padding: '4px 0',
        borderLeft: `3px solid ${toneDot(pill.tone)}`,
        background,
      }}
    >
      {onSelect && (
        <div className="flex justify-center">
          <Check state={selected} onChange={onSelect} label={`Select ${item.name}`} />
        </div>
      )}
      <div className="px-1">
        <EditableText
          {...edit}
          column="quantity"
          value={item.quantity}
          numeric
          align="right"
          render={(v) => num(v)}
          title="Demand — what the customer asked for"
        />
      </div>
      {/* Colour lives on the wrapper so the button inherits it: blank means
          nobody has answered, which is not the same as zero. */}
      <div className="px-1" style={{ color: coverColor(cover) }}>
        <EditableText
          {...edit}
          column="available_quantity"
          value={item.availableQuantity}
          numeric
          align="right"
          render={(v) => num(v)}
          title="Avail — how many we can supply. Blank means not answered yet."
        />
      </div>
      <div className="px-1">
        <EditableText {...edit} column="size" value={item.size} />
      </div>
      <div className="flex min-w-0 flex-col gap-px px-1.5">
        <span className="flex min-w-0 items-center gap-1.5">
          <EditableText {...edit} column="name" value={item.name} />
        </span>
        {/* The customer's own words about this line. Evidence, so it is shown
            where the ask is read and never edited from here. */}
        {item.customerNotes?.trim() && (
          <span
            title={item.customerNotes}
            className="truncate px-1.5 text-[11px] italic text-muted-foreground"
          >
            {item.customerNotes.replace(/\s+/g, ' ')}
          </span>
        )}
      </div>
      <div className="px-1.5">
        <StatusPill
          {...edit}
          column="status"
          value={item.status}
          label={pill.label}
          tone={pill.tone}
          options={ITEM_STATUS_OPTIONS}
        />
      </div>
      <div className="px-1">
        <EditableText
          {...edit}
          column="unit_price"
          value={item.unitPrice}
          numeric
          align="right"
          render={(v) => money(v)}
        />
      </div>
      {/* Generated by the database from demand and unit price. */}
      <div
        className="px-2.5 text-right text-[12.5px] font-semibold tabular-nums text-foreground"
        tabIndex={0}
        title="Total — calculated from demand × unit price"
      >
        {money(item.total) || '—'}
      </div>
      <NoteCell
        kind="shared"
        table="job_request_items"
        id={item.id}
        title={title}
        value={item.externalNotes}
        onSaved={onSaved}
        touchTarget={touchTarget}
      />
      <NoteCell
        kind="internal"
        table="job_request_items"
        id={item.id}
        title={title}
        value={item.sourcingNotes}
        onSaved={onSaved}
        touchTarget={touchTarget}
      />
      {onDelete && (
        <div className="flex justify-center px-1">
          <button
            type="button"
            onClick={onDelete}
            title={`Delete ${title || 'this line'} permanently`}
            aria-label={`Delete ${title || 'this line'}`}
            className="inline-flex size-[26px] cursor-pointer items-center justify-center rounded-[7px] border-none bg-transparent text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <TrashIcon size={14} />
          </button>
        </div>
      )}
    </div>
  )
}

/** One labelled, editable field in the request detail grid. */
/**
 * One supplier's links, as a segmented pill: who they are, then what they open.
 *
 * A job can have several suppliers and several availability requests with each
 * of them, so the supplier — not the request — is the unit: the name is written
 * once, carries the app's own supplier mark, and every request the job has with
 * them plus their conversation hang off it as segments. A flat run of `AR-<id>`
 * chips is the same links in an order nobody can scan.
 */
function SupplierPill({
  name,
  children,
  focusedMobile = false,
}: {
  name: string
  children: React.ReactNode
  focusedMobile?: boolean
}) {
  return (
    <span
      data-focused-mobile-supplier-pill={focusedMobile ? '' : undefined}
      className={focusedMobile
        ? 'flex w-full min-w-0 max-w-full flex-wrap items-stretch overflow-visible rounded-xl border border-lps-edge bg-card text-[10.5px] font-semibold'
        : 'inline-flex min-w-0 max-w-full flex-none flex-wrap items-stretch overflow-hidden rounded-xl border border-lps-edge bg-card text-[10.5px] font-semibold'}
    >
      <span className={focusedMobile
        ? 'flex min-w-0 max-w-full basis-full items-start gap-1 border-b border-lps-hair px-2 py-1 text-foreground'
        : 'flex items-center gap-1 px-2 py-0.5 text-foreground'}>
        <SuppliersIcon size={11} className={cn(
          'flex-none text-muted-foreground',
          focusedMobile && 'mt-0.5',
        )} />
        <span className={focusedMobile
          ? 'min-w-0 max-w-full whitespace-normal break-words [overflow-wrap:anywhere]'
          : 'max-w-[11rem] truncate'}>{name}</span>
      </span>
      {children}
    </span>
  )
}

/** One thing a pill opens: an availability request, or a conversation. */
function LinkSegment({
  title,
  describedBy,
  onOpen,
  className,
  children,
}: {
  title: string
  describedBy?: string
  onOpen: () => void
  className?: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onOpen()
      }}
      title={title}
      aria-label={title}
      aria-describedby={describedBy}
      className={cn(
        'flex cursor-pointer items-center border-l border-lps-hair bg-transparent px-1.5 hover:bg-lps-tint',
        className,
      )}
    >
      {children}
    </button>
  )
}

/**
 * Who the job is for on the left, everything it opens on the right: the
 * customer and their conversation, where it ships, and every engaged supplier
 * with their availability requests and conversation. The sourcing notes used
 * to carry these links, but a note is free text: the links belong to the job,
 * not to a sentence about it.
 *
 * `suppliersHidden` folds the supplier strip away on small screens — on a
 * collapsed list card there is no empty half to ride, and who a job's
 * suppliers are is what you open the card to find out. `focusedMobile` is the
 * focused Job's narrow preview only: its supplier name gets a full-width row.
 * All variants wrap dated AR segments to the available width.
 */
export function RequestLinks({
  request,
  suppliersHidden = false,
  focusedMobile = false,
  relatedOnly = false,
  className,
}: {
  request: JobRequestRow
  suppliersHidden?: boolean
  focusedMobile?: boolean
  /** Route actions only, for the compact desktop details tray. */
  relatedOnly?: boolean
  className?: string
}) {
  const dateIdPrefix = useId()
  const customerName = request.customer?.company || request.customer?.name
  const contact = request.customer?.company && request.customer.name ? request.customer.name : null
  // Only the stored canonical customer thread is safe to open. Rosie owns
  // first-contact minting and collision handling; this strip never guesses.
  const customerThread = request.customer ? customerThreadId(request.customer) : null

  // Only where it is going; the street lives in the details drawer.
  const locality = [
    request.shipping.city ?? request.billing.city,
    request.shipping.state ?? request.billing.state,
  ]
    .filter(Boolean)
    .join(', ')

  // The engaged suppliers, most recently engaged first — each one pill, so a
  // job with several suppliers and several requests each still reads as a list
  // of suppliers rather than a run of loose AR numbers.
  const supplierPills = [...request.supplierLinks].sort(
    (a, b) => (b.availabilityRequests[0]?.id ?? 0) - (a.availabilityRequests[0]?.id ?? 0),
  )

  return (
    <div
      data-focused-mobile-request-links={focusedMobile ? '' : undefined}
      className={cn(
        'flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[12px]',
        focusedMobile && 'w-full max-w-full [overflow-wrap:anywhere]',
        className,
      )}
    >
      {!relatedOnly && (
        <span className={cn(
          'font-semibold text-foreground',
          focusedMobile && 'min-w-0 max-w-full break-words',
        )}>
          {customerName ?? <span className="italic text-muted-foreground">Unassigned customer</span>}
        </span>
      )}
      {!relatedOnly && contact && <span className={cn(
        'text-muted-foreground',
        focusedMobile && 'min-w-0 max-w-full break-words',
      )}>· {contact}</span>}
      {/* The customer's conversation, on the customer's own name — the one
          place it cannot be mistaken for a supplier's. */}
      {customerThread && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            openChat({
              agentId: 'rosie',
              threadId: customerThread,
              label: customerName ?? customerThread,
            })
          }}
          title={`Open the customer conversation with ${customerName ?? customerThread}`}
          aria-label={`Open the customer conversation with ${customerName ?? customerThread}`}
          className={cn(
            'flex flex-none cursor-pointer items-center gap-1 rounded-full border border-lps-edge bg-card px-2 py-0.5 text-[10.5px] font-semibold text-primary hover:bg-secondary',
            relatedOnly && 'min-h-11',
          )}
        >
          <MessagesSquare size={11} /> Chat
        </button>
      )}
      {!relatedOnly && locality && (
        <span className={cn(
          'inline-flex items-center gap-1 text-muted-foreground',
          focusedMobile && 'min-w-0 max-w-full flex-wrap',
        )}>
          <MapPinIcon size={11} /> {locality}
        </span>
      )}
      {supplierPills.length > 0 && (
        <div
          className={cn(
            focusedMobile
              ? 'flex w-full min-w-0 max-w-full flex-wrap items-center gap-1'
              : 'flex w-full min-w-0 max-w-full flex-wrap items-center gap-1 md:ml-auto md:w-auto md:justify-end',
            suppliersHidden && 'hidden md:flex',
          )}
        >
          {supplierPills.map((l) => (
            <SupplierPill key={l.supplierId} name={l.name} focusedMobile={focusedMobile}>
              {l.availabilityRequests.map((ar) => (
                <LinkSegment
                  key={ar.id}
                  title={availabilityRequestLinkLabel(ar.id, l.name, ar.status)}
                  describedBy={`${dateIdPrefix}-ar-${ar.id}-date`}
                  onOpen={() => openAvailabilityRequest(ar.id)}
                  className={cn(
                    'flex-row justify-center gap-1.5 py-0.5',
                    relatedOnly && 'min-h-8',
                    isSubmittedARStatus(ar.status)
                      ? 'bg-[var(--lps-tone-green-bg)] text-[var(--lps-tone-green-fg)] hover:bg-[var(--lps-tone-green-bg)]'
                      : isInProgressARStatus(ar.status)
                        ? 'bg-[var(--lps-tone-amber-bg)] text-[var(--lps-tone-amber-fg)] hover:bg-[var(--lps-tone-amber-bg)]'
                        : 'bg-[var(--lps-tone-grey-bg)] text-[var(--lps-tone-grey-fg)] hover:bg-[var(--lps-tone-grey-bg)]',
                    'hover:brightness-95',
                  )}
                >
                  <span className="flex items-center gap-1">
                    AR-{ar.id}
                    {(isSubmittedARStatus(ar.status) || isInProgressARStatus(ar.status)) && (
                      <span
                        aria-hidden="true"
                        className={cn(
                          'size-1.5 flex-none rounded-full',
                          isSubmittedARStatus(ar.status)
                            ? 'bg-[var(--lps-tone-green-dot)]'
                            : 'bg-[var(--lps-tone-amber-dot)]',
                        )}
                      />
                    )}
                  </span>
                  <span id={`${dateIdPrefix}-ar-${ar.id}-date`} className="whitespace-nowrap text-[10px] font-normal opacity-80">
                    {formatMonthDay(isSubmittedARStatus(ar.status) ? ar.submittedAt : ar.createdAt) || '—'}
                  </span>
                </LinkSegment>
              ))}
              {l.rosieThreadId && !focusedMobile && (
                <LinkSegment
                  title={`Open the supplier conversation with ${l.name}`}
                  onOpen={() =>
                    openChat({ agentId: 'rosie', threadId: l.rosieThreadId!, label: l.name })
                  }
                  className={cn(
                    'text-muted-foreground hover:text-primary',
                    relatedOnly && 'min-h-8',
                  )}
                >
                  <MessagesSquare size={11} />
                </LinkSegment>
              )}
            </SupplierPill>
          ))}
        </div>
      )}
    </div>
  )
}

function DetailField({
  label,
  ...props
}: EditProps & { label: string; value: string | number | null; placeholder?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-[.05em] text-muted-foreground">
        {label}
      </span>
      <EditableText {...props} />
    </div>
  )
}

function JobSchedule({ request, edit }: { request: JobRequestRow; edit: Omit<EditProps, 'column'> }) {
  const [date, setDate] = useState(request.expectedInstallDate ?? '')
  const [method, setMethod] = useState(request.fulfillmentMethod ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    setDate(request.expectedInstallDate ?? '')
    setMethod(request.fulfillmentMethod ?? '')
  }, [request.id, request.expectedInstallDate, request.fulfillmentMethod])
  const save = async (column: string, value: string) => {
    setBusy(true)
    setError('')
    try {
      await patchRow(edit.table, edit.id, column, value)
      edit.onSaved()
    } catch (e) { setError((e as Error).message) }
    finally { setBusy(false) }
  }
  return <div className="flex flex-wrap gap-3 py-2 text-[12px]">
    <label className="flex flex-col gap-1">Expected delivery / installation date
      <input aria-label="Expected delivery / installation date" type="date" value={date} disabled={busy}
        onChange={(event) => setDate(event.target.value)}
        onBlur={(event) => { const next = event.currentTarget.value; setDate(next); if (next !== (request.expectedInstallDate ?? '')) void save('expected_install_date', next) }}
        className="min-h-11 rounded-md border border-input bg-background px-2" />
    </label>
    <label className="flex flex-col gap-1">Pickup / Delivery
      <select aria-label="Pickup / Delivery" value={method} disabled={busy}
        onChange={(event) => { setMethod(event.target.value); void save('fulfillment_method', event.target.value) }}
        className="min-h-11 rounded-md border border-input bg-background px-2">
        <option value="">Not set</option><option value="pickup">Pickup</option><option value="delivery">Delivery</option>
      </select>
    </label>
    {error && <p role="alert" className="text-destructive">{error}</p>}
  </div>
}

/** One of the two addresses, street over city/state/ZIP. */
function AddressCard({
  label,
  prefix,
  address,
  ...edit
}: Omit<EditProps, 'column'> & {
  label: string
  /** `shipping` or `billing` — the column-name prefix. */
  prefix: string
  address: JobAddress
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-lps-hair bg-card p-3">
      <span className="text-[10.5px] font-bold uppercase tracking-[.05em] text-muted-foreground">
        {label}
      </span>
      <DetailField {...edit} label="Street" column={`${prefix}_address`}
        value={address.address} placeholder="street" />
      <div className="grid grid-cols-[minmax(0,1fr)_64px_84px] gap-2">
        <DetailField {...edit} label="City" column={`${prefix}_city`}
          value={address.city} placeholder="city" />
        <DetailField {...edit} label="State" column={`${prefix}_state`}
          value={address.state} placeholder="—" />
        <DetailField {...edit} label="ZIP" column={`${prefix}_zip`}
          value={address.zip} placeholder="—" />
      </div>
    </div>
  )
}

/** The screenshot's compact top summary, limited to fields this schema owns. */
function RequestOverview({ request }: { request: JobRequestRow }) {
  const customerName = request.customer?.company || request.customer?.name
  const contactName = request.customer?.company ? request.customer.name : null
  const shipping = addressLine(request.shipping)
  const billing = addressLine(request.billing)

  const blocks = [
    {
      label: 'Request',
      primary: request.name || requestRef(request.id),
      secondary: request.name ? requestRef(request.id) : 'Unnamed job',
    },
    {
      label: 'Contact',
      primary: customerName || 'No customer assigned',
      secondary: contactName,
      detail: request.customer
        ? [request.customer.phone, request.customer.email].filter(Boolean).join(' · ')
        : null,
    },
    {
      label: 'Delivery',
      primary: request.fulfillmentMethod === 'pickup' ? 'Pickup' : shipping || 'No shipping address recorded',
      secondary: request.expectedInstallDate ? `Expected delivery / installation date: ${request.expectedInstallDate}` : 'Expected delivery / installation date not recorded',
    },
    {
      label: 'Billing & payment',
      primary: billing || 'No billing address recorded',
      secondary: 'Payment method not recorded',
    },
  ]

  return (
    <div className="grid gap-px overflow-hidden rounded-lg border border-lps-hair bg-lps-hair sm:grid-cols-2 xl:grid-cols-4">
      {blocks.map((block) => (
        <div key={block.label} className="flex min-w-0 flex-col gap-0.5 bg-card px-3 py-2.5">
          <span className="text-[9.5px] font-bold uppercase tracking-[.06em] text-muted-foreground">
            {block.label}
          </span>
          <span className="truncate text-[12px] font-semibold text-foreground" title={block.primary}>
            {block.primary}
          </span>
          {block.secondary && (
            <span className="truncate text-[10.5px] text-muted-foreground" title={block.secondary}>
              {block.secondary}
            </span>
          )}
          {block.detail && (
            <span className="truncate text-[10.5px] text-muted-foreground" title={block.detail}>
              {block.detail}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

/** One titled block in the details drawer's note row. */
function NoteBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 rounded-xl border border-lps-hair bg-card p-3">
      <span className="text-[10.5px] font-bold uppercase tracking-[.05em] text-muted-foreground">
        {label}
      </span>
      {children}
    </div>
  )
}

/** A compact desktop signature column: separation without another boxed panel. */
function SignatureBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-1 border-l border-lps-hair pl-3 first:border-l-0 first:pl-0">
      <h3 className="m-0 text-[10px] font-bold uppercase tracking-[.05em] text-muted-foreground">
        {label}
      </h3>
      {children}
    </section>
  )
}

function SignatureAddress({
  prefix,
  address,
  ...edit
}: Omit<EditProps, 'column'> & { prefix: string; address: JobAddress }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <DetailField {...edit} label="Street" column={`${prefix}_address`} value={address.address} placeholder="street" />
      <div className="grid grid-cols-[minmax(0,1fr)_56px_72px] gap-1.5">
        <DetailField {...edit} label="City" column={`${prefix}_city`} value={address.city} placeholder="city" />
        <DetailField {...edit} label="State" column={`${prefix}_state`} value={address.state} placeholder="—" />
        <DetailField {...edit} label="ZIP" column={`${prefix}_zip`} value={address.zip} placeholder="—" />
      </div>
    </div>
  )
}

function CompactJobDetails({
  request,
  edit,
  open,
  onToggle,
  lastUpdated,
}: {
  request: JobRequestRow
  edit: Omit<EditProps, 'column'>
  open: boolean
  onToggle: () => void
  lastUpdated: string
}) {
  const contactValues = request.customer
    ? [request.customer.name, request.customer.phone, request.customer.email]
      .map((value) => value?.trim())
      .filter((value): value is string => Boolean(value))
    : []
  const hasRelatedRoutes = Boolean(
    request.customer?.rosieThreadId?.trim() || request.supplierLinks.length,
  )

  return (
    <div data-compact-job-details-disclosure className="border-t border-border">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex min-h-11 w-full cursor-pointer items-center gap-2 border-none bg-lps-tint px-3.5 py-2 text-left outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <span className="flex size-4 flex-none items-center justify-center text-muted-foreground">
          {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </span>
        <span className="min-w-0 truncate text-[10.5px] font-bold uppercase tracking-[.05em] text-muted-foreground">
          Job details & notes
        </span>
      </button>

      {open && (
        <div
          data-compact-job-details
          className="grid grid-cols-1 gap-3 bg-lps-tint px-3.5 pb-3.5 min-[1100px]:grid-cols-2 min-[1500px]:grid-cols-4"
        >
          {contactValues.length > 0 && (
            <SignatureBlock label="Contact">
              {request.customer?.name?.trim() && (
                <span className="break-words text-[12.5px] font-semibold [overflow-wrap:anywhere]">
                  {request.customer.name.trim()}
                </span>
              )}
              {(request.customer?.phone?.trim() || request.customer?.email?.trim()) && (
                <span className="break-words text-[11.5px] text-muted-foreground [overflow-wrap:anywhere]">
                  {[request.customer.phone?.trim(), request.customer.email?.trim()].filter(Boolean).join(' · ')}
                </span>
              )}
            </SignatureBlock>
          )}
          <SignatureBlock label="Payment contact / billing">
            <SignatureAddress {...edit} prefix="billing" address={request.billing} />
          </SignatureBlock>
          <SignatureBlock label="Delivery">
            <JobSchedule request={request} edit={edit} />
            <SignatureAddress {...edit} prefix="shipping" address={request.shipping} />
          </SignatureBlock>
          <SignatureBlock label="Other / notes">
            <div data-request-last-updated className="flex min-h-11 items-center gap-2 text-[12px]">
              <span className="font-semibold text-muted-foreground">Last updated</span>
              {lastUpdated ? (
                <time dateTime={request.updatedAt ?? undefined} className="font-medium text-foreground">
                  {lastUpdated}
                </time>
              ) : (
                <span className="font-medium text-muted-foreground">Not recorded</span>
              )}
            </div>
            <span className="text-[10px] font-bold uppercase tracking-[.05em] text-muted-foreground">
              The customer's own words
            </span>
            <NoteThread entries={entriesOf(request.notes, 'customer')} empty="Nothing on file." />
            <span className="mt-1 text-[10px] font-bold uppercase tracking-[.05em] text-muted-foreground">
              Shared note — the customer sees this
            </span>
            <EditableTextarea {...edit} column="external_notes" value={request.externalNotes}
              placeholder="Add a note to share with the customer…" />
            <span className="mt-1 text-[10px] font-bold uppercase tracking-[.05em] text-muted-foreground">
              Sourcing note — job changes only
            </span>
            <EditableTextarea {...edit} column="sourcing_notes" value={request.sourcingNotes}
              placeholder="Add a sourcing note…" renderPreview={renderSourcingNote} editLabel="Edit job sourcing note" />
            {hasRelatedRoutes && (
              <>
                <span className="mt-1 text-[10px] font-bold uppercase tracking-[.05em] text-muted-foreground">
                  Related
                </span>
                <RequestLinks request={request} relatedOnly />
              </>
            )}
          </SignatureBlock>
        </div>
      )}
    </div>
  )
}

/**
 * The roles the changelog records, in words.
 *
 * `actor` is `app.actor` when a writer set it and the database role otherwise
 * (migration 0055), so the raw value is a mix of names and role names. Only the
 * role names need translating — an agent that names itself already reads.
 */
const ACTOR_LABEL: Record<string, string> = {
  service_role: 'This app',
  postgres: 'An agent script',
  rosie: 'Rosie',
  'claude-code': 'Claude Code',
}
const actorLabel = (a: string) => ACTOR_LABEL[a] ?? a

/** `Aug 18, 09:41` — a changelog entry is read against its neighbours, so the
 *  time matters as much as the date. */
const changeStamp = (iso: string) =>
  new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })

/** One changed value, short enough to sit in a row. */
function showValue(v: unknown): string {
  if (v == null) return '—'
  if (typeof v === 'boolean') return v ? 'yes' : 'no'
  const text = (typeof v === 'object' ? JSON.stringify(v) : String(v)).replace(/\s+/g, ' ').trim()
  if (!text) return '—'
  return text.length > 160 ? `${text.slice(0, 160)}…` : text
}

/** An `{old, new}` pair as the trigger writes it for an update. */
const asPair = (v: unknown): { old: unknown; new: unknown } | null =>
  v !== null && typeof v === 'object' && !Array.isArray(v) && 'new' in (v as object)
    ? (v as { old: unknown; new: unknown })
    : null

function ChangeEntry({ entry }: { entry: JobChange }) {
  const inserted = entry.action === 'insert'
  return (
    <div className="flex flex-col gap-1.5 rounded-xl bg-lps-bubble p-2.5">
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
        <span
          className="flex-none rounded-full px-1.5 py-px text-[9.5px] font-bold uppercase tracking-wide"
          style={toneStyle(inserted ? 'green' : 'teal')}
        >
          {inserted ? 'Created' : 'Changed'}
        </span>
        <span className="text-[11.5px] font-semibold text-foreground">
          {actorLabel(entry.actor)}
        </span>
        <span className="min-w-0 truncate text-[11px] text-muted-foreground">
          {entry.itemId == null
            ? 'on the request'
            : `on ${entry.itemName ?? `line ${entry.itemId}`}`}
        </span>
        <span className="ml-auto flex-none whitespace-nowrap text-[10.5px] text-muted-foreground">
          {changeStamp(entry.createdAt)}
        </span>
      </div>
      <div className="flex flex-col gap-0.5">
        {Object.entries(entry.changes).map(([column, value]) => {
          const pair = asPair(value)
          return (
            <div
              key={column}
              className="grid grid-cols-[minmax(96px,auto)_minmax(0,1fr)] items-baseline gap-x-2"
            >
              <span className="truncate font-mono text-[10.5px] text-muted-foreground">
                {column}
              </span>
              {pair ? (
                <span className="min-w-0 text-[11.5px]">
                  <span className="text-lps-dim line-through">{showValue(pair.old)}</span>
                  <span className="mx-1 text-lps-dim">→</span>
                  <span className="text-foreground">{showValue(pair.new)}</span>
                </span>
              ) : (
                <span className="min-w-0 text-[11.5px] text-foreground">{showValue(value)}</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * The request's whole audit trail, behind a toggle.
 *
 * Loaded only when opened, and reloaded whenever `version` moves — the page
 * bumps that after every write, and an edit you just made should appear in the
 * history you are looking at.
 *
 * Nothing here is editable, and it is not a note: `job_request_changelog` is
 * written by a database trigger and is immutable. It is also the *complete*
 * record — the app's edits and the agents' land in it identically, because
 * neither write path has to cooperate for the trigger to fire.
 */
function ChangeHistory({ requestId, version, touchTarget = false }: { requestId: number; version: number; touchTarget?: boolean }) {
  const [open, setOpen] = useState(false)
  const [entries, setEntries] = useState<JobChange[] | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setBusy(true)
    fetch(`/api/requests/${requestId}/changelog`)
      .then((r) => r.json())
      .then((d: { entries?: JobChange[]; error?: string }) => {
        if (cancelled) return
        if (d.error) {
          setError(d.error)
          return
        }
        setError('')
        setEntries(d.entries ?? [])
      })
      .catch((e) => {
        if (!cancelled) setError(String(e))
      })
      .finally(() => {
        if (!cancelled) setBusy(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, version, requestId])

  return (
    <div className="border-t border-border">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex w-full cursor-pointer items-center gap-2 border-none bg-lps-tint px-3.5 py-2 text-left hover:bg-muted',
          touchTarget && 'min-h-11 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
        )}
      >
        <span className="flex size-4 flex-none items-center justify-center text-muted-foreground">
          {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </span>
        <span className="flex-none text-[10.5px] font-bold uppercase tracking-[.05em] text-muted-foreground">
          Change history
        </span>
        <span className="min-w-0 truncate text-[11.5px] text-muted-foreground">
          {open
            ? entries
              ? `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}, newest first`
              : 'Loading…'
            : 'Every edit to this request and its lines, by the app and by the agents'}
        </span>
      </button>

      {open && (
        <div className="flex flex-col gap-1.5 bg-lps-tint px-3.5 pb-3.5">
          {error && <span className="text-[12px] text-destructive">{error}</span>}
          {busy && !entries && (
            <span className="py-2 text-[12px] text-muted-foreground">Loading…</span>
          )}
          {entries?.length === 0 && (
            <span className="py-2 text-[12px] text-muted-foreground">Nothing recorded yet.</span>
          )}
          {entries?.map((e) => <ChangeEntry key={e.id} entry={e} />)}
        </div>
      )}
    </div>
  )
}

/**
 * Everything under a request's head: its particulars, its lines, its history.
 *
 * The whole of the expanded card, so the two pages that open a request open the
 * same thing. `onSelect` is what makes the lines selectable — the Job Requests
 * page has a bar to act on a selection, a customer's card has none, and a
 * checkbox nothing can act on would be a lie.
 */
export function RequestBody({
  request,
  version,
  detailsOpen,
  onToggleDetails,
  compactJobDetails = false,
  summaryInHeader = false,
  touchTargets = false,
  selected,
  onSelect,
  onDeleteItem,
  emptyItemsCopy = 'No line items match these filters.',
  onSaved,
}: {
  request: JobRequestRow
  /** Bumped after every write — what makes an open history drawer refresh. */
  version: number
  /** Held by the card, so it survives the lines collapsing and reopening. */
  detailsOpen: boolean
  onToggleDetails: () => void
  /** Focused Job on both breakpoints plus expanded desktop All Jobs. */
  compactJobDetails?: boolean
  /** The focused job already shows its rollup beside the header actions. */
  summaryInHeader?: boolean
  /** Explicitly enlarge shared edit/status controls only on focused/compact Job work. */
  touchTargets?: boolean
  /** Every selected line id on the page; the body reads its own out of it. */
  selected?: Set<number>
  /** Select or clear these line ids; the page owns the set. */
  onSelect?: (ids: number[], on: boolean) => void
  /**
   * Delete one line, permanently. Omitted where requests are read rather than
   * managed — a customer's page lists their jobs, it does not administer them.
   */
  onDeleteItem?: (item: JobRequestItem) => void
  /** Honest empty state for filtered management vs an unfiltered work pane. */
  emptyItemsCopy?: string
  onSaved: () => void
}) {
  const [tab, setTab] = useState<'items' | 'orders'>('items')
  useEffect(() => setTab('items'), [request.id])
  const edit = { table: 'job_requests', id: request.id, onSaved, touchTarget: touchTargets }
  const ship = addressLine(request.shipping)
  const bill = addressLine(request.billing)
  const lastUpdated = request.updatedAt && !Number.isNaN(new Date(request.updatedAt).getTime())
    ? formatDate(request.updatedAt)
    : ''

  // What the collapsed drawer says it is hiding, so opening it is a decision
  // rather than a guess.
  const detailSummary =
    [
      ship ? `Ship to ${ship}` : null,
      bill && bill !== ship ? `Bill to ${bill}` : null,
      request.notes.length
        ? `${request.notes.length} ${request.notes.length === 1 ? 'note' : 'notes'}`
        : null,
    ]
      .filter(Boolean)
      .join('  ·  ') || 'No address or notes recorded'

  return (
    <>
      <div role="tablist" aria-label="Job request" className="flex gap-1 border-t border-border px-3 py-1">
        {(['items', 'orders'] as const).map((value) => <button key={value} type="button" role="tab"
          aria-selected={tab === value} onClick={() => setTab(value)}
          className={`min-h-11 rounded-md px-3 text-[12px] font-semibold ${tab === value ? 'bg-muted text-foreground' : 'text-muted-foreground'}`}>
          {value === 'items' ? 'Request items' : 'Orders'}
        </button>)}
      </div>
      {tab === 'orders' ? <JobOrders jobRequestId={request.id} onChanged={onSaved} version={version} /> : <>
      {(!compactJobDetails || !summaryInHeader) && <div className="flex flex-col gap-2 border-t border-border bg-lps-tint p-2.5 sm:p-3">
        {!compactJobDetails && <RequestOverview request={request} />}
        {!summaryInHeader && <DemandSummary
          lineTotal={request.lineTotal}
          itemCount={request.itemCount}
          counts={request.statusCounts}
        />}
      </div>}

      {!compactJobDetails && (
        <div className="border-t border-border">
          <button
            type="button"
            aria-expanded={detailsOpen}
            onClick={onToggleDetails}
            className="flex min-h-11 w-full cursor-pointer items-center gap-2 border-none bg-lps-tint px-3.5 py-2 text-left outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          >
            <span className="flex size-4 flex-none items-center justify-center text-muted-foreground">
              {detailsOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            </span>
            <span className="flex-none text-[10.5px] font-bold uppercase tracking-[.05em] text-muted-foreground">
              More details & notes
            </span>
            {!detailsOpen && (
              <span className="min-w-0 truncate text-[11.5px] text-muted-foreground">
                {detailSummary}
              </span>
            )}
          </button>

          {detailsOpen && (
            <div className="flex flex-col gap-3 bg-lps-tint px-3.5 pb-3.5">
              <div
                data-request-last-updated
                className="flex min-h-11 items-center gap-2 rounded-lg border border-lps-hair bg-card px-3 text-[12px]"
              >
                <span className="font-semibold text-muted-foreground">Last updated</span>
                {lastUpdated ? (
                  <time dateTime={request.updatedAt ?? undefined} className="font-medium text-foreground">
                    {lastUpdated}
                  </time>
                ) : (
                  <span className="font-medium text-muted-foreground">Not recorded</span>
                )}
              </div>
              <JobSchedule request={request} edit={edit} />
              <div className="grid gap-3 md:grid-cols-2">
                <AddressCard {...edit} label="Shipping address" prefix="shipping"
                  address={request.shipping} />
                <AddressCard {...edit} label="Billing address" prefix="billing"
                  address={request.billing} />
              </div>
              <div className="grid gap-3 lg:grid-cols-3">
                <NoteBlock label="The customer's own words">
                  <NoteThread entries={entriesOf(request.notes, 'customer')} empty="Nothing on file." />
                </NoteBlock>
                <NoteBlock label="Shared note — the customer sees this">
                  <EditableTextarea {...edit} column="external_notes" value={request.externalNotes}
                    placeholder="Add a note to share with the customer…" />
                </NoteBlock>
                <NoteBlock label="Sourcing note — job changes only">
                  <EditableTextarea {...edit} column="sourcing_notes" value={request.sourcingNotes}
                    placeholder="Add a sourcing note…" renderPreview={renderSourcingNote} editLabel="Edit job sourcing note" />
                </NoteBlock>
              </div>
            </div>
          )}
        </div>
      )}

      {/* The line table scrolls sideways rather than crushing its columns —
          the design fixes a min width for exactly this reason, and the two
          note columns are what would otherwise be squeezed out of existence. */}
      <div data-request-line-table onKeyDown={navigateLineCells} className="overflow-x-auto border-t border-border">
        <div
          style={{
            minWidth:
              GRID_MIN - (onSelect ? 0 : SELECT_COLUMN) + (onDeleteItem ? ACTION_COLUMN : 0),
          }}
        >
          {/* Column header, repeated per card so it survives a collapsed neighbour. */}
          <div
            className="grid items-center border-b border-border bg-lps-headrow text-[11px] font-bold uppercase tracking-[.05em] text-muted-foreground"
            style={{ gridTemplateColumns: gridOf(!!onSelect, !!onDeleteItem) }}
          >
            {/* Deliberately unlabelled: the column selects lines, and a
                header control here would only mean "all of them". */}
            {onSelect && <div />}
            <div className="px-2 py-1.5 text-right">Demand</div>
            <div className="px-2 py-1.5 text-right">Avail</div>
            <div className="px-2 py-1.5">Size</div>
            <div className="px-2 py-1.5">Plant Name</div>
            <div className="px-2 py-1.5">Status</div>
            <div className="px-2 py-1.5 text-right">Unit price</div>
            <div className="px-2 py-1.5 text-right">Total</div>
            <div className="px-2 py-1.5">Shared note</div>
            <div className="px-2 py-1.5">Sourcing note</div>
            {/* Unlabelled for the same reason the select column is: the header
                cell of a per-row action could only mean "all of them". */}
            {onDeleteItem && <div />}
          </div>
          {request.items.length ? (
            request.items.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                selected={selected?.has(item.id) ?? false}
                onSelect={onSelect && (() => onSelect([item.id], !selected?.has(item.id)))}
                onDelete={onDeleteItem && (() => onDeleteItem(item))}
                onSaved={onSaved}
                touchTarget={touchTargets}
              />
            ))
          ) : (
            <div className="px-4 py-6 text-center text-[12.5px] text-muted-foreground">
              {emptyItemsCopy}
            </div>
          )}
        </div>
      </div>

      {compactJobDetails && (
        <CompactJobDetails
          request={request}
          edit={edit}
          open={detailsOpen}
          onToggle={onToggleDetails}
          lastUpdated={lastUpdated}
        />
      )}

      <ChangeHistory requestId={request.id} version={version} touchTarget={touchTargets} />
      </>}
    </>
  )
}
