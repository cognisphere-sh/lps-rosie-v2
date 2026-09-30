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
  diff_size_qty_sub: 'Diff Sz/Sub', need_to_order: 'Need to Order', arriving_soon: 'Arriving Soon',
}

export interface OrderAllocation {
  jobRequestItemId: number
  jobRequestId: number
  jobName: string | null
  quantity: number
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
  /** Admin only: customer communication is omitted from supplier payloads. */
  noteForCustomer?: string | null
  /** Admin only; supplier order payloads omit internal job associations. */
  allocations?: OrderAllocation[]
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
  supplierId: number
  supplierName: string
  status: OrderStatus
  fulfillmentMethod: FulfillmentMethod | null
  confirmationDate: string | null
  fulfillmentDate: string | null
  noteForSupplier: string | null
  /** Admin only: customer communication is omitted from supplier payloads. */
  noteForCustomer?: string | null
  createdAt: string
  /** Customer-requested delivery/installation dates; portal schedules omit job identities. */
  jobSchedules?: ARJobSchedule[]
  availabilityRequestNames?: Record<number, string>
  availabilityRequestIds: number[]
  items: OrderItem[]
}

export interface PartnerOrderUpdate {
  status?: 'processing' | 'order_ready'
  fulfillmentMethod?: FulfillmentMethod | null
  fulfillmentDate?: string | null
  noteForSupplier?: string | null
}

export const ORDER_ITEM_STATUSES = ['pending', 'available', 'partial_qty', 'unavailable', 'diff_size_qty_sub', 'need_to_order', 'arriving_soon'] as const
export type OrderItemStatus = (typeof ORDER_ITEM_STATUSES)[number]

export function parseOrderItemUpdate(value: unknown): { status: OrderItemStatus } {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== 1
    || !(ORDER_ITEM_STATUSES as readonly string[]).includes((value as { status?: unknown }).status as string)) {
    throw new Error('Choose a valid plant status')
  }
  return { status: (value as { status: OrderItemStatus }).status }
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
  if (!Object.keys(body).length || Object.keys(body).some((key) => !['status', 'fulfillmentMethod', 'fulfillmentDate', 'noteForSupplier'].includes(key))) {
    throw new Error('Choose an order status, pickup/delivery method, fulfillment date, or supplier note')
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
  return update
}

export interface OrderCandidate {
  availabilityRequestName?: string | null
  availabilityRequestItemId: number
  availabilityRequestId: number
  supplierId: number
  supplierName: string
  name: string
  size: string | null
  status: string | null
  unitPrice: number | null
  remainingQuantity: number
  allocations: (OrderAllocation & { remainingQuantity: number })[]
}

/** Remaining quoted demand that can be ordered without a supplier response. */
export interface DirectOrderCandidate {
  jobRequestItemId: number
  jobRequestId: number
  jobName: string | null
  name: string
  size: string | null
  unitPrice: number | null
  remainingQuantity: number
}

export interface CreateOrderInput {
  supplierId: number
  customerConfirmed: true
  fulfillmentMethod: FulfillmentMethod | null
  noteForSupplier: string | null
  noteForCustomer: string | null
  items: {
    availabilityRequestItemId: number
    allocations: { jobRequestItemId: number; quantity: number }[]
  }[]
}

/** A customer-confirmed order made from the quote, without supplier availability. */
export interface CreateDirectOrderInput {
  supplierId: number
  customerConfirmed: true
  fulfillmentMethod: FulfillmentMethod | null
  noteForSupplier: string | null
  noteForCustomer: string | null
  items: { jobRequestItemId: number; quantity: number }[]
}

export function isDirectOrder(input: CreateOrderInput | CreateDirectOrderInput): input is CreateDirectOrderInput {
  return 'jobRequestItemId' in input.items[0]
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

export function parseCreateOrder(value: unknown): CreateOrderInput | CreateDirectOrderInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('order is required')
  const body = value as Record<string, unknown>
  if (!positiveId(body.supplierId)) throw new Error('supplierId is required')
  if (body.customerConfirmed !== true) throw new Error('Confirm the customer has placed this order')
  if (body.fulfillmentDate != null && body.fulfillmentDate !== '') {
    throw new Error('The supplier enters the fulfillment date when confirming the order')
  }
  if (body.fulfillmentMethod != null && !['pickup', 'delivery'].includes(body.fulfillmentMethod as string)) {
    throw new Error('fulfillmentMethod must be pickup or delivery')
  }
  if ('notes' in body) throw new Error('Use noteForSupplier instead of notes')
  if ('noteFromCustomer' in body) throw new Error('Use noteForCustomer instead of noteFromCustomer')
  for (const field of ['noteForSupplier', 'noteForCustomer']) {
    if (body[field] != null && (typeof body[field] !== 'string' || (body[field] as string).length > 10000)) {
      throw new Error(`${field} must be text up to 10000 characters`)
    }
  }
  if (!Array.isArray(body.items) || !body.items.length || body.items.length > 500) throw new Error('Select between 1 and 500 order lines')
  const direct = body.items.every((raw) => raw && typeof raw === 'object' && 'jobRequestItemId' in raw && !('availabilityRequestItemId' in raw))
  if (direct) {
    const seen = new Set<number>()
    const items = body.items.map((raw: unknown) => {
      const item = raw as Record<string, unknown>
      if (!positiveId(item.jobRequestItemId) || seen.has(item.jobRequestItemId)) throw new Error('Each quoted line must have a unique valid ID')
      seen.add(item.jobRequestItemId)
      if (typeof item.quantity !== 'number' || !Number.isFinite(item.quantity) || item.quantity <= 0 || item.quantity > 1e9) {
        throw new Error('Order quantities must be positive numbers')
      }
      return { jobRequestItemId: item.jobRequestItemId, quantity: item.quantity }
    })
    return { supplierId: body.supplierId, customerConfirmed: true,
      fulfillmentMethod: (body.fulfillmentMethod as FulfillmentMethod | null | undefined) ?? null,
      noteForSupplier: (body.noteForSupplier as string | null | undefined)?.trim() || null,
      noteForCustomer: (body.noteForCustomer as string | null | undefined)?.trim() || null, items }
  }
  const seen = new Set<number>()
  const items = body.items.map((raw: unknown) => {
    if (!raw || typeof raw !== 'object') throw new Error('Invalid order line')
    const item = raw as Record<string, unknown>
    if (!positiveId(item.availabilityRequestItemId) || seen.has(item.availabilityRequestItemId)) {
      throw new Error('Each availability line must have a unique valid ID')
    }
    seen.add(item.availabilityRequestItemId)
    if (!Array.isArray(item.allocations) || !item.allocations.length || item.allocations.length > 500) throw new Error('Every order line needs job quantities')
    const jobs = new Set<number>()
    const allocations = item.allocations.map((value: unknown) => {
      if (!value || typeof value !== 'object') throw new Error('Invalid job quantity')
      const allocation = value as Record<string, unknown>
      if (!positiveId(allocation.jobRequestItemId) || jobs.has(allocation.jobRequestItemId)) throw new Error('Each job line must have a unique valid ID')
      jobs.add(allocation.jobRequestItemId)
      if (typeof allocation.quantity !== 'number' || !Number.isFinite(allocation.quantity) || allocation.quantity <= 0 || allocation.quantity > 1e9) throw new Error('Order quantities must be positive numbers')
      return { jobRequestItemId: allocation.jobRequestItemId, quantity: allocation.quantity }
    })
    return { availabilityRequestItemId: item.availabilityRequestItemId, allocations }
  })
  return {
    supplierId: body.supplierId, customerConfirmed: true,
    fulfillmentMethod: (body.fulfillmentMethod as FulfillmentMethod | null | undefined) ?? null,
    noteForSupplier: (body.noteForSupplier as string | null | undefined)?.trim() || null,
    noteForCustomer: (body.noteForCustomer as string | null | undefined)?.trim() || null,
    items,
  }
}

/** The subtotal stays absent when every line is still unpriced. */
export function orderSubtotal(order: Pick<Order, 'items'>): number | null {
  const totals = order.items.map((item) => item.total).filter((value): value is number => value != null)
  return totals.length ? totals.reduce((sum, value) => sum + value, 0) : null
}

/** Admin inline edits; totals remain database-generated. */
export function parseOrderItemCell(column: unknown, value: unknown): Record<string, string | number | null> {
  if (typeof column !== 'string' || !['name', 'size', 'quantity', 'unit_price', 'note_for_supplier', 'note_for_customer'].includes(column)) throw new Error('Invalid order item field')
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
