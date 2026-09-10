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
  AR_RESPONSE_OPTIONS,
  arResponseTone,
  groupSupplierItems,
  type SupplierItemGroup,
  type SupplierItemLine,
} from '@/lib/availability'
import { toneDot } from '@/lib/job-requests'
import { money, num } from '@/lib/format'
import { redactPartnerRequestRefs } from '@/lib/partner-display'

/** Same six choices as every availability-request line picker. */
const CARDS = AR_RESPONSE_OPTIONS.map((o) => ({
  status: o.value || null,
  label: o.label,
  color: toneDot(arResponseTone(o.value || null)),
}))

/** The quantity asked across some lines — the card's total and a plant's. */
const demandOf = (lines: SupplierItemLine[]) =>
  lines.reduce((sum, l) => sum + (l.quantity ?? 0), 0)

type Patch = (itemId: number, changes: Record<string, string>) => Promise<void>

function PlantEntry({ group, color, onPatch }: { group: SupplierItemGroup; color: string; onPatch: Patch }) {
  // Our note about the plant, where every ask carries the same one; asks that
  // differ keep their own under their chip.
  const notes = [...new Set(group.lines.map((l) => l.lpsNotes).filter((n): n is string => !!n))]
  const shared = notes.length === 1 ? redactPartnerRequestRefs(notes[0]) : null
  return (
    <div className="flex flex-col gap-1.5 py-1.5 pl-3" style={{ borderLeft: `3px solid ${color}`, borderRadius: 2 }}>
      <span className="flex min-w-0 items-baseline gap-2">
        <span className="text-[15px] font-bold tabular-nums text-foreground">{num(demandOf(group.lines))}</span>
        {group.size && <span className="text-[12px] text-lps-dim">{group.size}</span>}
        <span className="min-w-0 truncate text-[15px] text-foreground" title={group.name}>
          {group.name}
        </span>
      </span>
      {shared && (
        <span className="truncate text-[11px] italic text-muted-foreground" title={shared}>
          {shared}
        </span>
      )}
      {/* One row per request that asked — its chip with how many it asked
          for, the line's status picker and its unit price, since each
          request's line is answered on its own. */}
      <span className="flex flex-col gap-1.5">
        {group.lines.map((line) => (
          <span key={line.id} className="flex min-w-0 flex-wrap items-center gap-2">
            <span
              className="inline-flex min-w-0 flex-1 items-center gap-1 rounded-md border border-border bg-secondary/45 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground"
              title={line.arName}
            >
              <span className="truncate">{line.arName}</span>
              {line.quantity != null && <span className="flex-none">×{num(line.quantity)}</span>}
            </span>
            {!shared && line.lpsNotes && (
              <span className="w-full truncate text-[10.5px] italic text-muted-foreground" title={redactPartnerRequestRefs(line.lpsNotes)}>
                {redactPartnerRequestRefs(line.lpsNotes)}
              </span>
            )}
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
