import Link from 'next/link'
import type { ReactNode } from 'react'
import { JobMetadata } from './job-metadata'
import { formatWeekdayMonthDay, money } from '@/lib/format'
import { cn } from '@/lib/utils'

/** The card the /requests job card is drawn in, shared by orders and ARs. */
export const recordCard = 'flex-none overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md'

/** Pickup or Delivery as the job card's pill; nothing when not yet set. */
export function MethodPill({ method }: { method: 'pickup' | 'delivery' | null | undefined }) {
  return method ? <span className="inline-flex items-center whitespace-nowrap rounded-full border border-lps-edge bg-card px-2 py-0.5 text-[11px] font-semibold text-primary">
    {method === 'pickup' ? 'Pickup' : 'Delivery'}
  </span> : null
}

/**
 * A record as one row of the /requests job card's grid (2026-10-21), for
 * orders (Chris's card, the supplier's list and page) and the supplier's AR
 * cards: [leading] | status | identity | EDD | pickup/delivery | items | total
 * | [actions]. The status column fits its pill (the job card's 7.25rem left a
 * wide gap); with no leading control the pill spans that column too. Phones:
 * status and actions, then the identity, then EDD · mode · items · total. A
 * request spanning jobs stacks one EDD and one mode per job, in job order.
 */
export function RecordRow({ id, status, identity, createdAt, schedules, count, total, leading, actions, className }: {
  id: number; status: ReactNode; identity: ReactNode; createdAt?: string | null
  schedules: { date: string | null; method: 'pickup' | 'delivery' | null | undefined }[]; count: number; total: number | null
  leading?: ReactNode; actions?: ReactNode; className?: string
}) {
  return <header className={cn('grid grid-cols-[auto_auto_auto_1fr] items-center gap-x-2.5 gap-y-1.5 px-3.5 py-2.5 transition-colors duration-150 hover:bg-lps-tint min-[900px]:grid-cols-[auto_max-content_minmax(0,24rem)_5.75rem_4.5rem_4rem_5rem_minmax(max-content,1fr)] min-[900px]:gap-x-3', className)}>
    <span className="col-span-3 col-start-1 row-start-1 flex min-w-0 items-center gap-2.5 min-[900px]:contents">
      {leading}
      <span className={cn('flex min-w-0 items-center min-[900px]:row-start-1', leading ? 'min-[900px]:col-start-2' : 'min-[900px]:col-span-2 min-[900px]:col-start-1')}>{status}</span>
    </span>
    <span className="col-span-4 col-start-1 row-start-2 min-w-0 truncate text-[14px] font-semibold text-foreground max-[899px]:line-clamp-2 max-[899px]:whitespace-normal min-[900px]:col-start-3 min-[900px]:col-end-4 min-[900px]:row-start-1 min-[900px]:pr-3" title={createdAt !== undefined ? `Created ${formatWeekdayMonthDay(createdAt) || '—'}` : undefined}>
      {identity}
    </span>
    {actions && <div className="col-start-4 row-start-1 flex items-center gap-1 justify-self-end min-[900px]:col-start-8">{actions}</div>}
    <div aria-label="Job schedules" className="col-start-1 row-start-3 flex flex-col gap-1 min-[900px]:col-start-4 min-[900px]:row-start-1">
      {schedules.map((schedule, index) => <JobMetadata key={index} request={{ id, expectedInstallDate: schedule.date, fulfillmentMethod: null }} showFulfillment={false} className="grid-cols-[max-content]" />)}
    </div>
    <span className="col-start-2 row-start-3 flex min-w-0 flex-col items-start gap-1 text-[12px] min-[900px]:col-start-5 min-[900px]:row-start-1">
      {schedules.map((schedule, index) => <MethodPill key={index} method={schedule.method} />)}
    </span>
    <span className="col-start-3 row-start-3 whitespace-nowrap text-[12px] text-muted-foreground min-[900px]:col-start-6 min-[900px]:row-start-1">{count} {count === 1 ? 'item' : 'items'}</span>
    <span className="col-start-4 row-start-3 justify-self-start whitespace-nowrap text-[12px] font-semibold tabular-nums text-foreground min-[900px]:col-start-7 min-[900px]:row-start-1 min-[900px]:justify-self-end">{money(total) || '$0.00'}</span>
  </header>
}

/** A row card that opens its page: the whole card is a stretched link over the row. */
export function RecordLinkCard({ href, label, data, children }: { href: string; label: string; data?: Record<string, string>; children: ReactNode }) {
  return <article {...data} className={cn(recordCard, 'relative transition-[background-color,box-shadow] hover:bg-lps-tint has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring')}>
    <Link href={href} aria-label={label} className="absolute inset-0 z-10 rounded-xl outline-none" />
    {children}
  </article>
}
