/** Tables contributing to a job's detail, line totals and supplier links. */
export const JOB_REALTIME_TABLES = [
  'job_requests',
  'job_request_items',
  'availability_requests',
  'candidates',
  'orders',
  'order_items',
  'order_item_job_request_items',
  'customers',
  'suppliers',
] as const

/** Invalidate saved job data; never send raw records or public-link tokens. */
export interface JobEvent { type: 'jobs' }

export function isJobEvent(value: unknown): value is JobEvent {
  return typeof value === 'object' && value !== null && 'type' in value && value.type === 'jobs'
}
