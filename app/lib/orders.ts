import type { Tone } from '@/lib/job-requests'
import type { ARJobSchedule } from '@/lib/availability'

export const ORDER_STATUSES = ['new', 'processing', 'order_ready', 'completed', 'closed_won', 'closed_lost'] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]
export type FulfillmentMethod = 'pickup' | 'delivery'

/** APS is the current default; explicit grower orders remain supported. */
export const isApsSupplier = (name: string): boolean => /^(?:Austin Plant Supply|APS)$/i.test(name.trim())

export const ORDER_STATUS_META: Record<OrderStatus, { label: string; tone: Tone }> = {
  new: { label: 'New', tone: 'blue' },
  processing: { label: 'Processing', tone: 'orange' },
  order_ready: { label: 'Order Ready', tone: 'green' },
  completed: { label: 'Completed', tone: 'teal' },
  closed_won: { label: 'Closed Won', tone: 'green' },
  closed_lost: { label: 'Closed Lost', tone: 'red' },
}
export const ORDER_ITEM_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending', available: 'Available', partial_qty: 'Partial Qty', unavailable: 'Unavailable',
  diff_size_sub: 'Diff Sz/Sub', need_to_order: 'Need to Order', arriving_soon: 'Arriving Soon',
}

export interface OrderItem {
  id: number
  name: string
  size: string | null
  quantity: number
  unitPrice: number | null
  total: number | null
  status: string
  noteForSupplier: string | null
  /** The supplier's reply on this row. */
  noteFromSupplier: string | null
  /** The candidate this row was ordered from (0146); null for a row added by hand. */
  candidateId?: number | null
}

export interface OrderShareJob {
  jobRequestId: number
  jobName: string | null
  expectedInstallDate: string | null
  customer: { name: string | null; company: string | null; email: string | null; phone: string | null } | null
  shippingAddress: string | null
}

export const orderRecordName = (order: { id: number; recordName?: string | null }) => order.recordName || `O-${order.id}`

/** The job's EDD is the order's target date (0149). */
export const orderEdd = (order: Pick<Order, 'jobSchedules'>) => order.jobSchedules?.[0]?.expectedInstallDate ?? null


/** One Additional details entry (0151): the list keeps its order. */
export interface OrderDetail { field: string; value: string }

/**
 * Additional details as sent to the database (0151): 1–50 entries of
 * non-blank `field` (≤ 100) and `value` (≤ 2000), trimmed. Entries left
 * entirely blank are dropped; an empty list is null.
 */
export function parseOrderDetails(value: unknown): OrderDetail[] | null {
  if (value == null) return null
  if (!Array.isArray(value)) throw new Error('Additional details must be a list of fields')
  const details = value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry) || Object.keys(entry).some((key) => key !== 'field' && key !== 'value')
      || typeof entry.field !== 'string' || typeof entry.value !== 'string') throw new Error('Each additional detail needs a field and a value')
    const field = entry.field.trim(), text = entry.value.trim()
    if (!field && !text) return []
    if (!field || !text) throw new Error('Each additional detail needs a field and a value')
    if (field.length > 100 || text.length > 2000) throw new Error('Fields are up to 100 characters, values up to 2000')
    return [{ field, value: text }]
  })
  if (details.length > 50) throw new Error('Additional details hold up to 50 fields')
  return details.length ? details : null
}

/**
 * The Additional details a new order starts from: what the job knows — the
 * customer, the delivery address and the customer's contact as one field
 * (2026-10-21). The change log is its own field (0150).
 */
export function orderDetailsTemplate(job: Pick<OrderShareJob, 'customer' | 'shippingAddress'>): OrderDetail[] {
  const customer = job.customer
  return [
    { field: 'Customer', value: customer?.company?.trim() || customer?.name?.trim() || 'Not provided' },
    { field: 'Delivery address', value: job.shippingAddress?.trim() ?? '' },
    // One field per contact: name, email, phone (2026-10-21).
    { field: 'Delivery contact', value: [customer?.name, customer?.email, customer?.phone].map((part) => part?.trim()).filter(Boolean).join(', ') },
  ].filter((detail) => detail.value)
}

export interface Order {
  /** Revocable public viewing capability; included for admins and authorized partner detail reads. */
  publicToken?: string | null
  jobNames?: string[]
  customerDetails?: { jobName: string | null; customer: OrderShareJob['customer']; address: string | null }[]
  recordName?: string | null
  /** Archive classification for both views, including closure of every linked job. */
  closed?: boolean
  /** Admin only: customer details for copying an order. */
  shareJobs?: OrderShareJob[]
  id: number
  /** Admin only: the one job this order belongs to (0146). */
  jobRequestId?: number
  supplierId: number
  supplierName: string
  status: OrderStatus
  /** The job's pickup/delivery (0149: orders have none of their own). */
  fulfillmentMethod: FulfillmentMethod | null
  confirmationDate: string | null
  /** What the supplier needs: customer, delivery address, contacts, payment method (0151: an ordered field list). */
  additionalDetails: OrderDetail[] | null
  /** Markdown bullets `- MM/DD: change`: material changes only (0150). */
  changeLog: string | null
  /** The supplier's reply on the order. */
  noteFromSupplier: string | null
  createdAt: string
  /** Customer-requested delivery/installation dates; portal schedules omit job identities. */
  jobSchedules?: ARJobSchedule[]
  /** The supplier's availability request for this job, if any (one per job and supplier). */
  availabilityRequestId: number | null
  availabilityRequestName?: string | null
  items: OrderItem[]
}

export interface PartnerOrderUpdate {
  status?: 'processing' | 'order_ready' | 'completed'
  additionalDetails?: OrderDetail[] | null
  changeLog?: string | null
  noteFromSupplier?: string | null
}

export const ORDER_ITEM_STATUSES = ['pending', 'available', 'partial_qty', 'unavailable', 'diff_size_sub', 'need_to_order', 'arriving_soon'] as const
export type OrderItemStatus = (typeof ORDER_ITEM_STATUSES)[number]

/** A row's status, with the supplier's reply when `noteFromSupplier` is sent (blank clears it). */
export function parseOrderItemUpdate(value: unknown): { status: OrderItemStatus; noteFromSupplier?: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).some((key) => key !== 'status' && key !== 'noteFromSupplier')
    || !(ORDER_ITEM_STATUSES as readonly string[]).includes((value as { status?: unknown }).status as string)) {
    throw new Error('Choose a valid plant status')
  }
  const { status, noteFromSupplier } = value as { status: OrderItemStatus; noteFromSupplier?: unknown }
  if (noteFromSupplier === undefined) return { status }
  if (typeof noteFromSupplier !== 'string' || noteFromSupplier.length > 10000) throw new Error('Note must be text up to 10000 characters')
  return { status, noteFromSupplier: noteFromSupplier.trim() }
}

/** Supplier price edits are separate from status updates. */
export function parseOrderItemPrice(value: unknown): number | null {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== 1 || !('unitPrice' in value)) throw new Error('Provide a unit price')
  const price = (value as { unitPrice: unknown }).unitPrice
  if (price === null) return null
  if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0 || price >= 100000000 || Math.abs(price * 100 - Math.round(price * 100)) > 0.000001) throw new Error('Enter a positive price with at most two decimal places')
  return price
}

/** Lifecycle is checked again under a database lock. Pickup/delivery and the date are the job's (0149). */
export function parsePartnerOrderUpdate(value: unknown): PartnerOrderUpdate {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Order update is required')
  const body = value as Record<string, unknown>
  if (!Object.keys(body).length || Object.keys(body).some((key) => !['status', 'additionalDetails', 'changeLog', 'noteFromSupplier'].includes(key))) {
    throw new Error('Choose an order status, additional details, change log, or note')
  }
  const update: PartnerOrderUpdate = {}
  if ('status' in body) {
    if (body.status !== 'processing' && body.status !== 'order_ready' && body.status !== 'completed') throw new Error('Choose Processing, Order Ready or Completed')
    update.status = body.status
  }
  if ('additionalDetails' in body) update.additionalDetails = parseOrderDetails(body.additionalDetails)
  if ('changeLog' in body) {
    if (body.changeLog != null && (typeof body.changeLog !== 'string' || body.changeLog.length > 10000)) {
      throw new Error('Change log must be text up to 10000 characters')
    }
    update.changeLog = typeof body.changeLog === 'string' ? body.changeLog.trim() || null : null
  }
  if ('noteFromSupplier' in body) {
    if (body.noteFromSupplier != null && (typeof body.noteFromSupplier !== 'string' || body.noteFromSupplier.length > 10000)) {
      throw new Error('Note from supplier must be text up to 10000 characters')
    }
    update.noteFromSupplier = typeof body.noteFromSupplier === 'string' ? body.noteFromSupplier.trim() || null : null
  }
  return update
}

/** A job line Chris can order: its selected candidate, not yet on an order (0146). */
export interface OrderLineChoice {
  jobRequestItemId: number
  supplierId: number
  supplierName: string
  name: string
  size: string | null
  status: string
  quantity: number | null
  unitPrice: number | null
}

/** Order the ticked job lines' selected candidates from one supplier (0146). */
export interface CreateOrderInput {
  jobRequestId: number
  supplierId: number
  additionalDetails: OrderDetail[] | null
  jobRequestItemIds: number[]
}

export function positiveId(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}

export function parseCreateOrder(value: unknown): CreateOrderInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('order is required')
  const body = value as Record<string, unknown>
  if (!positiveId(body.jobRequestId)) throw new Error('jobRequestId is required')
  if (!positiveId(body.supplierId)) throw new Error('supplierId is required')
  // Pickup/delivery is the job's, the header note is additionalDetails and
  // orders carry no customer note (0149).
  if (['fulfillmentMethod', 'noteForSupplier', 'noteForCustomer'].some((field) => field in body)) throw new Error('Set pickup/delivery on the job and send additionalDetails')
  const additionalDetails = parseOrderDetails(body.additionalDetails)
  const ids = body.jobRequestItemIds
  if (!Array.isArray(ids) || !ids.length || ids.length > 500 || !ids.every(positiveId) || new Set(ids).size !== ids.length) {
    throw new Error('Choose between 1 and 500 job lines')
  }
  return {
    jobRequestId: body.jobRequestId, supplierId: body.supplierId,
    additionalDetails,
    jobRequestItemIds: ids,
  }
}

/** The subtotal stays absent when every line is still unpriced. */
export function orderSubtotal(order: Pick<Order, 'items'>): number | null {
  const totals = order.items.map((item) => item.total).filter((value): value is number => value != null)
  return totals.length ? totals.reduce((sum, value) => sum + value, 0) : null
}

/** Admin inline edits; totals remain database-generated. */
export function parseOrderItemCell(column: unknown, value: unknown): Record<string, string | number | null> {
  if (typeof column !== 'string' || !['name', 'size', 'quantity', 'unit_price', 'note_for_supplier', 'note_from_supplier'].includes(column)) throw new Error('Invalid order item field')
  if (typeof value !== 'string') throw new Error('Invalid field value')
  const text = value.trim()
  if (column === 'quantity' || column === 'unit_price') {
    if (!text && column === 'unit_price') return { [column]: null }
    const number = Number(text)
    if (!text || !Number.isFinite(number) || number <= 0) throw new Error('Enter a positive number')
    if (column === 'unit_price' && (number >= 100000000 || Math.abs(number * 100 - Math.round(number * 100)) > 0.000001)) throw new Error('Enter a price with at most two decimal places')
    return { [column]: number }
  }
  if (column === 'name' && !text) throw new Error('Plant name is required')
  return { [column]: text || null }
}
