import 'server-only'
import { randomUUID } from 'node:crypto'

import type { ARJobSchedule } from '@/lib/availability'
import { isDirectOrder, type CreateDirectOrderInput, type CreateOrderInput, type DirectOrderCandidate, type Order, type OrderAllocation, type OrderShareJob, type OrderCandidate, type OrderItem, type OrderStatus, type FulfillmentMethod, type PartnerOrderUpdate, type OrderItemStatus } from '@/lib/orders'
import { supabase } from '@/lib/supabase'

interface OrderRecord {
  public_token?: string | null
  record_name?: string | null
  id: number; supplier_id: number; status: OrderStatus; fulfillment_method: FulfillmentMethod | null
  confirmation_date: string | null; fulfillment_date: string | null; note_for_supplier: string | null; note_for_customer: string | null; created_at: string
}
interface ItemRecord {
  id: number; order_id: number; name: string; size: string | null
  quantity: number; unit_price: number | null; total: number | null; status: string; note_for_supplier: string | null; note_for_customer: string | null
}
interface AllocationRecord { order_item_id: number; job_request_item_id: number; quantity: number }
interface JobItemRecord { id: number; job_request_id: number; demanded_quantity?: number | null }
interface JobRecord { customer_id?: number | null; shipping_address?: string | null; shipping_city?: string | null; shipping_state?: string | null; shipping_zip?: string | null; id: number; name: string | null; status?: string; is_active?: boolean; fulfillment_method?: FulfillmentMethod | null; expected_install_date?: string | null }

// Read optional record_name when present without requiring migration 0104.
// Public responses below still map only their intended fields.
const ORDER_COLUMNS = '*'
const ITEM_COLUMNS = 'id, order_id, name, size, quantity, unit_price, total, status, note_for_supplier, note_for_customer'
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
  return all<JobItemRecord>(supabase.from('job_request_items').select('id, job_request_id, demanded_quantity')
    .in('job_request_id', jobIds).eq('is_active', true).order('id'))
}

/** Portal responses include job names and fulfillment contacts, omitting internal job IDs and allocations. */
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
  const links = items.length ? await all<AllocationRecord>(supabase.from('order_item_job_request_items')
    .select('order_item_id, job_request_item_id, quantity').in('order_item_id', items.map((item) => item.id)).order('order_item_id').order('job_request_item_id')) : []
  const arLinks = links.length ? await all<{ availability_request_item_id: number; job_request_item_id: number }>(supabase.from('availability_request_item_jobs')
    .select('availability_request_item_id, job_request_item_id').in('job_request_item_id', unique(links.map((link) => link.job_request_item_id)))
    .order('availability_request_item_id').order('job_request_item_id')) : []
  const relatedItems = arLinks.length ? await all<{ id: number; availability_request_id: number }>(supabase.from('availability_request_items')
    .select('id, availability_request_id').in('id', unique(arLinks.map((link) => link.availability_request_item_id))).eq('is_active', true).order('id')) : []
  const relatedRequests = relatedItems.length ? await all<{ id: number; supplier_id: number; record_name?: string | null }>(supabase.from('availability_requests')
    .select('*').in('id', unique(relatedItems.map((item) => item.availability_request_id)))
    .in('supplier_id', unique(records.map((order) => order.supplier_id))).eq('is_active', true).order('id')) : []
  const relatedRequestMap = new Map(relatedRequests.map((request) => [request.id, request.supplier_id]))
  const relatedItemMap = new Map(relatedItems.map((item) => [item.id, item.availability_request_id]))
  const orderSupplierMap = new Map(records.map((order) => [order.id, order.supplier_id]))
  const orderForItem = new Map(items.map((item) => [item.id, item.order_id]))
  const requestsByJobItem = new Map<number, Set<number>>()
  for (const link of arLinks) {
    const requestId = relatedItemMap.get(link.availability_request_item_id)
    if (requestId == null || !relatedRequestMap.has(requestId)) continue
    const requestIds = requestsByJobItem.get(link.job_request_item_id) ?? new Set<number>()
    requestIds.add(requestId)
    requestsByJobItem.set(link.job_request_item_id, requestIds)
  }
  // These are related ARs through shared job items, not a stored source choice.
  const availabilityRequestMap = new Map<number, Set<number>>()
  for (const link of links) {
    const orderId = orderForItem.get(link.order_item_id)!
    const requestIds = availabilityRequestMap.get(orderId) ?? new Set<number>()
    for (const requestId of requestsByJobItem.get(link.job_request_item_id) ?? []) {
      if (relatedRequestMap.get(requestId) === orderSupplierMap.get(orderId)) requestIds.add(requestId)
    }
    availabilityRequestMap.set(orderId, requestIds)
  }
  const allocationMap = new Map<number, OrderAllocation[]>()
  const orderJobClosures = new Map<number, boolean[]>()
  const orderShareJobs = new Map<number, Map<number, OrderShareJob>>()
  const orderSchedules = new Map<number, Map<number, ARJobSchedule>>()
  if (items.length) {
    if (links.length) {
      const jobItems = await all<JobItemRecord>(supabase.from('job_request_items').select('id, job_request_id').in('id', unique(links.map((link) => link.job_request_item_id))).order('id'))
      const jobs = jobItems.length ? await all<JobRecord>(supabase.from('job_requests').select('id, name, status, is_active, expected_install_date, fulfillment_method, customer_id, shipping_address, shipping_city, shipping_state, shipping_zip').in('id', unique(jobItems.map((item) => item.job_request_id))).order('id')) : []
      const customerIds = unique(jobs.flatMap((job) => job.customer_id == null ? [] : [job.customer_id]))
      const customers = customerIds.length ? await all<NonNullable<OrderShareJob['customer']> & { id: number }>(supabase.from('customers')
        .select('id, name, company, email, phone').in('id', customerIds).order('id')) : []
      const customerMap = new Map(customers.map(({ id, ...customer }) => [id, customer]))
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
          {
            const shareJobs = orderShareJobs.get(orderId) ?? new Map<number, OrderShareJob>()
            shareJobs.set(jobId, { jobRequestId: jobId, jobName: job.name, expectedInstallDate: job.expected_install_date ?? null,
              customer: job.customer_id == null ? null : customerMap.get(job.customer_id) ?? null,
              shippingAddress: [job.shipping_address, job.shipping_city, job.shipping_state, job.shipping_zip].filter(Boolean).join(', ') || null })
            orderShareJobs.set(orderId, shareJobs)
          }
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
      id: item.id, name: item.name, size: item.size,
      quantity: Number(item.quantity), unitPrice: asNumber(item.unit_price), total: asNumber(item.total), status: item.status, noteForSupplier: item.note_for_supplier ?? null,
      ...(!scope.forSupplier ? { noteForCustomer: item.note_for_customer ?? null } : {}),
      ...(!scope.forSupplier ? { allocations: allocationMap.get(item.id) ?? [] } : {}),
    })
    itemMap.set(item.order_id, list)
  }
  return records.map((order) => ({
    recordName: order.record_name ?? null,
    ...(!scope.forSupplier ? { publicToken: order.public_token ?? null } : {}),
    jobNames: [...(orderShareJobs.get(order.id)?.values() ?? [])].flatMap((job) => job.jobName ? [job.jobName] : []),
    ...(scope.forSupplier ? { customerDetails: [...(orderShareJobs.get(order.id)?.values() ?? [])].map((job) => ({ jobName: job.jobName, customer: job.customer, address: job.shippingAddress })) } : {}),
    id: order.id, supplierId: order.supplier_id, supplierName: supplierNames.get(order.supplier_id) ?? `Supplier ${order.supplier_id}`,
    closed: ['closed_won', 'closed_lost'].includes(order.status)
      || Boolean(orderJobClosures.get(order.id)?.length && orderJobClosures.get(order.id)!.every(Boolean)),
    status: order.status, fulfillmentMethod: order.fulfillment_method, confirmationDate: order.confirmation_date,
    fulfillmentDate: order.fulfillment_date, noteForSupplier: order.note_for_supplier ?? null,
    ...(!scope.forSupplier ? { noteForCustomer: order.note_for_customer ?? null } : {}), createdAt: order.created_at, items: itemMap.get(order.id) ?? [],
    ...(!scope.forSupplier ? { shareJobs: [...(orderShareJobs.get(order.id) ?? [])].sort(([a], [b]) => a - b).map(([, job]) => job) } : {}),
    jobSchedules: [...(orderSchedules.get(order.id) ?? [])].sort(([a], [b]) => a - b).map(([, schedule]) => schedule),
    availabilityRequestNames: Object.fromEntries(relatedRequests.filter((request) => availabilityRequestMap.get(order.id)?.has(request.id) && request.record_name)
      .map((request) => [request.id, request.record_name!])),
    availabilityRequestIds: [...(availabilityRequestMap.get(order.id) ?? [])].sort((a, b) => a - b),
  }))
}

export async function orderDetail(id: number, supplierId?: number): Promise<Order | null> {
  const orders = await listOrders({ orderId: id, supplierId, forSupplier: supplierId != null })
  return orders[0] ?? null
}

/** Publishing again rotates the capability; revoking clears it immediately. */
export async function setOrderPublic(id: number, isPublic: boolean): Promise<string | null> {
  const order = await orderDetail(id)
  if (!order) throw new Error('Order not found')
  if (isPublic && order.closed) throw new Error('This order is closed')
  const { data, error } = await supabase.from('orders')
    .update({ public_token: isPublic ? randomUUID() : null })
    .eq('id', id).eq('is_active', true).select('public_token').single()
  if (error) throw new Error(error.message)
  return data.public_token
}

/** Public links expose only the supplier view, without portal associations. */
export async function publicOrder(token: string): Promise<Order | null> {
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(token)) return null
  const lookup = () => supabase.from('orders').select('id, supplier_id')
    .eq('public_token', token).eq('is_active', true)
    .not('status', 'in', '(closed_won,closed_lost)').maybeSingle()
  const { data, error } = await lookup()
  if (error) throw new Error(error.message)
  if (!data) return null
  const { data: supplier, error: supplierError } = await supabase.from('suppliers')
    .select('id').eq('id', data.supplier_id).eq('is_active', true).maybeSingle()
  if (supplierError) throw new Error(supplierError.message)
  if (!supplier) return null
  const order = await orderDetail(data.id, data.supplier_id)
  if (!order || order.closed) return null
  const current = await lookup()
  if (current.error) throw new Error(current.error.message)
  if (!current.data || current.data.id !== order.id || current.data.supplier_id !== order.supplierId) return null
  return { ...order, availabilityRequestIds: [], availabilityRequestNames: {} }
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
  const items = await all<{ id: number; job_request_id: number; name: string; size: string | null; demanded_quantity: number | null; unit_price: number | null }>(supabase.from('job_request_items')
    .select('id, job_request_id, name, size, demanded_quantity, unit_price').in('job_request_id', unique(jobIds)).eq('is_active', true).order('id'))
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
    const remaining = item.demanded_quantity == null ? 0 : Math.max(0, Number(item.demanded_quantity) - (used.get(item.id) ?? 0))
    return job && remaining > 0 ? [{ jobRequestItemId: item.id, jobRequestId: item.job_request_id, jobName: job.name,
      name: item.name, size: item.size, unitPrice: asNumber(item.unit_price), remainingQuantity: remaining }] : []
  })
}

/** Supplier answers minus commitments to that supplier for their allocated job items. */
export async function orderCandidates(jobIds: number[]): Promise<OrderCandidate[]> {
  const jobItems = await jobItemsForJobs(unique(jobIds))
  if (!jobItems.length) return []
  const links = await all<{ availability_request_item_id: number; job_request_item_id: number; quantity: number | null }>(supabase.from('availability_request_item_jobs')
    .select('availability_request_item_id, job_request_item_id, quantity').in('job_request_item_id', jobItems.map((item) => item.id)).order('availability_request_item_id').order('job_request_item_id'))
  if (!links.length) return []
  const arItemIds = unique(links.map((link) => link.availability_request_item_id))
  const items = await all<{ id: number; availability_request_id: number; name: string; size: string | null; status: string | null; demanded_quantity: number | null; available_quantity: number | null; unit_price: number | null }>(supabase.from('availability_request_items')
    .select('id, availability_request_id, name, size, status, demanded_quantity, available_quantity, unit_price').in('id', arItemIds).eq('is_active', true).order('id'))
  if (!items.length) return []
  const [requests, jobs, allLinks] = await Promise.all([
    all<{ id: number; supplier_id: number; record_name?: string | null }>(supabase.from('availability_requests').select('*').in('id', unique(items.map((item) => item.availability_request_id))).eq('is_active', true).neq('status', 'closed').order('id')),
    all<JobRecord>(supabase.from('job_requests').select('id, name').in('id', unique(jobIds)).eq('is_active', true).not('status', 'in', '(closed_won,closed_lost,archived)').order('id')),
    all<(typeof links)[number]>(supabase.from('availability_request_item_jobs')
      .select('availability_request_item_id, job_request_item_id, quantity').in('availability_request_item_id', items.map((item) => item.id))
      .order('availability_request_item_id').order('job_request_item_id')),
  ])
  if (!requests.length) return []
  const suppliers = await all<{ id: number; name: string }>(supabase.from('suppliers').select('id, name').in('id', unique(requests.map((request) => request.supplier_id))).eq('is_active', true).order('id'))
  // Include every job on a shared AR, even when only one job is being viewed.
  const customerOrderAllocations = await all<AllocationRecord>(supabase.from('order_item_job_request_items')
    .select('order_item_id, job_request_item_id, quantity').in('job_request_item_id', unique(allLinks.map((link) => link.job_request_item_id)))
    .order('order_item_id').order('job_request_item_id'))
  const priorItemIds = unique(customerOrderAllocations.map((link) => link.order_item_id))
  const priorItems = priorItemIds.length ? await all<{ id: number; order_id: number }>(supabase.from('order_items')
    .select('id, order_id').in('id', priorItemIds).eq('is_active', true).order('id')) : []
  const usedBySupplierJobItem = new Map<string, number>()
  const usedByJobItem = new Map<number, number>()
  if (priorItems.length) {
    const priorOrders = await all<{ id: number; supplier_id: number }>(supabase.from('orders').select('id, supplier_id')
      .in('id', unique(priorItems.map((item) => item.order_id))).eq('is_active', true).neq('status', 'closed_lost').order('id'))
    const supplierForOrder = new Map(priorOrders.map((order) => [order.id, order.supplier_id]))
    const supplierForItem = new Map(priorItems.flatMap((item) => {
      const supplierId = supplierForOrder.get(item.order_id)
      return supplierId == null ? [] : [[item.id, supplierId] as const]
    }))
    for (const link of customerOrderAllocations) {
      const supplierId = supplierForItem.get(link.order_item_id)
      if (supplierId == null) continue
      const key = `${supplierId}:${link.job_request_item_id}`
      usedBySupplierJobItem.set(key, (usedBySupplierJobItem.get(key) ?? 0) + Number(link.quantity))
      usedByJobItem.set(link.job_request_item_id, (usedByJobItem.get(link.job_request_item_id) ?? 0) + Number(link.quantity))
    }
  }
  const requestMap = new Map(requests.map((request) => [request.id, request]))
  const supplierMap = new Map(suppliers.map((supplier) => [supplier.id, supplier.name]))
  const jobItemMap = new Map(jobItems.map((item) => [item.id, item]))
  const jobMap = new Map(jobs.map((job) => [job.id, job.name]))
  return items.flatMap((item) => {
    const request = requestMap.get(item.availability_request_id)
    if (!request || !supplierMap.has(request.supplier_id) || !item.status || item.status === 'unavailable') return []
    const requested = item.demanded_quantity == null ? Infinity : Number(item.demanded_quantity)
    // Can Order describes stock the supplier will procure, so zero on hand is
    // not a cap. Other responses cannot exceed either the ask or the offer.
    const offered = item.status === 'can_order' || item.available_quantity == null ? Infinity : Number(item.available_quantity)
    const itemLinks = allLinks.filter((link) => link.availability_request_item_id === item.id)
    const allocatedDemand = itemLinks.reduce((sum, link) => sum + Number(link.quantity ?? 0), 0)
    const capacity = Math.min(requested, offered)
    const alreadyOrdered = itemLinks.reduce((sum, link) => sum + (usedBySupplierJobItem.get(`${request.supplier_id}:${link.job_request_item_id}`) ?? 0), 0)
    const remainingQuantity = Math.max(0, (Number.isFinite(capacity) ? capacity : allocatedDemand) - alreadyOrdered)
    if (remainingQuantity === 0) return []
    const allocations = links.filter((link) => link.availability_request_item_id === item.id).flatMap((link) => {
      const jobItem = jobItemMap.get(link.job_request_item_id)
      const jobId = jobItem?.job_request_id
      if (jobId == null || !jobMap.has(jobId)) return []
      const allocationRemaining = link.quantity == null ? remainingQuantity : Math.max(0, Number(link.quantity) - (usedBySupplierJobItem.get(`${request.supplier_id}:${link.job_request_item_id}`) ?? 0))
      const demandRemaining = jobItem?.demanded_quantity == null ? remainingQuantity : Math.max(0, Number(jobItem.demanded_quantity) - (usedByJobItem.get(link.job_request_item_id) ?? 0))
      const remaining = Math.min(remainingQuantity, allocationRemaining, demandRemaining)
      return remaining > 0 ? [{ jobRequestItemId: link.job_request_item_id, jobRequestId: jobId, jobName: jobMap.get(jobId) ?? null, quantity: Number(link.quantity), remainingQuantity: remaining }] : []
    })
    return allocations.length ? [{ availabilityRequestItemId: item.id, availabilityRequestId: request.id, availabilityRequestName: request.record_name ?? null, supplierId: request.supplier_id, supplierName: supplierMap.get(request.supplier_id)!, name: item.name, size: item.size, status: item.status, unitPrice: asNumber(item.unit_price), remainingQuantity, allocations }] : []
  })
}

/** All writes affecting associations and lifecycle run in a single database transaction. */
export async function createOrder(input: CreateOrderInput | CreateDirectOrderInput): Promise<number> {
  if (isDirectOrder(input)) {
    const { data, error } = await supabase.rpc('create_direct_order', {
      p_supplier_id: input.supplierId, p_customer_confirmed: input.customerConfirmed,
      p_fulfillment_method: input.fulfillmentMethod, p_fulfillment_date: null, p_note_for_supplier: input.noteForSupplier,
      p_note_for_customer: input.noteForCustomer,
      p_items: input.items.map((item) => ({ job_request_item_id: item.jobRequestItemId, quantity: item.quantity })),
    })
    if (error) throw new Error(error.message)
    return Number(data)
  }
  const { data, error } = await supabase.rpc('create_order', {
    p_supplier_id: input.supplierId, p_customer_confirmed: input.customerConfirmed,
    p_fulfillment_method: input.fulfillmentMethod, p_fulfillment_date: null, p_note_for_supplier: input.noteForSupplier,
      p_note_for_customer: input.noteForCustomer,
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
    ...('noteForSupplier' in update ? { note_for_supplier: update.noteForSupplier } : {}),
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

export async function updatePartnerOrderItemPrice(orderId: number, supplierId: number, itemId: number, price: number | null): Promise<void> {
  const { error } = await supabase.rpc('update_partner_order_item_price', {
    p_order_id: orderId, p_supplier_id: supplierId, p_order_item_id: itemId, p_unit_price: price,
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

/** Scoped to the active line after the admin endpoint checks order access/closure. */
export async function updateOrderItemCell(orderId: number, itemId: number, patch: Record<string, string | number | null>): Promise<void> {
  const { data, error } = await supabase.from('order_items').update(patch)
    .eq('order_id', orderId).eq('id', itemId).eq('is_active', true).select('id').single()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('Order item not found')
}
