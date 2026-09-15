import 'server-only'

import type { CreateOrderInput, Order, OrderAllocation, OrderCandidate, OrderItem, OrderStatus, FulfillmentMethod } from '@/lib/orders'
import { supabase } from '@/lib/supabase'

interface OrderRecord {
  id: number; supplier_id: number; status: OrderStatus; fulfillment_method: FulfillmentMethod | null
  confirmation_date: string | null; fulfillment_date: string | null; notes: string | null; created_at: string
}
interface ItemRecord {
  id: number; order_id: number; availability_request_item_id: number | null; name: string; size: string | null
  quantity: number; unit_price: number | null; total: number | null; status: string; notes: string | null
}
interface AllocationRecord { order_item_id: number; job_request_item_id: number; quantity: number }
interface JobItemRecord { id: number; job_request_id: number; quantity?: number | null }
interface JobRecord { id: number; name: string | null; fulfillment_method?: FulfillmentMethod | null }

const ORDER_COLUMNS = 'id, supplier_id, status, fulfillment_method, confirmation_date, fulfillment_date, notes, created_at'
const ITEM_COLUMNS = 'id, order_id, availability_request_item_id, name, size, quantity, unit_price, total, status, notes'
const unique = (ids: number[]) => [...new Set(ids)]
const asNumber = (value: number | null) => value == null ? null : Number(value)

/** Page associations too: a combined grower order can exceed the API row cap. */
async function all<T>(query: { range: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }> }): Promise<T[]> {
  const rows: T[] = []
  while (true) {
    const { data, error } = await query.range(rows.length, rows.length + 999)
    if (error) throw new Error(error.message)
    rows.push(...(data ?? []) as T[])
    if ((data?.length ?? 0) < 1000) return rows
  }
}

async function jobItemsForJobs(jobIds: number[]): Promise<JobItemRecord[]> {
  if (!jobIds.length) return []
  return all<JobItemRecord>(supabase.from('job_request_items').select('id, job_request_id, quantity')
    .in('job_request_id', jobIds).eq('is_active', true).order('id'))
}

/** Read full order rows; internal job associations are never loaded for a portal. */
export async function listOrders(scope: { jobRequestId?: number; supplierId?: number; orderId?: number; forSupplier?: boolean }): Promise<Order[]> {
  let orderIds: number[] | undefined
  if (scope.jobRequestId != null) {
    const jobItems = await jobItemsForJobs([scope.jobRequestId])
    if (!jobItems.length) return []
    const links = await all<{ order_item_id: number }>(supabase.from('order_item_job_request_items')
      .select('order_item_id').in('job_request_item_id', jobItems.map((item) => item.id)).order('order_item_id'))
    if (!links.length) return []
    const items = await all<{ order_id: number }>(supabase.from('order_items').select('order_id')
      .in('id', unique(links.map((link) => link.order_item_id))).eq('is_active', true).order('id'))
    orderIds = unique(items.map((item) => item.order_id))
    if (!orderIds.length) return []
  }
  let query = supabase.from('orders').select(ORDER_COLUMNS).eq('is_active', true).order('created_at', { ascending: false }).order('id')
  if (orderIds) query = query.in('id', orderIds)
  if (scope.orderId != null) query = query.eq('id', scope.orderId)
  if (scope.supplierId != null) query = query.eq('supplier_id', scope.supplierId)
  const records = await all<OrderRecord>(query)
  if (!records.length) return []
  const [suppliers, items] = await Promise.all([
    all<{ id: number; name: string }>(supabase.from('suppliers').select('id, name').in('id', unique(records.map((order) => order.supplier_id))).order('id')),
    all<ItemRecord>(supabase.from('order_items').select(ITEM_COLUMNS).in('order_id', records.map((order) => order.id)).eq('is_active', true).order('id')),
  ])
  const supplierNames = new Map(suppliers.map((supplier) => [supplier.id, supplier.name]))
  const allocationMap = new Map<number, OrderAllocation[]>()
  if (!scope.forSupplier && items.length) {
    const links = await all<AllocationRecord>(supabase.from('order_item_job_request_items')
      .select('order_item_id, job_request_item_id, quantity').in('order_item_id', items.map((item) => item.id)).order('order_item_id').order('job_request_item_id'))
    if (links.length) {
      const jobItems = await all<JobItemRecord>(supabase.from('job_request_items').select('id, job_request_id').in('id', unique(links.map((link) => link.job_request_item_id))).order('id'))
      const jobs = jobItems.length ? await all<JobRecord>(supabase.from('job_requests').select('id, name').in('id', unique(jobItems.map((item) => item.job_request_id))).order('id')) : []
      const jobItemMap = new Map(jobItems.map((item) => [item.id, item.job_request_id]))
      const jobMap = new Map(jobs.map((job) => [job.id, job.name]))
      for (const link of links) {
        const jobId = jobItemMap.get(link.job_request_item_id)
        if (jobId == null) continue
        const allocations = allocationMap.get(link.order_item_id) ?? []
        allocations.push({ jobRequestItemId: link.job_request_item_id, jobRequestId: jobId, jobName: jobMap.get(jobId) ?? null, quantity: Number(link.quantity) })
        allocationMap.set(link.order_item_id, allocations)
      }
    }
  }
  const itemMap = new Map<number, OrderItem[]>()
  for (const item of items) {
    const list = itemMap.get(item.order_id) ?? []
    list.push({
      id: item.id, availabilityRequestItemId: item.availability_request_item_id, name: item.name, size: item.size,
      quantity: Number(item.quantity), unitPrice: asNumber(item.unit_price), total: asNumber(item.total), status: item.status, notes: item.notes,
      ...(!scope.forSupplier ? { allocations: allocationMap.get(item.id) ?? [] } : {}),
    })
    itemMap.set(item.order_id, list)
  }
  return records.map((order) => ({
    id: order.id, supplierId: order.supplier_id, supplierName: supplierNames.get(order.supplier_id) ?? `Supplier ${order.supplier_id}`,
    status: order.status, fulfillmentMethod: order.fulfillment_method, confirmationDate: order.confirmation_date,
    fulfillmentDate: order.fulfillment_date, notes: order.notes, createdAt: order.created_at, items: itemMap.get(order.id) ?? [],
  }))
}

export async function orderDetail(id: number, supplierId?: number): Promise<Order | null> {
  const orders = await listOrders({ orderId: id, supplierId, forSupplier: supplierId != null })
  return orders[0] ?? null
}

/** Choices for combining customer jobs, using names and familiar job references. */
export async function orderJobChoices(): Promise<JobRecord[]> {
  return all<JobRecord>(supabase.from('job_requests').select('id, name, fulfillment_method').eq('is_active', true)
    .not('status', 'in', '(closed_won,closed_lost,archived)').order('created_at', { ascending: false }).order('id'))
}

/** The uncommitted portion of each supplier answer and its selected customer jobs. */
export async function orderCandidates(jobIds: number[]): Promise<OrderCandidate[]> {
  const jobItems = await jobItemsForJobs(unique(jobIds))
  if (!jobItems.length) return []
  const links = await all<{ availability_request_item_id: number; job_request_item_id: number; quantity: number }>(supabase.from('availability_request_item_jobs')
    .select('availability_request_item_id, job_request_item_id, quantity').in('job_request_item_id', jobItems.map((item) => item.id)).order('availability_request_item_id').order('job_request_item_id'))
  if (!links.length) return []
  const arItemIds = unique(links.map((link) => link.availability_request_item_id))
  const items = await all<{ id: number; availability_request_id: number; name: string; size: string | null; status: string | null; quantity: number | null; available_quantity: number | null; unit_price: number | null }>(supabase.from('availability_request_items')
    .select('id, availability_request_id, name, size, status, quantity, available_quantity, unit_price').in('id', arItemIds).eq('is_active', true).order('id'))
  if (!items.length) return []
  const [requests, jobs, priorItems, customerOrderAllocations] = await Promise.all([
    all<{ id: number; supplier_id: number }>(supabase.from('availability_requests').select('id, supplier_id').in('id', unique(items.map((item) => item.availability_request_id))).eq('is_active', true).neq('status', 'closed').order('id')),
    all<JobRecord>(supabase.from('job_requests').select('id, name').in('id', unique(jobIds)).eq('is_active', true).not('status', 'in', '(closed_won,closed_lost,archived)').order('id')),
    all<{ id: number; order_id: number; availability_request_item_id: number; quantity: number }>(supabase.from('order_items').select('id, order_id, availability_request_item_id, quantity').in('availability_request_item_id', arItemIds).eq('is_active', true).order('id')),
    all<AllocationRecord>(supabase.from('order_item_job_request_items').select('order_item_id, job_request_item_id, quantity').in('job_request_item_id', jobItems.map((item) => item.id)).order('order_item_id').order('job_request_item_id')),
  ])
  if (!requests.length) return []
  const suppliers = await all<{ id: number; name: string }>(supabase.from('suppliers').select('id, name').in('id', unique(requests.map((request) => request.supplier_id))).eq('is_active', true).order('id'))
  const usedByLine = new Map<number, number>()
  const usedByAllocation = new Map<string, number>()
  const usedByJobItem = new Map<number, number>()
  // A job line can have competing availability responses. Its already ordered
  // demand must include orders sourced through every one of those responses.
  const priorItemIds = new Set(priorItems.map((item) => item.id))
  const additionalIds = unique(customerOrderAllocations.map((link) => link.order_item_id)).filter((id) => !priorItemIds.has(id))
  if (additionalIds.length) {
    priorItems.push(...await all<(typeof priorItems)[number]>(supabase.from('order_items')
      .select('id, order_id, availability_request_item_id, quantity').in('id', additionalIds).eq('is_active', true).order('id')))
  }
  if (priorItems.length) {
    const priorOrders = await all<{ id: number }>(supabase.from('orders').select('id').in('id', unique(priorItems.map((item) => item.order_id))).eq('is_active', true).neq('status', 'closed_lost').order('id'))
    const liveOrders = new Set(priorOrders.map((order) => order.id))
    const liveItems = priorItems.filter((item) => liveOrders.has(item.order_id))
    const itemMap = new Map(liveItems.map((item) => [item.id, item]))
    for (const item of liveItems) usedByLine.set(item.availability_request_item_id, (usedByLine.get(item.availability_request_item_id) ?? 0) + Number(item.quantity))
    if (liveItems.length) {
      const used = await all<AllocationRecord>(supabase.from('order_item_job_request_items').select('order_item_id, job_request_item_id, quantity').in('order_item_id', liveItems.map((item) => item.id)).order('order_item_id').order('job_request_item_id'))
      for (const link of used) {
        const item = itemMap.get(link.order_item_id)!
        const key = `${item.availability_request_item_id}:${link.job_request_item_id}`
        usedByAllocation.set(key, (usedByAllocation.get(key) ?? 0) + Number(link.quantity))
        usedByJobItem.set(link.job_request_item_id, (usedByJobItem.get(link.job_request_item_id) ?? 0) + Number(link.quantity))
      }
    }
  }
  const requestMap = new Map(requests.map((request) => [request.id, request]))
  const supplierMap = new Map(suppliers.map((supplier) => [supplier.id, supplier.name]))
  const jobItemMap = new Map(jobItems.map((item) => [item.id, item]))
  const jobMap = new Map(jobs.map((job) => [job.id, job.name]))
  return items.flatMap((item) => {
    const request = requestMap.get(item.availability_request_id)
    if (!request || !supplierMap.has(request.supplier_id) || !item.status || item.status === 'unavailable') return []
    const requested = item.quantity == null ? Infinity : Number(item.quantity)
    // Can Order describes stock the supplier will procure, so zero on hand is
    // not a cap. Other responses cannot exceed either the ask or the offer.
    const offered = item.status === 'can_order' || item.available_quantity == null ? Infinity : Number(item.available_quantity)
    const allocatedDemand = links.filter((link) => link.availability_request_item_id === item.id).reduce((sum, link) => sum + Number(link.quantity ?? 0), 0)
    const capacity = Math.min(requested, offered)
    const remainingQuantity = Math.max(0, (Number.isFinite(capacity) ? capacity : allocatedDemand) - (usedByLine.get(item.id) ?? 0))
    if (remainingQuantity === 0) return []
    const allocations = links.filter((link) => link.availability_request_item_id === item.id).flatMap((link) => {
      const jobItem = jobItemMap.get(link.job_request_item_id)
      const jobId = jobItem?.job_request_id
      if (jobId == null || !jobMap.has(jobId)) return []
      const allocationRemaining = link.quantity == null ? remainingQuantity : Math.max(0, Number(link.quantity) - (usedByAllocation.get(`${item.id}:${link.job_request_item_id}`) ?? 0))
      const demandRemaining = jobItem?.quantity == null ? remainingQuantity : Math.max(0, Number(jobItem.quantity) - (usedByJobItem.get(link.job_request_item_id) ?? 0))
      const remaining = Math.min(remainingQuantity, allocationRemaining, demandRemaining)
      return remaining > 0 ? [{ jobRequestItemId: link.job_request_item_id, jobRequestId: jobId, jobName: jobMap.get(jobId) ?? null, quantity: Number(link.quantity), remainingQuantity: remaining }] : []
    })
    return allocations.length ? [{ availabilityRequestItemId: item.id, availabilityRequestId: request.id, supplierId: request.supplier_id, supplierName: supplierMap.get(request.supplier_id)!, name: item.name, size: item.size, status: item.status, unitPrice: asNumber(item.unit_price), remainingQuantity, allocations }] : []
  })
}

/** All writes affecting associations and lifecycle run in a single database transaction. */
export async function createOrder(input: CreateOrderInput): Promise<number> {
  const { data, error } = await supabase.rpc('create_order', {
    p_supplier_id: input.supplierId, p_customer_confirmed: input.customerConfirmed,
    p_fulfillment_method: input.fulfillmentMethod, p_fulfillment_date: input.fulfillmentDate, p_notes: input.notes,
    p_items: input.items.map((item) => ({ availability_request_item_id: item.availabilityRequestItemId,
      allocations: item.allocations.map((allocation) => ({ job_request_item_id: allocation.jobRequestItemId, quantity: allocation.quantity })) })),
  })
  if (error) throw new Error(error.message)
  return Number(data)
}

export async function confirmOrder(id: number, supplierId: number, confirmationDate: string | null, fulfillmentDate: string | null): Promise<void> {
  const { error } = await supabase.rpc('confirm_order', { p_order_id: id, p_supplier_id: supplierId,
    p_confirmation_date: confirmationDate ?? new Date().toISOString().slice(0, 10), p_fulfillment_date: fulfillmentDate })
  if (error) throw new Error(error.message)
}

export async function closeOrder(id: number, status: 'closed_won' | 'closed_lost'): Promise<void> {
  const { error } = await supabase.rpc('close_order', { p_order_id: id, p_status: status })
  if (error) throw new Error(error.message)
}

export async function setOrderFulfillmentDate(id: number, date: string | null, supplierId?: number): Promise<void> {
  let query = supabase.from('orders').update({ fulfillment_date: date }).eq('id', id).eq('is_active', true).in('status', ['committed', 'confirmed'])
  if (supplierId != null) query = query.eq('supplier_id', supplierId)
  const { data, error } = await query.select('id')
  if (error) throw new Error(error.message)
  if (!data?.length) throw new Error('Order not found or already closed')
}
