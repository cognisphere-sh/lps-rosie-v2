// The job-request status vocabulary, shared by the API route and the page.
//
// The database stores the statuses in `docs/supabase-schema.md`'s spelling; the
// Order Requests design names and colours them. This module is the one place
// the two are reconciled — add a status here and to the migration's CHECK, and
// nowhere else.

/** `job_requests.status` — the CHECK vocabulary, in lifecycle order. */
export const REQUEST_STATUSES = [
  'sourcing',
  'quoted',
  'closed_won',
  'closed_lost',
  'archived',
] as const
export type RequestStatus = (typeof REQUEST_STATUSES)[number]

/**
 * `job_request_items.status` — the CHECK vocabulary, in lifecycle order.
 *
 * Four words, since migration 0058: `pending` → `available`, with
 * `alternative_proposed` and `unavailable` as the other two endings. What is
 * being *done* about a pending line is not a status — it is the timestamped
 * `internal_notes` sourcing log, which also says what was found out.
 */
export const ITEM_STATUSES = [
  'pending',
  'available',
  'alternative_proposed',
  'unavailable',
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
  sourcing: { label: 'Sourcing', tone: 'amber' },
  quoted: { label: 'Quoted', tone: 'teal' },
  closed_won: { label: 'Closed won', tone: 'green' },
  closed_lost: { label: 'Closed lost', tone: 'red' },
  archived: { label: 'Archived', tone: 'grey' },
}

export const ITEM_STATUS_META: Record<ItemStatus, { label: string; tone: Tone }> = {
  pending: { label: 'Pending', tone: 'grey' },
  available: { label: 'Available', tone: 'green' },
  alternative_proposed: { label: 'Substituted', tone: 'teal' },
  unavailable: { label: 'Unavailable', tone: 'red' },
}

export const requestStatusLabel = (s: string) =>
  REQUEST_STATUS_META[s as RequestStatus]?.label ?? s
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
 * The design draws "Partial" as its own state, but partial-ness is a fact about
 * two numbers, not a status someone sets — so it is derived here. It only
 * overrides a status that claims the item is covered (`available`); an
 * explicitly `unavailable` line keeps its own word whatever the numbers say.
 */
export function itemPill(
  status: string,
  quantity: number | null,
  available: number | null,
): { label: string; tone: Tone } {
  const meta = ITEM_STATUS_META[status as ItemStatus] ?? { label: status, tone: 'grey' as Tone }
  if (status === 'available' && coverOf(quantity, available) === 'partial') {
    return { label: 'Partial', tone: 'lime' }
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
