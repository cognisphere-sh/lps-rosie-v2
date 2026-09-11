// The job-request status vocabulary, shared by the API route and the page.
//
// The database stores the statuses in `docs/supabase-schema.md`'s spelling; the
// Order Requests design names and colours them. This module is the one place
// the two are reconciled — add a status here and to the migration's CHECK, and
// nowhere else.

/** Selectable job stages. Existing stored values retain their history. */
export const REQUEST_STATUSES = [
  'sourcing',
  'quoted',
  'availability',
  'confirmed',
  'closed_won',
  'closed_lost',
] as const
export type RequestStatus = (typeof REQUEST_STATUSES)[number]

/** The existing open Job Request lifecycle shared by Jobs surfaces. */
export const ACTIVE_JOB_STATUSES = ['sourcing', 'quoted', 'availability', 'confirmed'] as const satisfies readonly RequestStatus[]
export const isActiveJobStatus = (status: string): status is (typeof ACTIVE_JOB_STATUSES)[number] =>
  (ACTIVE_JOB_STATUSES as readonly string[]).includes(status)

/**
 * `job_request_items.status` — the CHECK vocabulary, in picker order.
 * Existing alternative_proposed rows retain their stored value and notes.
 */
export const ITEM_STATUSES = [
  'available',
  'unavailable',
  'alternative_proposed',
  'need_to_order',
  'arriving_soon',
  'pending',
] as const
export type ItemStatus = (typeof ITEM_STATUSES)[number]

/**
 * The six colour tones the design defines. A tone is not a status: `partial` is
 * derived from availability (see `itemTone`), and two statuses can share one.
 */
export type Tone = 'green' | 'lime' | 'grey' | 'amber' | 'red' | 'teal'

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
  sourcing: { label: 'Active', tone: 'amber' },
  quoted: { label: 'Quote', tone: 'teal' },
  availability: { label: 'Availability', tone: 'lime' },
  confirmed: { label: 'Confirmed', tone: 'green' },
  closed_won: { label: 'Won', tone: 'green' },
  closed_lost: { label: 'Lost', tone: 'red' },
}

export const ITEM_STATUS_META: Record<ItemStatus, { label: string; tone: Tone }> = {
  pending: { label: 'Pending', tone: 'grey' },
  available: { label: 'Available', tone: 'green' },
  alternative_proposed: { label: 'Diff Sz/Qnty/Sub', tone: 'teal' },
  unavailable: { label: 'Unavailable', tone: 'red' },
  need_to_order: { label: 'Need to Order', tone: 'amber' },
  arriving_soon: { label: 'Arriving Soon', tone: 'lime' },
}

export const requestStatusLabel = (s: string) =>
  REQUEST_STATUS_META[s as RequestStatus]?.label ?? (s === 'archived' ? 'Archived' : s)
export const REQUEST_STATUS_TOKENS: Record<RequestStatus, string> = {
  sourcing: 'Act',
  quoted: 'Qte',
  availability: 'Avl',
  confirmed: 'Cfm',
  closed_won: 'Won',
  closed_lost: 'Lost',
}
export const requestStatusToken = (s: string) => REQUEST_STATUS_TOKENS[s as RequestStatus] ?? '?'
export const requestStatusTone = (s: string): Tone =>
  REQUEST_STATUS_META[s as RequestStatus]?.tone ?? 'grey'

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
    return { label: meta.label, tone: 'lime' }
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
