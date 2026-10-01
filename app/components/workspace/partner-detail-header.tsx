import { formatWeekdayMonthDay } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

export type PartnerContact = { name: string | null; company: string | null; phone: string | null; email: string | null }

/** Shared order/request identity, fulfillment and customer information. */
export function PartnerDetailHeader({ name, status, schedule, contacts = [], note, children }: {
  name: string
  status: ReactNode
  schedule: ReactNode
  contacts?: { customer: PartnerContact | null; address: string | null; jobName?: string | null }[]
  note?: string | null
  children?: ReactNode
}) {
  return <section aria-label="Job details" className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-3">
    {/* Equal side columns keep the job name centred in the row, whatever the status and schedule widths. */}
    <header className="grid min-w-0 items-center gap-2 rounded-xl bg-secondary/60 px-3 py-2.5 sm:grid-cols-[minmax(max-content,1fr)_minmax(0,2fr)_minmax(max-content,1fr)] sm:gap-3">
      <div className="justify-self-start">{status}</div>
      <h1 className="m-0 min-w-0 text-center text-[18px] font-semibold leading-6 [overflow-wrap:anywhere]">{name}</h1>
      <div className="min-w-0 sm:justify-self-end">{schedule}</div>
    </header>
    <div className="space-y-4 px-2 pb-1">
      {contacts.map(({ customer, address, jobName }, index) => <div key={index} className="grid gap-4 sm:grid-cols-2">
        {jobName && contacts.length > 1 && <p className="m-0 font-semibold sm:col-span-2">{jobName}</p>}
        <div className="space-y-1"><div className="text-[10.5px] text-lps-dim">Contact</div><div className="flex flex-wrap gap-x-3 gap-y-1 text-[13px] [overflow-wrap:anywhere]">{customer ? <><span>{[customer.company, customer.name].filter(Boolean).join(' · ')}</span>{customer.phone && <a href={`tel:${customer.phone}`}>{customer.phone}</a>}{customer.email && <a href={`mailto:${customer.email}`}>{customer.email}</a>}</> : 'Not provided'}</div></div>
        <div className="space-y-1 sm:text-right"><div className="text-[10.5px] text-lps-dim">Delivery address</div><p className="m-0 whitespace-pre-wrap text-[13px] [overflow-wrap:anywhere]">{address || 'Not provided'}</p></div>
      </div>)}
      {note && <div className="space-y-1"><div className="text-[10.5px] text-lps-dim">Notes for supplier</div><p className="m-0 whitespace-pre-wrap text-[13px] [overflow-wrap:anywhere]">{note}</p></div>}
      {children}
    </div>
  </section>
}

export function PartnerFulfillment({ method, date }: { method: string | null; date: string | null }) {
  return <div className="flex flex-wrap items-center gap-2 text-[12px]">
    <span className={cn('rounded-full border px-2.5 py-1 font-medium', method === 'delivery' ? 'border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-300' : 'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300')}>{method === 'delivery' ? 'Delivery' : method === 'pickup' ? 'Pickup' : 'Mode to be confirmed'}</span>
    <span className="text-muted-foreground">{formatWeekdayMonthDay(date) || 'Date to be confirmed'}</span>
  </div>
}
