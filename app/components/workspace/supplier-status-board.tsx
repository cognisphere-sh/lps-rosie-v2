'use client'

// The portal's **By status** view (2026-08-30): the supplier's open lines as a
// board, one card per answer, each listing the plants answered that way with
// the total asked, and a chip per request that asked. It answers "what have I
// said I can order / what is still unpriced" at a glance — the third cut of
// the same workload By request and By item draw.
//
// A line's status is set here too — the same picker and answer dialog the
// request page and By item use, on each request's chip — and the line moves to
// the card its new answer names once the page re-reads. Nothing here names a
// job beyond the request name the portal already prints.

import { AnswerCell, LineStatusPicker } from '@/components/workspace/availability'
import {
  groupSupplierItems,
  type SupplierItemGroup,
  type SupplierItemLine,
} from '@/lib/availability'
import { money, num } from '@/lib/format'

/**
 * The board's cards: the five answers a line can carry, in the comp's order,
 * plus the unanswered state (the *Set status* pill's own words) for the lines
 * nobody has answered yet — which would otherwise be on no card at all.
 * Nothing derived: a card is exactly `availability_request_items.status`.
 */
const CARDS: { status: string | null; label: string; color: string }[] = [
  { status: 'can_order', label: 'Need to Order', color: '#E08A3A' },
  { status: 'arriving_soon', label: 'Arriving Soon', color: '#3B8BF5' },
  { status: 'diff_size_qty_sub', label: 'Diff Size/Qty/Sub', color: '#8F7CF6' },
  { status: 'available', label: 'Available', color: '#3DBB6A' },
  { status: 'unavailable', label: 'Unavailable', color: '#E5484D' },
  { status: null, label: 'Set Status', color: '#8C9E8E' },
]

/** The quantity asked across some lines — the card's total and a plant's. */
const demandOf = (lines: SupplierItemLine[]) =>
  lines.reduce((sum, l) => sum + (l.quantity ?? 0), 0)

type Patch = (itemId: number, changes: Record<string, string>) => Promise<void>

function PlantEntry({ group, color, onPatch }: { group: SupplierItemGroup; color: string; onPatch: Patch }) {
  return (
    <div className="flex flex-col gap-1.5 py-1.5 pl-3" style={{ borderLeft: `3px solid ${color}`, borderRadius: 2 }}>
      <span className="flex min-w-0 items-baseline gap-2">
        <span className="text-[15px] font-bold tabular-nums text-foreground">{num(demandOf(group.lines))}</span>
        {group.size && <span className="text-[12px] text-lps-dim">{group.size}</span>}
        <span className="min-w-0 truncate text-[15px] text-foreground" title={group.name}>
          {group.name}
        </span>
      </span>
      {/* One row per request that asked — its chip with how many it asked
          for, the line's status picker and its unit price, since each
          request's line is answered on its own. */}
      <span className="flex flex-col gap-1.5">
        {group.lines.map((line) => (
          <span key={line.id} className="flex min-w-0 items-center gap-2">
            <span
              className="inline-flex min-w-0 flex-1 items-center gap-1 rounded-md border border-border bg-secondary/45 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground"
              title={line.arName}
            >
              <span className="truncate">{line.arName}</span>
              {line.quantity != null && <span className="flex-none">×{num(line.quantity)}</span>}
            </span>
            <span className="flex-none"><LineStatusPicker item={line} editable onPatch={onPatch} /></span>
            <span className="w-20 flex-none">
              <AnswerCell
                value={line.unitPrice == null ? '' : String(line.unitPrice)}
                editable
                align="right"
                placeholder="$/unit"
                display={money(line.unitPrice)}
                onCommit={(next) => void onPatch(line.id, { unit_price: next.trim() })}
              />
            </span>
          </span>
        ))}
      </span>
    </div>
  )
}

/** The whole board. */
export function SupplierStatusBoard({
  lines,
  onPatch,
}: {
  lines: SupplierItemLine[]
  /** Write one line's answer; the caller re-reads, and the line moves card. */
  onPatch: (line: SupplierItemLine, changes: Record<string, string>) => Promise<void>
}) {
  const byId = new Map(lines.map((l) => [l.id, l]))
  const patch: Patch = async (itemId, changes) => {
    const line = byId.get(itemId)
    if (line) await onPatch(line, changes)
  }
  if (!lines.length) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-center">
        <span className="text-[14px] font-semibold text-foreground">Nothing to show yet</span>
        <span className="text-[12.5px] text-muted-foreground">
          A plant appears here once an availability request asks you for it.
        </span>
      </div>
    )
  }
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {CARDS.map((card) => {
        const mine = lines.filter((l) => l.status === card.status)
        const groups = groupSupplierItems(mine)
        return (
          <section
            key={card.status ?? 'pending'}
            // A fixed height, the list scrolling inside it: the grid's rows
            // stay level however many plants one answer holds.
            className="flex h-[26rem] flex-col gap-3 overflow-hidden rounded-2xl border border-border bg-card px-4 pb-4 pt-3"
            style={{ borderTop: `3px solid ${card.color}` }}
          >
            <header className="flex flex-none items-center gap-2">
              <span className="size-2 flex-none rounded-full" style={{ background: card.color }} />
              <h2 className="m-0 min-w-0 flex-1 truncate font-serif text-[19px] font-bold text-foreground">
                {card.label}
              </h2>
              <span className="text-[14px] font-bold tabular-nums" style={{ color: card.color }}>
                {num(demandOf(mine))}
              </span>
            </header>
            {groups.length === 0 ? (
              <span className="text-[12px] text-lps-dim">—</span>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
                {groups.map((g) => (
                  <PlantEntry key={g.key} group={g} color={card.color} onPatch={patch} />
                ))}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
