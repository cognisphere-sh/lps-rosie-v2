// The availability-request vocabulary, shared by the admin app, the supplier
// portal and the API routes — the same reconciliation `lib/job-requests.ts`
// does for job requests, over migration 0062's tables.

import type { Tone } from '@/lib/job-requests'

/** `availability_requests.status` — the CHECK vocabulary, in lifecycle order. */
export const AR_STATUSES = ['draft', 'new', 'processing', 'submitted', 'closed'] as const
export type ARStatus = (typeof AR_STATUSES)[number]

// The portal's three working states, plus Draft preparation and admin closure. `new` is
// publishing, or LPS reopening a request the supplier already worked on (never
// automatic since 0130), so the ask goes back to the top of their New tab;
// `processing` is any answer they have made since; `submitted` is the button.
export const AR_STATUS_META: Record<ARStatus, { label: string; tone: Tone }> = {
  // LPS only: built on the job card, invisible to the supplier until Publish.
  draft: { label: 'Draft', tone: 'grey' },
  new: { label: 'New', tone: 'blue' },
  processing: { label: 'Processing', tone: 'orange' },
  submitted: { label: 'Completed', tone: 'green' },
  closed: { label: 'Closed', tone: 'grey' },
}

export const arStatusLabel = (s: string) => AR_STATUS_META[s as ARStatus]?.label ?? s
export const arStatusTone = (s: string): Tone => AR_STATUS_META[s as ARStatus]?.tone ?? 'grey'

/** The existing lifecycle state the admin UI may safely call submitted. */
export const isSubmittedARStatus = (status: string) => status === 'submitted'

/** Open requests are in progress until the supplier submits them. */
export const isInProgressARStatus = (status: string) => status === 'new' || status === 'processing'

/** The AR segment's accessible name, including the state its visible indicator conveys. */
export function availabilityRequestLinkLabel(
  id: number,
  supplierName: string,
  status: string,
  recordName?: string | null,
): string {
  const base = `Open availability request ${availabilityRecordName({ id, recordName })} to ${supplierName}`
  return isSubmittedARStatus(status) ? `${base} — Completed`
    : isInProgressARStatus(status) ? `${base} — In progress`
      : status === 'closed' ? `${base} — Closed` : status === 'draft' ? `${base} — Draft` : base
}

/**
 * `candidates.status` — the supplier's answer, in the order the
 * portal's picker offers it. NULL is a real state (not answered yet) and
 * renders as "Pending". Selecting Pending saves NULL without clearing the
 * quantities, prices or notes; it is not a supplier answer.
 *
 * A substitute is answered naming another candidate of the line
 * (`offeredCandidateId`) or a typed one (`offerDescription`): the asked
 * candidate is stored Unavailable and the substitute `diff_size_sub` (renamed
 * from `diff_size_qty_sub` in 0130). The asked row shows the substitute's
 * answer (`withSubstituteAnswers` server-side) and reads Diff Sz/Sub.
 * `partial_qty` (Partial Qty) = the asked plant, fewer than demanded.
 */
export const AR_RESPONSES = [
  'available',
  'partial_qty',
  'unavailable',
  'diff_size_sub',
  'can_order',
  'arriving_soon',
] as const
export type ARResponse = (typeof AR_RESPONSES)[number]

// Partial Qty is yellow and Can Order orange (2026-09-30); the rest keep their
// tones. `grey` is not free: it is what an unanswered line reads as.
export const AR_RESPONSE_META: Record<ARResponse, { label: string; tone: Tone }> = {
  available: { label: 'Available', tone: 'green' },
  partial_qty: { label: 'Partial Qty', tone: 'yellow' },
  can_order: { label: 'Can Order', tone: 'orange' },
  diff_size_sub: { label: 'Diff Sz/Sub', tone: 'purple' },
  arriving_soon: { label: 'Arriving Soon', tone: 'lime' },
  unavailable: { label: 'Unavailable', tone: 'red' },
}

export const arResponseLabel = (s: string | null) =>
  s == null ? 'Pending' : AR_RESPONSE_META[s as ARResponse]?.label ?? s
export const arResponseTone = (s: string | null): Tone =>
  s == null ? 'grey' : AR_RESPONSE_META[s as ARResponse]?.tone ?? 'grey'

export const AR_RESPONSE_OPTIONS = [
  ...AR_RESPONSES.map((v) => ({ value: v, label: AR_RESPONSE_META[v].label })),
  { value: '', label: 'Pending' },
]

/**
 * What a line picker offers. Unavailable and Diff Sz/Sub are separate options
 * again (2026-10-05). Since 2026-10-07 both open the substitute dialog, whose
 * No Sub appears only when Unavailable is selected and saves plain Unavailable;
 * a chosen substitute is saved as Diff Sz/Sub
 * naming it (the asked row is stored Unavailable). Can Order
 * and Arriving Soon are one option (2026-10-01); the dialog asks which.
 */
export const AR_ANSWER_OPTIONS = [
  { value: 'available', label: 'Available' },
  { value: 'unavailable', label: AR_RESPONSE_META.unavailable.label },
  { value: 'diff_size_sub', label: AR_RESPONSE_META.diff_size_sub.label },
  { value: 'can_order', label: 'Can Order/Arriving Soon' },
  { value: 'partial_qty', label: AR_RESPONSE_META.partial_qty.label },
  { value: '', label: 'Pending' },
]

/**
 * The picker option a line sits under: Arriving Soon is under Can Order, and
 * Unavailable naming a substitute under Diff Sz/Sub.
 */
export const arAnswerOption = (item: Pick<ARItem, 'status' | 'offeredCandidateId' | 'offerDescription'>) => {
  const s = arShownStatus(item)
  return s === 'arriving_soon' ? 'can_order' : s
}

/** One line shared with the supplier, with their answer. */
export interface ARItem {
  id: number
  allocations?: { jobRequestItemId: number; quantity: number | null }[]
  /** Snapshotted at share time; admins can correct it directly, while later job edits never rewrite it. */
  name: string
  size: string | null
  demandedQuantity: number | null
  /** The supplier's answer; null = not answered yet. With a substitute, this and
   *  the quantity, price and reply below are the substitute's. */
  status: string | null
  availableQuantity: number | null
  unitPrice: number | null
  /** LPS's ask to the supplier about this line. */
  noteForSupplier: string | null
  /** The supplier's reply about this line. */
  noteFromSupplier: string | null
  /** Diff Sz/Sub substitute: a picked tag (another candidate of the line)… */
  offeredCandidateId?: number | null
  /** …or one the supplier typed (its own candidate, unpriced until enriched). */
  offerDescription?: string | null
  /** This supplier's other candidates on the same job line: the substitute tags. */
  alternatives?: ARAlternative[]
}

/**
 * A line write's snake_case columns (`{itemId, changes}` / `{itemId, details}`),
 * applied to the camelCase item fields they show in — for an optimistic copy
 * of the line; the read after the write replaces it.
 */
export function withLineChanges<T extends ARItem>(item: T, changes: Record<string, string>): T {
  const next = { ...item } as Record<string, unknown>
  for (const [column, raw] of Object.entries(changes)) {
    const key = column.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())
    const numeric = /_(quantity|price|id)$/.test(column)
    next[key] = raw === '' && key !== 'name' ? null : numeric ? Number(raw) : raw
  }
  // Available is sent without a quantity: the database sets it to the demand.
  if (changes.status === 'available' && !('available_quantity' in changes)) next.availableQuantity = item.demandedQuantity
  // Back to unanswered (pending): the database clears the quantity (0132).
  if (changes.status === '') next.availableQuantity = null
  return next as unknown as T
}

/** A substitute tag: always priced (unpriced candidates are not offered as tags). */
export interface ARAlternative { id: number; description: string; unitPrice: number | null }

/** An answer that names a substitute (the asked row is stored Unavailable; the substitute is its own row). */
export const hasOffer = (item: Pick<ARItem, 'offeredCandidateId' | 'offerDescription'>) =>
  item.offeredCandidateId != null || !!item.offerDescription

/** The answer a line reads as: Unavailable that names a substitute reads Diff Sz/Sub. */
export const arShownStatus = (item: Pick<ARItem, 'status' | 'offeredCandidateId' | 'offerDescription'>) =>
  item.status === 'unavailable' && hasOffer(item) ? 'diff_size_sub' : item.status

/** No price to show. 0 is a $0 price (0143). */
export const isUnpriced = (item: Pick<ARItem, 'unitPrice'>) => item.unitPrice == null

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
export const availabilityRecordName = (request: { id: number; recordName?: string | null }) => request.recordName || `AR-${request.id}`

export interface ARSummary {
  recordName?: string | null
  /** Sharing capability for admins and authorized partners. Omitted from public payloads. */
  publicToken?: string | null
  id: number
  /** The request's job (`availability_requests.job_request_id`), for navigation. */
  jobRequestId: number | null
  jobRequestIds?: number[]
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
  /** Shared request-wide sourcing requirements and actual supplier responses. */
  noteForSupplier: string | null
}

/**
 * The whole request, as the portal's expanded card and the admin tab render
 * it. No messages — the transcript table was dropped 2026-08-23.
 */
export interface ARDetail extends ARSummary {
  items: ARItem[]
  /** One schedule per linked job; supplier/public payloads omit the job identity. */
  jobSchedules?: ARJobSchedule[]
  /** Only present when customer details are shared (portal) or always (admin). */
  customer: { name: string; company: string | null; email: string | null; phone: string | null } | null
  /** Delivery destination; same disclosure rule as `customer`. */
  shipping: { address: string | null; city: string | null; state: string | null; zip: string | null } | null
}

/** Keep each install date paired with that job's fulfillment method. */
export interface ARJobSchedule {
  /** Admin only; never included in supplier/public schedule metadata. */
  jobRequestId?: number
  /** Admin only; never included in supplier/public schedule metadata. */
  jobName?: string | null
  expectedInstallDate: string | null
  fulfillmentMethod: 'pickup' | 'delivery' | null
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
  availabilityRequests: { id: number; recordName?: string | null; status: string; createdAt?: string | null; submittedAt?: string | null }[]
  /** `suppliers.rosie_thread_id` — the supplier's chat thread, when set. */
  rosieThreadId: string | null
}

/** Apply one drawer status signal without refetching unrelated job-request data. */
export function withAvailabilityRequestStatus(
  links: SupplierLink[],
  arId: number,
  status: string,
  submittedAt?: string | null,
): SupplierLink[] {
  let changed = false
  const next = links.map((link) => {
    const availabilityRequests = link.availabilityRequests.map((ar) => {
      if (ar.id !== arId || (ar.status === status && (submittedAt === undefined || ar.submittedAt === submittedAt))) return ar
      changed = true
      return { ...ar, status, ...(submittedAt !== undefined ? { submittedAt } : {}) }
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
  /** `candidates.mapped_inventory_id` (migration 0077). */
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
