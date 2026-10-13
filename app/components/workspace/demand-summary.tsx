import { cn } from '@/lib/utils'
import { money } from '@/lib/format'

export type SummaryCell = { value: string; label: string; count: number; color: string }

/**
 * What a request is worth and where its lines stand — the one count strip of
 * the job's Request items tab, its AR tab and the supplier's AR page.
 *
 * Total items and Subtotal sit on top; under them every status is a cell of
 * equal height (number over name), zeros included but dimmed, so "nothing is
 * unavailable" and "nobody has looked yet" cannot render alike. Each cell
 * toggles a filter when `onToggleStatus` is given.
 */
export function DemandSummary({
  lineTotal,
  itemCount,
  cells,
  activeStatus = null,
  onToggleStatus,
}: {
  lineTotal: number | null
  itemCount: number
  cells: SummaryCell[]
  /** The status the lines are filtered to, highlighted; each count cell toggles its own. */
  activeStatus?: string | null
  onToggleStatus?: (status: string) => void
}) {
  return (
    <div data-demand-summary className="w-full overflow-hidden rounded-lg border border-lps-hair bg-secondary/45 @container">
      <div className="flex w-full flex-wrap items-center justify-between border-b border-lps-hair bg-card">
        <div className="flex items-center justify-center gap-1.5 px-3 py-2">
          <span className="text-[12px] font-bold tabular-nums text-foreground">{itemCount}</span>
          <span className="whitespace-nowrap text-[10.5px] text-muted-foreground">
            Total {itemCount === 1 ? 'item' : 'items'}
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-1.5 px-3 py-2">
          <span className="text-[10.5px] text-muted-foreground">Subtotal</span>
          <span className="whitespace-nowrap text-[12.5px] font-bold tabular-nums text-foreground">
            {lineTotal == null ? '—' : money(lineTotal) || '$0.00'}
          </span>
        </div>
      </div>
      <div className="grid w-full grid-cols-4 gap-px bg-lps-hair @[760px]:grid-cols-7 [&>button]:bg-card">
        {cells.map((c) => (
          <button
            key={c.value}
            type="button"
            aria-pressed={activeStatus === c.value}
            disabled={!onToggleStatus}
            onClick={() => onToggleStatus?.(c.value)}
            className={cn(
              'flex min-h-[52px] cursor-pointer flex-col items-center justify-center gap-0.5 border-none px-1 py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:cursor-default',
              activeStatus === c.value ? 'bg-primary/15 ring-1 ring-inset ring-primary' : 'enabled:hover:bg-muted',
              c.count === 0 && activeStatus !== c.value && 'opacity-45',
            )}
          >
            <span className="text-[15px] font-bold leading-none tabular-nums" style={{ color: c.color }}>{c.count}</span>
            <span className="min-w-0 break-words text-center text-[10.5px] leading-tight" style={{ color: c.color }}>{c.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
