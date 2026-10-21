import type { ReactNode } from 'react'
import { RecordLinkCard, RecordRow } from './record-row'
import { arSubtotal, type ARDetail } from '@/lib/availability'

/**
 * A request's list card (2026-10-21): the /requests job card's one row —
 * status, name, EDD, pickup/delivery, items, total — as the supplier's order
 * cards. The whole card opens the request's page; a request spanning jobs
 * lists each job's date and mode.
 */
export function PartnerRequestCardLayout({ request, href, name, status, label }: {
  request: ARDetail; href: string; name: string; status: ReactNode; label?: string
}) {
  const schedules = request.jobSchedules?.length ? request.jobSchedules : [{ expectedInstallDate: null, fulfillmentMethod: null }]
  return <RecordLinkCard href={href} label={label ?? name} data={{ 'data-request-row-status': request.status }}>
    <RecordRow id={request.id} status={<span className="inline-flex flex-none [&>span]:h-6 [&>span]:w-auto [&>span]:px-2.5 [&>span]:text-[12px] [&>span]:font-semibold">{status}</span>}
      identity={name} schedules={schedules.map((schedule) => ({ date: schedule.expectedInstallDate, method: schedule.fulfillmentMethod }))}
      count={request.items.length} total={arSubtotal(request.items)} />
  </RecordLinkCard>
}
