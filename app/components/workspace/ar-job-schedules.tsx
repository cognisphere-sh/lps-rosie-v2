import type { ARJobSchedule } from '@/lib/availability'
import { formatMonthDay } from '@/lib/format'
import { requestRef } from '@/lib/job-requests'

/** A combined request keeps dates paired with each job's fulfillment method. */
export function ARJobSchedules({ schedules, showJobNames = false, showFulfillmentMethod = true }: {
  schedules?: ARJobSchedule[]
  showJobNames?: boolean
  showFulfillmentMethod?: boolean
}) {
  const rows: ARJobSchedule[] = schedules?.length ? schedules : [{ expectedInstallDate: null, fulfillmentMethod: null }]
  return (
    <div className="inline-flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[11px]" aria-label="Job schedules">
      {rows.map((schedule, index) => (
        <div key={schedule.jobRequestId ?? index} className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
          {rows.length > 1 && (
            <span className="break-words font-semibold text-foreground">
              {showJobNames
                ? schedule.jobName || (schedule.jobRequestId != null ? requestRef(schedule.jobRequestId) : `Job ${index + 1}`)
                : `Job ${index + 1}`}
            </span>
          )}
          <dl className="m-0 inline-flex min-w-0 flex-wrap gap-x-3 gap-y-1">
            <div className="flex items-baseline gap-1 whitespace-nowrap">
              <dt className="text-muted-foreground">EDD</dt>
              <dd className="m-0 font-semibold tabular-nums text-foreground">{formatMonthDay(schedule.expectedInstallDate) || '—'}</dd>
            </div>
            {showFulfillmentMethod && <div className="flex items-baseline gap-1 whitespace-nowrap">
              <dt className="text-muted-foreground">Fulfillment</dt>
              <dd className="m-0 font-semibold text-foreground">
                {schedule.fulfillmentMethod === 'pickup' ? 'Pickup' : schedule.fulfillmentMethod === 'delivery' ? 'Delivery' : '—'}
              </dd>
            </div>}
          </dl>
        </div>
      ))}
    </div>
  )
}
