import Link from 'next/link'
import type { CSSProperties, ReactNode } from 'react'
import { JobMetadata } from './job-metadata'
import { TruncatedText } from './truncated-text'
import { type ARDetail } from '@/lib/availability'
import { cn } from '@/lib/utils'

/**
 * The portal's list card, shared by requests and orders (2026-10-07): always
 * two rows — status and name, then date · item count · customer. Long text is
 * ellipsised with a "…" button for the rest. The whole card opens its page
 * through a stretched link *under* the content, so those buttons stay real
 * buttons rather than being nested inside a link.
 */
export function PartnerListCard({ href, label, status, name, date, count, customer, className, style, data }: {
  href: string; label: string; status: ReactNode; name: string; date: ReactNode; count: number
  customer: string | null; className?: string; style?: CSSProperties; data?: Record<string, string>
}) {
  return <article {...data} style={style}
    className={cn('relative flex flex-none flex-col gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2.5 shadow-sm transition-[background-color,box-shadow] duration-150 ease-lps hover:bg-lps-tint hover:shadow-md has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring', className)}>
    <Link href={href} aria-label={label} className="absolute inset-0 rounded-xl outline-none" />
    <div className="pointer-events-none relative flex min-w-0 items-center gap-2">
      <span className="inline-flex flex-none [&>span]:h-6 [&>span]:w-auto [&>span]:px-2 [&>span]:text-[11px]">{status}</span>
      <TruncatedText text={name} label="name" className="flex-1 text-[13px] font-semibold text-foreground max-[899px]:text-[14px]" />
    </div>
    <div className="pointer-events-none relative flex min-w-0 items-center gap-2 text-[12px] text-muted-foreground">
      <span className="flex flex-none items-center">{date}</span>
      <span aria-hidden="true">·</span>
      <span className="flex-none whitespace-nowrap">{count} {count === 1 ? 'item' : 'items'}</span>
      {customer && <>
        <span aria-hidden="true">·</span>
        <TruncatedText text={customer} label="customer name" className="flex-1 font-semibold text-foreground" />
      </>}
    </div>
  </article>
}

/** A request's list card: its EDD pill per linked job as the date. */
export function PartnerRequestCardLayout({ request, href, name, status, className, style, label }: {
  request: ARDetail; href: string; name: string; status: ReactNode
  className?: string; style?: CSSProperties; label?: string
}) {
  const schedules = request.jobSchedules?.length ? request.jobSchedules : [{ expectedInstallDate: null, fulfillmentMethod: null }]
  return <PartnerListCard href={href} label={label ?? name} status={status} name={name} count={request.items.length}
    customer={request.customer?.company || request.customer?.name || null} className={className} style={style}
    data={{ 'data-request-row-status': request.status }}
    date={<div aria-label="Job schedules" className="inline-flex items-center gap-x-2">
      {schedules.map((schedule, index) => <div key={index} className="inline-flex items-center gap-1">
        {schedules.length > 1 && <span>Job {index + 1}</span>}
        <JobMetadata request={{ id: index, expectedInstallDate: schedule.expectedInstallDate, fulfillmentMethod: schedule.fulfillmentMethod }} showFulfillment={false} className="grid-cols-[max-content]" />
      </div>)}
    </div>} />
}
