import { AR_RESPONSE_OPTIONS, arResponseTone } from '@/lib/availability'
import { toneDot } from '@/lib/job-requests'
import { money } from '@/lib/format'

/**
 * The answer strip: one cell per answer with its count in that answer's
 * accent, then the line count and the subtotal. A zero is drawn as a dash in the same accent rather than dropped.
 */
export function SummaryStrip({ items, subtotal, statusOptions = AR_RESPONSE_OPTIONS }: { items: { status: string | null }[]; subtotal: number | null; statusOptions?: readonly { label: string; value: string }[] }) {
  const cells = statusOptions.map((o) => ({
    label: o.label,
    value: items.filter((item) => (item.status ?? '') === o.value).length,
    color: toneDot(arResponseTone(o.value === 'need_to_order' ? 'can_order' : o.value === 'pending' ? null : o.value || null)),
  }))
  return (
    <div className="rounded-2xl border border-border bg-card px-4 py-5 md:px-6 md:py-6">
      <div className="grid grid-cols-3 items-end gap-x-2 gap-y-4 min-[900px]:grid-cols-8">
        {cells.map((c) => (
          <div key={c.label} className="flex min-w-0 flex-col items-center gap-2">
            <span className="text-center text-[11px] text-muted-foreground md:text-[12.5px]">{c.label}</span>
            <span className="text-[17px] font-semibold tabular-nums leading-none" style={{ color: c.color }}>
              {c.value || '-'}
            </span>
          </div>
        ))}
        <div className="flex flex-col gap-2 border-t border-border pt-3 min-[900px]:items-center min-[900px]:border-0 min-[900px]:pt-0">
          <span className="truncate text-[11px] text-muted-foreground md:text-[12.5px]">Total Items</span>
          <span className="text-[17px] font-semibold tabular-nums leading-none text-foreground">{items.length}</span>
        </div>
        <div className="col-span-2 flex min-w-0 flex-col items-end gap-2 border-t border-border pt-3 min-[900px]:col-span-1 min-[900px]:border-0 min-[900px]:pt-0">
          <span className="text-[10.5px] text-lps-dim">Subtotal</span>
          <span className="max-w-full break-words text-[20px] font-semibold tabular-nums leading-none text-foreground">
            {subtotal == null ? '—' : money(subtotal)}
          </span>
        </div>
      </div>
    </div>
  )
}

