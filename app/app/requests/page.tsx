'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  CheckIcon, ChevronDown, ChevronRight, CloseIcon, MailIcon, MapPinIcon, PhoneIcon,
} from '@/components/workspace/icons'
import {
  AppendNote, EditableText, EditableTextarea, type EditProps, patchRow,
} from '@/components/workspace/editable'
import { Shell, useToast } from '@/components/workspace/shell'
import { useOutsideClose } from '@/components/workspace/table-parts'
import { Toolbar, type Chip } from '@/components/workspace/toolbar'
import { formatDate, money, num } from '@/lib/format'
import { shortStamp } from '@/lib/notes'
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
  toneTint,
  type Tone,
} from '@/lib/job-requests'
import type {
  JobAddress, JobChange, JobNote, JobRequestFacets, JobRequestItem, JobRequestRow,
} from '@/lib/rows'
import { useDebouncedSearch } from '@/lib/use-debounced'
import { cn } from '@/lib/utils'

/**
 * The line-item grid, shared by the header and every row so they stay aligned.
 *
 * Select · Item · Size · Demand · Avail · Unit price · Total · Status ·
 * Shared note · Internal note. The design draws one Notes column; the two
 * audiences are split here because they are not one field — `external_notes` is
 * written for the customer and `internal_notes` is an append-only sourcing log,
 * and a single cell cannot honestly edit both.
 */
const GRID =
  '36px minmax(200px,1.5fr) 78px 74px 74px 92px 100px 132px minmax(170px,1fr) minmax(170px,1fr)'

/** Under this the columns would crush, so the card scrolls sideways instead. */
const GRID_MIN = 1180

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

/** Tri-state select box — the design's checkbox, `'some'` being its mixed state. */
function Check({
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
    <div className="flex flex-wrap gap-1.5">
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

const NOTE_KIND: Record<JobNote['kind'], { label: string; tone: Tone }> = {
  customer: { label: 'Customer', tone: 'amber' },
  shared: { label: 'Shared', tone: 'green' },
  internal: { label: 'Internal', tone: 'grey' },
}

/** The parsed entries of one audience, oldest first. */
const entriesOf = (notes: JobNote[], kind: JobNote['kind']) => notes.filter((n) => n.kind === kind)

/**
 * The most recently written entry across all three audiences.
 *
 * `notes` arrives grouped by audience — customer, then shared, then internal —
 * so the last element is the last *internal* entry, not the newest thing on the
 * request. Stamps sort lexically because they are written `YYYY-MM-DD HH:MM`;
 * an unstamped entry predates the convention and loses to any stamped one.
 */
function newestNote(notes: JobNote[]): JobNote | null {
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
 * One note column: the newest entry inline, the whole thing in a popover.
 *
 * `kind` decides what the popover offers, because the two columns are different
 * kinds of thing. `shared` is one field written to be shown to the customer, so
 * it is edited whole; `internal` is an append-only log, so it is read and added
 * to and never rewritten.
 */
function NoteCell({
  kind,
  table,
  id,
  title,
  value,
  entries,
  onSaved,
}: {
  kind: 'shared' | 'internal'
  table: string
  id: number
  /** What the popover is about — "Bloodgood Maple · 15 gal". */
  title: string
  /** Raw column text; only the shared editor writes it. */
  value: string | null
  entries: JobNote[]
  onSaved: () => void
}) {
  const [open, setOpen] = useState(false)
  useOutsideClose(open, () => setOpen(false))

  const meta = NOTE_KIND[kind]
  // A shared note is one field written for the customer, so the cell previews
  // the field. An internal log is a sequence, so the cell previews its newest
  // entry and says how many there are.
  const last = kind === 'shared' ? null : entries.length ? entries[entries.length - 1] : null
  const summary = kind === 'shared' ? value?.trim() ?? '' : last?.text ?? ''

  return (
    <div data-pop className="relative min-w-0 px-1.5">
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
            {last && (
              <span className="w-full truncate text-[10.5px] text-muted-foreground">
                {entries.length > 1 ? `${entries.length} entries` : ''}
                {entries.length > 1 && last.stamp ? ' · ' : ''}
                {shortStamp(last.stamp)}
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
              <NoteThread entries={entries} empty="Nothing logged yet." />
              <div className="border-t border-border pt-2">
                <AppendNote
                  table={table}
                  id={id}
                  column="internal_notes"
                  onSaved={onSaved}
                  placeholder="What did you find out?"
                />
              </div>
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
  onSaved,
}: {
  item: JobRequestItem
  selected: boolean
  onSelect: () => void
  onSaved: () => void
}) {
  const pill = itemPill(item.status, item.quantity, item.availableQuantity)
  const cover = coverOf(item.quantity, item.availableQuantity)
  const edit = { table: 'job_request_items', id: item.id, onSaved }
  const title = [item.name, item.size].filter(Boolean).join(' · ')

  // What a line is beats how it is doing: a selected row reads as selected, a
  // waiting row as waiting, and only then does the status tint show through.
  const background = selected
    ? 'var(--lps-tone-green-bg)'
    : item.needsAttention
      ? 'var(--lps-warn-bg)'
      : toneTint(pill.tone)

  return (
    <div
      className="grid items-center border-b border-lps-hair last:border-b-0"
      style={{
        gridTemplateColumns: GRID,
        minHeight: '56px',
        padding: '7px 0',
        borderLeft: `3px solid ${toneDot(pill.tone)}`,
        background,
      }}
    >
      <div className="flex justify-center">
        <Check state={selected} onChange={onSelect} label={`Select ${item.name}`} />
      </div>
      <div className="flex min-w-0 flex-col gap-px px-1.5">
        <span className="flex min-w-0 items-center gap-1.5">
          <EditableText {...edit} column="name" value={item.name} />
          {item.needsAttention && (
            <span className="flex-none whitespace-nowrap rounded-full border border-[var(--lps-tone-amber-dot)] px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-lps-warn-fg">
              Needs input
            </span>
          )}
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
      <NoteCell
        kind="shared"
        table="job_request_items"
        id={item.id}
        title={title}
        value={item.externalNotes}
        entries={entriesOf(item.notes, 'shared')}
        onSaved={onSaved}
      />
      <NoteCell
        kind="internal"
        table="job_request_items"
        id={item.id}
        title={title}
        value={null}
        entries={entriesOf(item.notes, 'internal')}
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

function RequestCard({
  request,
  expanded,
  selected,
  version,
  onToggle,
  onSelect,
  onSaved,
}: {
  request: JobRequestRow
  expanded: boolean
  /** Every selected line id on the page; the card reads its own out of it. */
  selected: Set<number>
  /** Bumped after every write — what makes an open history drawer refresh. */
  version: number
  onToggle: () => void
  /** Select or clear these line ids; the page owns the set. */
  onSelect: (ids: number[], on: boolean) => void
  onSaved: () => void
}) {
  // The second level of expansion, kept on the card: opening a request's
  // details is a fact about looking at that card, not about the page, and the
  // card stays mounted while its lines collapse and reopen.
  const [detailsOpen, setDetailsOpen] = useState(false)

  const tone = requestStatusTone(request.status)
  const customerName = request.customer?.company || request.customer?.name
  const contact = request.customer?.company && request.customer.name ? request.customer.name : null
  const edit = { table: 'job_requests', id: request.id, onSaved }

  const ship = addressLine(request.shipping)
  const bill = addressLine(request.billing)
  // The head keeps only where it is going; the street lives in the drawer.
  const locality = [
    request.shipping.city ?? request.billing.city,
    request.shipping.state ?? request.billing.state,
  ]
    .filter(Boolean)
    .join(', ')

  // Selection is over the lines the filters let through — the ones on screen.
  const ids = request.items.map((i) => i.id)
  const picked = ids.filter((id) => selected.has(id)).length
  const cardState: boolean | 'some' = picked === 0 ? false : picked === ids.length ? true : 'some'

  const customerEntries = entriesOf(request.notes, 'customer')
  const internalEntries = entriesOf(request.notes, 'internal')
  const latest = newestNote(request.notes)

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
    <div
      // `flex-none` matters: as a flex child this card would otherwise be
      // *shrunk* to fit the scroll container, and because it clips its own
      // overflow (for the rounded corners) the line table would be cut off
      // with nothing to scroll it back into view.
      className="flex-none overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md"
      style={{
        borderLeft: `3px solid ${request.needsAttention ? 'var(--lps-warn-dot)' : 'transparent'}`,
      }}
    >
      {/* The head is a div, not a button: it carries the status picker and the
          flag toggle, and a button inside a button is invalid HTML. The chevron
          is the keyboard-reachable control; clicking the head also toggles. */}
      <div onClick={onToggle} className="flex cursor-pointer flex-col gap-2 px-3.5 py-3 hover:bg-lps-tint">
        <div className="flex flex-wrap items-center gap-2.5">
          <Check
            state={cardState}
            onChange={() => onSelect(ids, cardState !== true)}
            label={`Select every line on ${requestRef(request.id)}`}
          />
          <button
            type="button"
            aria-expanded={expanded}
            aria-label={`${expanded ? 'Collapse' : 'Expand'} ${requestRef(request.id)}`}
            onClick={(e) => {
              e.stopPropagation()
              onToggle()
            }}
            className="flex size-5 flex-none cursor-pointer items-center justify-center rounded-md border-none bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
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

        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2 pl-[54px]">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-[13.5px] font-semibold text-foreground">
              {customerName ?? <span className="italic text-muted-foreground">Unassigned customer</span>}
            </span>
            <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11.5px] text-muted-foreground">
              {contact && <span>{contact}</span>}
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
              {locality && (
                <span className="inline-flex items-center gap-1">
                  <MapPinIcon size={12} /> {locality}
                </span>
              )}
            </span>
          </div>
          <div className="flex flex-col items-end gap-px">
            <span className="whitespace-nowrap text-[16px] font-bold tabular-nums leading-tight text-foreground">
              {money(request.lineTotal) || '$0.00'}
            </span>
            <span className="whitespace-nowrap text-[10.5px] font-semibold uppercase tracking-[.05em] text-muted-foreground">
              {request.itemCount} {request.itemCount === 1 ? 'line' : 'lines'}
            </span>
          </div>
        </div>

        <div className="pl-[54px]">
          <CountPills counts={request.statusCounts} />
        </div>

        {/* The newest thing anyone wrote, on one line. Enough to tell a card
            that is waiting on a reply from one that is simply open; the whole
            thread is a chevron away. */}
        {latest && (
          <div
            className="flex min-w-0 items-baseline gap-2 border-t border-lps-hair pl-[54px] pt-2"
            title={latest.text}
          >
            <span
              className="flex-none rounded-full px-1.5 py-px text-[9.5px] font-bold uppercase tracking-wide"
              style={toneStyle(NOTE_KIND[latest.kind].tone)}
            >
              {NOTE_KIND[latest.kind].label}
            </span>
            <span className="min-w-0 truncate text-[11.5px] text-muted-foreground">
              {latest.text}
            </span>
            {latest.stamp && (
              <span className="ml-auto flex-none whitespace-nowrap text-[10.5px] text-lps-dim">
                {shortStamp(latest.stamp)}
              </span>
            )}
          </div>
        )}
      </div>

      {expanded && (
        <>
          {/* Level two. The order's own particulars — where it ships, where it
              bills, and the three notes — sit directly under the head and stay
              shut until asked for: they are read when a request is being
              actioned, not when it is being scanned. */}
          <div className="border-t border-border">
            <button
              type="button"
              aria-expanded={detailsOpen}
              onClick={() => setDetailsOpen((v) => !v)}
              className="flex w-full cursor-pointer items-center gap-2 border-none bg-lps-tint px-3.5 py-2 text-left hover:bg-muted"
            >
              <span className="flex size-4 flex-none items-center justify-center text-muted-foreground">
                {detailsOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              </span>
              <span className="flex-none text-[10.5px] font-bold uppercase tracking-[.05em] text-muted-foreground">
                Order details
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
                    <NoteThread entries={customerEntries} empty="Nothing on file." />
                  </NoteBlock>
                  <NoteBlock label="Shared note — the customer sees this">
                    <EditableTextarea
                      {...edit}
                      column="external_notes"
                      value={request.externalNotes}
                      placeholder="Add a note to share with the customer…"
                    />
                  </NoteBlock>
                  <NoteBlock label="Internal log — append only">
                    <NoteThread entries={internalEntries} empty="Nothing logged yet." />
                    <AppendNote
                      table="job_requests"
                      id={request.id}
                      column="internal_notes"
                      onSaved={onSaved}
                      placeholder="What did you find out?"
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
            <div style={{ minWidth: GRID_MIN }}>
              {/* Column header, repeated per card so it survives a collapsed neighbour. */}
              <div
                className="grid items-center border-b border-border bg-lps-headrow text-[11px] font-bold uppercase tracking-[.05em] text-muted-foreground"
                style={{ gridTemplateColumns: GRID }}
              >
                {/* The card's own checkbox above covers this column; a second
                    one here would select exactly the same lines. */}
                <div />
                <div className="px-2.5 py-2">Item</div>
                <div className="px-2.5 py-2">Size</div>
                <div className="px-2.5 py-2 text-right">Demand</div>
                <div className="px-2.5 py-2 text-right">Avail</div>
                <div className="px-2.5 py-2 text-right">Unit price</div>
                <div className="px-2.5 py-2 text-right">Total</div>
                <div className="px-2.5 py-2">Status</div>
                <div className="px-2.5 py-2">Shared note</div>
                <div className="px-2.5 py-2">Internal note</div>
              </div>
              {request.items.length ? (
                request.items.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    selected={selected.has(item.id)}
                    onSelect={() => onSelect([item.id], !selected.has(item.id))}
                    onSaved={onSaved}
                  />
                ))
              ) : (
                <div className="px-4 py-6 text-center text-[12.5px] text-muted-foreground">
                  No line items match these filters.
                </div>
              )}
            </div>
          </div>

          <ChangeHistory requestId={request.id} version={version} />
        </>
      )}
    </div>
  )
}

/**
 * What can be done to a set of selected lines.
 *
 * Every action here is a write this app already owns. The design also offers
 * Email quote, Text quote, PDF quote, Place order and Send availability
 * request; none of those are wired, because none of them exist yet — rosie has
 * no mailbox and may not contact a customer unbidden (`docs/harness/agent-rosie.md`),
 * and the order tables are deferred by migration 0055. Buttons that only looked
 * like they sent something would be worse than their absence.
 */
function SelectionBar({
  ids,
  onClear,
  onSaved,
}: {
  ids: number[]
  onClear: () => void
  onSaved: () => void
}) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [menu, setMenu] = useState(false)
  useOutsideClose(menu, () => setMenu(false))

  const apply = async (column: string, value: string, done: string) => {
    setMenu(false)
    setBusy(true)
    // `allSettled`, not `all`: one rejected line must not hide the ones that
    // went through, and the count of failures is what the toast should say.
    const results = await Promise.allSettled(
      ids.map((id) => patchRow('job_request_items', id, column, value)),
    )
    const failed = results.filter((r) => r.status === 'rejected').length
    setBusy(false)
    onSaved()
    if (failed) {
      toast(`${ids.length - failed} of ${ids.length} updated · ${failed} failed`)
      return
    }
    toast(`${done} · ${ids.length} ${ids.length === 1 ? 'line' : 'lines'}`)
    onClear()
  }

  return (
    <div className="lps-pop sticky top-0 z-[60] flex flex-none flex-wrap items-center gap-2 rounded-xl border border-lps-edge bg-secondary px-3 py-2">
      <span className="whitespace-nowrap text-[13px] font-bold text-foreground">
        {ids.length} selected
      </span>
      <span className="h-[22px] w-px bg-lps-edge" />
      <div data-menu className="relative">
        <button
          type="button"
          disabled={busy}
          onClick={() => setMenu((v) => !v)}
          className="flex cursor-pointer items-center gap-1.5 rounded-full border border-border bg-card px-[11px] py-[5px] text-[12px] font-semibold text-foreground disabled:opacity-50"
        >
          Set status <ChevronDown size={12} />
        </button>
        {menu && (
          <div className="lps-pop absolute left-0 top-[calc(100%+6px)] z-[80] min-w-[190px] rounded-xl border border-border bg-popover p-1.5 shadow-[var(--lps-shadow)]">
            {ITEM_STATUS_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => void apply('status', o.value, `Set to ${o.label}`)}
                className="flex w-full cursor-pointer items-center gap-2 rounded-lg border-none bg-transparent px-2 py-1.5 text-left text-[12.5px] text-muted-foreground hover:bg-muted"
              >
                <span
                  className="size-2 flex-none rounded-full"
                  style={{ background: toneDot(itemPill(o.value, null, null).tone) }}
                />
                {o.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={() => void apply('needs_attention', 'true', 'Flagged for input')}
        className="flex cursor-pointer items-center gap-1.5 rounded-full border border-border bg-card px-[11px] py-[5px] text-[12px] font-semibold text-foreground disabled:opacity-50"
      >
        <span className="size-[7px] flex-none rounded-full" style={{ background: 'var(--lps-warn-dot)' }} />
        Flag for input
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => void apply('needs_attention', 'false', 'Flag cleared')}
        className="cursor-pointer rounded-full border border-border bg-card px-[11px] py-[5px] text-[12px] font-semibold text-foreground disabled:opacity-50"
      >
        Clear flag
      </button>
      <button
        type="button"
        onClick={onClear}
        className="ml-auto flex cursor-pointer items-center gap-1.5 rounded-full border-none bg-transparent px-2 py-[5px] text-[12px] font-semibold text-muted-foreground hover:text-foreground"
      >
        Clear <CloseIcon size={11} />
      </button>
    </div>
  )
}

export default function RequestsPage() {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [itemStatus, setItemStatus] = useState('all')
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
  /** Selected line ids, across every card on the page. */
  const [selected, setSelected] = useState<Set<number>>(new Set())
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
    if (customer !== 'all') p.set('customer', String(customerIds.get(customer) ?? ''))
    if (created !== 'all') p.set('created', String(daysFor(created) ?? ''))
    if (updated !== 'all') p.set('updated', String(daysFor(updated) ?? ''))
    if (needsOnly) p.set('needs', '1')
    return p.toString()
  }, [status, itemStatus, customer, created, updated, needsOnly, customerIds])

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
  const drillingIn = debounced.trim() !== '' || itemStatus !== 'all'
  useEffect(() => {
    if (drillingIn) setExpanded(new Set(requests.map((r) => r.id)))
  }, [drillingIn, requests])

  // A selection only means something over lines you can see. When a filter,
  // a search or a page turn changes what came back, anything that fell out of
  // view leaves the selection with it — otherwise "12 selected" would act on
  // rows nobody has in front of them.
  const visibleIds = useMemo(
    () => requests.flatMap((r) => r.items.map((i) => i.id)),
    [requests],
  )
  useEffect(() => {
    setSelected((prev) => {
      if (!prev.size) return prev
      const kept = new Set(visibleIds.filter((id) => prev.has(id)))
      return kept.size === prev.size ? prev : kept
    })
  }, [visibleIds])

  const select = useCallback((ids: number[], on: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev)
      for (const id of ids) {
        if (on) next.add(id)
        else next.delete(id)
      }
      return next
    })
  }, [])

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
    customer !== 'all' ||
    created !== 'all' ||
    updated !== 'all' ||
    needsOnly ||
    query !== ''

  const clearAll = () => {
    setQuery('')
    setStatus('all')
    setItemStatus('all')
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
                ? 'Try clearing the status, customer, or search filters.'
                : 'Requests appear here as Rosie takes them in.'}
            </span>
          </div>
        )}
        {selected.size > 0 && (
          <SelectionBar
            ids={[...selected]}
            onClear={() => setSelected(new Set())}
            onSaved={reload}
          />
        )}
        {requests.map((request) => (
          <RequestCard
            key={request.id}
            request={request}
            expanded={expanded.has(request.id)}
            selected={selected}
            version={reloads}
            onToggle={() => toggle(request.id)}
            onSelect={select}
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
