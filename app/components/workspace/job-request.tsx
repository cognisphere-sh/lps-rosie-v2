'use client'

// The pieces of a job request's expanded card, shared by the pages that show
// one. They were the Job Requests page's until a customer's card needed the
// same order details, line table and history under each of their requests —
// nothing here knows which page it is drawn on.

import { useEffect, useLayoutEffect, useState } from 'react'
import { MessagesSquare } from 'lucide-react'

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
  isSubmittedARStatus,
} from '@/lib/availability'
import { openAvailabilityRequest, openChat } from '@/lib/chat-bus'
import { customerThreadId } from '@/lib/customers'
import { money, num } from '@/lib/format'
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
}: EditProps & {
  value: string
  label: string
  tone: Tone
  options: { value: string; label: string }[]
}) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const pop = useOutsideClose<HTMLSpanElement>(open, () => setOpen(false))
  const [at, setAt] = useState<{ left: number; top?: number; bottom?: number } | null>(null)

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
    const left = Math.min(box.left, window.innerWidth - MENU_WIDTH - 8)
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
    <span ref={pop} data-pop className="inline-block">
      <button
        type="button"
        title="Click to update status"
        disabled={busy}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        className={cn('cursor-pointer border-none bg-transparent p-0', busy && 'opacity-50')}
      >
        <span
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold"
          style={toneStyle(tone)}
        >
          <span className="size-[7px] flex-none rounded-full" style={{ background: toneDot(tone) }} />
          {label}
          <ChevronDown size={10} />
        </span>
      </button>
      {open && at && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{ left: at.left, top: at.top, bottom: at.bottom, width: MENU_WIDTH }}
          className="lps-pop fixed z-[75] rounded-xl border border-border bg-popover p-1.5 shadow-[var(--lps-shadow)]"
        >
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
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
}: {
  lineTotal: number
  itemCount: number
  counts: Record<string, number>
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-lps-hair bg-secondary/45">
      <div className="grid min-w-[630px] grid-cols-[repeat(4,minmax(92px,1fr))_minmax(92px,1fr)_minmax(118px,1.15fr)] divide-x divide-lps-hair">
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
              <span className="whitespace-nowrap text-[10.5px] text-muted-foreground">{o.label}</span>
            </div>
          )
        })}
        <div className="flex items-center justify-center gap-1.5 px-2 py-2">
          <span className="text-[12px] font-bold tabular-nums text-foreground">{itemCount}</span>
          <span className="whitespace-nowrap text-[10.5px] text-muted-foreground">
            Total {itemCount === 1 ? 'item' : 'items'}
          </span>
        </div>
        <div className="flex items-center justify-center gap-1.5 px-2 py-2">
          <span className="text-[10.5px] text-muted-foreground">Subtotal</span>
          <span className="whitespace-nowrap text-[12.5px] font-bold tabular-nums text-foreground">
            {money(lineTotal) || '$0.00'}
          </span>
        </div>
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

/**
 * One note column: a line of it inline, the whole thing in a popover.
 *
 * Both columns are free text edited whole. `kind` still decides what the
 * popover says and which column it writes, because the audiences are not the
 * same: `shared` is written to be shown to the customer, `internal` is our own
 * working sheet — a line per supplier — and never leaves the building.
 */
function NoteCell({
  kind,
  table,
  id,
  title,
  value,
  onSaved,
}: {
  kind: 'shared' | 'internal'
  table: string
  id: number
  /** What the popover is about — "Bloodgood Maple · 15 gal". */
  title: string
  /** Raw column text — both audiences are one editable field. */
  value: string | null
  onSaved: () => void
}) {
  const [open, setOpen] = useState(false)
  const pop = useOutsideClose(open, () => setOpen(false))

  const meta = NOTE_KIND[kind]
  // Both audiences are one free-text field now, so the cell previews the field
  // itself. A sourcing note is written a line per supplier, and the last line
  // is the latest thing we heard — so that is the line the cell shows.
  const lines = (value ?? '').split('\n').map((l) => l.trim()).filter(Boolean)
  const summary = kind === 'shared' ? value?.trim() ?? '' : (lines[lines.length - 1] ?? '')

  return (
    <div ref={pop} data-pop className="relative min-w-0 px-1.5">
      <button
        type="button"
        title={summary || `Add a ${meta.label.toLowerCase()} note`}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        className="flex w-full min-w-0 cursor-pointer flex-col items-start gap-px rounded-md border border-transparent bg-transparent px-1 py-0.5 text-left hover:border-border hover:bg-lps-tint"
      >
        {summary ? (
          <>
            <span className="w-full truncate text-[12px] text-foreground">
              {summary.replace(/\s+/g, ' ')}
            </span>
            {kind === 'internal' && lines.length > 1 && (
              <span className="w-full truncate text-[10.5px] text-muted-foreground">
                {lines.length} lines
              </span>
            )}
          </>
        ) : (
          <span className="text-[12px] text-lps-dim">—</span>
        )}
      </button>
      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="lps-pop absolute right-2 top-[calc(100%+8px)] z-[70] flex max-h-[360px] w-[340px] flex-col gap-2 overflow-auto rounded-2xl border border-border bg-popover p-3 shadow-[var(--lps-shadow)]"
        >
          <div className="flex items-baseline gap-2">
            <span className="text-[12.5px] font-bold text-foreground">{meta.label} note</span>
            <span className="min-w-0 truncate text-[11px] text-muted-foreground">{title}</span>
          </div>
          {kind === 'shared' ? (
            <>
              <span className="text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground">
                The customer sees this
              </span>
              <EditableTextarea
                table={table}
                id={id}
                column="external_notes"
                value={value}
                onSaved={onSaved}
                placeholder="Add a note to share with the customer…"
              />
            </>
          ) : (
            <>
              <EditableTextarea
                table={table}
                id={id}
                column="sourcing_notes"
                value={value}
                onSaved={onSaved}
                placeholder="Add a sourcing note…"
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
}: {
  item: JobRequestItem
  selected: boolean
  /** Omitted where the page has nothing to do with a selection. */
  onSelect?: () => void
  /** Omitted where lines are read, not managed — the customer's own page. */
  onDelete?: () => void
  onSaved: () => void
}) {
  const pill = itemPill(item.status, item.quantity, item.availableQuantity)
  const cover = coverOf(item.quantity, item.availableQuantity)
  const edit = { table: 'job_request_items', id: item.id, onSaved }
  const title = [item.name, item.size].filter(Boolean).join(' · ')

  // A selected row reads as selected; otherwise the status tints it. The
  // needs-input amber used to sit between the two, but every line that is not
  // `available` is waiting on somebody by definition, so it painted almost the
  // whole table one colour and hid the statuses underneath it.
  const background = selected ? 'var(--lps-tone-green-bg)' : toneTint(pill.tone)

  return (
    <div
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
      />
      <NoteCell
        kind="internal"
        table="job_request_items"
        id={item.id}
        title={title}
        value={item.sourcingNotes}
        onSaved={onSaved}
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
function SupplierPill({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex flex-none items-stretch overflow-hidden rounded-full border border-lps-edge bg-card text-[10.5px] font-semibold">
      <span className="flex items-center gap-1 px-2 py-0.5 text-foreground">
        <SuppliersIcon size={11} className="flex-none text-muted-foreground" />
        <span className="max-w-[11rem] truncate">{name}</span>
      </span>
      {children}
    </span>
  )
}

/** One thing a pill opens: an availability request, or a conversation. */
function LinkSegment({
  title,
  onOpen,
  className,
  children,
}: {
  title: string
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
 * suppliers are is what you open the card to find out.
 */
export function RequestLinks({
  request,
  suppliersHidden = false,
  className,
}: {
  request: JobRequestRow
  suppliersHidden?: boolean
  className?: string
}) {
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
    <div className={cn('flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[12px]', className)}>
      <span className="font-semibold text-foreground">
        {customerName ?? <span className="italic text-muted-foreground">Unassigned customer</span>}
      </span>
      {contact && <span className="text-muted-foreground">· {contact}</span>}
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
          className="flex flex-none cursor-pointer items-center gap-1 rounded-full border border-lps-edge bg-card px-2 py-0.5 text-[10.5px] font-semibold text-primary hover:bg-secondary"
        >
          <MessagesSquare size={11} /> Chat
        </button>
      )}
      {locality && (
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <MapPinIcon size={11} /> {locality}
        </span>
      )}
      {supplierPills.length > 0 && (
        <div
          className={cn(
            'flex w-full flex-wrap items-center gap-1 md:ml-auto md:w-auto md:justify-end',
            suppliersHidden && 'hidden md:flex',
          )}
        >
          {supplierPills.map((l) => (
            <SupplierPill key={l.supplierId} name={l.name}>
              {l.availabilityRequests.map((ar) => (
                <LinkSegment
                  key={ar.id}
                  title={availabilityRequestLinkLabel(ar.id, l.name, ar.status)}
                  onOpen={() => openAvailabilityRequest(ar.id)}
                  className={cn(
                    'gap-1',
                    isSubmittedARStatus(ar.status)
                      ? 'text-[var(--lps-tone-green-dot)]'
                      : 'text-primary',
                  )}
                >
                  AR-{ar.id}
                  {isSubmittedARStatus(ar.status) && (
                    <span
                      aria-hidden="true"
                      className="size-1.5 flex-none rounded-full bg-[var(--lps-tone-green-dot)]"
                    />
                  )}
                </LinkSegment>
              ))}
              {l.rosieThreadId && (
                <LinkSegment
                  title={`Open the supplier conversation with ${l.name}`}
                  onOpen={() =>
                    openChat({ agentId: 'rosie', threadId: l.rosieThreadId!, label: l.name })
                  }
                  className="text-muted-foreground hover:text-primary"
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
      primary: shipping || 'No shipping address recorded',
      secondary: 'Delivery schedule not recorded',
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
function ChangeHistory({ requestId, version }: { requestId: number; version: number }) {
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
        className="flex w-full cursor-pointer items-center gap-2 border-none bg-lps-tint px-3.5 py-2 text-left hover:bg-muted"
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
  const edit = { table: 'job_requests', id: request.id, onSaved }
  const ship = addressLine(request.shipping)
  const bill = addressLine(request.billing)

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
      <div className="flex flex-col gap-2 border-t border-border bg-lps-tint p-2.5 sm:p-3">
        <RequestOverview request={request} />
        <DemandSummary
          lineTotal={request.lineTotal}
          itemCount={request.itemCount}
          counts={request.statusCounts}
        />
      </div>

      {/* Addresses and audience-specific notes remain editable and complete,
          but sit behind one compact secondary-information drawer. */}
      <div className="border-t border-border">
        <button
          type="button"
          aria-expanded={detailsOpen}
          onClick={onToggleDetails}
          className="flex w-full cursor-pointer items-center gap-2 border-none bg-lps-tint px-3.5 py-2 text-left hover:bg-muted"
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
            <div className="grid gap-3 md:grid-cols-2">
              <AddressCard {...edit} label="Shipping address" prefix="shipping"
                address={request.shipping} />
              <AddressCard {...edit} label="Billing address" prefix="billing"
                address={request.billing} />
            </div>

            {/* The three audiences, in the order they are read: what they
                said, what we told them, what we know. Only the middle one
                is a field. */}
            <div className="grid gap-3 lg:grid-cols-3">
              <NoteBlock label="The customer's own words">
                <NoteThread entries={entriesOf(request.notes, 'customer')} empty="Nothing on file." />
              </NoteBlock>
              <NoteBlock label="Shared note — the customer sees this">
                <EditableTextarea
                  {...edit}
                  column="external_notes"
                  value={request.externalNotes}
                  placeholder="Add a note to share with the customer…"
                />
              </NoteBlock>
              <NoteBlock label="Sourcing note — job changes only">
                {/* The line-by-line sourcing detail lives on the lines. What
                    belongs here is what moved about the job itself. */}
                <EditableTextarea
                  {...edit}
                  column="sourcing_notes"
                  value={request.sourcingNotes}
                  placeholder="Add a sourcing note…"
                />
              </NoteBlock>
            </div>
          </div>
        )}
      </div>

      {/* The line table scrolls sideways rather than crushing its columns —
          the design fixes a min width for exactly this reason, and the two
          note columns are what would otherwise be squeezed out of existence. */}
      <div className="overflow-x-auto border-t border-border">
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
              />
            ))
          ) : (
            <div className="px-4 py-6 text-center text-[12.5px] text-muted-foreground">
              {emptyItemsCopy}
            </div>
          )}
        </div>
      </div>

      <ChangeHistory requestId={request.id} version={version} />
    </>
  )
}
