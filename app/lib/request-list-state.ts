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

/**
 * Restore persisted display labels after the sales vocabulary changed.
 *
 * The stored filter intentionally remains label-based. Known
 * legacy labels migrate; malformed/unknown entries keep the old fail-closed
 * behavior, and mixed old/new copies collapse to one canonical selection.
 */
export function normalizeStoredRequestStatusLabels(
  stored: unknown,
  options: readonly RequestFilterOption[],
  fallback: readonly string[],
): string[] {
  if (!Array.isArray(stored)) return [...fallback]
  const allowed = new Set(options.map((option) => option.label))
  const normalized: string[] = []
  const legacy: Record<string, string[]> = {
    Substituted: ['Diff Sz/Sub'], 'Different Sz/Qnty/Sub': ['Diff Sz/Sub'], 'Diff Sz/Qnty/Sub': ['Diff Sz/Sub'],
    'Need to Order': ['Can Order'],
    Active: ['Quote'], Sourcing: ['Quote'], New: ['Quote'],
    Confirmed: ['Committed'],
    Quoted: ['Quote'], 'Quote Delivered': ['Quote'], 'In Progress': ['Quote', 'Availability'],
    'Closed won': ['Won'], 'Closed Won': ['Won'], 'Closed lost': ['Lost'], 'Closed Lost': ['Lost'],
  }
  for (const value of stored) {
    if (typeof value !== 'string') continue
    for (const label of Object.hasOwn(legacy, value) ? legacy[value] : [value]) {
      if (allowed.has(label) && !normalized.includes(label)) normalized.push(label)
    }
  }
  // Preserve a previously complete default when Committed replaces Active.
  const previousDefaults = [
    ['Active', 'Quote', 'Availability', 'Confirmed', 'Won', 'Lost'],
    ['Sourcing', 'Quoted', 'Availability', 'Confirmed', 'Closed won', 'Closed lost'],
    ['Sourcing', 'Quote Delivered', 'Closed won', 'Closed lost'],
    ['New', 'In Progress', 'Confirmed', 'Closed Won', 'Closed Lost'],
  ]
  if (previousDefaults.some((labels) => labels.length === stored.length
    && labels.every((label) => stored.includes(label)))) return [...fallback]
  return normalized
}

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
  itemStatusEmptyMeansNone = false,
}: {
  status: string[]
  itemStatus: string[]
  customer: string[]
  created: string[]
  updated: string[]
  customerIds: ReadonlyMap<string, number>
  requestStatusOptions: readonly RequestFilterOption[]
  itemStatusEmptyMeansNone?: boolean
  itemStatusOptions: readonly RequestFilterOption[]
}) {
  const params = new URLSearchParams()
  params.set('status', status.length ? valuesOf(status, requestStatusOptions).join(',') : 'none')
  if (itemStatusEmptyMeansNone && !itemStatus.length) params.set('itemStatus', 'none')
  else if (itemStatus.length && !(itemStatusEmptyMeansNone && itemStatusOptions.every((option) => itemStatus.includes(option.label)))) {
    params.set('itemStatus', valuesOf(itemStatus, itemStatusOptions).join(','))
  }
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
