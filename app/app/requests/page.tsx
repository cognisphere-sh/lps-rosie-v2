'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { ChevronDown, ChevronRight, MailIcon, MapPinIcon, PhoneIcon } from '@/components/workspace/icons'
import { Shell, useToast } from '@/components/workspace/shell'
import { useOutsideClose } from '@/components/workspace/table-parts'
import { Toolbar, type Chip } from '@/components/workspace/toolbar'
import { formatDate, money, num } from '@/lib/format'
import {
  ITEM_STATUS_OPTIONS,
  REQUEST_STATUS_OPTIONS,
  coverColor,
  coverOf,
  itemPill,
  requestRef,
  requestStatusLabel,
  requestStatusTone,
  toneDot,
  toneStyle,
  type Tone,
} from '@/lib/job-requests'
import type { JobAddress, JobNote, JobRequestFacets, JobRequestItem, JobRequestRow } from '@/lib/rows'
import { useDebouncedSearch } from '@/lib/use-debounced'
import { cn } from '@/lib/utils'

/** The line-item grid, shared by the header and every row so they stay aligned. */
const GRID = 'minmax(190px,1.6fr) 78px 74px 74px 92px 100px 132px minmax(180px,1.1fr)'

const DATE_RANGES = [
  { label: 'Today', days: 1 },
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 14 days', days: 14 },
  { label: 'Last 30 days', days: 30 },
]
const daysFor = (label: string) => DATE_RANGES.find((r) => r.label === label)?.days

const EMPTY_FACETS: JobRequestFacets = { size: [], customer: [] }

/** "1240 SE Ankeny St · Portland, OR · 97214" for the collapsed card. */
const addressLine = (a: JobAddress) =>
  [a.address, [a.city, a.state].filter(Boolean).join(', '), a.zip].filter(Boolean).join(' · ')

/**
 * One field write, through the same whitelisted endpoint every other table
 * edits through. The server decides what may be written — this only asks.
 */
async function patchRow(table: string, id: number, column: string, value: string): Promise<void> {
  const res = await fetch('/api/rows', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ table, id, column, value }),
  })
  const body = (await res.json().catch(() => ({}))) as { error?: string }
  if (!res.ok) throw new Error(body.error ?? 'Could not save')
}

interface EditProps {
  table: string
  id: number
  column: string
  /** Refetch after a write: generated totals and every count move with it. */
  onSaved: () => void
}

/**
 * Click-to-edit text or number.
 *
 * Enter and blur commit, Esc abandons. An unchanged value is never written:
 * clicking into a field and straight back out should not appear in the
 * request's changelog as an edit.
 */
function EditableText({
  table,
  id,
  column,
  onSaved,
  value,
  render,
  placeholder = '—',
  numeric = false,
  align = 'left',
  title,
}: EditProps & {
  value: string | number | null
  /** How the committed value reads when not editing (money, thousands, …). */
  render?: (v: string | number | null) => string
  placeholder?: string
  numeric?: boolean
  align?: 'left' | 'right'
  title?: string
}) {
  const toast = useToast()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const done = useRef(false)

  const commit = async () => {
    if (done.current) return
    done.current = true
    const next = draft.trim()
    const before = value == null ? '' : String(value)
    setEditing(false)
    if (next === before) return
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

  if (editing) {
    return (
      <input
        autoFocus
        type={numeric ? 'number' : 'text'}
        step="any"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            void commit()
          } else if (e.key === 'Escape') {
            e.preventDefault()
            done.current = true
            setEditing(false)
          }
        }}
        className={cn(
          'w-full min-w-0 rounded-md border border-primary bg-card px-1.5 py-0.5 text-[12.5px] text-foreground outline-none',
          align === 'right' && 'text-right tabular-nums',
        )}
      />
    )
  }

  const shown = render ? render(value) : value == null ? '' : String(value)
  return (
    <button
      type="button"
      title={title ?? 'Click to edit'}
      disabled={busy}
      onClick={(e) => {
        e.stopPropagation()
        setDraft(value == null ? '' : String(value))
        done.current = false
        setEditing(true)
      }}
      className={cn(
        'w-full min-w-0 cursor-text truncate rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-left text-[12.5px] text-foreground hover:border-border hover:bg-lps-tint',
        align === 'right' && 'text-right tabular-nums',
        busy && 'opacity-50',
      )}
    >
      {shown || <span className="text-lps-dim">{placeholder}</span>}
    </button>
  )
}

/** Multi-line click-to-edit, for the shared-note fields. */
function EditableTextarea({
  table,
  id,
  column,
  onSaved,
  value,
  placeholder,
}: EditProps & { value: string | null; placeholder: string }) {
  const toast = useToast()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const done = useRef(false)
  const current = value ?? ''

  const commit = async () => {
    if (done.current) return
    done.current = true
    setEditing(false)
    if (draft === current) return
    setBusy(true)
    try {
      await patchRow(table, id, column, draft)
      onSaved()
    } catch (e) {
      toast((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (editing) {
    return (
      <textarea
        autoFocus
        rows={3}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault()
            done.current = true
            setEditing(false)
          }
        }}
        className="w-full resize-y rounded-lg border border-primary bg-card p-2 text-[12.5px] text-foreground outline-none"
      />
    )
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={(e) => {
        e.stopPropagation()
        setDraft(current)
        done.current = false
        setEditing(true)
      }}
      className={cn(
        'w-full cursor-text whitespace-pre-wrap rounded-lg border border-transparent bg-transparent p-2 text-left text-[12.5px] text-foreground hover:border-border hover:bg-lps-tint',
        busy && 'opacity-50',
      )}
    >
      {current || <span className="text-lps-dim">{placeholder}</span>}
    </button>
  )
}

/** The design's status pill, with its click-to-change picker attached. */
function StatusPill({
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
  useOutsideClose(open, () => setOpen(false))

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
    <span data-pop className="relative inline-block">
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
      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="lps-pop absolute left-0 top-[calc(100%+6px)] z-[75] min-w-[180px] rounded-xl border border-border bg-popover p-1.5 shadow-[var(--lps-shadow)]"
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
 * The needs-input flag, as a badge that toggles.
 *
 * A request's badge reflects `needsAttention`, which is true when its own flag
 * is set **or** any line is waiting — so clearing the flag on a request whose
 * lines are still unanswered leaves the badge up. That is correct: the work is
 * still outstanding, and the count says where.
 */
function AttentionToggle({
  table,
  id,
  onSaved,
  on,
  count,
}: Omit<EditProps, 'column'> & { on: boolean; count?: number }) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)

  const toggle = async () => {
    setBusy(true)
    try {
      await patchRow(table, id, 'needs_attention', on ? 'false' : 'true')
      onSaved()
    } catch (e) {
      toast((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      disabled={busy}
      title={on ? 'Clear the needs-input flag' : 'Flag this as needing input'}
      onClick={(e) => {
        e.stopPropagation()
        void toggle()
      }}
      className={cn(
        'cursor-pointer whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-bold',
        on
          ? 'border-transparent bg-lps-warn-bg text-lps-warn-fg'
          : 'border-border bg-transparent text-muted-foreground hover:border-[var(--lps-warn-dot)] hover:text-lps-warn-fg',
        busy && 'opacity-50',
      )}
    >
      {on ? `Needs input${count ? ` · ${count}` : ''}` : 'Flag'}
    </button>
  )
}

/** "3 available · 1 substituted" as the design's per-status count chips. */
function CountPills({ counts }: { counts: Record<string, number> }) {
  const shown = ITEM_STATUS_OPTIONS.filter((o) => counts[o.value])
  if (!shown.length) return null
  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      {shown.map((o) => (
        <span
          key={o.value}
          className="whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold"
          style={toneStyle(itemPill(o.value, null, null).tone)}
        >
          {counts[o.value]} {o.label.toLowerCase()}
        </span>
      ))}
    </div>
  )
}

/**
 * The inline stamp, without its zone name.
 *
 * Entries are written `[2026-08-17 09:41 America/Chicago]` so the zone is
 * unambiguous in the record; in a one-line summary it is noise — every stamp
 * carries the same zone. The popover still shows the entry's full stamp.
 */
const shortStamp = (stamp: string | null) =>
  stamp ? stamp.replace(/\s+[A-Za-z]+\/[A-Za-z_]+$/, '') : ''

const NOTE_KIND: Record<JobNote['kind'], { label: string; tone: Tone }> = {
  customer: { label: 'Customer', tone: 'amber' },
  shared: { label: 'Shared', tone: 'green' },
  internal: { label: 'Internal', tone: 'grey' },
}

/**
 * The notes cell: the newest entry inline, the whole thread in a popover.
 *
 * **Only `external_notes` is editable, and only through the popover's own
 * field.** `customer_notes` is the customer's words and `internal_notes` is an
 * append-only sourcing log; overwriting either from a grid cell would destroy a
 * record, so both are read-only here.
 */
function NotesCell({
  notes,
  title,
  itemId,
  externalNotes,
  onSaved,
}: {
  notes: JobNote[]
  title: string
  itemId: number
  externalNotes: string | null
  onSaved: () => void
}) {
  const [open, setOpen] = useState(false)
  useOutsideClose(open, () => setOpen(false))

  const last = notes.length ? notes[notes.length - 1] : null
  return (
    <div data-pop className="relative min-w-0 px-1.5">
      <button
        type="button"
        title="Notes"
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        className="flex w-full min-w-0 cursor-pointer flex-col items-start gap-px rounded-md border border-transparent bg-transparent px-1 py-0.5 text-left hover:border-border hover:bg-lps-tint"
      >
        {last ? (
          <>
            <span className="w-full truncate text-[12px] text-foreground">
              <strong className="font-semibold">{NOTE_KIND[last.kind].label}:</strong> {last.text}
            </span>
            <span className="w-full truncate text-[10.5px] text-muted-foreground">
              {notes.length} {notes.length === 1 ? 'note' : 'notes'}
              {last.stamp ? ` · ${shortStamp(last.stamp)}` : ''}
            </span>
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
            <span className="text-[12.5px] font-bold text-foreground">Notes</span>
            <span className="min-w-0 truncate text-[11px] text-muted-foreground">{title}</span>
          </div>
          {notes.map((n, i) => (
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
              <p className="m-0 whitespace-pre-wrap text-[12.5px] leading-relaxed text-foreground">{n.text}</p>
            </div>
          ))}
          <div className="flex flex-col gap-1 border-t border-border pt-2">
            <span className="text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground">
              Shared note — the customer sees this
            </span>
            <EditableTextarea
              table="job_request_items"
              id={itemId}
              column="external_notes"
              value={externalNotes}
              onSaved={onSaved}
              placeholder="Add a note to share with the customer…"
            />
          </div>
        </div>
      )}
    </div>
  )
}

function ItemRow({ item, onSaved }: { item: JobRequestItem; onSaved: () => void }) {
  const pill = itemPill(item.status, item.quantity, item.availableQuantity)
  const cover = coverOf(item.quantity, item.availableQuantity)
  const edit = { table: 'job_request_items', id: item.id, onSaved }

  return (
    <div
      className="grid items-center border-b border-lps-hair last:border-b-0"
      style={{
        gridTemplateColumns: GRID,
        minHeight: '56px',
        padding: '7px 0',
        borderLeft: `3px solid ${toneDot(pill.tone)}`,
        background: item.needsAttention ? 'var(--lps-warn-bg)' : undefined,
      }}
    >
      <div className="flex min-w-0 items-center gap-1.5 px-1.5">
        <EditableText {...edit} column="name" value={item.name} />
        {item.needsAttention && (
          <span className="flex-none whitespace-nowrap rounded-full border border-[var(--lps-tone-amber-dot)] px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-lps-warn-fg">
            Needs input
          </span>
        )}
      </div>
      <div className="px-1">
        <EditableText {...edit} column="size" value={item.size} />
      </div>
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
        <EditableText
          {...edit}
          column="unit_price"
          value={item.unitPrice}
          numeric
          align="right"
          render={(v) => money(v)}
        />
      </div>
      {/* Generated by the database from the two columns to its left. */}
      <div
        className="px-2.5 text-right text-[12.5px] font-semibold tabular-nums text-foreground"
        title="Total — calculated from demand × unit price"
      >
        {money(item.total) || '—'}
      </div>
      <div className="px-2.5">
        <StatusPill
          {...edit}
          column="status"
          value={item.status}
          label={pill.label}
          tone={pill.tone}
          options={ITEM_STATUS_OPTIONS}
        />
      </div>
      <NotesCell
        notes={item.notes}
        title={[item.name, item.size].filter(Boolean).join(' · ')}
        itemId={item.id}
        externalNotes={item.externalNotes}
        onSaved={onSaved}
      />
    </div>
  )
}

/** One labelled, editable field in the request detail grid. */
function DetailField({
  label,
  ...props
}: EditProps & { label: string; value: string | number | null; placeholder?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <EditableText {...props} />
    </div>
  )
}

function RequestCard({
  request,
  expanded,
  onToggle,
  onSaved,
}: {
  request: JobRequestRow
  expanded: boolean
  onToggle: () => void
  onSaved: () => void
}) {
  const tone = requestStatusTone(request.status)
  const customerName = request.customer?.company || request.customer?.name
  const contact = request.customer?.company && request.customer.name ? request.customer.name : null
  const edit = { table: 'job_requests', id: request.id, onSaved }
  const ship = addressLine(request.shipping) || addressLine(request.billing)

  return (
    <div
      // `flex-none` matters: as a flex child this card would otherwise be
      // *shrunk* to fit the scroll container, and because it clips its own
      // overflow (for the rounded corners) the line table would be cut off
      // with nothing to scroll it back into view.
      className="flex-none overflow-hidden rounded-xl border border-border bg-card"
      style={{
        borderLeft: `3px solid ${request.needsAttention ? 'var(--lps-warn-dot)' : 'transparent'}`,
      }}
    >
      {/* The head is a div, not a button: it carries the status picker and the
          flag toggle, and a button inside a button is invalid HTML. The chevron
          is the keyboard-reachable control; clicking the head also toggles. */}
      <div onClick={onToggle} className="flex cursor-pointer flex-col gap-2.5 p-3.5 hover:bg-lps-tint">
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            aria-expanded={expanded}
            aria-label={`${expanded ? 'Collapse' : 'Expand'} ${requestRef(request.id)}`}
            onClick={(e) => {
              e.stopPropagation()
              onToggle()
            }}
            className="flex size-5 flex-none cursor-pointer items-center justify-center border-none bg-transparent text-muted-foreground"
          >
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
          <span className="text-[13.5px] font-bold tracking-tight text-primary">
            {requestRef(request.id)}
          </span>
          <StatusPill
            {...edit}
            column="status"
            value={request.status}
            label={requestStatusLabel(request.status)}
            tone={tone}
            options={REQUEST_STATUS_OPTIONS}
          />
          <AttentionToggle
            table="job_requests"
            id={request.id}
            onSaved={onSaved}
            on={request.needsAttention}
            count={request.attentionCount}
          />
          <span className="ml-auto whitespace-nowrap text-[11px] text-lps-dim">
            Created {formatDate(request.createdAt)} · Updated {formatDate(request.updatedAt)}
          </span>
        </div>

        <div className="flex flex-wrap items-start justify-between gap-3 pl-[30px]">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-[13px] font-semibold text-foreground">
              {customerName ?? <span className="italic text-muted-foreground">Unassigned customer</span>}
            </span>
            {contact && <span className="text-[11.5px] text-muted-foreground">{contact}</span>}
            <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11.5px] text-muted-foreground">
              {request.customer?.email && (
                <span className="inline-flex items-center gap-1">
                  <MailIcon size={12} /> {request.customer.email}
                </span>
              )}
              {request.customer?.phone && (
                <span className="inline-flex items-center gap-1">
                  <PhoneIcon size={12} /> {request.customer.phone}
                </span>
              )}
            </span>
            {ship && (
              <span className="inline-flex items-start gap-1 text-[11.5px] text-muted-foreground">
                <span className="mt-0.5 flex-none">
                  <MapPinIcon size={12} />
                </span>
                {ship}
              </span>
            )}
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <span className="whitespace-nowrap text-[12px] font-semibold text-foreground">
              {request.itemCount} {request.itemCount === 1 ? 'line' : 'lines'} ·{' '}
              {money(request.lineTotal) || '$0.00'}
            </span>
            <CountPills counts={request.statusCounts} />
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border">
          {/* The line table scrolls sideways rather than crushing its columns —
              the design fixes a min width for exactly this reason, and Notes is
              the column that would otherwise be squeezed out of existence. */}
          <div className="overflow-x-auto">
            <div className="min-w-[960px]">
              {/* Column header, repeated per card so it survives a collapsed neighbour. */}
              <div
                className="grid items-center border-b border-border bg-lps-headrow text-[11px] font-bold uppercase tracking-[.05em] text-muted-foreground"
                style={{ gridTemplateColumns: GRID }}
              >
                <div className="px-2.5 py-2">Item</div>
                <div className="px-2.5 py-2">Size</div>
                <div className="px-2.5 py-2 text-right">Demand</div>
                <div className="px-2.5 py-2 text-right">Avail</div>
                <div className="px-2.5 py-2 text-right">Unit price</div>
                <div className="px-2.5 py-2 text-right">Total</div>
                <div className="px-2.5 py-2">Status</div>
                <div className="px-2.5 py-2">Notes</div>
              </div>
              {request.items.length ? (
                request.items.map((item) => <ItemRow key={item.id} item={item} onSaved={onSaved} />)
              ) : (
                <div className="px-4 py-6 text-center text-[12.5px] text-muted-foreground">
                  No line items match these filters.
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-lps-hair bg-lps-tint px-4 py-3">
            <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2 lg:grid-cols-4">
              <DetailField {...edit} label="Ship to" column="shipping_address"
                value={request.shipping.address} placeholder="street" />
              <DetailField {...edit} label="City" column="shipping_city"
                value={request.shipping.city} placeholder="city" />
              <DetailField {...edit} label="State" column="shipping_state"
                value={request.shipping.state} placeholder="state" />
              <DetailField {...edit} label="ZIP" column="shipping_zip"
                value={request.shipping.zip} placeholder="zip" />
              <DetailField {...edit} label="Bill to" column="billing_address"
                value={request.billing.address} placeholder="street" />
              <DetailField {...edit} label="City" column="billing_city"
                value={request.billing.city} placeholder="city" />
              <DetailField {...edit} label="State" column="billing_state"
                value={request.billing.state} placeholder="state" />
              <DetailField {...edit} label="ZIP" column="billing_zip"
                value={request.billing.zip} placeholder="zip" />
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground">
                Shared note — the customer sees this
              </span>
              <EditableTextarea
                {...edit}
                column="external_notes"
                value={request.externalNotes}
                placeholder="Add a note to share with the customer…"
              />
            </div>

            {request.notes.filter((n) => n.kind !== 'shared').length > 0 && (
              <div className="flex flex-col gap-1.5">
                <span className="text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground">
                  Read-only — the customer&apos;s own words, and the sourcing log
                </span>
                {request.notes
                  .filter((n) => n.kind !== 'shared')
                  .map((n, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span
                        className="mt-px flex-none rounded-full px-1.5 py-px text-[9.5px] font-bold uppercase tracking-wide"
                        style={toneStyle(NOTE_KIND[n.kind].tone)}
                      >
                        {NOTE_KIND[n.kind].label}
                      </span>
                      <span className="min-w-0 whitespace-pre-wrap text-[12.5px] text-foreground">
                        {n.stamp && (
                          <span className="mr-1.5 text-[11px] text-lps-dim">{shortStamp(n.stamp)}</span>
                        )}
                        {n.text}
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function RequestsPage() {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [itemStatus, setItemStatus] = useState('all')
  const [size, setSize] = useState('all')
  const [customer, setCustomer] = useState('all')
  const [created, setCreated] = useState('all')
  const [updated, setUpdated] = useState('all')
  const [needsOnly, setNeedsOnly] = useState(false)
  const [page, setPage] = useState(1)

  const [requests, setRequests] = useState<JobRequestRow[]>([])
  const [total, setTotal] = useState(0)
  const [pageCount, setPageCount] = useState(1)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [facets, setFacets] = useState<JobRequestFacets>(EMPTY_FACETS)
  const [summary, setSummary] = useState({ requests: 0, items: 0, attention: 0 })
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  /** Bumped after a write, to refetch the page and everything derived from it. */
  const [reloads, setReloads] = useState(0)
  const reload = useCallback(() => setReloads((n) => n + 1), [])

  const customerIds = useMemo(() => {
    const map = new Map<string, number>()
    for (const c of facets.customer) map.set(c.company || c.name, c.id)
    return map
  }, [facets.customer])

  const serverQuery = useMemo(() => {
    const p = new URLSearchParams()
    if (status !== 'all') p.set('status', REQUEST_STATUS_OPTIONS.find((o) => o.label === status)?.value ?? '')
    if (itemStatus !== 'all') p.set('itemStatus', ITEM_STATUS_OPTIONS.find((o) => o.label === itemStatus)?.value ?? '')
    if (size !== 'all') p.set('size', size)
    if (customer !== 'all') p.set('customer', String(customerIds.get(customer) ?? ''))
    if (created !== 'all') p.set('created', String(daysFor(created) ?? ''))
    if (updated !== 'all') p.set('updated', String(daysFor(updated) ?? ''))
    if (needsOnly) p.set('needs', '1')
    return p.toString()
  }, [status, itemStatus, size, customer, created, updated, needsOnly, customerIds])

  const { query: debounced, filters: debouncedFilters, settled } = useDebouncedSearch(query, serverQuery)

  // Reset to page 1 during render when the result set changes underneath, so a
  // stale page never costs a second request — the pattern the other lists use.
  const searchKey = `${debounced}|${debouncedFilters}`
  const [lastKey, setLastKey] = useState(searchKey)
  if (searchKey !== lastKey) {
    setLastKey(searchKey)
    setPage(1)
  }

  useEffect(() => {
    let cancelled = false
    fetch('/api/requests?facets=1')
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || d.error) return
        setFacets(d.facets ?? EMPTY_FACETS)
        setSummary(d.summary ?? { requests: 0, items: 0, attention: 0 })
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [reloads])

  useEffect(() => {
    let cancelled = false
    setBusy(true)
    const params = new URLSearchParams(debouncedFilters)
    params.set('q', debounced)
    params.set('page', String(page))
    fetch(`/api/requests?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return
        if (d.error) {
          setError(d.error)
          setRequests([])
          return
        }
        setError('')
        setRequests(d.requests ?? [])
        setTotal(d.total ?? 0)
        setPageCount(d.pageCount ?? 1)
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
  }, [debounced, debouncedFilters, page, reloads])

  // A search or an item filter is asking about *lines*, so the cards that
  // matched open themselves — otherwise the answer is hidden behind a chevron.
  const drillingIn = debounced.trim() !== '' || itemStatus !== 'all' || size !== 'all'
  useEffect(() => {
    if (drillingIn) setExpanded(new Set(requests.map((r) => r.id)))
  }, [drillingIn, requests])

  const toggle = useCallback((id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const allExpanded = requests.length > 0 && requests.every((r) => expanded.has(r.id))

  const chips: Chip[] = [
    {
      label: 'Status',
      value: status,
      options: REQUEST_STATUS_OPTIONS.map((o) => o.label),
      onChange: setStatus,
      allLabel: 'All statuses',
    },
    {
      label: 'Item status',
      value: itemStatus,
      options: ITEM_STATUS_OPTIONS.map((o) => o.label),
      onChange: setItemStatus,
      allLabel: 'All item statuses',
    },
    { label: 'Size', value: size, options: facets.size, onChange: setSize, allLabel: 'All sizes' },
    {
      label: 'Customer',
      value: customer,
      options: facets.customer.map((c) => c.company || c.name),
      onChange: setCustomer,
      allLabel: 'All customers',
    },
    {
      label: 'Created',
      value: created,
      options: DATE_RANGES.map((r) => r.label),
      onChange: setCreated,
      allLabel: 'All time',
    },
    {
      label: 'Updated',
      value: updated,
      options: DATE_RANGES.map((r) => r.label),
      onChange: setUpdated,
      allLabel: 'All time',
    },
  ]

  const hasFilters =
    status !== 'all' ||
    itemStatus !== 'all' ||
    size !== 'all' ||
    customer !== 'all' ||
    created !== 'all' ||
    updated !== 'all' ||
    needsOnly ||
    query !== ''

  const clearAll = () => {
    setQuery('')
    setStatus('all')
    setItemStatus('all')
    setSize('all')
    setCustomer('all')
    setCreated('all')
    setUpdated('all')
    setNeedsOnly(false)
  }

  return (
    <Shell
      page="requests"
      title="Job Requests"
      subtitle={`${summary.requests} open ${summary.requests === 1 ? 'request' : 'requests'} · ${summary.items} line items · ${summary.attention} need input`}
      toolbar={
        <Toolbar
          placeholder="Search plants, customers, JR-…"
          query={query}
          onQuery={setQuery}
          chips={chips}
          hasFilters={hasFilters}
          onClear={clearAll}
          summary={`${total} ${total === 1 ? 'request' : 'requests'}`}
          pagination={{ page, pageCount, onPage: setPage, busy }}
          controls={
            <>
              <button
                type="button"
                onClick={() => setNeedsOnly((v) => !v)}
                className={cn(
                  'flex cursor-pointer items-center gap-1.5 rounded-full border px-[11px] py-[5px] text-[12px] font-semibold',
                  needsOnly
                    ? 'border-primary bg-secondary text-primary'
                    : 'border-border bg-card text-muted-foreground',
                )}
              >
                <span
                  className="size-[7px] flex-none rounded-full"
                  style={{ background: 'var(--lps-warn-dot)' }}
                />
                Needs input · {summary.attention}
              </button>
              <button
                type="button"
                onClick={() =>
                  setExpanded(allExpanded ? new Set() : new Set(requests.map((r) => r.id)))
                }
                className="cursor-pointer rounded-full border border-border bg-card px-[11px] py-[5px] text-[12px] font-semibold text-muted-foreground"
              >
                {allExpanded ? 'Collapse all' : 'Expand all'}
              </button>
            </>
          }
        />
      }
    >
      {/* The Shell hands its children a fixed, overflow-hidden box, so this is
          the scroll container. Without `min-h-0 flex-1 overflow-auto` the cards
          push past its bottom edge with nothing to scroll them back. */}
      <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-auto p-3 pb-5 md:p-4">
        {error && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-[13px] text-destructive">
            {error}
          </div>
        )}
        {!error && !busy && requests.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <span className="text-[14px] font-semibold text-foreground">
              {hasFilters ? 'No job requests match these filters' : 'No job requests yet'}
            </span>
            <span className="text-[12.5px] text-muted-foreground">
              {hasFilters
                ? 'Try clearing the status, size, or search filters.'
                : 'Requests appear here as Rosie takes them in.'}
            </span>
          </div>
        )}
        {requests.map((request) => (
          <RequestCard
            key={request.id}
            request={request}
            expanded={expanded.has(request.id)}
            onToggle={() => toggle(request.id)}
            onSaved={reload}
          />
        ))}
        {(busy || !settled) && requests.length === 0 && (
          <div className="py-16 text-center text-[12.5px] text-muted-foreground">Loading…</div>
        )}
      </div>
    </Shell>
  )
}
