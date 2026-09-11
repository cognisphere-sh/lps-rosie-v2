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
    Substituted: ['Diff Sz/Qnty/Sub'], 'Different Sz/Qnty/Sub': ['Diff Sz/Qnty/Sub'],
    Sourcing: ['Active'], New: ['Active'],
    Quoted: ['Quote'], 'Quote Delivered': ['Quote'], 'In Progress': ['Quote', 'Availability'],
    'Closed won': ['Won'], 'Closed Won': ['Won'], 'Closed lost': ['Lost'], 'Closed Lost': ['Lost'],
  }
  for (const value of stored) {
    if (typeof value !== 'string') continue
    for (const label of Object.hasOwn(legacy, value) ? legacy[value] : [value]) {
      if (allowed.has(label) && !normalized.includes(label)) normalized.push(label)
    }
  }
  // The old default selected every non-archived stage. Keep that intent when
  // adding Availability and Confirmed, instead of hiding those jobs. A saved
  // In Progress selection expands above and preserves any excluded Confirmed.
  const oldDefault = ['Active', 'Quote', 'Won', 'Lost']
  if (stored.some((value) => typeof value === 'string' && Object.hasOwn(legacy, value))
    && normalized.length === 4 && oldDefault.every((label) => normalized.includes(label))
    && allowed.has('Active') && allowed.has('Availability') && allowed.has('Confirmed')) return [...fallback]
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
