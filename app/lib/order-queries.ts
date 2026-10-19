import 'server-only'
import { randomUUID } from 'node:crypto'

import type { ARJobSchedule } from '@/lib/availability'
import { type CreateOrderInput, type Order, type OrderLineChoice, type OrderShareJob, type OrderItem, type OrderStatus, type FulfillmentMethod, type PartnerOrderUpdate, type OrderItemStatus } from '@/lib/orders'
import { supabase } from '@/lib/supabase'

interface OrderRecord {
  public_token?: string | null
  record_name?: string | null
  id: number; job_request_id: number; supplier_id: number; status: OrderStatus; fulfillment_method: FulfillmentMethod | null
  confirmation_date: string | null; fulfillment_date: string | null; note_for_supplier: string | null; note_from_supplier: string | null
  note_for_customer: string | null; created_at: string
}
interface ItemRecord {
  id: number; order_id: number; candidate_id: number | null; name: string; size: string | null
  quantity: number; unit_price: number | null; total: number | null; status: string
  note_for_supplier: string | null; note_from_supplier: string | null; note_for_customer: string | null
}
interface JobRecord { customer_id?: number | null; shipping_address?: string | null; shipping_city?: string | null; shipping_state?: string | null; shipping_zip?: string | null; id: number; name: string | null; status?: string; is_active?: boolean; fulfillment_method?: FulfillmentMethod | null; expected_install_date?: string | null }

// Read optional record_name when present without requiring migration 0104.
// Public responses below still map only their intended fields.
const ORDER_COLUMNS = '*'
const ITEM_COLUMNS = 'id, order_id, candidate_id, name, size, quantity, unit_price, total, status, note_for_supplier, note_from_supplier, note_for_customer'
const unique = (ids: number[]) => [...new Set(ids)]
const asNumber = (value: number | null) => value == null ? null : Number(value)

/** Page reads too: a large order can exceed the API row cap. */
async function all<T>(query: { range: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }> }): Promise<T[]> {
  const rows: T[] = []
  while (true) {
    const { data, error } = await query.range(rows.length, rows.length + 999)
    if (error) throw new Error(error.message)
    rows.push(...(data ?? []) as T[])
    if ((data?.length ?? 0) < 1000) return rows
  }
}

/**
 * Each order belongs to one job and one supplier (0146). Portal responses
 * include the job name and fulfillment contacts, omitting the internal job ID.
 */
export async function listOrders(scope: { jobRequestId?: number; supplierId?: number; orderId?: number; forSupplier?: boolean }): Promise<Order[]> {
  let query = supabase.from('orders').select(ORDER_COLUMNS).eq('is_active', true).order('created_at', { ascending: false }).order('id')
  if (scope.jobRequestId != null) query = query.eq('job_request_id', scope.jobRequestId)
  if (scope.orderId != null) query = query.eq('id', scope.orderId)
  if (scope.supplierId != null) query = query.eq('supplier_id', scope.supplierId)
  const records = await all<OrderRecord>(query)
  if (!records.length) return []
  const jobIds = unique(records.map((order) => order.job_request_id))
  const supplierIds = unique(records.map((order) => order.supplier_id))
  const [suppliers, items, jobs, requests] = await Promise.all([
    all<{ id: number; name: string }>(supabase.from('suppliers').select('id, name').in('id', supplierIds).order('id')),
    all<ItemRecord>(supabase.from('order_items').select(ITEM_COLUMNS).in('order_id', records.map((order) => order.id)).eq('is_active', true).order('id')),
    all<JobRecord>(supabase.from('job_requests').select('id, name, status, is_active, expected_install_date, fulfillment_method, customer_id, shipping_address, shipping_city, shipping_state, shipping_zip').in('id', jobIds).order('id')),
    // One AR per job and supplier: the order header links to it.
    all<{ id: number; job_request_id: number; supplier_id: number; status: string; record_name?: string | null }>(supabase.from('availability_requests')
      .select('*').in('job_request_id', jobIds).in('supplier_id', supplierIds).order('id')),
  ])
  const customerIds = unique(jobs.flatMap((job) => job.customer_id == null ? [] : [job.customer_id]))
  const customers = customerIds.length ? await all<NonNullable<OrderShareJob['customer']> & { id: number }>(supabase.from('customers')
    .select('id, name, company, email, phone').in('id', customerIds).order('id')) : []
  const customerMap = new Map(customers.map(({ id, ...customer }) => [id, customer]))
  const supplierNames = new Map(suppliers.map((supplier) => [supplier.id, supplier.name]))
  const jobMap = new Map(jobs.map((job) => [job.id, job]))
  const requestFor = new Map(requests.filter((request) => !scope.forSupplier || request.status !== 'draft')
    .map((request) => [`${request.job_request_id}:${request.supplier_id}`, request]))
  const itemMap = new Map<number, OrderItem[]>()
  for (const item of items) {
    const list = itemMap.get(item.order_id) ?? []
    list.push({
      id: item.id, name: item.name, size: item.size,
      quantity: Number(item.quantity), unitPrice: asNumber(item.unit_price), total: asNumber(item.total), status: item.status,
      noteForSupplier: item.note_for_supplier ?? null, noteFromSupplier: item.note_from_supplier ?? null,
      ...(!scope.forSupplier ? { noteForCustomer: item.note_for_customer ?? null, candidateId: item.candidate_id ?? null } : {}),
    })
    itemMap.set(item.order_id, list)
  }
  return records.map((order) => {
    const job = jobMap.get(order.job_request_id)
    const shareJob: OrderShareJob | null = job ? { jobRequestId: job.id, jobName: job.name, expectedInstallDate: job.expected_install_date ?? null,
      customer: job.customer_id == null ? null : customerMap.get(job.customer_id) ?? null,
      shippingAddress: [job.shipping_address, job.shipping_city, job.shipping_state, job.shipping_zip].filter(Boolean).join(', ') || null } : null
    const schedule: ARJobSchedule | null = job ? { expectedInstallDate: job.expected_install_date ?? null, fulfillmentMethod: job.fulfillment_method ?? null,
      ...(!scope.forSupplier ? { jobRequestId: job.id, jobName: job.name } : {}) } : null
    const request = requestFor.get(`${order.job_request_id}:${order.supplier_id}`)
    return {
      recordName: order.record_name ?? null,
      ...(!scope.forSupplier ? { publicToken: order.public_token ?? null, jobRequestId: order.job_request_id } : {}),
      jobNames: job?.name ? [job.name] : [],
      ...(scope.forSupplier ? { customerDetails: shareJob ? [{ jobName: shareJob.jobName, customer: shareJob.customer, address: shareJob.shippingAddress }] : [] } : {}),
      id: order.id, supplierId: order.supplier_id, supplierName: supplierNames.get(order.supplier_id) ?? `Supplier ${order.supplier_id}`,
      closed: ['closed_won', 'closed_lost'].includes(order.status)
        || Boolean(job && (job.is_active === false || ['closed_won', 'closed_lost', 'archived'].includes(job.status ?? ''))),
      status: order.status, fulfillmentMethod: order.fulfillment_method, confirmationDate: order.confirmation_date,
      fulfillmentDate: order.fulfillment_date, noteForSupplier: order.note_for_supplier ?? null, noteFromSupplier: order.note_from_supplier ?? null,
      ...(!scope.forSupplier ? { noteForCustomer: order.note_for_customer ?? null } : {}), createdAt: order.created_at, items: itemMap.get(order.id) ?? [],
      ...(!scope.forSupplier ? { shareJobs: shareJob ? [shareJob] : [] } : {}),
      jobSchedules: schedule ? [schedule] : [],
      availabilityRequestId: request?.id ?? null,
      availabilityRequestName: request?.record_name ?? null,
    }
  })
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
  return { ...order, availabilityRequestId: null, availabilityRequestName: null }
}

/**
 * The job's lines whose selected candidate is not on an order yet, as
 * `job_lines` shows them: what `create_order` (0146) copies onto a row.
 */
export async function orderLineChoices(jobRequestId: number): Promise<OrderLineChoice[]> {
  const lines = await all<{ id: number; selected_candidate_id: number; candidate_supplier_id: number; candidate_name: string; size: string | null
    candidate_status: string | null; available_quantity: number | null; demanded_quantity: number | null; unit_price: number | null }>(supabase.from('job_lines')
    .select('id, selected_candidate_id, candidate_supplier_id, candidate_name, size, candidate_status, available_quantity, demanded_quantity, unit_price')
    .eq('job_request_id', jobRequestId).eq('is_active', true).order('id'))
  if (!lines.length) return []
  const [ordered, suppliers] = await Promise.all([
    all<{ candidate_id: number }>(supabase.from('order_items').select('candidate_id').in('candidate_id', lines.map((line) => line.selected_candidate_id)).order('id')),
    all<{ id: number; name: string }>(supabase.from('suppliers').select('id, name').in('id', unique(lines.map((line) => line.candidate_supplier_id))).eq('is_active', true).order('id')),
  ])
  const taken = new Set(ordered.map((row) => row.candidate_id))
  const supplierNames = new Map(suppliers.map((supplier) => [supplier.id, supplier.name]))
  return lines.flatMap((line) => taken.has(line.selected_candidate_id) || !supplierNames.has(line.candidate_supplier_id) ? [] : [{
    jobRequestItemId: line.id, supplierId: line.candidate_supplier_id, supplierName: supplierNames.get(line.candidate_supplier_id)!,
    name: line.candidate_name, size: line.size,
    status: line.candidate_status == null ? 'pending' : line.candidate_status === 'can_order' ? 'need_to_order' : line.candidate_status,
    // The available quantity the line shows (capped at its Qty), else its Qty.
    quantity: Number(line.available_quantity) > 0 ? Number(line.available_quantity) : asNumber(line.demanded_quantity),
    unitPrice: asNumber(line.unit_price),
  }])
}

/** The job's pickup/delivery, the default for a new order. */
export async function jobFulfillmentMethod(jobRequestId: number): Promise<FulfillmentMethod | null> {
  const { data, error } = await supabase.from('job_requests').select('fulfillment_method').eq('id', jobRequestId).maybeSingle()
  if (error) throw new Error(error.message)
  return (data?.fulfillment_method as FulfillmentMethod | null | undefined) ?? null
}

/** One open order per job and supplier: lines for a supplier with one go onto it. */
export async function createOrder(input: CreateOrderInput): Promise<number> {
  const { data, error } = await supabase.rpc('create_order', {
    p_job_request_id: input.jobRequestId, p_supplier_id: input.supplierId, p_job_request_item_ids: input.jobRequestItemIds,
    p_fulfillment_method: input.fulfillmentMethod, p_note_for_supplier: input.noteForSupplier, p_note_for_customer: input.noteForCustomer,
  })
  if (error) throw new Error(error.message)
  return Number(data)
}

/** A row added by hand: no candidate, edited in place afterwards. */
export async function addOrderItem(orderId: number): Promise<number> {
  const { data, error } = await supabase.from('order_items')
    .insert({ order_id: orderId, name: 'New plant', quantity: 1, status: 'pending' }).select('id').single()
  if (error) throw new Error(error.message)
  return Number(data.id)
}

export async function updatePartnerOrder(id: number, supplierId: number, update: PartnerOrderUpdate): Promise<void> {
  const patch = {
    ...('status' in update ? { status: update.status } : {}),
    ...('fulfillmentMethod' in update ? { fulfillment_method: update.fulfillmentMethod } : {}),
    ...('fulfillmentDate' in update ? { fulfillment_date: update.fulfillmentDate } : {}),
    ...('noteForSupplier' in update ? { note_for_supplier: update.noteForSupplier } : {}),
    ...('noteFromSupplier' in update ? { note_from_supplier: update.noteFromSupplier } : {}),
  }
  const { error } = await supabase.rpc('update_partner_order', { p_order_id: id, p_supplier_id: supplierId, p_patch: patch })
  if (error) throw new Error(error.message)
}

/** A row's procurement status, with the supplier's reply when given ('' clears it). */
export async function updatePartnerOrderItem(orderId: number, supplierId: number, itemId: number, status: OrderItemStatus, noteFromSupplier?: string): Promise<void> {
  const { error } = await supabase.rpc('update_partner_order_item', {
    p_order_id: orderId, p_supplier_id: supplierId, p_order_item_id: itemId, p_status: status,
    p_note_from_supplier: noteFromSupplier ?? null,
  })
  if (error) throw new Error(error.message)
}

export async function updatePartnerOrderItemPrice(orderId: number, supplierId: number, itemId: number, price: number | null): Promise<void> {
  const { error } = await supabase.rpc('update_partner_order_item_price', {
    p_order_id: orderId, p_supplier_id: supplierId, p_order_item_id: itemId, p_unit_price: price,
  })
  if (error) throw new Error(error.message)
}

/** Remove one order line. An empty order is removed too. */
export async function deleteOrderItem(orderId: number, itemId: number): Promise<boolean> {
  const { data, error } = await supabase.rpc('delete_order_item', {
    p_order_id: orderId,
    p_order_item_id: itemId,
  })
  if (error) throw new Error(error.message)
  return data === true
}

/** Saved order context for the notification on the order's job thread. */
export async function supplierOrderEventContext(orderId: number, forSupplierId?: number) {
  let query = supabase.from('orders').select('id, supplier_id, job_request_id').eq('id', orderId)
  if (forSupplierId != null) query = query.eq('supplier_id', forSupplierId)
  const { data: order, error: orderError } = await query.single()
  if (orderError) throw new Error(orderError.message)
  const { data: supplier, error: supplierError } = await supabase.from('suppliers')
    .select('name').eq('id', order.supplier_id).single()
  if (supplierError) throw new Error(supplierError.message)
  return {
    supplierId: order.supplier_id as number,
    supplierName: supplier.name as string,
    // An order belongs to one job (0146); that job's thread owns it.
    threadId: `jr-${order.job_request_id as number}`,
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
