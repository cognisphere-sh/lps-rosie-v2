'use client'

// The portal's **By item** view: this supplier's open availability-request
// lines grouped by the plant they are about, rather than by the request they
// arrived on.
//
// The By-request list answers "what does this job want from us". This answers
// the question it can't: *how often have they asked me for this plant, and
// what did I say each time* — which is spread across every request that wanted
// it. So a row is a plant, and every row opens into one sub-row per request
// that asked for it — one or six — which is where the line is answered.
//
// A group is one of two things:
//
// - **Mapped** — a real row of this supplier's own catalogue
//   (`mapped_inventory_id`, migration 0077). Every line in it is the same
//   offering at the same size, whatever each request called it. These take a
//   drop.
// - **Unmapped** — a shared spelling and nothing more. Nobody has said those
//   lines are one plant; they were merely typed alike. A line is dragged *out*
//   of one of these by its request name, and dropping it on a catalogue row is
//   how it is said.
//
// Since 2026-08-30 the view is one flat table (Demand · Size · Name · Date ·
// Status · Avail. Qty · Note for supplier) drawn to the Figma comp, filtered by the
// answer-status tabs the home page draws above it. Below 900px the same groups
// are drawn as cards instead (`ItemGroupCard`) — the table does not fit a phone.

import { useState } from 'react'

import { AnswerCell, LineStatusPicker } from '@/components/workspace/availability'
import { useIsMobile } from '@/components/workspace/frame'
import { ChevronDown, ChevronRight } from '@/components/workspace/icons'
import {
  AR_RESPONSE_OPTIONS,
  arShownStatus,
  groupSupplierItems,
  type SupplierItemGroup,
  type SupplierItemLine,
} from '@/lib/availability'
import { formatWeekdayMonthDay, num } from '@/lib/format'
import { redactPartnerRequestRefs } from '@/lib/partner-display'
import { cn } from '@/lib/utils'
import { EmptyState } from '@/components/workspace/empty-state'

/** Demand · Size · Name · Date · Status · Avail. Qty · Note for supplier. */
const COLUMNS = '72px 110px minmax(220px,1.4fr) 96px 160px 90px minmax(200px,1fr)'
const GRID_MIN = 900

/**
 * The status tabs drawn over this view: every answer, plus All. A line's
 * *answer* is what is being counted (Unavailable with a substitute counts as
 * Diff Sz/Sub) — the request's lifecycle is By request's business.
 */
export const ITEM_FILTERS = [
  { id: 'all', label: 'All', status: null },
  ...AR_RESPONSE_OPTIONS.map((o) => ({ id: o.value || 'pending', label: o.label, status: o.value || null })),
]
export type ItemFilterId = (typeof ITEM_FILTERS)[number]['id']

/** How many lines each tab holds. */
export function countItemFilters(lines: SupplierItemLine[]): Record<ItemFilterId, number> {
  const counts = Object.fromEntries(ITEM_FILTERS.map((f) => [f.id, 0])) as Record<ItemFilterId, number>
  counts.all = lines.length
  for (const line of lines) {
    const status = arShownStatus(line) ?? 'pending'
    if (status in counts) counts[status] += 1
  }
  return counts
}

/** The total asked for across a group's lines; null when no line carries one. */
function demandOf(lines: SupplierItemLine[]): number | null {
  const qs = lines.map((l) => l.demandedQuantity).filter((q): q is number => q != null)
  return qs.length ? qs.reduce((a, b) => a + b, 0) : null
}

/**
 * The request name, as one plant's sub-row names it. It is also the **drag
 * handle** — deliberately not the whole row: the rest of the row is the
 * request's editable cells, and a drag that started inside a text input would
 * fight selecting the text in it.
 */
function RequestCell({
  line,
  href,
  dragging,
  onDragStart,
  onDragEnd,
}: {
  line: SupplierItemLine
  href: string
  dragging: boolean
  onDragStart: () => void
  onDragEnd: () => void
}) {
  return (
    <span
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', String(line.id))
        e.dataTransfer.effectAllowed = 'move'
        onDragStart()
      }}
      onDragEnd={onDragEnd}
      title="Drag onto one of your catalogue rows to group this line under it"
      className={cn('min-w-0 cursor-grab px-1 active:cursor-grabbing', dragging && 'opacity-40')}
    >
      <a
        href={href}
        draggable={false}
        className="block min-w-0 truncate text-[18px] font-normal text-foreground no-underline hover:underline"
        title={`Open ${line.arName}`}
      >
        {line.arName}
      </a>
      {line.arCustomer && (
        <span className="block truncate text-[11px] text-muted-foreground" title={line.arCustomer}>
          {line.arCustomer}
        </span>
      )}
      {/* Our note about this line — what LPS said when it asked. */}
      {line.noteForSupplier && (
        <span className="block whitespace-pre-wrap text-[11px] italic text-muted-foreground [overflow-wrap:anywhere]" title={redactPartnerRequestRefs(line.noteForSupplier)}>
          {redactPartnerRequestRefs(line.noteForSupplier)}
        </span>
      )}
    </span>
  )
}

/** The cells a line is answered in: status, available quantity, the supplier's note. */
function AnswerCells({
  line,
  onPatch,
}: {
  line: SupplierItemLine
  onPatch: (itemId: number, changes: Record<string, string>) => Promise<void>
}) {
  return (
    <>
      <div className="px-1">
        <LineStatusPicker item={line} editable onPatch={onPatch} />
      </div>
      <AnswerCell
        value={line.availableQuantity == null ? '' : String(line.availableQuantity)}
        editable
        align="right"
        placeholder="—"
        display={num(line.availableQuantity)}
        onCommit={(next) => void onPatch(line.id, { available_quantity: next.trim() })}
      />
      <AnswerCell
        value={line.noteFromSupplier ?? ''}
        editable
        placeholder="Add note…"
        display={line.noteFromSupplier ?? ''}
        onCommit={(next) => void onPatch(line.id, { note_from_supplier: next.trim() })}
        ariaLabel={`Line ${line.id} supplier notes`}
        multiline
      />
    </>
  )
}

/**
 * One plant as a row: the plant, its size, the total demand and how many
 * requests asked. Every row opens — the chevron on the demand cell — into one
 * sub-row per request, and that is where a line is answered, so a single ask
 * and a sixth ask are read and answered the same way.
 */
function ItemGroupRow({
  group,
  hrefFor,
  open,
  onToggle,
  draggingId,
  onDragStartLine,
  onDragEndLine,
  onDrop,
  onPatch,
}: {
  group: SupplierItemGroup
  hrefFor: (line: SupplierItemLine) => string
  open: boolean
  onToggle: () => void
  draggingId: number | null
  onDragStartLine: (id: number) => void
  onDragEndLine: () => void
  onDrop: (itemId: number) => void
  onPatch: (itemId: number, changes: Record<string, string>) => Promise<void>
}) {
  const [over, setOver] = useState(false)
  const mapped = group.mappedInventoryId != null
  // A group only takes a drop when it *is* a catalogue row, and never from a
  // line it already holds — that write would be a no-op dressed as a change.
  const takesDrop = mapped && draggingId != null && !group.lines.some((l) => l.id === draggingId)
  // Our per-line note, where every ask carries the same one — the usual case
  // for a plant asked for once, and worth a line under the name.
  const notes = [...new Set(group.lines.map((l) => l.noteForSupplier).filter((n): n is string => !!n))]
  const note = notes.length === 1 ? redactPartnerRequestRefs(notes[0]) : null

  return (
    <div
      onDragOver={(e) => {
        if (!takesDrop) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        if (!takesDrop) return
        e.preventDefault()
        setOver(false)
        const id = Number.parseInt(e.dataTransfer.getData('text/plain'), 10)
        if (Number.isInteger(id)) onDrop(id)
      }}
      className={cn(
        'border-b border-border bg-card transition-[background-color,box-shadow] duration-150 ease-lps last:border-b-0',
        over && 'bg-lps-tint ring-2 ring-inset ring-primary/35',
        takesDrop && !over && 'ring-1 ring-inset ring-primary/30',
      )}
      style={{ minWidth: GRID_MIN }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="grid w-full cursor-pointer items-center gap-x-2 border-none bg-transparent text-left transition-colors duration-150 hover:bg-lps-tint"
        style={{ gridTemplateColumns: COLUMNS, minHeight: 56, padding: '10px 16px' }}
      >
        <span className="flex items-center gap-1 px-1 text-[13px] tabular-nums text-foreground">
          <span className="flex size-3.5 flex-none items-center justify-center text-lps-dim">
            {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </span>
          {num(demandOf(group.lines)) || '—'}
        </span>
        <span className="truncate px-1 text-[13px] text-muted-foreground" title={group.size ?? undefined}>
          {group.size ?? '—'}
        </span>
        <span className="min-w-0 px-1">
          <span className="block truncate text-[14px] font-medium text-foreground" title={group.name}>
            {group.name}
          </span>
          {note && (
            <span className="block whitespace-pre-wrap text-[11px] text-muted-foreground [overflow-wrap:anywhere]" title={note}>
              {note}
            </span>
          )}
        </span>
        <span className="px-1 text-[12px] text-muted-foreground">
          {group.lines.length === 1 ? '1 request' : `${group.lines.length} requests`}
        </span>
      </button>
      {open &&
        group.lines.map((line) => (
          <div
            key={line.id}
            className="grid items-center gap-x-2 border-t border-lps-hair"
            style={{ gridTemplateColumns: COLUMNS, minHeight: 52, padding: '6px 16px' }}
          >
            <span className="px-1 text-center text-[13px] tabular-nums text-foreground">
              {num(line.demandedQuantity) || '—'}
            </span>
            <span className="truncate px-1 text-[13px] text-muted-foreground" title={line.size ?? undefined}>
              {line.size ?? '—'}
            </span>
            <RequestCell
              line={line}
              href={hrefFor(line)}
              dragging={draggingId === line.id}
              onDragStart={() => onDragStartLine(line.id)}
              onDragEnd={onDragEndLine}
            />
            <span className="truncate px-1 text-[12px] text-muted-foreground">{formatWeekdayMonthDay(line.arCreatedAt)}</span>
            <AnswerCells line={line} onPatch={onPatch} />
          </div>
        ))}
    </div>
  )
}

/**
 * One plant as a phone draws it (below 900px). The seven-column table does not
 * fit, so the row becomes a card: the plant and its ask on top, and once opened
 * each request's line stacked under it with labelled, full-width answer fields
 * — the same shape the request page's own phone cards use. No drag: touch
 * browsers don't fire HTML5 drag events, so grouping a line under a catalogue
 * row stays a desktop action.
 */
function ItemGroupCard({
  group,
  hrefFor,
  open,
  onToggle,
  onPatch,
}: {
  group: SupplierItemGroup
  hrefFor: (line: SupplierItemLine) => string
  open: boolean
  onToggle: () => void
  onPatch: (itemId: number, changes: Record<string, string>) => Promise<void>
}) {
  const notes = [...new Set(group.lines.map((l) => l.noteForSupplier).filter((n): n is string => !!n))]
  const note = notes.length === 1 ? redactPartnerRequestRefs(notes[0]) : null
  const asks = group.lines.length === 1 ? '1 request' : `${group.lines.length} requests`

  return (
    <article className="min-w-0 overflow-hidden rounded-xl border border-border bg-card [overflow-wrap:anywhere]">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex min-h-14 w-full cursor-pointer items-start gap-3 border-none bg-transparent px-3.5 py-3 text-left active:bg-lps-tint"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[16px] font-semibold leading-5 text-foreground">{group.name}</span>
          <span className="mt-0.5 block text-[13px] text-muted-foreground">
            Need {num(demandOf(group.lines)) || '—'}{group.size ? ` · ${group.size}` : ''} · {asks}
          </span>
          {note && (
            <span className="mt-1 block whitespace-pre-wrap text-[12px] italic text-muted-foreground">{note}</span>
          )}
        </span>
        <span className="mt-0.5 flex size-5 flex-none items-center justify-center text-lps-dim">
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
      </button>
      {open &&
        group.lines.map((line) => (
          <div key={line.id} className="grid min-w-0 grid-cols-2 gap-3 border-t border-lps-hair px-3.5 py-3">
            <div className="col-span-2 min-w-0">
              <span className="flex min-w-0 items-baseline gap-2">
                <a
                  href={hrefFor(line)}
                  className="min-w-0 flex-1 truncate text-[14px] font-medium text-foreground underline-offset-2 hover:underline"
                >
                  {line.arName}
                </a>
                <span className="flex-none text-[12px] tabular-nums text-muted-foreground">
                  {formatWeekdayMonthDay(line.arCreatedAt)}
                </span>
              </span>
              <span className="mt-0.5 block text-[12px] text-muted-foreground">
                Need {num(line.demandedQuantity) || '—'}{line.size ? ` · ${line.size}` : ''}
                {line.arCustomer ? ` · ${line.arCustomer}` : ''}
              </span>
              {!note && line.noteForSupplier && (
                <span className="mt-1 block whitespace-pre-wrap text-[12px] italic text-muted-foreground">
                  {redactPartnerRequestRefs(line.noteForSupplier)}
                </span>
              )}
            </div>
            <label className="flex min-w-0 flex-col gap-1">
              <span className="text-[11px] font-bold uppercase tracking-[.05em] text-muted-foreground">Status</span>
              <span className="relative flex min-h-11 items-center">
                <LineStatusPicker item={line} editable onPatch={onPatch} ariaLabel={`${line.arName} status`} touch />
              </span>
            </label>
            <label className="flex min-w-0 flex-col gap-1">
              <span className="text-[11px] font-bold uppercase tracking-[.05em] text-muted-foreground">Available qty</span>
              <AnswerCell
                value={line.availableQuantity == null ? '' : String(line.availableQuantity)}
                editable
                align="right"
                placeholder="Qty"
                display={num(line.availableQuantity)}
                onCommit={(next) => void onPatch(line.id, { available_quantity: next.trim() })}
                ariaLabel={`${line.arName} available quantity`}
                inputMode="decimal"
                touch
              />
            </label>
            <label className="col-span-2 flex min-w-0 flex-col gap-1">
              <span className="text-[11px] font-bold uppercase tracking-[.05em] text-muted-foreground">Supplier reply</span>
              <AnswerCell
                value={line.noteFromSupplier ?? ''}
                editable
                placeholder="Substitute, ETA, conditions…"
                display={line.noteFromSupplier ?? ''}
                onCommit={(next) => void onPatch(line.id, { note_from_supplier: next.trim() })}
                ariaLabel={`${line.arName} supplier reply`}
                multiline
                touch
              />
            </label>
          </div>
        ))}
    </article>
  )
}

/**
 * The whole By-item view.
 *
 * Expansion is keyed by group key rather than index, so it survives the
 * refetch a drop triggers — the group you dropped onto stays open under you.
 */
export function SupplierItemGroups({
  lines,
  filter = 'all',
  hrefFor,
  onMap,
  onPatch,
}: {
  lines: SupplierItemLine[]
  /** Which answer the table is cut to — the tab above it. */
  filter?: ItemFilterId
  /** Where the request cell's link goes — the request's own page. */
  hrefFor: (line: SupplierItemLine) => string
  /** Point one line at a catalogue row. The caller writes, then refetches. */
  onMap: (line: SupplierItemLine, inventoryId: string) => void
  /**
   * Write one line's answer. The line names the request it belongs to, which
   * is why this takes the whole line: a table here spans several requests, and
   * each answer goes to its own.
   */
  onPatch: (line: SupplierItemLine, changes: Record<string, string>) => Promise<void>
}) {
  const [openKeys, setOpenKeys] = useState<string[]>([])
  const [draggingId, setDraggingId] = useState<number | null>(null)
  const isMobile = useIsMobile()

  const status = ITEM_FILTERS.find((f) => f.id === filter)?.status ?? null
  const shown = filter === 'all' ? lines : lines.filter((l) => arShownStatus(l) === status)
  const groups = groupSupplierItems(shown)
  const byId = new Map(lines.map((l) => [l.id, l]))
  const patchById = async (itemId: number, changes: Record<string, string>) => {
    const line = byId.get(itemId)
    if (line) await onPatch(line, changes)
  }
  const toggle = (key: string) =>
    setOpenKeys((keys) => (keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key]))

  if (!groups.length) {
    return (
      <EmptyState
        art={lines.length ? 'tag' : 'seed'}
        className="py-16"
        title={lines.length ? 'Nothing in this tab' : 'Nothing to group yet'}
        hint={lines.length
          ? 'Try All to see every plant.'
          : 'A plant appears here once an availability request asks you for it.'}
      />
    )
  }

  if (isMobile) {
    return (
      <div className="flex min-w-0 flex-col gap-2">
        {groups.map((group) => (
          <ItemGroupCard
            key={group.key}
            group={group}
            hrefFor={hrefFor}
            open={openKeys.includes(group.key)}
            onToggle={() => toggle(group.key)}
            onPatch={patchById}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="w-full min-w-0 max-w-full overflow-x-auto">
      <div
        className="grid items-center gap-x-2 px-4 pb-2 pt-1 text-[12px] text-muted-foreground"
        style={{ gridTemplateColumns: COLUMNS, minWidth: GRID_MIN }}
      >
        <span className="px-1 text-center">Demand</span>
        <span className="px-1">Size</span>
        <span className="px-1">Name</span>
        <span className="px-1">Date</span>
        <span className="px-1">Status</span>
        <span className="px-1 text-right">Avail. Qty</span>
        <span className="px-1">Note for supplier</span>
      </div>
      <div className="overflow-hidden rounded-xl border border-border" style={{ minWidth: GRID_MIN }}>
        {groups.map((group) => (
          <ItemGroupRow
            key={group.key}
            group={group}
            hrefFor={hrefFor}
            onPatch={patchById}
            open={openKeys.includes(group.key)}
            onToggle={() => toggle(group.key)}
            draggingId={draggingId}
            onDragStartLine={setDraggingId}
            onDragEndLine={() => setDraggingId(null)}
            onDrop={(itemId) => {
              const line = byId.get(itemId)
              // The drop target is a mapped group, so the id is there.
              if (line && group.mappedInventoryId) {
                // Keep the receiving group open — the line lands inside it.
                setOpenKeys((keys) => (keys.includes(group.key) ? keys : [...keys, group.key]))
                onMap(line, group.mappedInventoryId)
              }
              setDraggingId(null)
            }}
          />
        ))}
      </div>
    </div>
  )
}
