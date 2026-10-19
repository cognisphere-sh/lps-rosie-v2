// The job-request status vocabulary, shared by the API route and the page.
//
// The database stores the statuses in `docs/supabase-schema.md`'s spelling; the
// Order Requests design names and colours them. This module is the one place
// the two are reconciled — add a status here and to the migration's CHECK, and
// nowhere else.

/** Selectable job stages. Supplier confirmation belongs to Orders. */
export const REQUEST_STATUSES = [
  'quoted',
  'availability',
  'committed',
  'closed_won',
  'closed_lost',
] as const
export type RequestStatus = (typeof REQUEST_STATUSES)[number]

/** The existing open Job Request lifecycle shared by Jobs surfaces. */
export const ACTIVE_JOB_STATUSES = ['quoted', 'availability', 'committed'] as const satisfies readonly RequestStatus[]
export const isActiveJobStatus = (status: string): status is (typeof ACTIVE_JOB_STATUSES)[number] =>
  (ACTIVE_JOB_STATUSES as readonly string[]).includes(status)

/**
 * A line's status: its selected candidate's (`job_lines.candidate_status`,
 * 0137), in picker order. Edits go through `update_job_line`.
 */
export const ITEM_STATUSES = [
  'available',
  'partial_qty',
  'unavailable',
  'diff_size_sub',
  'need_to_order',
  'arriving_soon',
  'pending',
] as const
export type ItemStatus = (typeof ITEM_STATUSES)[number]

/** A candidate's stored status in the line vocabulary: unanswered is Pending, Can Order is Need to Order. */
export const itemStatusOf = (candidateStatus: string | null): string =>
  candidateStatus == null ? 'pending' : candidateStatus === 'can_order' ? 'need_to_order' : candidateStatus

/** PostgREST `or` filter on `job_lines.candidate_status` for these line statuses (unknown ones are dropped). */
export function candidateStatusFilter(statuses: readonly string[]): string {
  const known = statuses.filter((s): s is ItemStatus => (ITEM_STATUSES as readonly string[]).includes(s))
  const stored = known.filter((s) => s !== 'pending').map((s) => (s === 'need_to_order' ? 'can_order' : s))
  return [
    ...(known.includes('pending') ? ['candidate_status.is.null'] : []),
    ...(stored.length ? [`candidate_status.in.(${stored.join(',')})`] : []),
  ].join(',')
}

/**
 * The colour tones the design defines. A tone is not a status: an Available
 * line short of demand is tinted like Partial Qty (see `itemPill`).
 */
export type Tone = 'green' | 'lime' | 'grey' | 'amber' | 'red' | 'teal' | 'yellow' | 'orange' | 'blue' | 'purple'

/** Inline styles rather than classes: Tailwind cannot see a runtime tone name. */
export function toneStyle(tone: Tone) {
  return {
    background: `var(--lps-tone-${tone}-bg)`,
    color: `var(--lps-tone-${tone}-fg)`,
  }
}
export const toneDot = (tone: Tone) => `var(--lps-tone-${tone}-dot)`

/**
 * The design's row tint — the pill's own background, thinned.
 *
 * A pill is a small shape and can carry a full-strength wash; a whole table row
 * cannot, so the design draws it at about a third. `color-mix` keeps that one
 * rule here rather than doubling every tone token with a faded twin.
 */
export const toneTint = (tone: Tone) =>
  `color-mix(in srgb, var(--lps-tone-${tone}-bg) 40%, transparent)`

export const REQUEST_STATUS_META: Record<RequestStatus, { label: string; tone: Tone }> = {
  committed: { label: 'Committed', tone: 'amber' },
  quoted: { label: 'Quote', tone: 'teal' },
  availability: { label: 'Availability', tone: 'lime' },
  closed_won: { label: 'Won', tone: 'green' },
  closed_lost: { label: 'Lost', tone: 'red' },
}

export const ITEM_STATUS_META: Record<ItemStatus, { label: string; tone: Tone }> = {
  pending: { label: 'Pending', tone: 'grey' },
  available: { label: 'Available', tone: 'green' },
  partial_qty: { label: 'Partial Qty', tone: 'yellow' },
  diff_size_sub: { label: 'Diff Sz/Sub', tone: 'purple' },
  unavailable: { label: 'Unavailable', tone: 'red' },
  need_to_order: { label: 'Can Order', tone: 'orange' },
  arriving_soon: { label: 'Arriving Soon', tone: 'lime' },
}

/** Read compatibility for saved job filters/rows from before migration 0093. */
export const canonicalRequestStatus = (status: string): string => status === 'confirmed' ? 'committed' : status
export const requestStatusLabel = (s: string) =>
  REQUEST_STATUS_META[canonicalRequestStatus(s) as RequestStatus]?.label ?? (s === 'archived' ? 'Archived' : s)
export const REQUEST_STATUS_TOKENS: Record<RequestStatus, string> = {
  committed: 'Cmt',
  quoted: 'Qte',
  availability: 'Avl',
  closed_won: 'Won',
  closed_lost: 'Lost',
}
export const requestStatusToken = (s: string) => REQUEST_STATUS_TOKENS[canonicalRequestStatus(s) as RequestStatus] ?? '?'
export const requestStatusTone = (s: string): Tone =>
  REQUEST_STATUS_META[canonicalRequestStatus(s) as RequestStatus]?.tone ?? 'grey'

/** What the quantity pair says on its own, independent of the stored status. */
export type Cover = 'unanswered' | 'none' | 'partial' | 'full'

export function coverOf(quantity: number | null, available: number | null): Cover {
  if (available == null) return 'unanswered'
  if (available <= 0) return 'none'
  if (quantity != null && available < quantity) return 'partial'
  return 'full'
}

/**
 * The pill an item shows.
 *
 * Quantity coverage can tint Available, while its label remains the saved
 * status. The quantity cells show the shortfall separately.
 */
export function itemPill(
  status: string,
  quantity: number | null,
  available: number | null,
): { label: string; tone: Tone } {
  const meta = ITEM_STATUS_META[status as ItemStatus] ?? { label: status, tone: 'grey' as Tone }
  if (status === 'available' && coverOf(quantity, available) === 'partial') {
    return { label: meta.label, tone: 'yellow' }
  }
  return meta
}

/** The colour the Avail figure itself takes — green covered, amber short, red none. */
export function coverColor(cover: Cover): string {
  if (cover === 'unanswered') return 'var(--lps-dim)'
  if (cover === 'none') return 'var(--lps-tone-red-fg)'
  if (cover === 'partial') return 'var(--lps-tone-amber-fg)'
  return 'var(--foreground)'
}

/** Filter option lists, label/value pairs for the toolbar chips. */
export const REQUEST_STATUS_OPTIONS = REQUEST_STATUSES.map((v) => ({
  value: v,
  label: REQUEST_STATUS_META[v].label,
}))
export const ITEM_STATUS_OPTIONS = ITEM_STATUSES.map((v) => ({
  value: v,
  label: ITEM_STATUS_META[v].label,
}))

/** `JR-1042` — the design's order id, over our bigint primary key. */
export const requestRef = (id: number) => `JR-${id}`
