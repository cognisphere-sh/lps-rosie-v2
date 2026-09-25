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
// answer-status tabs the home page draws above it.

import { useState } from 'react'

import { AnswerCell, LineStatusPicker } from '@/components/workspace/availability'
import { ChevronDown, ChevronRight } from '@/components/workspace/icons'
import {
  AR_RESPONSE_OPTIONS,
  groupSupplierItems,
  type SupplierItemGroup,
  type SupplierItemLine,
} from '@/lib/availability'
import { formatWeekdayMonthDay, num } from '@/lib/format'
import { redactPartnerRequestRefs } from '@/lib/partner-display'
import { cn } from '@/lib/utils'

/** Demand · Size · Name · Date · Status · Avail. Qty · Note for supplier. */
const COLUMNS = '72px 110px minmax(220px,1.4fr) 96px 160px 90px minmax(200px,1fr)'
const GRID_MIN = 900

/**
 * The status tabs drawn over this view: every answer, plus All. A line's
 * *answer* is what is being counted — the request's lifecycle is By request's
 * business.
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
    const status = line.status ?? 'pending'
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
        className="block min-w-0 truncate text-[17px] font-normal text-foreground no-underline hover:underline"
        title={`Open ${line.arName}`}
      >
        {line.arName}
      </a>
      {line.arCustomer && (
        <span className="block truncate text-[10.5px] text-muted-foreground" title={line.arCustomer}>
          {line.arCustomer}
        </span>
      )}
      {/* Our note about this line — what LPS said when it asked. */}
      {line.noteForSupplier && (
        <span className="block whitespace-pre-wrap text-[10.5px] italic text-muted-foreground [overflow-wrap:anywhere]" title={redactPartnerRequestRefs(line.noteForSupplier)}>
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
        value={line.noteForSupplier ?? ''}
        editable
        placeholder="Add note…"
        display={line.noteForSupplier ?? ''}
        onCommit={(next) => void onPatch(line.id, { note_for_supplier: next.trim() })}
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
        'border-b border-border bg-card last:border-b-0',
        over && 'bg-lps-tint ring-2 ring-inset ring-primary/35',
        takesDrop && !over && 'ring-1 ring-inset ring-primary/30',
      )}
      style={{ minWidth: GRID_MIN }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="grid w-full cursor-pointer items-center gap-x-2 border-none bg-transparent text-left hover:bg-lps-tint"
        style={{ gridTemplateColumns: COLUMNS, minHeight: 76, padding: '14px 16px' }}
      >
        <span className="flex items-center gap-1 px-1 text-[12.5px] tabular-nums text-foreground">
          <span className="flex size-3.5 flex-none items-center justify-center text-lps-dim">
            {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </span>
          {num(demandOf(group.lines)) || '—'}
        </span>
        <span className="truncate px-1 text-[12.5px] text-muted-foreground" title={group.size ?? undefined}>
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
            <span className="px-1 text-center text-[12.5px] tabular-nums text-foreground">
              {num(line.demandedQuantity) || '—'}
            </span>
            <span className="truncate px-1 text-[12.5px] text-muted-foreground" title={line.size ?? undefined}>
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

  const status = ITEM_FILTERS.find((f) => f.id === filter)?.status ?? null
  const shown = filter === 'all' ? lines : lines.filter((l) => l.status === status)
  const groups = groupSupplierItems(shown)
  const byId = new Map(lines.map((l) => [l.id, l]))

  if (!groups.length) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-center">
        <span className="text-[14px] font-semibold text-foreground">
          {lines.length ? 'Nothing in this tab' : 'Nothing to group yet'}
        </span>
        <span className="text-[12.5px] text-muted-foreground">
          {lines.length
            ? 'Try All to see every plant.'
            : 'A plant appears here once an availability request asks you for it.'}
        </span>
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
            onPatch={async (itemId, changes) => {
              const line = byId.get(itemId)
              if (line) await onPatch(line, changes)
            }}
            open={openKeys.includes(group.key)}
            onToggle={() =>
              setOpenKeys((keys) =>
                keys.includes(group.key) ? keys.filter((k) => k !== group.key) : [...keys, group.key],
              )
            }
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
