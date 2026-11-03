import { AR_RESPONSE_OPTIONS, arResponseTone, arShownStatus } from '@/lib/availability'
import { toneStyle } from '@/lib/job-requests'
import { DemandSummary } from './demand-summary'

/**
 * The AR/order answer counts, drawn by the same `DemandSummary` as the job's
 * Request items tab. An AR line that is Unavailable with a substitute counts as
 * Diff Sz/Sub.
 */
export function SummaryStrip({ items, subtotal, statusOptions = AR_RESPONSE_OPTIONS, activeStatuses = [], onToggleStatus, collapseOnMobile = false }: { collapseOnMobile?: boolean; activeStatuses?: readonly string[]; onToggleStatus?: (status: string) => void; items: { status: string | null; offeredCandidateId?: number | null; offerDescription?: string | null }[]; subtotal: number | null; statusOptions?: readonly { label: string; value: string }[] }) {
  const cells = statusOptions.map((o) => ({
    value: o.value,
    label: o.label,
    count: items.filter((item) => (arShownStatus(item) ?? '') === o.value).length,
    color: toneStyle(arResponseTone(o.value === 'need_to_order' ? 'can_order' : o.value === 'pending' ? null : o.value || null)).color,
  }))
  return <DemandSummary lineTotal={subtotal} itemCount={items.length} cells={cells} activeStatuses={activeStatuses} onToggleStatus={onToggleStatus} collapseOnMobile={collapseOnMobile} />
}
