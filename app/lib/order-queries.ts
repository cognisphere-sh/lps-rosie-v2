import 'server-only'

import type { ARJobSchedule } from '@/lib/availability'
import { isDirectOrder, type CreateDirectOrderInput, type CreateOrderInput, type DirectOrderCandidate, type Order, type OrderAllocation, type OrderCandidate, type OrderItem, type OrderStatus, type FulfillmentMethod, type PartnerOrderUpdate, type OrderItemStatus } from '@/lib/orders'
import { supabase } from '@/lib/supabase'

interface OrderRecord {
  id: number; supplier_id: number; status: OrderStatus; fulfillment_method: FulfillmentMethod | null
  confirmation_date: string | null; fulfillment_date: string | null; notes: string | null; supplier_notes: string | null; created_at: string
}
interface ItemRecord {
  id: number; order_id: number; availability_request_item_id: number | null; name: string; size: string | null
  quantity: number; unit_price: number | null; total: number | null; status: string; notes: string | null
}
interface AllocationRecord { order_item_id: number; job_request_item_id: number; quantity: number }
interface JobItemRecord { id: number; job_request_id: number; quantity?: number | null }
interface JobRecord { id: number; name: string | null; status?: string; is_active?: boolean; fulfillment_method?: FulfillmentMethod | null; expected_install_date?: string | null }

const ORDER_COLUMNS = 'id, supplier_id, status, fulfillment_method, confirmation_date, fulfillment_date, notes, supplier_notes, created_at'
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

/** Portal responses expose customer schedules and closure, never internal job identities. */
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
  const sourceIds = unique(items.flatMap((item) => item.availability_request_item_id == null ? [] : [item.availability_request_item_id]))
  const sourceItems = sourceIds.length ? await all<{ id: number; availability_request_id: number }>(supabase.from('availability_request_items')
    .select('id, availability_request_id').in('id', sourceIds).eq('is_active', true).order('id')) : []
  const sourceRequests = sourceItems.length ? await all<{ id: number; supplier_id: number }>(supabase.from('availability_requests')
    .select('id, supplier_id').in('id', unique(sourceItems.map((item) => item.availability_request_id)))
    .in('supplier_id', unique(records.map((order) => order.supplier_id))).eq('is_active', true).order('id')) : []
  const sourceRequestMap = new Map(sourceRequests.map((request) => [request.id, request.supplier_id]))
  const sourceItemMap = new Map(sourceItems.map((item) => [item.id, item.availability_request_id]))
  const orderSupplierMap = new Map(records.map((order) => [order.id, order.supplier_id]))
  const availabilityRequestMap = new Map<number, Set<number>>()
  for (const item of items) {
    const requestId = item.availability_request_item_id == null ? undefined : sourceItemMap.get(item.availability_request_item_id)
    if (requestId == null || sourceRequestMap.get(requestId) !== orderSupplierMap.get(item.order_id)) continue
    const requestIds = availabilityRequestMap.get(item.order_id) ?? new Set<number>()
    requestIds.add(requestId)
    availabilityRequestMap.set(item.order_id, requestIds)
  }
  const allocationMap = new Map<number, OrderAllocation[]>()
  const orderJobClosures = new Map<number, boolean[]>()
  const orderSchedules = new Map<number, Map<number, ARJobSchedule>>()
  const orderForItem = new Map(items.map((item) => [item.id, item.order_id]))
  if (items.length) {
    const links = await all<AllocationRecord>(supabase.from('order_item_job_request_items')
      .select('order_item_id, job_request_item_id, quantity').in('order_item_id', items.map((item) => item.id)).order('order_item_id').order('job_request_item_id'))
    if (links.length) {
      const jobItems = await all<JobItemRecord>(supabase.from('job_request_items').select('id, job_request_id').in('id', unique(links.map((link) => link.job_request_item_id))).order('id'))
      const jobs = jobItems.length ? await all<JobRecord>(supabase.from('job_requests').select(scope.forSupplier
        ? 'id, status, is_active, expected_install_date, fulfillment_method'
        : 'id, name, status, is_active, expected_install_date, fulfillment_method').in('id', unique(jobItems.map((item) => item.job_request_id))).order('id')) : []
      const jobItemMap = new Map(jobItems.map((item) => [item.id, item.job_request_id]))
      const jobMap = new Map(jobs.map((job) => [job.id, job]))
      for (const link of links) {
        const jobId = jobItemMap.get(link.job_request_item_id)
        const job = jobId == null ? undefined : jobMap.get(jobId)
        const orderId = orderForItem.get(link.order_item_id)!
        const closures = orderJobClosures.get(orderId) ?? []
        closures.push(Boolean(job && (job.is_active === false || ['closed_won', 'closed_lost', 'archived'].includes(job.status ?? ''))))
        orderJobClosures.set(orderId, closures)
        if (job && jobId != null) {
          const schedules = orderSchedules.get(orderId) ?? new Map<number, ARJobSchedule>()
          schedules.set(jobId, { expectedInstallDate: job.expected_install_date ?? null, fulfillmentMethod: job.fulfillment_method ?? null,
            ...(!scope.forSupplier ? { jobRequestId: jobId, jobName: job.name } : {}) })
          orderSchedules.set(orderId, schedules)
        }
        if (scope.forSupplier || jobId == null) continue
        const allocations = allocationMap.get(link.order_item_id) ?? []
        allocations.push({ jobRequestItemId: link.job_request_item_id, jobRequestId: jobId, jobName: jobMap.get(jobId)?.name ?? null, quantity: Number(link.quantity) })
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
    closed: ['closed_won', 'closed_lost'].includes(order.status)
      || Boolean(orderJobClosures.get(order.id)?.length && orderJobClosures.get(order.id)!.every(Boolean)),
    status: order.status, fulfillmentMethod: order.fulfillment_method, confirmationDate: order.confirmation_date,
    fulfillmentDate: order.fulfillment_date, notes: order.notes, createdAt: order.created_at, items: itemMap.get(order.id) ?? [],
    supplierNotes: order.supplier_notes ?? null,
    jobSchedules: [...(orderSchedules.get(order.id) ?? [])].sort(([a], [b]) => a - b).map(([, schedule]) => schedule),
    availabilityRequestIds: [...(availabilityRequestMap.get(order.id) ?? [])].sort((a, b) => a - b),
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

/** Active suppliers and quote lines for the no-availability order path. */
export async function orderSuppliers(): Promise<{ id: number; name: string }[]> {
  return all<{ id: number; name: string }>(supabase.from('suppliers').select('id, name').eq('is_active', true).order('name').order('id'))
}

export async function directOrderCandidates(jobIds: number[]): Promise<DirectOrderCandidate[]> {
  const items = await all<{ id: number; job_request_id: number; name: string; size: string | null; quantity: number | null; unit_price: number | null }>(supabase.from('job_request_items')
    .select('id, job_request_id, name, size, quantity, unit_price').in('job_request_id', unique(jobIds)).eq('is_active', true).order('id'))
  if (!items.length) return []
  const [jobs, allocations] = await Promise.all([
    all<JobRecord>(supabase.from('job_requests').select('id, name').in('id', unique(jobIds)).eq('is_active', true)
      .not('status', 'in', '(closed_won,closed_lost,archived)').order('id')),
    all<AllocationRecord>(supabase.from('order_item_job_request_items').select('order_item_id, job_request_item_id, quantity')
      .in('job_request_item_id', items.map((item) => item.id)).order('order_item_id').order('job_request_item_id')),
  ])
  if (!jobs.length) return []
  const orderItemIds = unique(allocations.map((allocation) => allocation.order_item_id))
  const orderItems = orderItemIds.length ? await all<{ id: number; order_id: number; is_active: boolean }>(supabase.from('order_items')
    .select('id, order_id, is_active').in('id', orderItemIds).eq('is_active', true).order('id')) : []
  const orderIds = unique(orderItems.map((item) => item.order_id))
  const orders = orderIds.length ? await all<{ id: number; status: string; is_active: boolean }>(supabase.from('orders')
    .select('id, status, is_active').in('id', orderIds).eq('is_active', true).neq('status', 'closed_lost').order('id')) : []
  const liveOrders = new Set(orders.map((order) => order.id))
  const orderForItem = new Map(orderItems.map((item) => [item.id, item.order_id]))
  const used = new Map<number, number>()
  for (const allocation of allocations) {
    if (liveOrders.has(orderForItem.get(allocation.order_item_id) ?? -1)) {
      used.set(allocation.job_request_item_id, (used.get(allocation.job_request_item_id) ?? 0) + Number(allocation.quantity))
    }
  }
  const jobMap = new Map(jobs.map((job) => [job.id, job]))
  return items.flatMap((item) => {
    const job = jobMap.get(item.job_request_id)
    const remaining = item.quantity == null ? 0 : Math.max(0, Number(item.quantity) - (used.get(item.id) ?? 0))
    return job && remaining > 0 ? [{ jobRequestItemId: item.id, jobRequestId: item.job_request_id, jobName: job.name,
      name: item.name, size: item.size, unitPrice: asNumber(item.unit_price), remainingQuantity: remaining }] : []
  })
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
export async function createOrder(input: CreateOrderInput | CreateDirectOrderInput): Promise<number> {
  if (isDirectOrder(input)) {
    const { data, error } = await supabase.rpc('create_direct_order', {
      p_supplier_id: input.supplierId, p_customer_confirmed: input.customerConfirmed,
      p_fulfillment_method: input.fulfillmentMethod, p_fulfillment_date: null, p_notes: input.notes,
      p_items: input.items.map((item) => ({ job_request_item_id: item.jobRequestItemId, quantity: item.quantity })),
    })
    if (error) throw new Error(error.message)
    return Number(data)
  }
  const { data, error } = await supabase.rpc('create_order', {
    p_supplier_id: input.supplierId, p_customer_confirmed: input.customerConfirmed,
    p_fulfillment_method: input.fulfillmentMethod, p_fulfillment_date: null, p_notes: input.notes,
    p_items: input.items.map((item) => ({ availability_request_item_id: item.availabilityRequestItemId,
      allocations: item.allocations.map((allocation) => ({ job_request_item_id: allocation.jobRequestItemId, quantity: allocation.quantity })) })),
  })
  if (error) throw new Error(error.message)
  return Number(data)
}

export async function updatePartnerOrder(id: number, supplierId: number, update: PartnerOrderUpdate): Promise<void> {
  const patch = {
    ...('status' in update ? { status: update.status } : {}),
    ...('fulfillmentMethod' in update ? { fulfillment_method: update.fulfillmentMethod } : {}),
    ...('fulfillmentDate' in update ? { fulfillment_date: update.fulfillmentDate } : {}),
    ...('supplierNotes' in update ? { supplier_notes: update.supplierNotes } : {}),
  }
  const { error } = await supabase.rpc('update_partner_order', { p_order_id: id, p_supplier_id: supplierId, p_patch: patch })
  if (error) throw new Error(error.message)
}

/** Suppliers may keep their own order-line procurement state current. */
export async function updatePartnerOrderItem(orderId: number, supplierId: number, itemId: number, status: OrderItemStatus): Promise<void> {
  const { error } = await supabase.rpc('update_partner_order_item', {
    p_order_id: orderId, p_supplier_id: supplierId, p_order_item_id: itemId, p_status: status,
  })
  if (error) throw new Error(error.message)
}

/** Remove one order line and its job allocations. An empty order is removed too. */
export async function deleteOrderItem(orderId: number, itemId: number): Promise<boolean> {
  const { data, error } = await supabase.rpc('delete_order_item', {
    p_order_id: orderId,
    p_order_item_id: itemId,
  })
  if (error) throw new Error(error.message)
  return data === true
}

/** Saved order context for Rosie's supplier/order thread notification. */
export async function supplierOrderEventContext(orderId: number, forSupplierId?: number) {
  let query = supabase.from('orders').select('id, supplier_id').eq('id', orderId)
  if (forSupplierId != null) query = query.eq('supplier_id', forSupplierId)
  const { data: order, error: orderError } = await query.single()
  if (orderError) throw new Error(orderError.message)
  const { data: supplier, error: supplierError } = await supabase.from('suppliers')
    .select('name, rosie_thread_id').eq('id', order.supplier_id).single()
  if (supplierError) throw new Error(supplierError.message)
  return {
    supplierId: order.supplier_id as number,
    supplierName: supplier.name as string,
    threadId: supplier.rosie_thread_id as string | null,
    orderId,
  }
}
