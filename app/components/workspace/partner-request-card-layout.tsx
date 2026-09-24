import Link from 'next/link'
import type { CSSProperties, ReactNode } from 'react'
import { JobMetadata } from './job-metadata'
import { arSubtotal, type ARDetail } from '@/lib/availability'
import { money } from '@/lib/format'
import { cn } from '@/lib/utils'

/** Compact job-card layout, with the same read-only EDD pill as job requests. */
export function PartnerRequestCardLayout({ request, href, name, status, className, style, label }: {
  request: ARDetail; href: string; name: string; status: ReactNode
  className?: string; style?: CSSProperties; label?: string
}) {
  const schedules = request.jobSchedules?.length ? request.jobSchedules : [{ expectedInstallDate: null, fulfillmentMethod: null }]
  const total = arSubtotal(request.items)
  const customer = request.customer?.company || request.customer?.name
  const locality = [request.shipping?.city, request.shipping?.state].filter(Boolean).join(', ')
  const note = request.noteForSupplier?.trim()
  return <Link href={href} aria-label={label} data-request-row-status={request.status} style={style}
    className={cn('flex flex-none flex-col gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2.5 no-underline shadow-sm transition-shadow hover:bg-lps-tint hover:shadow-md', className)}>
    <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
      <span className="inline-flex [&>span]:h-6 [&>span]:w-auto [&>span]:px-2 [&>span]:text-[11px]">{status}</span>
      <span className="min-w-0 max-w-full truncate text-[12.5px] font-semibold text-foreground">{name}</span>
      <div aria-label="Job schedules" className="inline-flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
        {schedules.map((schedule, index) => <div key={index} className="inline-flex items-center gap-1.5">
          {schedules.length > 1 && <span className="text-[11px] text-muted-foreground">Job {index + 1}</span>}
          <JobMetadata request={{ id: index, expectedInstallDate: schedule.expectedInstallDate, fulfillmentMethod: schedule.fulfillmentMethod }} showFulfillment={false} className="grid-cols-[max-content]" />
          {schedules.length > 1 && <PartnerCardFulfillment method={schedule.fulfillmentMethod} />}
        </div>)}
      </div>
      <span className="ml-auto flex items-center gap-2 whitespace-nowrap text-[11px] text-muted-foreground">
        {schedules.length === 1 && <><PartnerCardFulfillment method={schedules[0].fulfillmentMethod} /><span aria-hidden="true">:</span></>}
        <span>{request.items.length} {request.items.length === 1 ? 'item' : 'items'}</span><span aria-hidden="true">:</span>
        <span className="font-semibold tabular-nums text-foreground">{total == null ? '—' : money(total)}</span>
      </span>
    </div>
    {(customer || locality || note) && <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
      {customer && <span className="font-semibold text-foreground">{customer}</span>}{locality && <span>{locality}</span>}
      {note && <span title={note} className="whitespace-pre-wrap [overflow-wrap:anywhere]">{note}</span>}
    </div>}
  </Link>
}

export function PartnerCardFulfillment({ method }: { method: string | null }) {
  return <span className="inline-flex items-center rounded-full border border-lps-edge bg-card px-2 py-0.5 text-[10.5px] font-semibold text-primary">{method === 'pickup' ? 'Pickup' : method === 'delivery' ? 'Delivery' : '—'}</span>
}
