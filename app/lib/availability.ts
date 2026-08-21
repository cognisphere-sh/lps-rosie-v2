// The availability-request vocabulary, shared by the admin app, the supplier
// portal and the API routes — the same reconciliation `lib/job-requests.ts`
// does for job requests, over migration 0062's tables.

import type { Tone } from '@/lib/job-requests'

/** `availability_requests.status` — the CHECK vocabulary, in lifecycle order. */
export const AR_STATUSES = ['new', 'submitted', 'closed'] as const
export type ARStatus = (typeof AR_STATUSES)[number]

// `submitted` reads as **Answered**: the portal's button says Save (a supplier
// can save partial answers and come back), so the stored word would overclaim.
export const AR_STATUS_META: Record<ARStatus, { label: string; tone: Tone }> = {
  new: { label: 'New', tone: 'amber' },
  submitted: { label: 'Answered', tone: 'green' },
  closed: { label: 'Closed', tone: 'grey' },
}

export const arStatusLabel = (s: string) => AR_STATUS_META[s as ARStatus]?.label ?? s
export const arStatusTone = (s: string): Tone => AR_STATUS_META[s as ARStatus]?.tone ?? 'grey'

/**
 * `availability_request_items.status` — the supplier's four-word answer.
 * NULL is a real state (not answered yet) and renders as "Set status".
 */
export const AR_RESPONSES = ['available', 'can_order', 'substitute', 'unavailable'] as const
export type ARResponse = (typeof AR_RESPONSES)[number]

export const AR_RESPONSE_META: Record<ARResponse, { label: string; tone: Tone }> = {
  available: { label: 'Available', tone: 'green' },
  can_order: { label: 'Can order', tone: 'amber' },
  substitute: { label: 'Substitute', tone: 'teal' },
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

/**
 * The channels a supplier-thread message can carry. `email`/`text` = a
 * supplier-facing exchange that happened outside the app and is recorded
 * here; `app` = typed in the portal or admin thread; `internal` = what the
 * supplier never sees — an instruction to daisy, another agent's note, or a
 * broker-side note (migration 0063).
 */
export const MESSAGE_CHANNELS = ['app', 'email', 'text', 'internal'] as const
export type MessageChannel = (typeof MESSAGE_CHANNELS)[number]

/** How each channel reads and colours in the chat view. */
export const CHANNEL_META: Record<MessageChannel, { label: string; tone: Tone }> = {
  text: { label: 'Text', tone: 'green' },
  email: { label: 'Email', tone: 'teal' },
  app: { label: 'Portal', tone: 'lime' },
  internal: { label: 'Internal', tone: 'grey' },
}

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
}

/** One `supplier_messages` row — append-only, never edited. */
export interface SupplierMessage {
  id: number
  supplierId: number
  jobRequestId: number | null
  availabilityRequestId: number | null
  sender: 'broker' | 'supplier'
  /** Chris, Rosie, Daisy, or the supplier contact — null when unrecorded. */
  senderName: string | null
  channel: MessageChannel
  body: string
  createdAt: string
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
}

/**
 * The whole request, as the portal's expanded card and the admin tab render
 * it. No messages: the conversation is one thread per supplier, never per
 * request (2026-08-19).
 */
export interface ARDetail extends ARSummary {
  items: ARItem[]
  /** Only present when customer details are shared (portal) or always (admin). */
  customer: { name: string; company: string | null; email: string | null; phone: string | null } | null
  /** Delivery destination; same disclosure rule as `customer`. */
  shipping: { address: string | null; city: string | null; state: string | null; zip: string | null } | null
}

/**
 * The suppliers engaged on one job request — what the sourcing-note supplier
 * links are built from. Onboarded suppliers link to their availability-request
 * view, the rest to their conversation thread.
 */
export interface SupplierLink {
  supplierId: number
  name: string
  onboarded: boolean
  /** The newest availability request this job has with them, if any. */
  availabilityRequestId: number | null
}
