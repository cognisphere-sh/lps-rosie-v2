// The availability-request vocabulary, shared by the admin app, the supplier
// portal and the API routes — the same reconciliation `lib/job-requests.ts`
// does for job requests, over migration 0062's tables.

import type { Tone } from '@/lib/job-requests'

/** `availability_requests.status` — the CHECK vocabulary, in lifecycle order. */
export const AR_STATUSES = ['new', 'processing', 'submitted', 'closed'] as const
export type ARStatus = (typeof AR_STATUSES)[number]

// The portal's three working states, plus the admin's terminal one. `new` is
// re-set whenever a line is added to a request the supplier already worked on
// (migration 0075's trigger), so the ask goes back to the top of their New tab;
// `processing` is any answer they have made since; `submitted` is the button.
export const AR_STATUS_META: Record<ARStatus, { label: string; tone: Tone }> = {
  new: { label: 'New', tone: 'amber' },
  processing: { label: 'Processing', tone: 'teal' },
  submitted: { label: 'Submitted', tone: 'green' },
  closed: { label: 'Closed', tone: 'grey' },
}

export const arStatusLabel = (s: string) => AR_STATUS_META[s as ARStatus]?.label ?? s
export const arStatusTone = (s: string): Tone => AR_STATUS_META[s as ARStatus]?.tone ?? 'grey'

/** The existing lifecycle state the admin UI may safely call submitted. */
export const isSubmittedARStatus = (status: string) => status === 'submitted'

/** The AR segment's accessible name, including the state its visible indicator conveys. */
export function availabilityRequestLinkLabel(
  id: number,
  supplierName: string,
  status: string,
): string {
  const base = `Open availability request AR-${id} to ${supplierName}`
  return isSubmittedARStatus(status) ? `${base} — Submitted` : base
}

/**
 * `availability_request_items.status` — the supplier's answer, in the order the
 * portal's picker offers it. NULL is a real state (not answered yet) and
 * renders as "Set status".
 *
 * `diff_size_qty_sub` was `substitute` until migration 0076: the answer covers
 * a different size or quantity as well as a different plant, so the stored
 * value was renamed with the label rather than left disagreeing with it.
 */
export const AR_RESPONSES = [
  'available',
  'can_order',
  'diff_size_qty_sub',
  'arriving_soon',
  'unavailable',
] as const
export type ARResponse = (typeof AR_RESPONSES)[number]

// Tones come from the design's existing six — no new colour was introduced for
// the two new answers. `diff_size_qty_sub` keeps the teal `substitute` already
// had, and `arriving_soon` takes `lime`, the one tone nothing else was using
// (`grey` is not free: it is what an unanswered line reads as).
export const AR_RESPONSE_META: Record<ARResponse, { label: string; tone: Tone }> = {
  available: { label: 'Available', tone: 'green' },
  can_order: { label: 'Can order', tone: 'amber' },
  diff_size_qty_sub: { label: 'Diff Size/Qty/Sub', tone: 'teal' },
  arriving_soon: { label: 'Arriving soon', tone: 'lime' },
  unavailable: { label: 'Unavailable', tone: 'red' },
}

export const arResponseLabel = (s: string | null) =>
  s == null ? 'Set status' : AR_RESPONSE_META[s as ARResponse]?.label ?? s
export const arResponseTone = (s: string | null): Tone =>
  s == null ? 'grey' : AR_RESPONSE_META[s as ARResponse]?.tone ?? 'grey'

export const AR_RESPONSE_OPTIONS = AR_RESPONSES.map((v) => ({
  value: v,
  label: AR_RESPONSE_META[v].label,
}))

/** One line shared with the supplier, with their answer. */
export interface ARItem {
  id: number
  jobRequestItemId: number | null
  /** The ask, snapshotted at share time — a later job edit never rewrites it. */
  name: string
  size: string | null
  quantity: number | null
  /** The supplier's answer; null = not answered yet. */
  status: string | null
  availableQuantity: number | null
  unitPrice: number | null
  notes: string | null
  /** LPS's brief note to the supplier — e.g. the mapped substitute. Ours, never theirs to edit. */
  lpsNotes: string | null
}

/**
 * What a line comes to — the supplier's quantity × their price. Null until
 * both halves of the answer exist: a priced line with no quantity, or a
 * quantity with no price, is an unfinished answer, not a $0 one.
 */
export function arLineTotal(item: ARItem): number | null {
  if (item.availableQuantity == null || item.unitPrice == null) return null
  return item.availableQuantity * item.unitPrice
}

/** The request's subtotal, over the lines that carry a total. Null = none do. */
export function arSubtotal(items: ARItem[]): number | null {
  const totals = items.map(arLineTotal).filter((t): t is number => t != null)
  return totals.length ? totals.reduce((sum, t) => sum + t, 0) : null
}

/** An availability request as a list shows it. */
export interface ARSummary {
  id: number
  jobRequestId: number
  /** `job_requests.name`, null = unnamed (render the JR ref). */
  jobName: string | null
  supplierId: number
  supplierName: string
  shareCustomerDetails: boolean
  status: string
  submittedAt: string | null
  createdAt: string
  itemCount: number
  answeredCount: number
  /** LPS's job-level note to the supplier — delivery window, site constraints. Ours, never theirs to edit. */
  lpsNotes: string | null
}

/**
 * The whole request, as the portal's expanded card and the admin tab render
 * it. No messages — the transcript table was dropped 2026-08-23.
 */
export interface ARDetail extends ARSummary {
  items: ARItem[]
  /** Only present when customer details are shared (portal) or always (admin). */
  customer: { name: string; company: string | null; email: string | null; phone: string | null } | null
  /** Delivery destination; same disclosure rule as `customer`. */
  shipping: { address: string | null; city: string | null; state: string | null; zip: string | null } | null
}

/**
 * The suppliers engaged on one job request — what a request card's links are
 * built from: every availability request the job has with them, and their own
 * conversation thread.
 */
export interface SupplierLink {
  supplierId: number
  name: string
  lpsPartner: boolean
  /** Every availability request this job has with them, newest first. */
  availabilityRequests: { id: number; status: string }[]
  /** `suppliers.rosie_thread_id` — the supplier's chat thread, when set. */
  rosieThreadId: string | null
}

/** Apply one drawer status signal without refetching unrelated job-request data. */
export function withAvailabilityRequestStatus(
  links: SupplierLink[],
  arId: number,
  status: string,
): SupplierLink[] {
  let changed = false
  const next = links.map((link) => {
    const availabilityRequests = link.availabilityRequests.map((ar) => {
      if (ar.id !== arId || ar.status === status) return ar
      changed = true
      return { ...ar, status }
    })
    return availabilityRequests.some((ar, i) => ar !== link.availabilityRequests[i])
      ? { ...link, availabilityRequests }
      : link
  })
  return changed ? next : links
}

// ------------------------------------------------- the portal's item view
//
// The same lines, cut the other way. The portal's request list answers "what
// does this job want from us". The question it cannot answer is "how often
// have they asked me for *this plant*, and what did I say each time", because
// a plant is spread across every request that wanted it. These types carry one
// supplier's whole open workload as lines, so the page can group them by plant
// instead.
//
// Everything here is **portal-safe by construction**: an ARItem is already
// what the supplier answers, and the only fields added name the request the
// line arrived on and the catalogue row it maps to. Nothing about the job
// behind it beyond the request name the portal already prints.

/** One availability-request line, plus the request and catalogue row it belongs to. */
export interface SupplierItemLine extends ARItem {
  arId: number
  /** `availability_requests.status` — new | processing | submitted | closed. */
  arStatus: string
  arCreatedAt: string
  /** The request's name as the portal prints it, already redacted. */
  arName: string
  /**
   * Who the job is for — **only** where that request was shared with customer
   * details. Null everywhere else, exactly as the portal's request cards
   * decide it.
   */
  arCustomer: string | null
  /** `availability_request_items.mapped_inventory_id` (migration 0077). */
  mappedInventoryId: string | null
  /** The mapped catalogue row's own identity — null when nothing is mapped. */
  mappedName: string | null
  mappedSize: string | null
}

/**
 * One plant, across every request that asked for it.
 *
 * Two kinds, and the difference is the whole point of the view. A **mapped**
 * group is a real catalogue row — every line in it is the same offering at the
 * same size, whatever each request called it. An **unmapped** group is only a
 * shared spelling: nothing says those lines are one plant except that they
 * were typed alike, which is why it is the group you drag lines *out* of.
 */
export interface SupplierItemGroup {
  /** `inv:<uuid>` or `name:<key>` — stable across a refetch, so expansion survives one. */
  key: string
  mappedInventoryId: string | null
  /** The catalogue row's name, or the item name the unmapped lines share. */
  name: string
  /** The catalogue row's size; for an unmapped group, the sizes actually asked. */
  size: string | null
  lines: SupplierItemLine[]
}

/** How an unmapped group is keyed: case and inner whitespace don't split a group. */
const nameKey = (name: string) => name.trim().toLowerCase().replace(/\s+/g, ' ')

/**
 * Group a supplier's lines by plant — mapped rows first, then the unmapped
 * names, each side alphabetical.
 *
 * Mapped first is not decoration: those are the groups a line can be dropped
 * onto, and the ordering keeps the drop targets together at the top rather
 * than interleaved with the names they are there to absorb.
 */
export function groupSupplierItems(lines: SupplierItemLine[]): SupplierItemGroup[] {
  const groups = new Map<string, SupplierItemGroup>()
  for (const line of lines) {
    const mapped = line.mappedInventoryId
    const key = mapped ? `inv:${mapped}` : `name:${nameKey(line.name)}`
    let group = groups.get(key)
    if (!group) {
      group = {
        key,
        mappedInventoryId: mapped,
        // A mapped row names itself; an unmapped group can only be called what
        // the first line asking for it was called.
        name: (mapped ? line.mappedName : null) ?? line.name,
        size: mapped ? line.mappedSize : null,
        lines: [],
      }
      groups.set(key, group)
    }
    group.lines.push(line)
  }

  // An unmapped group's size is whatever its lines actually asked for — one
  // size reads like a mapped row's, several say plainly that the group is a
  // spelling and not an offering.
  for (const group of groups.values()) {
    if (group.mappedInventoryId == null) {
      const sizes = [...new Set(group.lines.map((l) => l.size).filter((s): s is string => !!s))]
      group.size = sizes.length ? sizes.join(' · ') : null
    }
    group.lines.sort((a, b) => b.arId - a.arId || a.id - b.id)
  }

  const all = [...groups.values()]
  const byName = (a: SupplierItemGroup, b: SupplierItemGroup) =>
    a.name.localeCompare(b.name) || (a.size ?? '').localeCompare(b.size ?? '')
  return [
    ...all.filter((g) => g.mappedInventoryId != null).sort(byName),
    ...all.filter((g) => g.mappedInventoryId == null).sort(byName),
  ]
}

/** How many of a group's lines the supplier has actually answered. */
export const answeredIn = (lines: SupplierItemLine[]) =>
  lines.filter((l) => l.status != null).length
