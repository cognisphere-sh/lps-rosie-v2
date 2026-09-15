import type { Tone } from '@/lib/job-requests'

export const ORDER_STATUSES = ['committed', 'confirmed', 'closed_won', 'closed_lost'] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]
export type FulfillmentMethod = 'pickup' | 'delivery'

/** APS is the current default; explicit grower orders remain supported. */
export const isApsSupplier = (name: string): boolean => /^(?:Austin Plant Supply|APS)$/i.test(name.trim())

export const ORDER_STATUS_META: Record<OrderStatus, { label: string; tone: Tone }> = {
  committed: { label: 'Committed', tone: 'amber' },
  confirmed: { label: 'Confirmed', tone: 'green' },
  closed_won: { label: 'Closed Won', tone: 'green' },
  closed_lost: { label: 'Closed Lost', tone: 'red' },
}
export const ORDER_ITEM_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending', available: 'Available', unavailable: 'Unavailable',
  diff_size_qty_sub: 'Diff Sz/Qnty/Sub', need_to_order: 'Need to Order', arriving_soon: 'Arriving Soon',
}

export interface OrderAllocation {
  jobRequestItemId: number
  jobRequestId: number
  jobName: string | null
  quantity: number
}

export interface OrderItem {
  id: number
  availabilityRequestItemId: number | null
  name: string
  size: string | null
  quantity: number
  unitPrice: number | null
  total: number | null
  status: string
  notes: string | null
  /** Admin only; supplier order payloads omit internal job associations. */
  allocations?: OrderAllocation[]
}

export interface Order {
  id: number
  supplierId: number
  supplierName: string
  status: OrderStatus
  fulfillmentMethod: FulfillmentMethod | null
  confirmationDate: string | null
  fulfillmentDate: string | null
  notes: string | null
  createdAt: string
  items: OrderItem[]
}

export interface OrderCandidate {
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

export interface CreateOrderInput {
  supplierId: number
  customerConfirmed: true
  fulfillmentMethod: FulfillmentMethod | null
  fulfillmentDate: string | null
  notes: string | null
  items: {
    availabilityRequestItemId: number
    allocations: { jobRequestItemId: number; quantity: number }[]
  }[]
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
  if (!positiveId(body.supplierId)) throw new Error('supplierId is required')
  if (body.customerConfirmed !== true) throw new Error('Confirm the customer has placed this order')
  if (body.fulfillmentMethod != null && !['pickup', 'delivery'].includes(body.fulfillmentMethod as string)) {
    throw new Error('fulfillmentMethod must be pickup or delivery')
  }
  if (body.notes != null && (typeof body.notes !== 'string' || body.notes.length > 10000)) throw new Error('notes must be text under 10000 characters')
  if (!Array.isArray(body.items) || !body.items.length || body.items.length > 500) throw new Error('Select between 1 and 500 availability lines')
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
    fulfillmentDate: orderDate(body.fulfillmentDate, 'Pickup/delivery date'),
    notes: (body.notes as string | null | undefined)?.trim() || null,
    items,
  }
}

/** The subtotal stays absent when every line is still unpriced. */
export function orderSubtotal(order: Pick<Order, 'items'>): number | null {
  const totals = order.items.map((item) => item.total).filter((value): value is number => value != null)
  return totals.length ? totals.reduce((sum, value) => sum + value, 0) : null
}
