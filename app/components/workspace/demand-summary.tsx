import { money } from '@/lib/format'
import { StatusFilterTile } from './status-filter-tile'
import { MobileDisclosure } from './mobile-disclosure'
import { cn } from '@/lib/utils'

export type SummaryCell = { value: string; label: string; count: number; color: string }

/**
 * What a request is worth and where its lines stand — the one count strip of
 * the job's Request items tab, its AR tab and the supplier's AR page.
 *
 * Total items and Subtotal sit on top; under them every status is a cell of
 * equal height (number over name), zeros included, so "nothing is
 * unavailable" and "nobody has looked yet" cannot render alike. Each cell
 * toggles a filter when `onToggleStatus` is given; several can be on at once.
 */
export function DemandSummary({
  lineTotal,
  itemCount,
  cells,
  activeStatuses = [],
  onToggleStatus,
  collapseOnMobile = false,
}: {
  lineTotal: number | null
  itemCount: number
  cells: SummaryCell[]
  /** The statuses the lines are filtered to, highlighted; each count cell toggles its own. */
  activeStatuses?: readonly string[]
  onToggleStatus?: (status: string) => void
  collapseOnMobile?: boolean
}) {
  const statusCells = <div className="grid w-full grid-cols-4 gap-px bg-lps-hair @[760px]:grid-cols-7">
    {cells.map((c) => <StatusFilterTile key={c.value} label={c.label} count={c.count} color={c.color}
      selected={activeStatuses.includes(c.value)} disabled={!onToggleStatus} onClick={() => onToggleStatus?.(c.value)}
      className="rounded-none border-0 px-1 focus-visible:-outline-offset-2" />)}
  </div>
  return (
    <div data-demand-summary className="w-full overflow-hidden rounded-lg border border-lps-hair bg-secondary/45 @container">
      <div className={cn('flex w-full flex-wrap items-center justify-between border-b border-lps-hair bg-card', collapseOnMobile && 'max-[899px]:grid max-[899px]:grid-cols-3')}>
        <div className={cn('flex items-center justify-center gap-1.5 px-3 py-2', collapseOnMobile && 'max-[899px]:flex-col max-[899px]:gap-0.5 max-[899px]:px-2')}>
          <span className="text-[12px] font-bold tabular-nums text-foreground">{itemCount}</span>
          <span className="whitespace-nowrap text-[11px] text-muted-foreground">
            Total {itemCount === 1 ? 'item' : 'items'}
          </span>
        </div>
        {collapseOnMobile && <div className="flex flex-col items-center gap-0.5 py-2 text-[11px] text-muted-foreground min-[900px]:hidden">
          <span className="text-[12px] font-bold tabular-nums text-foreground">{cells.find(cell => cell.value === '' || cell.value === 'pending')?.count ?? 0}</span>
          <span>Pending</span>
        </div>}
        <div className={cn('flex flex-wrap items-center justify-center gap-1.5 px-3 py-2', collapseOnMobile && 'max-[899px]:flex-col-reverse max-[899px]:gap-0.5 max-[899px]:px-2')}>
          <span className="text-[11px] text-muted-foreground">Subtotal</span>
          <span className="whitespace-nowrap text-[13px] font-bold tabular-nums text-foreground">
            {lineTotal == null ? '—' : money(lineTotal) || '$0.00'}
          </span>
        </div>
      </div>
      {collapseOnMobile ? <MobileDisclosure label="Counts by status">{statusCells}</MobileDisclosure> : statusCells}
    </div>
  )
}

/** `statuses` with `status` switched on or off — a count cell's click. */
export function toggleStatus(statuses: string[], status: string) {
  return statuses.includes(status) ? statuses.filter((s) => s !== status) : [...statuses, status]
}
