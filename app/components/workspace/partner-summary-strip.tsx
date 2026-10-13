import { AR_RESPONSE_OPTIONS, arResponseTone, arShownStatus } from '@/lib/availability'
import { toneDot } from '@/lib/job-requests'
import { DemandSummary } from './demand-summary'

/**
 * The AR/order answer counts, drawn by the same `DemandSummary` as the job's
 * Request items tab. An AR line that is Unavailable with a substitute counts as
 * Diff Sz/Sub.
 */
export function SummaryStrip({ items, subtotal, statusOptions = AR_RESPONSE_OPTIONS, activeStatus = null, onToggleStatus }: { activeStatus?: string | null; onToggleStatus?: (status: string) => void; items: { status: string | null; offeredCandidateId?: number | null; offerDescription?: string | null }[]; subtotal: number | null; statusOptions?: readonly { label: string; value: string }[] }) {
  const cells = statusOptions.map((o) => ({
    value: o.value,
    label: o.label,
    count: items.filter((item) => (arShownStatus(item) ?? '') === o.value).length,
    color: toneDot(arResponseTone(o.value === 'need_to_order' ? 'can_order' : o.value === 'pending' ? null : o.value || null)),
  }))
  return <DemandSummary lineTotal={subtotal} itemCount={items.length} cells={cells} activeStatus={activeStatus} onToggleStatus={onToggleStatus} />
}
