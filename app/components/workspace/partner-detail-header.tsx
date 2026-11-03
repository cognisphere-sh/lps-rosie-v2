import { formatWeekdayMonthDay } from '@/lib/format'
import type { ReactNode } from 'react'
import { MobileDisclosure } from './mobile-disclosure'

export type PartnerContact = { name: string | null; company: string | null; phone: string | null; email: string | null }

/** One labelled row of the details list: label at the left, value beside it. */
function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return <div className="grid grid-cols-[6rem_minmax(0,1fr)] items-baseline gap-x-3 border-t border-lps-hair py-2.5 first:border-t-0">
    <dt className="text-[11px] text-lps-dim">{label}</dt>
    <dd className="m-0 min-w-0 text-[13px] [overflow-wrap:anywhere]">{children}</dd>
  </div>
}

/**
 * Shared order/request identity, fulfillment and customer information
 * (2026-10-07). The header is two rows — the name (status at its right), then
 * mode at the left and date at the right — and the details are three rows:
 * Contact, Delivery address, and Note for supplier where there is one.
 */
export function PartnerDetailHeader({ name, status, schedule, contacts = [], note, children, collapseDetailsOnMobile = false }: {
  name: string
  status: ReactNode
  schedule: ReactNode
  contacts?: { customer: PartnerContact | null; address: string | null; jobName?: string | null }[]
  note?: string | null
  children?: ReactNode
  collapseDetailsOnMobile?: boolean
}) {
  const details = <div className="flex flex-col gap-2 px-3 pb-1">
    {contacts.map(({ customer, address, jobName }, index) => <div key={index}>
      {jobName && contacts.length > 1 && <p className="m-0 pb-1 text-[13px] font-semibold">{jobName}</p>}
      <dl className="m-0">
        <DetailRow label="Contact">
          {customer ? <span className="flex flex-wrap gap-x-3 gap-y-1">
            <span>{[customer.company, customer.name].filter(Boolean).join(' · ')}</span>
            {customer.phone && <a href={`tel:${customer.phone}`}>{customer.phone}</a>}
            {customer.email && <a href={`mailto:${customer.email}`}>{customer.email}</a>}
          </span> : 'Not provided'}
        </DetailRow>
        <DetailRow label="Delivery address"><span className="whitespace-pre-wrap">{address || 'Not provided'}</span></DetailRow>
        {note && index === contacts.length - 1 && <DetailRow label="Note for supplier"><span className="whitespace-pre-wrap">{note}</span></DetailRow>}
      </dl>
    </div>)}
    {note && contacts.length === 0 && <dl className="m-0"><DetailRow label="Note for supplier"><span className="whitespace-pre-wrap">{note}</span></DetailRow></dl>}
    {children}
  </div>
  return <section aria-label="Job details" className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-3">
    <header className="flex flex-col gap-2 rounded-xl bg-secondary/60 px-3 py-2.5">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <h1 className="m-0 min-w-0 text-[18px] font-semibold leading-6 [overflow-wrap:anywhere]">{name}</h1>
        <div className="flex-none">{status}</div>
      </div>
      {schedule}
    </header>
    {(contacts.length > 0 || note || children) && (collapseDetailsOnMobile
      ? <MobileDisclosure label="Customer details">{details}</MobileDisclosure>
      : details)}
  </section>
}

/** A schedule as the header's second row: mode at the left, date at the right. */
export function PartnerFulfillment({ method, date, job }: { method: string | null; date: string | null; job?: string }) {
  return <div className="flex min-w-0 items-center justify-between gap-2 text-[12px]">
    <span className="flex min-w-0 items-center gap-2">
      {job && <span className="text-muted-foreground">{job}</span>}
      <span className="rounded-full border border-lps-edge bg-card px-2.5 py-1 font-semibold text-primary">{method === 'delivery' ? 'Delivery' : method === 'pickup' ? 'Pickup' : 'Mode to be confirmed'}</span>
    </span>
    <span className="flex-none text-right text-muted-foreground">{formatWeekdayMonthDay(date) || 'Date to be confirmed'}</span>
  </div>
}
