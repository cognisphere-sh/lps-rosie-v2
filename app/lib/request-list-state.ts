export interface RequestFilterOption {
  value: string
  label: string
}

export const REQUEST_DATE_RANGES = [
  { label: 'Today', days: 1 },
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 14 days', days: 14 },
  { label: 'Last 30 days', days: 30 },
] as const

const valuesOf = (labels: string[], options: readonly RequestFilterOption[]) =>
  labels.map((label) => options.find((option) => option.label === label)?.value).filter(Boolean) as string[]

const daysFor = (label: string) => REQUEST_DATE_RANGES.find((range) => range.label === label)?.days

/** Exact request-list API filter encoding shared by both responsive toolbar branches. */
export function buildRequestFilterQuery({
  status,
  itemStatus,
  customer,
  created,
  updated,
  customerIds,
  requestStatusOptions,
  itemStatusOptions,
}: {
  status: string[]
  itemStatus: string[]
  customer: string[]
  created: string[]
  updated: string[]
  customerIds: ReadonlyMap<string, number>
  requestStatusOptions: readonly RequestFilterOption[]
  itemStatusOptions: readonly RequestFilterOption[]
}) {
  const params = new URLSearchParams()
  if (status.length) params.set('status', valuesOf(status, requestStatusOptions).join(','))
  if (itemStatus.length) params.set('itemStatus', valuesOf(itemStatus, itemStatusOptions).join(','))
  if (customer.length) {
    params.set('customer', customer.map((name) => customerIds.get(name)).filter(Boolean).join(','))
  }
  if (created.length) params.set('created', String(daysFor(created[0]) ?? ''))
  if (updated.length) params.set('updated', String(daysFor(updated[0]) ?? ''))
  return params.toString()
}

/** Add broad search and the current server page without changing filter bytes. */
export function buildRequestListUrl(filters: string, query: string, page: number) {
  const params = new URLSearchParams(filters)
  params.set('q', query)
  params.set('page', String(page))
  return `/api/requests?${params.toString()}`
}
