'use client'

// The pieces of a job request's expanded card, shared by the pages that show
// one. They were the Job Requests page's until a customer's card needed the
// same order details, line table and history under each of their requests —
// nothing here knows which page it is drawn on.

import { LineCard } from '@/components/workspace/line-card'
import { DemandSummary, toggleStatus } from '@/components/workspace/demand-summary'
import { useEffect, useId, useLayoutEffect, useRef, useState, type DragEvent, type KeyboardEvent, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react'
import { MessagesSquare } from 'lucide-react'

import { Markdown } from '@/components/workspace/chat-kit'
import {
  datePickerProps, EditableText, EditableTextarea, type EditProps, patchRow,
} from '@/components/workspace/editable'
import {
  CheckIcon, ChevronDown, ChevronRight, EyeIcon, EyeOffIcon, MapPinIcon, SuppliersIcon, TrashIcon,
} from '@/components/workspace/icons'
import { useToast } from '@/components/workspace/shell'
import { useOutsideClose } from '@/components/workspace/table-parts'
import {
  availabilityRecordName,
  availabilityRequestLinkLabel,
  arResponseLabel,
  arStatusLabel,
  arStatusTone,
  arResponseTone,
  hasOffer,
  isInProgressARStatus,
  isSubmittedARStatus,
} from '@/lib/availability'
import { availabilityRequestStatusChanged, openAvailabilityRequest, openChat } from '@/lib/chat-bus'
import { CustomerChatButton } from '@/components/workspace/customer-chat-button'
import { customerThreadId } from '@/lib/customers'
import { formatWeekdayMonthDay, money, num } from '@/lib/format'
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
import { AREditorBody, AREditorFooter, useAREditor, useARNarrow } from '@/components/workspace/ar-editor'
import { useTouchDrag } from '@/components/workspace/touch-drag'
import { type ColumnDef } from '@/lib/columns'
import { quoteLineTotal } from '@/lib/job-request-html-quote'
import { useTableConfig } from '@/lib/table-config'
import type { Candidate, JobAddress, JobChange, JobNote, JobRequestItem, JobRequestRow } from '@/lib/rows'
import { lineCardName } from '@/lib/line-card'
import { cn } from '@/lib/utils'

/**
 * The line-item grid, shared by the header and every row so they stay aligned.
 *
 * Select · Demand · Avail · Size · Plant Name · Status · Note for customer · Unit
 * price · Total · Internal note. The design draws two Notes columns; the two
 * audiences are split here because they are not one field — `note_for_customer` is
 * written for the customer and `note_internal` is our own working sheet, and
 * a single cell cannot honestly edit both.
 */
/** The select column only exists where something can act on a selection. */
const SELECT_COLUMN = 36
/** The trailing column holding a line's delete button, where lines can be deleted. */
const ACTION_COLUMN = 34
const gridOf = (
  selectable: boolean,
  deletable: boolean,
  columns: readonly ColumnDef[],
  widthOf: (column: ColumnDef) => number,
) =>
  [selectable ? `${SELECT_COLUMN}px` : null, ...columns.map((column) => column.key === 'note_internal'
    ? `minmax(${widthOf(column)}px, 1fr)`
    : `${widthOf(column)}px`), deletable ? `${ACTION_COLUMN}px` : null]
    .filter(Boolean)
    .join(' ')

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
      : cell.querySelector<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), [tabindex="0"]')
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
  // Optimistic: the picked status shows while saving and until the parent's
  // refetch hands back a new `value`; a failure reverts.
  const [pending, setPending] = useState<string | null>(null)
  useEffect(() => setPending(null), [value])
  const pop = useOutsideClose<HTMLSpanElement>(open, () => setOpen(false))
  const trigger = useRef<HTMLButtonElement>(null)
  const [at, setAt] = useState<{ left: number; top?: number; bottom?: number } | null>(null)
  const menuId = `status-menu-${table}-${id}-${column}`

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
    if (next === (pending ?? value)) return
    setBusy(true)
    setPending(next)
    try {
      await patchRow(table, id, column, next)
      onSaved()
    } catch (e) {
      setPending(null)
      toast((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const toneOf = (v: string) =>
    table === 'job_requests' ? requestStatusTone(v) : itemPill(v, null, null).tone
  const pendingLabel = pending == null ? null : options.find((o) => o.value === pending)?.label ?? pending
  const shownLabel = pendingLabel ?? label
  const shownTone = pending == null ? tone : toneOf(pending)
  const fullLabel = pendingLabel ?? accessibleLabel ?? label

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
        )}
      >
        {compactLabel ? (
          <span
            data-compact-status-token
            aria-hidden="true"
            className="inline-flex max-w-full items-center justify-center whitespace-nowrap rounded-md px-1 text-[10.5px] font-bold leading-none"
            style={toneStyle(shownTone)}
          >
            {compactLabel}
          </span>
        ) : (
          <span
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold"
            style={toneStyle(shownTone)}
          >
            <span className="size-[7px] flex-none rounded-full" style={{ background: toneDot(shownTone) }} />
            {shownLabel}
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
              aria-checked={o.value === (pending ?? value)}
              onClick={() => void pick(o.value)}
              className={cn(
                'flex w-full cursor-pointer items-center gap-2 rounded-lg border-none bg-transparent px-2 py-1.5 text-left text-[12.5px] hover:bg-muted',
                o.value === (pending ?? value) ? 'font-semibold text-foreground' : 'font-normal text-muted-foreground',
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

export const NOTE_KIND: Record<JobNote['kind'], { label: string; tone: Tone }> = {
  customer: { label: 'Customer', tone: 'amber' },
  shared: { label: 'For customer', tone: 'green' },
  internal: { label: 'Internal', tone: 'grey' },
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

function renderInternalNote(text: string) {
  return <Markdown text={text} onAction={(scheme, target) => {
    if (scheme === 'ar') openAvailabilityRequest(Number.parseInt(target, 10))
    else openChat({ agentId: 'rosie', threadId: target })
  }} />
}

/** Notes stay in their table cells, including the full internal Markdown preview. */
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
  title: string
  value: string | null
  onSaved: () => void
  touchTarget: boolean
}) {
  const internal = kind === 'internal'
  return (
    <div className="min-w-0 px-0.5">
      <EditableTextarea
        center
        table={table}
        id={id}
        column={internal ? 'note_internal' : 'note_for_customer'}
        value={value}
        onSaved={onSaved}
        touchTarget={touchTarget}
        placeholder={''}
        editLabel={`Edit ${internal ? 'internal' : 'shared'} note for ${title}`}
        renderPreview={internal ? renderInternalNote : undefined}
        previewClickToEdit={internal}
        inlineControls
        compact={!internal}
      />
    </div>
  )
}

/** Drag payload type for a job line's candidate pill: JSON `{ id, itemId, supplierId }`. */
const CANDIDATE_DRAG = 'application/x-lps-candidate'
/** A second type naming the supplier, readable during dragover (data is not). */
const supplierDragType = (supplierId: number) => `application/x-lps-supplier-${supplierId}`

type CandidateDragPayload = { id: number; itemId: number; supplierId: number }

const draggedCandidate = (e: DragEvent): CandidateDragPayload | null => {
  try {
    const value = JSON.parse(e.dataTransfer.getData(CANDIDATE_DRAG)) as CandidateDragPayload
    return Number.isInteger(value?.id) ? value : null
  } catch { return null }
}
const carriesCandidate = (e: DragEvent, supplierId?: number) => e.dataTransfer.types.includes(CANDIDATE_DRAG)
  && (supplierId == null || e.dataTransfer.types.includes(supplierDragType(supplierId)))

/** What the candidate is: its description, else size and name. */
const candidateDescription = (candidate: Candidate) =>
  candidate.description?.trim() || [candidate.size, candidate.name].filter(Boolean).join(' ')

/** Not yet in front of the supplier: on no AR, or only on an unsent draft. */
const candidatePending = (candidate: Candidate) => candidate.arId == null || candidate.arStatus === 'draft'

/** In front of the supplier and not submitted yet: their answer can still change. */
const candidateAwaiting = (candidate: Candidate) => candidate.arStatus === 'new' || candidate.arStatus === 'processing'

/**
 * An answer saved under 0121 as Diff Sz/Sub with a substitute reads
 * Unavailable, as 0123 stores it: the substitute is the one on offer.
 */
const shownAnswer = (candidate: Candidate) =>
  candidate.status === 'diff_size_qty_sub' && hasOffer(candidate) ? 'unavailable' : candidate.status

/**
 * No price = unanswered with no price found; Pending = priced but not sent
 * yet; AR sent = asked and unanswered; else the supplier's answer.
 */
const candidateStatus = (candidate: Candidate) =>
  candidate.status == null && !candidate.unitPrice ? 'No price'
    : candidatePending(candidate) ? 'Pending'
      : candidate.status == null ? 'AR sent' : arResponseLabel(shownAnswer(candidate))

/** Grey until the supplier answers, then the answer's tone. */
const candidateTone = (candidate: Candidate): Tone => arResponseTone(shownAnswer(candidate))

/** Everything the pill leaves out, for its hover card. */
function candidateDetails(candidate: Candidate, siblings: Candidate[] = []) {
  const price = candidate.unitPrice ? money(candidate.unitPrice) : 'No price'
  const offered = candidate.offeredCandidateId != null ? siblings.find((c) => c.id === candidate.offeredCandidateId) : undefined
  return [
    candidateDescription(candidate),
    `${candidate.supplierName} · ${[candidate.size, candidate.name].filter(Boolean).join(' ')}`,
    `Price: ${price}`,
    `Status: ${candidateStatus(candidate)}${candidate.arId != null ? ` (AR-${candidate.arId})` : ''}`,
    candidate.noteForCustomer?.trim() && `Note for customer: ${candidate.noteForCustomer.trim()}`,
    candidate.noteFromSupplier?.trim() && `Supplier reply: ${candidate.noteFromSupplier.trim()}`,
    candidate.noteForSupplier?.trim() && `Our ask: ${candidate.noteForSupplier.trim()}`,
    offered && `Substitute offered: ${candidateDescription(offered)}`,
    !offered && candidate.offerDescription?.trim() && `Substitute offered: ${candidate.offerDescription.trim()} (not a candidate yet)`,
    candidate.isOriginal && 'Original request',
    candidate.hidden && 'Hidden from the line table',
  ].filter(Boolean).join('\n')
}

/**
 * One candidate as a draggable pill: description and price, with a dot on the
 * original request. Its colour is the supplier's answer (`candidateTone`); its
 * border is dotted while the AR is out with the supplier and solid otherwise
 * (not sent yet, or submitted). Hover shows the rest — supplier, notes, AR.
 */
function CandidatePill({
  candidate,
  itemId,
  busy,
  onDragState,
  siblings,
}: {
  candidate: Candidate
  itemId: number
  busy: boolean
  onDragState: (id: number | null) => void
  /** The line's other candidates, to name an offered substitute on hover. */
  siblings?: Candidate[]
}) {
  const tone = candidateTone(candidate)
  const awaiting = candidateAwaiting(candidate)
  const details = candidateDetails(candidate, siblings)
  const pill = useRef<HTMLSpanElement>(null)
  // A drop that moves the pill (to Selected and back, or out of view when
  // hidden) unmounts it first, and its dragend then never reaches React — so
  // a pill that leaves mid-drag ends the drag itself.
  const dragged = useRef(false)
  const dragState = (id: number | null) => { dragged.current = id != null; onDragState(id) }
  useEffect(() => () => { if (dragged.current) onDragState(null) }, [])
  // Phones: press and hold, then drag — the same payload, to the same drop zones.
  useTouchDrag(pill, {
    start: (dataTransfer) => {
      dataTransfer.setData(CANDIDATE_DRAG, JSON.stringify({ id: candidate.id, itemId, supplierId: candidate.supplierId }))
      dataTransfer.setData(supplierDragType(candidate.supplierId), '')
      dragState(candidate.id)
    },
    end: () => dragState(null),
  })
  return (
    <span
      ref={pill}
      draggable
      tabIndex={0}
      role="listitem"
      aria-label={`Candidate: ${details.replace(/\n/g, ' · ')}`}
      title={`${details}\n\nDrag (on a phone, press and hold first) to Selected, onto its supplier's AR link to ask it on their AR, to ${candidate.hidden ? 'Unhide' : 'Hide'}, or to the bin.`}
      data-candidate={candidate.id}
      onDragStart={(e) => {
        e.dataTransfer.setData(CANDIDATE_DRAG, JSON.stringify({ id: candidate.id, itemId, supplierId: candidate.supplierId }))
        e.dataTransfer.setData(supplierDragType(candidate.supplierId), '')
        e.dataTransfer.effectAllowed = 'move'
        dragState(candidate.id)
      }}
      onDragEnd={() => dragState(null)}
      className={cn(
        'inline-flex min-h-7 min-w-0 max-w-full cursor-grab select-none flex-wrap items-stretch overflow-hidden rounded-xl border text-left text-[11px] outline-none [-webkit-touch-callout:none] focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing',
        awaiting ? 'border-2 border-dotted' : 'border-lps-edge',
        busy && 'animate-pulse',
        candidate.hidden && 'opacity-60',
      )}
      style={{ ...toneStyle(tone), ...(awaiting && { borderColor: toneDot(tone) }) }}
    >
      <span className="flex min-w-0 items-center gap-1 px-2 py-0.5 font-semibold">
        {candidate.hidden && <EyeOffIcon size={10} className="flex-none" />}
        {candidate.isOriginal && <span data-original-dot className="size-1.5 flex-none rounded-full" style={{ background: toneDot(tone) }} />}
        <span className="[overflow-wrap:anywhere]">{candidateDescription(candidate) || '—'}</span>
      </span>
      <span className="flex flex-none items-center border-l border-current/20 px-1.5 font-semibold tabular-nums">
        {candidate.unitPrice ? money(candidate.unitPrice) : 'No price'}
      </span>
    </span>
  )
}

/** A drop zone for candidate pills; highlighted while a pill hovers over it. */
function CandidateDrop({
  accepts,
  onDrop,
  label,
  className,
  children,
}: {
  accepts: (payload: CandidateDragPayload) => boolean
  onDrop: (payload: CandidateDragPayload) => void
  label: string
  className?: string
  children: ReactNode
}) {
  const [over, setOver] = useState(false)
  return (
    <div
      aria-label={label}
      onDragOver={(e) => {
        if (!carriesCandidate(e)) return
        e.preventDefault()
        // Nested zones (the bin inside Candidates): the innermost one takes the drop.
        e.stopPropagation()
        e.dataTransfer.dropEffect = 'move'
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        setOver(false)
        const payload = draggedCandidate(e)
        if (payload == null || !accepts(payload)) return
        e.preventDefault()
        e.stopPropagation()
        onDrop(payload)
      }}
      className={cn(className, over && 'ring-2 ring-primary')}
    >
      {children}
    </div>
  )
}

/**
 * Posts one candidate action and refreshes; shared by the Selected and
 * Candidates cells. Optimistic: `item` is the line with the action already
 * applied, until the refetch hands back a new line or the write fails.
 */
function useCandidateActions(requestId: number, line: JobRequestItem, onSaved: () => void) {
  const toast = useToast()
  const [busy, setBusy] = useState<number | null>(null)
  const [pending, setPending] = useState<Partial<JobRequestItem> | null>(null)
  useEffect(() => setPending(null), [line])
  const item = pending ? { ...line, ...pending } : line
  const run = async (itemId: number, candidateId: number, init: RequestInit, optimistic: Partial<JobRequestItem>) => {
    if (busy != null) return
    setBusy(candidateId)
    setPending(optimistic)
    try {
      const res = await fetch(`/api/requests/${requestId}/items/${itemId}/candidates/${candidateId}`, init)
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(body.error ?? 'Could not update the candidate')
      onSaved()
    } catch (e) {
      setPending(null)
      toast((e as Error).message)
    } finally {
      setBusy(null)
    }
  }
  const post = (body: object) => ({
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  })
  return {
    busy,
    item,
    select: (itemId: number, id: number) => run(itemId, id, post({ action: 'select' }), { selectedCandidateId: id }),
    unselect: (itemId: number, id: number) => run(itemId, id, post({ action: 'unselect' }), { selectedCandidateId: null }),
    hide: (itemId: number, id: number, hidden: boolean) => run(itemId, id, post({ action: hidden ? 'hide' : 'unhide' }), {
      candidates: (item.candidates ?? []).map((c) => (c.id === id ? { ...c, hidden } : c)),
    }),
    remove: (itemId: number, id: number) => run(itemId, id, { method: 'DELETE' }, {
      candidates: (item.candidates ?? []).filter((c) => c.id !== id),
      ...(item.selectedCandidateId === id ? { selectedCandidateId: null } : {}),
    }),
  }
}

type CandidateActions = ReturnType<typeof useCandidateActions>

/** The Selected cell: drop a candidate here to copy it onto the line, replacing the current one. */
function SelectedCandidateCell({
  item,
  actions,
  onDragState,
}: {
  item: JobRequestItem
  actions: CandidateActions
  onDragState: (id: number | null) => void
}) {
  const candidates = item.candidates ?? []
  const selected = candidates.find((candidate) => candidate.id === item.selectedCandidateId)
  return (
    <CandidateDrop
      label={`Selected candidate for ${item.name}`}
      accepts={(payload) => payload.itemId === item.id}
      onDrop={(payload) => { if (payload.id !== item.selectedCandidateId) void actions.select(item.id, payload.id) }}
      className="mx-1 flex min-h-8 min-w-0 items-center justify-center rounded-xl"
    >
      {selected
        ? <CandidatePill candidate={selected} itemId={item.id} busy={actions.busy === selected.id} onDragState={onDragState} siblings={candidates} />
        : <span tabIndex={0} className="w-full rounded-xl border border-dashed border-lps-edge px-2 py-1 text-center text-[10.5px] text-lps-dim">Drop a candidate</span>}
    </CandidateDrop>
  )
}

/**
 * The Candidates cell: a pill per candidate, grouped by supplier (names are on
 * hover only). The selected one lives in the Selected cell instead; dropping
 * it back here leaves the line with no selection. Hidden ones (`hide_from_lps`)
 * are left out unless `showHidden`. While one of this line's pills is dragged,
 * a Hide (Unhide, for a hidden one) zone and a bin appear.
 */
function CandidatesCell({
  item,
  actions,
  dragging,
  onDragState,
  showHidden,
}: {
  item: JobRequestItem
  actions: CandidateActions
  dragging: number | null
  onDragState: (id: number | null) => void
  showHidden: boolean
}) {
  const candidates = item.candidates ?? []
  const shown = candidates.filter((c) => c.id !== item.selectedCandidateId && (showHidden || !c.hidden))
    .sort((a, b) => a.supplierId - b.supplierId || a.id - b.id)
  const dragged = dragging == null ? undefined : candidates.find((candidate) => candidate.id === dragging)

  if (!shown.length && dragging == null) {
    return <div tabIndex={0} className="px-1.5 text-center text-[11px] text-lps-dim">{candidates.length ? 'No other candidates' : 'No candidates'}</div>
  }

  const body = (
    <>
      <div role="list" aria-label={`Candidates for ${item.name}`} className="flex min-w-0 flex-wrap justify-center gap-1">
        {shown.map((candidate) => (
          <CandidatePill
            key={candidate.id}
            candidate={candidate}
            itemId={item.id}
            busy={actions.busy === candidate.id}
            onDragState={onDragState}
            siblings={candidates}
          />
        ))}
      </div>
      {dragged && (
        <div className="flex items-center gap-1 self-end">
          <CandidateDrop
            label={`${dragged.hidden ? 'Unhide' : 'Hide'} candidate on ${item.name}`}
            accepts={(payload) => payload.itemId === item.id}
            onDrop={(payload) => void actions.hide(item.id, payload.id, !dragged.hidden)}
            className="flex items-center gap-1 rounded-lg border border-dashed border-lps-edge px-2 py-0.5 text-[10.5px] font-semibold text-muted-foreground"
          >
            {dragged.hidden ? <EyeIcon size={12} /> : <EyeOffIcon size={12} />} {dragged.hidden ? 'Unhide' : 'Hide'}
          </CandidateDrop>
          <CandidateDrop
            label={`Delete candidate from ${item.name}`}
            accepts={(payload) => payload.itemId === item.id}
            // The binned pill unmounts at once (optimistic), so no dragend follows it.
            onDrop={(payload) => { onDragState(null); void actions.remove(item.id, payload.id) }}
            className="flex items-center gap-1 rounded-lg border border-dashed border-destructive/60 px-2 py-0.5 text-[10.5px] font-semibold text-destructive"
          >
            <TrashIcon size={12} /> Bin
          </CandidateDrop>
        </div>
      )}
    </>
  )
  const className = 'flex min-w-0 flex-col gap-1.5 px-1.5 py-1'
  return dragging != null && dragging === item.selectedCandidateId
    ? (
      <CandidateDrop
        label={`Unselect candidate for ${item.name}`}
        accepts={(payload) => payload.itemId === item.id && payload.id === item.selectedCandidateId}
        onDrop={(payload) => void actions.unselect(item.id, payload.id)}
        className={cn(className, 'min-h-8 rounded-xl')}
      >
        {body}
      </CandidateDrop>
    )
    : <div className={className}>{body}</div>
}

function ItemRow({
  requestId,
  item,
  columns,
  widthOf,
  selected,
  onSelect,
  onDelete,
  onSaved,
  touchTarget,
  card = false,
  showHidden = false,
}: {
  requestId: number
  item: JobRequestItem
  columns: readonly ColumnDef[]
  widthOf: (column: ColumnDef) => number
  selected: boolean
  /** Omitted where the page has nothing to do with a selection. */
  onSelect?: () => void
  /** Omitted where lines are read, not managed — the customer's own page. */
  onDelete?: () => void
  onSaved: () => void
  touchTarget: boolean
  /** Phones: the same cells as a labelled card instead of a sideways-scrolling row. */
  card?: boolean
  /** List candidates hidden from LPS (`hide_from_lps`) too. */
  showHidden?: boolean
}) {
  const pill = itemPill(item.status, item.quantity, item.availableQuantity)
  const cover = coverOf(item.quantity, item.availableQuantity)
  const candidateActions = useCandidateActions(requestId, item, onSaved)
  const [dragging, setDragging] = useState<number | null>(null)
  const [more, setMore] = useState(false)
  const edit = { table: 'job_request_items', id: item.id, onSaved, touchTarget }
  const title = [item.name, item.size].filter(Boolean).join(' · ')

  // A selected row reads as selected; otherwise the status tints it. The
  // needs-input amber used to sit between the two, but every line that is not
  // `available` is waiting on somebody by definition, so it painted almost the
  // whole table one colour and hid the statuses underneath it.
  const background = selected ? 'var(--lps-tone-green-bg)' : toneTint(pill.tone)
  const lineCell = (key: string) => {
    switch (key) {
      case 'quantity': return <div key={key} className="px-0.5"><EditableText {...edit} column="demanded_quantity" value={item.quantity} numeric align="center" render={(v) => num(v)} title="Demand — what the customer asked for" /></div>
      // Colour lives on the wrapper so blank availability remains distinct from zero.
      case 'available_quantity': return <div key={key} className="px-0.5" style={{ color: coverColor(cover) }}><EditableText {...edit} column="available_quantity" value={item.availableQuantity} numeric align="center" render={(v) => num(v)} title="Avail — how many we can supply. Blank means not answered yet." /></div>
      case 'size': return <div key={key} className="px-0.5"><EditableText {...edit} column="size" value={item.size} align="center" /></div>
      case 'name': return <div key={key} className="flex min-w-0 flex-col gap-px px-0.5"><span className="flex min-w-0 items-center gap-1.5"><EditableText {...edit} column="name" value={item.name} /></span></div>
      case 'selected': return <SelectedCandidateCell key={key} item={candidateActions.item} actions={candidateActions} onDragState={setDragging} />
      case 'candidates': return <CandidatesCell key={key} item={candidateActions.item} actions={candidateActions} dragging={dragging} onDragState={setDragging} showHidden={showHidden} />
      case 'status': return <div key={key} className="flex justify-center px-0.5"><StatusPill {...edit} column="status" value={item.status} label={pill.label} tone={pill.tone} options={ITEM_STATUS_OPTIONS} /></div>
      case 'note_for_customer': return <NoteCell key={key} kind="shared" table="job_request_items" id={item.id} title={title} value={item.noteForCustomer} onSaved={onSaved} touchTarget={touchTarget} />
      case 'unit_price': return <div key={key} className="px-0.5"><EditableText {...edit} column="unit_price" value={item.unitPrice} numeric align="center" render={(v) => money(v)} /></div>
      case 'total': return <div key={key} className="px-1 text-center text-[12.5px] font-semibold tabular-nums text-foreground" tabIndex={0} title="Total — zero when unavailable; otherwise available quantity × unit price, falling back to demand">{money(quoteLineTotal(item)) || '—'}</div>
      case 'note_internal': return <NoteCell key={key} kind="internal" table="job_request_items" id={item.id} title={title} value={item.noteInternal} onSaved={onSaved} touchTarget={touchTarget} />
      default: return null
    }
  }

  if (card) {
    const block = (key: string, label: string, boxed = true) => (
      <div data-line-card-section={key} className="flex min-w-0 flex-col gap-1">
        <span className="text-[10px] font-bold uppercase tracking-[.05em] text-muted-foreground">{label}</span>
        <div className={cn('min-w-0', boxed && 'min-h-11 rounded-lg border border-lps-hair bg-card')}>{lineCell(key)}</div>
      </div>
    )
    const cardText = cn(lineCardName, 'text-[15px] leading-6')
    return (
      <LineCard
        data-line-row
        data-line-card
        accent={toneDot(pill.tone)}
        background={background}
        leading={onSelect && <Check state={selected} onChange={onSelect} label={`Select ${item.name}`} />}
        qty={<EditableText {...edit} column="demanded_quantity" value={item.quantity} numeric align="center" render={(v) => num(v)} title="Demand — what the customer asked for" className={cn(cardText, 'whitespace-nowrap')} />}
        size={<EditableText {...edit} column="size" value={item.size} align="center" className={cardText} />}
        name={<EditableText {...edit} column="name" value={item.name} wrap className={cardText} />}
        trailing={onDelete && (
          <button type="button" onClick={onDelete} title={`Delete ${title || 'this line'} permanently`} aria-label={`Delete ${title || 'this line'}`}
            className="inline-flex size-9 flex-none cursor-pointer items-center justify-center rounded-lg border-none bg-transparent text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
            <TrashIcon size={15} />
          </button>
        )}
        cells={[['status', 'Status'], ['available_quantity', 'Avail'], ['unit_price', 'Price'], ['total', 'Total']]
          .map(([key, label]) => ({ key, label, node: lineCell(key) }))}
      >
        {/* Notes and candidates fold behind one toggle, so a phone scrolls
            through lines rather than notes. */}
        <button type="button" aria-expanded={more} onClick={() => setMore((open) => !open)}
          className="flex min-h-6 w-full cursor-pointer items-center justify-start gap-1 rounded-md px-1 border-none bg-transparent text-[11px] font-bold uppercase tracking-[.05em] text-muted-foreground hover:bg-card/70">
          {more ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          {more ? 'Less' : 'More'}
        </button>
        {more && (
          <div data-line-card-more className="flex flex-col gap-2">
            {block('note_for_customer', 'Note for customer')}
            {!!item.candidates?.length && block('selected', 'Selected', false)}
            {item.candidates?.some((c) => c.id !== item.selectedCandidateId && (showHidden || !c.hidden)) && block('candidates', 'Candidates', false)}
            {block('note_internal', 'Internal note')}
          </div>
        )}
      </LineCard>
    )
  }

  return (
    <div
      data-line-row
      className="grid items-center border-b border-lps-hair last:border-b-0"
      style={{
        gridTemplateColumns: gridOf(!!onSelect, !!onDelete, columns, widthOf),
        minHeight: '48px',
        borderLeft: `3px solid ${toneDot(pill.tone)}`,
        background,
      }}
    >
      {onSelect && (
        <div className="flex items-center justify-center self-stretch">
          <Check state={selected} onChange={onSelect} label={`Select ${item.name}`} />
        </div>
      )}
      {columns.map((column) => lineCell(column.key))}

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

/** A compact version of the inventory-table header: drag its label to move it,
 * and drag its trailing edge to resize it. */
function LineColumnHeader({
  column,
  width,
  onMove,
  onResize,
  action,
}: {
  column: ColumnDef
  width: number
  onMove: (from: string, to: string) => void
  onResize: (width: number) => void
  /** A control beside the label. */
  action?: ReactNode
}) {
  const startResize = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    const startX = event.clientX
    const startWidth = width
    const move = (next: MouseEvent) => onResize(startWidth + next.clientX - startX)
    const stop = () => {
      document.removeEventListener('mousemove', move)
      document.removeEventListener('mouseup', stop)
    }
    document.addEventListener('mousemove', move)
    document.addEventListener('mouseup', stop)
  }

  return (
    <div
      className="relative min-w-0 px-1 py-1.5"
      onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move' }}
      onDrop={(event) => {
        event.preventDefault()
        const from = event.dataTransfer.getData('text/plain')
        if (from && from !== column.key) onMove(from, column.key)
      }}
    >
      <span className="flex min-w-0 items-center justify-center gap-1">
        <span
          draggable
          onDragStart={(event) => {
            event.dataTransfer.setData('text/plain', column.key)
            event.dataTransfer.effectAllowed = 'move'
          }}
          title={`${column.label} — drag to reorder`}
          className={cn('block min-w-0 flex-1 cursor-grab truncate active:cursor-grabbing', column.key === 'name' ? 'text-left' : 'text-center')}
        >
          {column.label}
        </span>
        {action}
      </span>
      <div
        role="separator"
        aria-label={`Resize ${column.label}`}
        aria-orientation="vertical"
        title={`Drag to resize ${column.label}`}
        onMouseDown={startResize}
        className="group absolute -right-1.5 top-0 z-10 flex h-full w-3 cursor-col-resize select-none justify-center"
      >
        {/* Always-visible divider; it thickens on hover so the handle is findable. */}
        <span className="h-full w-px bg-lps-edge group-hover:w-0.5 group-hover:bg-primary" />
      </div>
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
  supplierId,
  onDropCandidate,
}: {
  name: string
  children: ReactNode
  focusedMobile?: boolean
  /** With `onDropCandidate`: this supplier's candidate pills can be dropped here. */
  supplierId?: number
  onDropCandidate?: (payload: CandidateDragPayload) => void
}) {
  const [over, setOver] = useState(false)
  const droppable = supplierId != null && onDropCandidate != null
  return (
    <span
      data-focused-mobile-supplier-pill={focusedMobile ? '' : undefined}
      data-supplier-pill={supplierId}
      onDragOver={droppable ? (e) => {
        if (!carriesCandidate(e, supplierId)) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        setOver(true)
      } : undefined}
      onDragLeave={droppable ? () => setOver(false) : undefined}
      onDrop={droppable ? (e) => {
        setOver(false)
        const payload = draggedCandidate(e)
        if (payload?.supplierId !== supplierId) return
        e.preventDefault()
        onDropCandidate(payload)
      } : undefined}
      className={cn(focusedMobile
        ? 'flex w-full min-w-0 max-w-full flex-wrap items-stretch overflow-visible rounded-xl border border-lps-edge bg-card text-[10.5px] font-semibold'
        : 'inline-flex min-w-0 max-w-full flex-none flex-wrap items-stretch overflow-hidden rounded-xl border border-lps-edge bg-card text-[10.5px] font-semibold',
        over && 'ring-2 ring-primary')}
    >
      <span className={focusedMobile
        ? 'flex min-w-0 max-w-full basis-full items-start gap-1 border-b border-lps-hair px-2 py-1 text-foreground'
        : 'flex min-h-8 items-center gap-1 px-2 py-0.5 text-foreground'}>
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
  children: ReactNode
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
 * with their availability requests and conversation. The internal notes used
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
  hideCustomerChat = false,
  className,
}: {
  request: JobRequestRow
  suppliersHidden?: boolean
  focusedMobile?: boolean
  /** Route actions only, for the compact desktop details tray. */
  relatedOnly?: boolean
  hideCustomerChat?: boolean
  className?: string
}) {
  const dateIdPrefix = useId()
  const toast = useToast()
  const [publishing, setPublishing] = useState<number | null>(null)
  const publish = async (arId: number) => {
    if (publishing != null) return
    setPublishing(arId)
    // Optimistic: every mounted card shows it published now; a refused write
    // announces it back as a draft.
    availabilityRequestStatusChanged({ arId, status: 'new', submittedAt: null })
    try {
      const response = await fetch(`/api/availability-requests/${arId}`, {
        method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'new' }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? 'Could not publish request')
      toast('Availability request published')
    } catch (error) {
      availabilityRequestStatusChanged({ arId, status: 'draft', submittedAt: null })
      toast((error as Error).message)
    } finally { setPublishing(null) }
  }
  // A candidate dropped on its supplier joins that supplier's newest AR for
  // this job that is not closed (a submitted one reopens as New). The job's
  // live updates refresh the card.
  const addToSupplierAR = async (link: JobRequestRow['supplierLinks'][number], payload: CandidateDragPayload) => {
    const ar = link.availabilityRequests.find((r) => r.status !== 'closed')
    if (!ar) { toast(`No open availability request with ${link.name}`); return }
    try {
      const res = await fetch(`/api/requests/${request.id}/items/${payload.itemId}/candidates/${payload.id}`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'add', arId: ar.id }),
      })
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(body.error ?? 'Could not add the candidate')
      toast(`Added to ${availabilityRecordName(ar)}`)
    } catch (e) {
      toast((e as Error).message)
    }
  }
  const customerName = request.customer?.company || request.customer?.name
  const contact = request.customer?.company && request.customer.name ? request.customer.name : null
  // Reuse the recorded thread. The chat button resolves missing threads on
  // the server before opening them.
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
      {request.customer && !hideCustomerChat && (
        <CustomerChatButton customerId={request.customer.id} threadId={customerThread} label={customerName ?? 'Customer'}
          className={cn(
            'flex flex-none cursor-pointer items-center gap-1 rounded-full border border-lps-edge bg-card px-2 py-0.5 text-[10.5px] font-semibold text-primary hover:bg-secondary',
            relatedOnly && 'min-h-11',
          )} />
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
            <SupplierPill key={l.supplierId} name={l.name} focusedMobile={focusedMobile}
              supplierId={l.supplierId} onDropCandidate={(payload) => void addToSupplierAR(l, payload)}>
              {l.availabilityRequests.map((ar) => (
                <span key={ar.id} className="inline-flex items-stretch">
                <LinkSegment
                  title={availabilityRequestLinkLabel(ar.id, l.name, ar.status, ar.recordName)}
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
                    {availabilityRecordName(ar)}
                    {ar.status === 'draft' && <span className="rounded border border-current px-1 text-[10px] font-bold">Draft</span>}
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
                  <span id={`${dateIdPrefix}-ar-${ar.id}-date`} className="whitespace-nowrap text-[10.5px] font-normal opacity-80">
                    {formatWeekdayMonthDay(isSubmittedARStatus(ar.status) ? ar.submittedAt : ar.createdAt) || '—'}
                  </span>
                </LinkSegment>
                {ar.status === 'draft' && <button type="button" disabled={publishing != null}
                  aria-label={`Publish ${availabilityRecordName(ar)}`}
                  className="min-h-8 border-l border-lps-hair bg-primary px-2 text-[10.5px] font-bold text-primary-foreground hover:brightness-95 disabled:opacity-50"
                  onClick={() => void publish(ar.id)}>{publishing === ar.id ? 'Publishing…' : 'Publish'}</button>}
                </span>
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
        {...datePickerProps({
          onChange: (event) => setDate(event.target.value),
          onBlur: (event) => { const next = event.currentTarget.value; setDate(next); if (next !== (request.expectedInstallDate ?? '')) void save('expected_install_date', next) },
        })}
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
function NoteBlock({ label, children }: { label: string; children: ReactNode }) {
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
function SignatureBlock({ label, children }: { label: string; children: ReactNode }) {
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
  supplierTabs,
}: {
  request: JobRequestRow
  edit: Omit<EditProps, 'column'>
  open: boolean
  onToggle: () => void
  lastUpdated: string
  /** The suppliers' ARs are the body's tabs, so Related keeps only the customer. */
  supplierTabs: boolean
}) {
  const contactValues = request.customer
    ? [request.customer.name, request.customer.phone, request.customer.email]
      .map((value) => value?.trim())
      .filter((value): value is string => Boolean(value))
    : []
  const hasRelatedRoutes = Boolean(
    request.customer || (!supplierTabs && request.supplierLinks.length),
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
              Note for customer — the customer sees this
            </span>
            <EditableTextarea {...edit} column="note_for_customer" value={request.noteForCustomer}
              placeholder="Add a note to share with the customer…" />
            <span className="mt-1 text-[10px] font-bold uppercase tracking-[.05em] text-muted-foreground">
              Internal note
            </span>
            <EditableTextarea {...edit} column="note_internal" value={request.noteInternal}
              placeholder="Add an internal note…" renderPreview={renderInternalNote} editLabel="Edit job internal note" />
            {hasRelatedRoutes && (
              <>
                <span className="mt-1 text-[10px] font-bold uppercase tracking-[.05em] text-muted-foreground">
                  Related
                </span>
                <RequestLinks request={supplierTabs ? { ...request, supplierLinks: [] } : request} relatedOnly />
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

/** `Tue, 08/18, 09:41` — a changelog entry is read against its neighbours, so the
 *  time matters as much as the date. */
const changeStamp = (iso: string) =>
  `${formatWeekdayMonthDay(iso)}, ${new Date(iso).toLocaleTimeString('en-US', {
    timeZone: 'America/Chicago', hour: 'numeric', minute: '2-digit',
  })}`

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

type SupplierARTabItem = {
  supplier: JobRequestRow['supplierLinks'][number]
  ar: JobRequestRow['supplierLinks'][number]['availabilityRequests'][number]
}

/**
 * The job's supplier ARs as tabs, most recently engaged supplier first. A job
 * has one AR per supplier (migration 0128); jobs from before that rule keep a
 * tab for each of their ARs.
 */
function supplierARTabs(request: JobRequestRow): SupplierARTabItem[] {
  return [...request.supplierLinks]
    .sort((a, b) => (b.availabilityRequests[0]?.id ?? 0) - (a.availabilityRequests[0]?.id ?? 0))
    .flatMap((supplier) => supplier.availabilityRequests.map((ar) => ({ supplier, ar })))
}

/**
 * One supplier AR's tab: status dot, AR number, supplier. Also where that
 * supplier's candidate pills are dropped to add them to the AR (a submitted
 * AR reopens as New; a closed one has to be reopened first).
 */
function SupplierARTab({ requestId, tab: { supplier, ar }, selected, onSelect }: {
  requestId: number
  tab: SupplierARTabItem
  selected: boolean
  onSelect: () => void
}) {
  const toast = useToast()
  const [over, setOver] = useState(false)
  const name = availabilityRecordName(ar)
  const add = async (payload: CandidateDragPayload) => {
    if (ar.status === 'closed') { toast(`${name} is closed — reopen it to add to it`); return }
    try {
      const res = await fetch(`/api/requests/${requestId}/items/${payload.itemId}/candidates/${payload.id}`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'add', arId: ar.id }),
      })
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(body.error ?? 'Could not add the candidate')
      toast(`Added to ${name}`)
    } catch (e) {
      toast((e as Error).message)
    }
  }
  return (
    <button type="button" role="tab" aria-selected={selected} onClick={onSelect}
      data-supplier-ar-tab={supplier.supplierId}
      title={`${name} · ${supplier.name} — ${arStatusLabel(ar.status)}`}
      aria-label={`${name} · ${supplier.name} — ${arStatusLabel(ar.status)}`}
      onDragOver={(e) => {
        if (!carriesCandidate(e, supplier.supplierId)) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        setOver(false)
        const payload = draggedCandidate(e)
        if (payload?.supplierId !== supplier.supplierId) return
        e.preventDefault()
        void add(payload)
      }}
      className={cn('inline-flex min-h-11 flex-none items-center gap-1.5 whitespace-nowrap rounded-md px-3 text-[12px] font-semibold',
        selected ? 'bg-muted text-foreground' : 'text-muted-foreground', over && 'ring-2 ring-primary')}>
      <span aria-hidden="true" className="size-2 flex-none rounded-full"
        style={{ background: `var(--lps-tone-${arStatusTone(ar.status)}-dot)` }} />
      <span className="flex-none">{name}</span>
      <span className="min-w-0 max-w-[11rem] truncate font-normal">{supplier.name}</span>
    </button>
  )
}

/** The open supplier tab: the AR itself, edited in place in the portal's drawing. */
function SupplierARPanel({ arId }: { arId: number }) {
  const editor = useAREditor(arId)
  const narrow = useARNarrow()
  return (
    <div role="tabpanel" data-supplier-ar-panel={arId} className="space-y-2.5 border-t border-border bg-lps-tint p-2.5 sm:p-3">
      <AREditorBody editor={editor} portal mobile={narrow} summaryCard={false} />
      <AREditorFooter editor={editor} portal className="rounded-xl border" />
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
  supplierTabs = false,
  mobile = false,
  onSaved,
}: {
  request: JobRequestRow
  /** Bumped after every write — what makes an open history drawer refresh. */
  version: number
  /** Phones: counts wrap into a grid and lines draw as cards, not a sideways table. */
  mobile?: boolean
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
  /** One tab per supplier AR after Items and Orders, editing the AR in place (focused Job). */
  supplierTabs?: boolean
  onSaved: () => void
}) {
  // A number is the open supplier tab's AR id.
  const [tab, setTab] = useState<'items' | 'orders' | number>('items')
  const arTabs = supplierTabs ? supplierARTabs(request) : []
  // The count cells the lines are narrowed to; each click toggles one, none shows all.
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const shownItems = statusFilter.length ? request.items.filter((item) => statusFilter.includes(item.status)) : request.items
  // The Candidates header's eye: list candidates hidden from LPS (0124) too.
  const [showHidden, setShowHidden] = useState(false)
  const openAR = typeof tab === 'number' ? arTabs.find((t) => t.ar.id === tab) : undefined
  // Uses the same persisted layout store and controls as inventory/supplier tables.
  const lineTable = useTableConfig('requestItems')
  const lineColumns = lineTable.visible
  const lineGrid = gridOf(!!onSelect, !!onDeleteItem, lineColumns, lineTable.widthOf)
  const lineMinWidth = lineColumns.reduce((sum, column) => sum + lineTable.widthOf(column), 0)
    + (onSelect ? SELECT_COLUMN : 0) + (onDeleteItem ? ACTION_COLUMN : 0)
  useEffect(() => { setTab('items'); setStatusFilter([]) }, [request.id])
  const edit = { table: 'job_requests', id: request.id, onSaved, touchTarget: touchTargets }
  const ship = addressLine(request.shipping)
  const bill = addressLine(request.billing)
  const lastUpdated = request.updatedAt && !Number.isNaN(new Date(request.updatedAt).getTime())
    ? formatWeekdayMonthDay(request.updatedAt)
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

  async function addItem() {
    try {
      const response = await fetch(`/api/requests/${request.id}/items`, { method: 'POST' })
      const body = await response.json().catch(() => ({})) as { error?: string }
      if (!response.ok) throw new Error(body.error ?? 'Could not add a line')
      onSaved()
    } catch (error) {
      window.alert((error as Error).message)
    }
  }

  return (
    <>
      <div role="tablist" aria-label="Job request" className="flex flex-nowrap gap-1 overflow-x-auto border-t border-border px-3 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {(['items', 'orders'] as const).map((value) => <button key={value} type="button" role="tab"
          aria-selected={tab === value} onClick={() => setTab(value)}
          className={`min-h-11 flex-none whitespace-nowrap rounded-md px-3 text-[12px] font-semibold ${tab === value ? 'bg-muted text-foreground' : 'text-muted-foreground'}`}>
          {value === 'items' ? 'Request items' : 'Orders'}
        </button>)}
        {arTabs.map((t) => <SupplierARTab key={t.ar.id} requestId={request.id} tab={t}
          selected={openAR?.ar.id === t.ar.id} onSelect={() => setTab(t.ar.id)} />)}
      </div>
      {openAR ? <SupplierARPanel key={openAR.ar.id} arId={openAR.ar.id} />
      : tab === 'orders' ? <JobOrders jobRequestId={request.id} onChanged={onSaved} version={version} /> : <>
      {(!compactJobDetails || !summaryInHeader) && <div className="flex flex-col gap-2 border-t border-border bg-lps-tint p-2.5 sm:p-3">
        {!compactJobDetails && <RequestOverview request={request} />}
        {!summaryInHeader && <DemandSummary
          lineTotal={request.lineTotal}
          itemCount={request.itemCount}
          cells={ITEM_STATUS_OPTIONS.map((o) => ({
            value: o.value,
            label: o.label,
            count: request.statusCounts[o.value] ?? 0,
            color: toneDot(itemPill(o.value, null, null).tone),
          }))}
          activeStatuses={statusFilter}
          onToggleStatus={(value) => setStatusFilter((cur) => toggleStatus(cur, value))}
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
                <NoteBlock label="Note for customer — the customer sees this">
                  <EditableTextarea {...edit} column="note_for_customer" value={request.noteForCustomer}
                    placeholder="Add a note to share with the customer…" />
                </NoteBlock>
                <NoteBlock label="Internal note">
                  <EditableTextarea {...edit} column="note_internal" value={request.noteInternal}
                    placeholder="Add an internal note…" renderPreview={renderInternalNote} editLabel="Edit job internal note" />
                </NoteBlock>
              </div>
            </div>
          )}
        </div>
      )}

      {/* The line table scrolls sideways rather than crushing resized columns. */}
      {onDeleteItem && <div className="flex justify-end border-t border-border bg-lps-tint px-3 py-2">
        <button type="button" onClick={() => void addItem()} className="min-h-9 rounded-md border border-border bg-card px-3 text-[12px] font-semibold hover:bg-muted">
          New row
        </button>
      </div>}
      {mobile ? (
        <div data-request-line-cards className="flex flex-col gap-4 border-t border-border p-2.5">
          {shownItems.length ? shownItems.map((item) => (
            <ItemRow
              key={item.id}
              card
              requestId={request.id}
              item={item}
              columns={lineColumns}
              widthOf={lineTable.widthOf}
              selected={selected?.has(item.id) ?? false}
              onSelect={onSelect && (() => onSelect([item.id], !selected?.has(item.id)))}
              onDelete={onDeleteItem && (() => onDeleteItem(item))}
              onSaved={onSaved}
              touchTarget={touchTargets}
              showHidden={showHidden}
            />
          )) : (
            <div className="px-4 py-6 text-center text-[12.5px] text-muted-foreground">{emptyItemsCopy}</div>
          )}
        </div>
      ) : (
      /* Its own scroll area, so the header stays put while the lines scroll. */
      <div data-request-line-table onKeyDown={navigateLineCells} className="max-h-[75vh] overflow-auto border-t border-border">
        <div
          style={{ minWidth: lineMinWidth }}
        >
          {/* Column header, repeated per card so it survives a collapsed neighbour. */}
          <div
            className="sticky top-0 z-[2] grid items-center border-b border-border bg-lps-headrow text-[11px] font-bold uppercase tracking-[.05em] text-muted-foreground"
            style={{ gridTemplateColumns: lineGrid }}
          >
            {/* Deliberately unlabelled: the column selects lines, and a
                header control here would only mean "all of them". */}
            {onSelect && <div className="self-stretch" />}
            {lineColumns.map((column) => (
              <LineColumnHeader
                key={column.key}
                column={column}
                width={lineTable.widthOf(column)}
                onMove={lineTable.moveColumn}
                onResize={(width) => lineTable.resizeColumn(column.key, width)}
                action={column.key === 'candidates' && (
                  <button
                    type="button"
                    aria-pressed={showHidden}
                    onClick={() => setShowHidden((shown) => !shown)}
                    title={showHidden ? 'Hide hidden candidates' : 'Show hidden candidates'}
                    aria-label={showHidden ? 'Hide hidden candidates' : 'Show hidden candidates'}
                    className={cn(
                      'inline-flex size-5 flex-none cursor-pointer items-center justify-center rounded border-none bg-transparent hover:bg-muted hover:text-foreground',
                      showHidden ? 'text-primary' : 'text-muted-foreground',
                    )}
                  >
                    {showHidden ? <EyeIcon size={13} /> : <EyeOffIcon size={13} />}
                  </button>
                )}
              />
            ))}
            {/* Unlabelled for the same reason the select column is: the header
                cell of a per-row action could only mean "all of them". */}
            {onDeleteItem && <div />}
          </div>
          {shownItems.length ? (
            shownItems.map((item) => (
              <ItemRow
                key={item.id}
                requestId={request.id}
                item={item}
                columns={lineColumns}
                widthOf={lineTable.widthOf}
                selected={selected?.has(item.id) ?? false}
                onSelect={onSelect && (() => onSelect([item.id], !selected?.has(item.id)))}
                onDelete={onDeleteItem && (() => onDeleteItem(item))}
                onSaved={onSaved}
                touchTarget={touchTargets}
                showHidden={showHidden}
              />
            ))
          ) : (
            <div className="px-4 py-6 text-center text-[12.5px] text-muted-foreground">
              {emptyItemsCopy}
            </div>
          )}
        </div>
      </div>
      )}

      {compactJobDetails && (
        <CompactJobDetails
          request={request}
          edit={edit}
          open={detailsOpen}
          onToggle={onToggleDetails}
          lastUpdated={lastUpdated}
          supplierTabs={supplierTabs}
        />
      )}

      <ChangeHistory requestId={request.id} version={version} touchTarget={touchTargets} />
      </>}
    </>
  )
}
