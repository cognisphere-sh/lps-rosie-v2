import type { Tone } from '@/lib/job-requests'
import type { ARJobSchedule } from '@/lib/availability'

export const ORDER_STATUSES = ['new', 'processing', 'order_ready', 'closed_won', 'closed_lost'] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]
export type FulfillmentMethod = 'pickup' | 'delivery'

/** APS is the current default; explicit grower orders remain supported. */
export const isApsSupplier = (name: string): boolean => /^(?:Austin Plant Supply|APS)$/i.test(name.trim())

export const ORDER_STATUS_META: Record<OrderStatus, { label: string; tone: Tone }> = {
  new: { label: 'New', tone: 'amber' },
  processing: { label: 'Processing', tone: 'teal' },
  order_ready: { label: 'Order Ready', tone: 'green' },
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
  /** Admin only: customer communication is omitted from supplier payloads. */
  noteForCustomer?: string | null
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

export interface Order {
  /** Admin only: revocable public viewing capability. */
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
  fulfillmentMethod: FulfillmentMethod | null
  confirmationDate: string | null
  fulfillmentDate: string | null
  noteForSupplier: string | null
  /** The supplier's reply on the order. */
  noteFromSupplier: string | null
  /** Admin only: customer communication is omitted from supplier payloads. */
  noteForCustomer?: string | null
  createdAt: string
  /** Customer-requested delivery/installation dates; portal schedules omit job identities. */
  jobSchedules?: ARJobSchedule[]
  /** The supplier's availability request for this job, if any (one per job and supplier). */
  availabilityRequestId: number | null
  availabilityRequestName?: string | null
  items: OrderItem[]
}

export interface PartnerOrderUpdate {
  status?: 'processing' | 'order_ready'
  fulfillmentMethod?: FulfillmentMethod | null
  fulfillmentDate?: string | null
  noteForSupplier?: string | null
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

/** Lifecycle and required confirmation fields are checked again under a database lock. */
export function parsePartnerOrderUpdate(value: unknown): PartnerOrderUpdate {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Order update is required')
  const body = value as Record<string, unknown>
  if (!Object.keys(body).length || Object.keys(body).some((key) => !['status', 'fulfillmentMethod', 'fulfillmentDate', 'noteForSupplier', 'noteFromSupplier'].includes(key))) {
    throw new Error('Choose an order status, pickup/delivery method, fulfillment date, or note')
  }
  const update: PartnerOrderUpdate = {}
  if ('status' in body) {
    if (body.status !== 'processing' && body.status !== 'order_ready') throw new Error('Choose Processing or Order Ready')
    update.status = body.status
  }
  if ('fulfillmentMethod' in body) {
    if (body.fulfillmentMethod !== null && body.fulfillmentMethod !== 'pickup' && body.fulfillmentMethod !== 'delivery') {
      throw new Error('fulfillmentMethod must be pickup or delivery')
    }
    update.fulfillmentMethod = body.fulfillmentMethod
  }
  if ('fulfillmentDate' in body) update.fulfillmentDate = orderDate(body.fulfillmentDate, 'Fulfillment date')
  if ('noteForSupplier' in body) {
    if (body.noteForSupplier != null && (typeof body.noteForSupplier !== 'string' || body.noteForSupplier.length > 10000)) {
      throw new Error('Note for supplier must be text up to 10000 characters')
    }
    update.noteForSupplier = typeof body.noteForSupplier === 'string' ? body.noteForSupplier.trim() || null : null
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
  fulfillmentMethod: FulfillmentMethod | null
  noteForSupplier: string | null
  noteForCustomer: string | null
  jobRequestItemIds: number[]
}

export function positiveId(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}

/** Reject impossible calendar dates as well as timestamps and loose formats. */
export function orderDate(value: unknown, field: string): string | null {
  if (value == null || value === '') return null
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)
    || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) {
    throw new Error(`${field} must be a valid date (YYYY-MM-DD)`)
  }
  return value
}

export function parseCreateOrder(value: unknown): CreateOrderInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('order is required')
  const body = value as Record<string, unknown>
  if (!positiveId(body.jobRequestId)) throw new Error('jobRequestId is required')
  if (!positiveId(body.supplierId)) throw new Error('supplierId is required')
  if (body.fulfillmentMethod != null && !['pickup', 'delivery'].includes(body.fulfillmentMethod as string)) {
    throw new Error('fulfillmentMethod must be pickup or delivery')
  }
  for (const field of ['noteForSupplier', 'noteForCustomer']) {
    if (body[field] != null && (typeof body[field] !== 'string' || (body[field] as string).length > 10000)) {
      throw new Error(`${field} must be text up to 10000 characters`)
    }
  }
  const ids = body.jobRequestItemIds
  if (!Array.isArray(ids) || !ids.length || ids.length > 500 || !ids.every(positiveId) || new Set(ids).size !== ids.length) {
    throw new Error('Choose between 1 and 500 job lines')
  }
  return {
    jobRequestId: body.jobRequestId, supplierId: body.supplierId,
    fulfillmentMethod: (body.fulfillmentMethod as FulfillmentMethod | null | undefined) ?? null,
    noteForSupplier: (body.noteForSupplier as string | null | undefined)?.trim() || null,
    noteForCustomer: (body.noteForCustomer as string | null | undefined)?.trim() || null,
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
  if (typeof column !== 'string' || !['name', 'size', 'quantity', 'unit_price', 'note_for_supplier', 'note_from_supplier', 'note_for_customer'].includes(column)) throw new Error('Invalid order item field')
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
