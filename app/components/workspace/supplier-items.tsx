'use client'

// The portal's **By item** view: this supplier's open availability-request
// lines grouped by the plant they are about, rather than by the request they
// arrived on.
//
// The By-request list answers "what does this job want from us". This answers
// the question it can't: *how often have they asked me for this plant, and
// what did I say each time* — which is spread across every request that wanted
// it. So a group is a plant, and its rows are the asks.
//
// A group is one of two things, and the difference is the point of the view:
//
// - **Mapped** — a real row of this supplier's own catalogue
//   (`mapped_inventory_id`, migration 0077). Every line in it is the same
//   offering at the same size, whatever each request called it. These are the
//   drop targets.
// - **Unmapped** — a shared spelling and nothing more. Nobody has said those
//   lines are one plant; they were merely typed alike. This is the group lines
//   are dragged *out* of, and dropping one on a catalogue row is how it is
//   said.
//
// No status tabs here, deliberately: a status belongs to a request, and this
// view is not looking at requests.

import { useState } from 'react'

import { ARLineTable, ARResponseSummary } from '@/components/workspace/availability'
import { ChevronDown, ChevronRight } from '@/components/workspace/icons'
import {
  answeredIn,
  arStatusLabel,
  arStatusTone,
  groupSupplierItems,
  type SupplierItemGroup,
  type SupplierItemLine,
} from '@/lib/availability'
import { toneDot, toneStyle, type Tone } from '@/lib/job-requests'
import { redactPortalRequestRefs } from '@/lib/portal-display'
import { cn } from '@/lib/utils'

/** A small read-only pill in a tone — the same shape the request pills use. */
function TonePill({ label, tone }: { label: string; tone: Tone }) {
  return (
    <span
      className="inline-flex w-fit items-center gap-1.5 rounded-full px-2 py-0.5 text-[10.5px] font-bold"
      style={toneStyle(tone)}
    >
      <span className="size-1.5 flex-none rounded-full" style={{ background: toneDot(tone) }} />
      {label}
    </span>
  )
}

/**
 * The Job cell — the one column this view adds to the request's own line
 * table, because here a table holds lines from several requests at once.
 *
 * It is also the **drag handle**. Deliberately not the whole row: the rest of
 * the row is the request's editable cells, and a drag that started inside a
 * text input would fight selecting the text in it.
 */
function JobCell({
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
      className={cn(
        'min-w-0 cursor-grab px-1 active:cursor-grabbing',
        dragging && 'opacity-40',
      )}
    >
      <span className="flex min-w-0 items-center gap-1.5">
        <a
          href={href}
          draggable={false}
          className="min-w-0 truncate text-[13px] font-semibold text-foreground no-underline hover:underline"
          title={`Open ${line.arName}`}
        >
          {line.arName}
        </a>
        <TonePill label={arStatusLabel(line.arStatus)} tone={arStatusTone(line.arStatus)} />
      </span>
      {line.arCustomer && (
        <span className="block truncate text-[10.5px] text-muted-foreground" title={line.arCustomer}>
          {line.arCustomer}
        </span>
      )}
    </span>
  )
}

/** One plant: the head, the answer strip, and its asks when open. */
function ItemGroupCard({
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
        'flex flex-none flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition-shadow',
        over ? 'border-primary ring-2 ring-primary/35' : 'border-border',
        takesDrop && !over && 'border-dashed border-primary/45',
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex cursor-pointer flex-wrap items-center gap-x-2.5 gap-y-1 border-none bg-transparent px-3.5 py-2.5 text-left hover:bg-lps-tint"
      >
        <span className="flex size-4 flex-none items-center justify-center text-lps-dim">
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
        <span className="min-w-0 max-w-[24rem] truncate text-[13.5px] font-semibold text-foreground">
          {group.name}
        </span>
        {group.size && (
          <span className="rounded-md border border-lps-hair bg-secondary/45 px-1.5 py-px text-[11px] font-semibold tabular-nums text-muted-foreground">
            {group.size}
          </span>
        )}
        {mapped ? (
          <span
            className="rounded-full border border-lps-hair px-1.5 py-px text-[9.5px] font-bold uppercase tracking-wide text-muted-foreground"
            title="One of your catalogue rows — drop a line here to group it under this row"
          >
            your catalogue
          </span>
        ) : (
          <span
            className="rounded-full border border-dashed border-lps-hair px-1.5 py-px text-[9.5px] font-bold uppercase tracking-wide text-lps-dim"
            title="Grouped by name only — not yet tied to one of your catalogue rows"
          >
            unmatched
          </span>
        )}
        <span className="ml-auto whitespace-nowrap text-[11px] text-lps-dim">
          {group.lines.length === 1 ? '1 request' : `${group.lines.length} requests`}
        </span>
      </button>

      <div className="px-3.5 pb-3">
        <ARResponseSummary items={group.lines} answeredCount={answeredIn(group.lines)} />
      </div>

      {open && (
        // The request's own line table, editable, with the Job column in
        // front. Not a look-alike: the same component, so an answer is set
        // here exactly as it is set on the request's page — the status picker
        // and its answer dialog, the inline quantity, price and notes cells.
        <div className="border-t border-border p-3">
          <ARLineTable
            items={group.lines}
            editable
            onPatch={onPatch}
            displayText={redactPortalRequestRefs}
            leadingHeader="Job"
            renderLeading={(line) => (
              <JobCell
                key={line.id}
                line={line}
                href={hrefFor(line)}
                dragging={draggingId === line.id}
                onDragStart={() => onDragStartLine(line.id)}
                onDragEnd={onDragEndLine}
              />
            )}
          />
        </div>
      )}
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
  hrefFor,
  onMap,
  onPatch,
}: {
  lines: SupplierItemLine[]
  /** Where the Job cell's link goes — the request's own page. */
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

  const groups = groupSupplierItems(lines)
  const byId = new Map(lines.map((l) => [l.id, l]))
  const mappedCount = groups.filter((g) => g.mappedInventoryId != null).length

  if (!groups.length) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-center">
        <span className="text-[14px] font-semibold text-foreground">Nothing to group yet</span>
        <span className="text-[12.5px] text-muted-foreground">
          A plant appears here once an availability request asks you for it.
        </span>
      </div>
    )
  }

  return (
    <>
      <p className="m-0 text-[12px] text-muted-foreground">
        Every plant you have been asked for, across all{' '}
        {lines.length === 1 ? '1 line' : `${lines.length} lines`} of your open requests.{' '}
        {mappedCount > 0
          ? 'Answer a line here as you would on its own request, or drag it by the job name onto one of your catalogue rows to group it under that row.'
          : 'Answer a line here as you would on its own request. None of these is tied to one of your catalogue rows yet, so they are grouped by name alone.'}
      </p>
      {groups.map((group) => (
        <ItemGroupCard
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
    </>
  )
}
