import { formatMonthDay } from '@/lib/format'
import type { JobRequestRow } from '@/lib/rows'
import { cn } from '@/lib/utils'

export function JobMetadata({ request, className }: {
  request: Pick<JobRequestRow, 'createdAt' | 'expectedInstallDate' | 'fulfillmentMethod'>
  className?: string
}) {
  const fields = [
    ['Created on', formatMonthDay(request.createdAt) || '—'],
    ['EDD', formatMonthDay(request.expectedInstallDate) || '—'],
    ['Fulfillment', request.fulfillmentMethod === 'pickup' ? 'Pickup' : request.fulfillmentMethod === 'delivery' ? 'Delivery' : '—'],
  ]

  return (
    <dl data-job-metadata className={cn('m-0 flex min-w-0 flex-wrap gap-x-3 gap-y-1 text-[11px]', className)}>
      {fields.map(([label, value]) => (
        <div key={label} className="flex items-baseline gap-1 whitespace-nowrap">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="m-0 font-semibold tabular-nums text-foreground">{value}</dd>
        </div>
      ))}
    </dl>
  )
}
