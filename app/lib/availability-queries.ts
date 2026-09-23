import 'server-only'
import { randomUUID } from 'node:crypto'

import type {
  ARDetail,
  ARItem,
  ARJobSchedule,
  ARSummary,
  SupplierItemLine,
  SupplierLink,
} from '@/lib/availability'
import { redactPartnerRequestRefs } from '@/lib/partner-display'
import { supabase } from '@/lib/supabase'
import { buildAvailabilitySnapshots } from '@/lib/availability-allocations'

// The reads and writes behind availability requests (migration 0062).
// Server-only for the same reason every other query module is: the client
// holds the project's secret key.

interface ARRecord {
  record_name?: string | null
  public_token: string | null
  id: number
  job_request_id: number | null
  supplier_id: number
  share_customer_details: boolean
  status: string
  submitted_at: string | null
  created_at: string
  lps_notes: string | null
  supplier_notes: string | null
}

interface ARItemRecord {
  id: number
  availability_request_id: number
  job_request_item_id: number | null
  name: string
  size: string | null
  quantity: number | null
  status: string | null
  available_quantity: number | null
  unit_price: number | null
  notes: string | null
  lps_notes: string | null
}


const AR_COLUMNS =
  'record_name, id, job_request_id, supplier_id, share_customer_details, status, submitted_at, created_at, lps_notes, supplier_notes, public_token'
const AR_ITEM_COLUMNS =
  'id, availability_request_id, job_request_item_id, name, size, quantity, status, available_quantity, unit_price, notes, lps_notes'

const toARItem = (r: ARItemRecord): ARItem => ({
  id: r.id,
  jobRequestItemId: r.job_request_item_id,
  name: r.name,
  size: r.size,
  quantity: r.quantity == null ? null : Number(r.quantity),
  status: r.status,
  availableQuantity: r.available_quantity == null ? null : Number(r.available_quantity),
  unitPrice: r.unit_price == null ? null : Number(r.unit_price),
  notes: r.notes,
  lpsNotes: r.lps_notes,
})


/** id → display name for a set of suppliers, one query. */
async function supplierNames(ids: number[]): Promise<Map<number, string>> {
  if (!ids.length) return new Map()
  const { data, error } = await supabase.from('suppliers').select('id, name').in('id', ids)
  if (error) throw new Error(`suppliers: ${error.message}`)
  return new Map((data ?? []).map((s) => [(s as { id: number }).id, (s as { name: string }).name]))
}

/** id → job name for a set of requests, one query. */
async function jobNames(ids: number[]): Promise<Map<number, string | null>> {
  if (!ids.length) return new Map()
  const data = await availabilityLinks<{ id: number; name: string | null }>(supabase.from('job_requests')
    .select('id, name').in('id', ids).order('id'))
  return new Map(
    (data ?? []).map((r) => [(r as { id: number }).id, (r as { name: string | null }).name]),
  )
}

/** Batch every linked job's schedule; source identity is admin-only metadata. */
async function jobSchedules(ids: number[], includeJobIdentity: boolean): Promise<Map<number, ARJobSchedule>> {
  if (!ids.length) return new Map()
  const rows = await availabilityLinks<{
    id: number
    name: string | null
    expected_install_date: string | null
    fulfillment_method: 'pickup' | 'delivery' | null
  }>(supabase.from('job_requests')
    .select('id, name, expected_install_date, fulfillment_method').in('id', [...new Set(ids)]).order('id'))
  return new Map(rows.map((job) => [job.id, {
    ...(includeJobIdentity ? { jobRequestId: job.id, jobName: job.name } : {}),
    expectedInstallDate: job.expected_install_date ?? null,
    fulfillmentMethod: job.fulfillment_method ?? null,
  }]))
}

/** Page junctions so combined grower requests retain all source associations. */
async function availabilityLinks<T>(query: { range: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }> }): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await query.range(from, from + 999)
    if (error) throw new Error(error.message)
    rows.push(...(data ?? []) as T[])
    if ((data?.length ?? 0) < 1000) return rows
  }
}

async function jobsByAvailability(ids: number[]): Promise<Map<number, number[]>> {
  const result = new Map<number, number[]>()
  if (!ids.length) return result
  const data = await availabilityLinks<{ availability_request_id: number; job_request_id: number }>(supabase.from('availability_request_jobs')
    .select('availability_request_id, job_request_id').in('availability_request_id', ids)
    .order('availability_request_id').order('job_request_id'))
  for (const row of data) result.set(row.availability_request_id,
    [...(result.get(row.availability_request_id) ?? []), row.job_request_id])
  return result
}

async function summarize(records: ARRecord[]): Promise<ARSummary[]> {
  if (!records.length) return []
  const suppliers = await supplierNames([...new Set(records.map((r) => r.supplier_id))])
  const linkedJobs = await jobsByAvailability(records.map((r) => r.id))
  const jobs = await jobNames([...new Set([...linkedJobs.values()].flat())])

  // Counts over every request at once — a list of forty must not be forty queries.
  const { data, error } = await supabase
    .from('availability_request_items')
    .select('availability_request_id, status')
    .in('availability_request_id', records.map((r) => r.id))
    .eq('is_active', true)
  if (error) throw new Error(`availability_request_items: ${error.message}`)
  const counts = new Map<number, { items: number; answered: number }>()
  for (const row of (data ?? []) as { availability_request_id: number; status: string | null }[]) {
    const c = counts.get(row.availability_request_id) ?? { items: 0, answered: 0 }
    c.items += 1
    if (row.status != null) c.answered += 1
    counts.set(row.availability_request_id, c)
  }

  return records.map((r) => ({
    recordName: r.record_name ?? null,
    publicToken: r.public_token,
    id: r.id,
    jobRequestId: linkedJobs.get(r.id)?.[0] ?? r.job_request_id,
    jobRequestIds: linkedJobs.get(r.id) ?? [],
    jobName: (linkedJobs.get(r.id) ?? []).map((id) => jobs.get(id) || `JR-${id}`).join(' · ') || null,
    supplierId: r.supplier_id,
    supplierName: suppliers.get(r.supplier_id) ?? `Supplier ${r.supplier_id}`,
    shareCustomerDetails: r.share_customer_details,
    status: r.status,
    submittedAt: r.submitted_at,
    createdAt: r.created_at,
    itemCount: counts.get(r.id)?.items ?? 0,
    answeredCount: counts.get(r.id)?.answered ?? 0,
    lpsNotes: r.lps_notes,
    supplierNotes: r.supplier_notes ?? null,
  }))
}

/** Availability requests for a set of supplier locations or one job, newest first. */
export async function listAvailabilityRequests(scope: {
  supplierIds?: number[]
  jobRequestId?: number
}): Promise<ARSummary[]> {
  if (!scope.supplierIds?.length && scope.jobRequestId == null) return []
  let q = supabase
    .from('availability_requests')
    .select(AR_COLUMNS)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(500)
  if (scope.supplierIds?.length) q = q.in('supplier_id', scope.supplierIds)
  if (scope.jobRequestId != null) {
    const links = await availabilityLinks<{ availability_request_id: number }>(supabase.from('availability_request_jobs')
      .select('availability_request_id').eq('job_request_id', scope.jobRequestId).order('availability_request_id'))
    if (!links?.length) return []
    q = q.in('id', links.map((link) => link.availability_request_id))
  }
  const { data, error } = await q
  if (error) throw new Error(`availability_requests: ${error.message}`)
  return summarize((data ?? []) as ARRecord[])
}

/**
 * One availability request, whole: the shared lines, the answers, and — where
 * disclosure allows — who the job is for. No messages: the conversation is one
 * thread per supplier, never per request (2026-08-19).
 *
 * `forSupplierId` is the portal's scope check: a portal URL names its supplier,
 * and a request belonging to anyone else answers "not found" rather than
 * existing-but-forbidden. `null` disclosure = admin, who sees everything.
 */
export async function availabilityRequest(
  id: number,
  opts: { forSupplierId?: number; publicToken?: string; includeSharing?: boolean } = {},
): Promise<ARDetail | null> {
  const { data, error } = await supabase
    .from('availability_requests')
    .select(AR_COLUMNS)
    .eq('id', id)
    .eq('is_active', true)
    .maybeSingle()
  if (error) throw new Error(`availability_requests: ${error.message}`)
  if (!data) return null
  const ar = data as ARRecord
  if (opts.publicToken && (ar.public_token !== opts.publicToken || ar.status === 'closed' || ar.status === 'hidden')) return null
  if (opts.forSupplierId != null && (ar.supplier_id !== opts.forSupplierId || ar.status === 'hidden')) return null

  const [summary] = await summarize([ar])
  const schedules = await jobSchedules(summary.jobRequestIds ?? [], opts.forSupplierId == null)

  const { data: itemData, error: itemErr } = await supabase
    .from('availability_request_items')
    .select(AR_ITEM_COLUMNS)
    .eq('availability_request_id', id)
    .eq('is_active', true)
    .order('id', { ascending: true })
  if (itemErr) throw new Error(`availability_request_items: ${itemErr.message}`)

  const allocations = itemData?.length ? await availabilityLinks<{ availability_request_item_id: number; job_request_item_id: number; quantity: number | null }>(supabase.from('availability_request_item_jobs')
    .select('availability_request_item_id, job_request_item_id, quantity')
    .in('availability_request_item_id', itemData.map((item) => item.id))
    .order('availability_request_item_id').order('job_request_item_id')) : []

  // Who the job is for — only crosses the line to the supplier when the
  // request was created with `share_customer_details`.
  let customer: ARDetail['customer'] = null
  let shipping: ARDetail['shipping'] = null
  const disclose = (summary.jobRequestIds?.length ?? 0) === 1 && (opts.forSupplierId == null || ar.share_customer_details)
  if (disclose) {
    const { data: job, error: jobErr } = await supabase
      .from('job_requests')
      .select('customer_id, shipping_address, shipping_city, shipping_state, shipping_zip')
      .eq('id', summary.jobRequestId)
      .maybeSingle()
    if (jobErr) throw new Error(`job_requests: ${jobErr.message}`)
    if (job) {
      const j = job as {
        customer_id: number | null
        shipping_address: string | null
        shipping_city: string | null
        shipping_state: string | null
        shipping_zip: string | null
      }
      shipping = {
        address: j.shipping_address,
        city: j.shipping_city,
        state: j.shipping_state,
        zip: j.shipping_zip,
      }
      if (j.customer_id != null) {
        const { data: cust, error: custErr } = await supabase
          .from('customers')
          .select('name, company, email, phone')
          .eq('id', j.customer_id)
          .maybeSingle()
        if (custErr) throw new Error(`customers: ${custErr.message}`)
        customer = (cust as ARDetail['customer']) ?? null
      }
    }
  }

  return {
    ...summary,
    publicToken: opts.forSupplierId == null || opts.includeSharing ? summary.publicToken : undefined,
    jobSchedules: [...schedules.values()],
    items: ((itemData ?? []) as ARItemRecord[]).map((item) => ({
      ...toARItem(item),
      ...(opts.forSupplierId == null ? { allocations: (allocations ?? [])
        .filter((allocation) => allocation.availability_request_item_id === item.id)
        .map((allocation) => ({ jobRequestItemId: allocation.job_request_item_id, quantity: allocation.quantity })) } : {}),
    })),
    customer,
    shipping,
  }
}

/**
 * What our own catalogue already says a line costs at this supplier, keyed by
 * job-request item id — seeded into the request so they confirm or correct a
 * number instead of typing one from scratch.
 *
 * Deliberately narrow. The look-up runs in `search_inventory`'s **literal
 * substring mode** (the quoted query, migration 0081 — no alias/fuzzy tail),
 * scoped to this supplier's own rows and to the size asked for, and a price is
 * taken
 * only when every surviving row agrees on one. Anything less certain goes out
 * blank: an empty box costs the supplier a moment, a wrong number in front of
 * them costs more. A failed look-up is never a failed request.
 */
async function catalogPrices(
  supplierId: number,
  items: { id: number; name: string; size: string | null }[],
): Promise<{ prices: Map<number, number>; fetched: boolean }> {
  const found = new Map<number, number>()
  let fetched = false
  await Promise.all(
    items.map(async (item) => {
      const name = item.name.replace(/"/g, '').trim()
      if (!name) return
      const { data, error } = await supabase
        .rpc('search_inventory', { search: `"${name}"` })
        .eq('supplier_id', supplierId)
        .gt('unit_price', 0)
      if (error) return
      fetched = true
      const size = item.size?.trim().toLowerCase()
      const rows = (data ?? []) as {
        size: string | null
        size_std: string | null
        unit_price: number | string
      }[]
      const prices = new Set<number>(
        rows
          .filter((row) =>
            !size ? true : (row.size_std ?? row.size ?? '').trim().toLowerCase() === size,
          )
          .map((row) => Number(row.unit_price)),
      )
      if (prices.size === 1) {
        const [price] = [...prices]
        if (Number.isFinite(price) && price > 0) found.set(item.id, price)
      }
    }),
  )
  return { prices: found, fetched }
}

/**
 * Create one availability request from a job request's lines.
 *
 * The lines are snapshotted — name, size, quantity copied at share time — so
 * the question the supplier answers is the one that was asked, whatever the
 * job request looks like later. `unit_price` is seeded from the catalogue
 * where we already know it (`catalogPrices`); `status` stays NULL, which is
 * the only thing that says a line has been answered.
 */
export async function createAvailabilityRequest(input: {
  jobRequestId?: number
  jobRequestIds?: number[]
  consolidateItems?: boolean
  supplierId: number
  shareCustomerDetails: boolean
  isPublic?: boolean
  itemIds: number[]
}): Promise<number> {
  const { data: sup, error: supErr } = await supabase
    .from('suppliers')
    .select('id, is_lps_partner, is_active')
    .eq('id', input.supplierId)
    .maybeSingle()
  if (supErr) throw new Error(`suppliers: ${supErr.message}`)
  const supplier = sup as { is_lps_partner: boolean; is_active: boolean } | null
  if (!supplier?.is_active) throw new Error('supplier not found')

  const jobIds = [...new Set(input.jobRequestIds ?? (input.jobRequestId != null ? [input.jobRequestId] : []))]
  const itemIds = [...new Set(input.itemIds)]
  if (!itemIds.length || !jobIds.length) throw new Error('At least one job and line are required')
  const { data: items, error: itemErr } = await supabase
    .from('job_request_items')
    .select('id, job_request_id, name, size, quantity')
    .in('id', itemIds)
    .in('job_request_id', jobIds)
    .eq('is_active', true)
  if (itemErr) throw new Error(`job_request_items: ${itemErr.message}`)
  if (items?.length !== itemIds.length) throw new Error('Every selected line must belong to an active line of the selected jobs')
  const lines = items as { id: number; job_request_id: number; name: string; size: string | null; quantity: number | null }[]
  const { prices } = await catalogPrices(input.supplierId, lines)
  const snapshots = buildAvailabilitySnapshots(lines, prices, input.consolidateItems ?? false)
  const { data: arId, error } = await supabase.rpc('create_availability_request', {
    p_supplier_id: input.supplierId,
    p_items: snapshots,
    p_share_customer_details: input.shareCustomerDetails,
    p_public_token: input.isPublic || !supplier.is_lps_partner ? randomUUID() : null,
  })
  if (error) throw new Error(`availability request: ${error.message}`)
  return Number(arId)
}

/** Save an answer and its Processing state together under the request's row lock. */
export async function updateARItem(
  arId: number,
  itemId: number,
  changes: Record<string, string>,
  opts: { forSupplierId?: number } = {},
): Promise<void> {
  const ar = await arForWrite(arId, opts.forSupplierId)
  const { error } = await supabase.rpc('answer_availability_request', {
    p_request_id: ar.id,
    p_supplier_id: ar.supplier_id,
    p_item_id: itemId,
    p_changes: changes,
  })
  if (error) throw new Error(error.message)
}

/** Admin-only corrections to the ask; supplier answer routes never call this. */
export async function updateARItemDetails(
  arId: number,
  itemId: number,
  changes: Record<string, string>,
): Promise<void> {
  if (!changes || typeof changes !== 'object' || Array.isArray(changes) || !Object.keys(changes).length) {
    throw new Error('Plant details are required')
  }
  const values: Record<string, string | number | null> = {}
  for (const [key, raw] of Object.entries(changes)) {
    if (!['name', 'size', 'quantity', 'lps_notes'].includes(key) || typeof raw !== 'string') {
      throw new Error('Invalid plant detail field')
    }
    const value = raw.trim()
    if (key === 'name' && !value) throw new Error('Plant name is required')
    if (key === 'quantity' && value) {
      const quantity = Number(value)
      if (!/^[+]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value) || !Number.isFinite(quantity) || quantity <= 0) {
        throw new Error('Requested quantity must be a number greater than zero')
      }
      values[key] = quantity
    } else {
      values[key] = value || null
    }
  }
  const ar = await arForWrite(arId)
  // The database's item-write guard locks the parent and rejects concurrent
  // closure. Only this request's active snapshot is changed, not the job line.
  const { data, error } = await supabase.from('availability_request_items')
    .update(values)
    .eq('id', itemId)
    .eq('availability_request_id', ar.id)
    .eq('is_active', true)
    .select('id')
  if (error) throw new Error(`availability_request_items: ${error.message}`)
  if (!data?.length) throw new Error('line not found')
}

/** The request, checked for writing: active, the supplier's own, not closed. */
async function arForWrite(arId: number, forSupplierId?: number): Promise<ARRecord> {
  const { data, error } = await supabase
    .from('availability_requests')
    .select(AR_COLUMNS)
    .eq('id', arId)
    .eq('is_active', true)
    .maybeSingle()
  if (error) throw new Error(`availability_requests: ${error.message}`)
  const ar = data as ARRecord | null
  if (!ar || (forSupplierId != null && ar.supplier_id !== forSupplierId)) {
    throw new Error('availability request not found')
  }
  if (ar.status === 'closed' || ar.status === 'hidden') throw new Error('this request is closed or hidden')
  return ar
}

/**
 * The portal home's whole list: every request with its lines embedded, so the
 * cards expand, search and filter without a fetch per card. Customer details
 * ride along only where `share_customer_details` says so.
 */
export async function listPortalRequests(supplierId: number): Promise<ARDetail[]> {
  const { data, error } = await supabase
    .from('availability_requests')
    .select(AR_COLUMNS)
    .eq('supplier_id', supplierId)
    .eq('is_active', true)
    .neq('status', 'hidden')
    .order('created_at', { ascending: false })
    .limit(500)
  if (error) throw new Error(`availability_requests: ${error.message}`)
  const records = (data ?? []) as ARRecord[]
  if (!records.length) return []

  const summaries = await summarize(records)
  const schedules = await jobSchedules(summaries.flatMap((summary) => summary.jobRequestIds ?? []), false)

  const { data: itemData, error: itemErr } = await supabase
    .from('availability_request_items')
    .select(AR_ITEM_COLUMNS)
    .in('availability_request_id', records.map((r) => r.id))
    .eq('is_active', true)
    .order('id', { ascending: true })
  if (itemErr) throw new Error(`availability_request_items: ${itemErr.message}`)
  const itemsByAr = new Map<number, ARItem[]>()
  for (const raw of (itemData ?? []) as ARItemRecord[]) {
    const list = itemsByAr.get(raw.availability_request_id) ?? []
    list.push(toARItem(raw))
    itemsByAr.set(raw.availability_request_id, list)
  }

  // Disclosure: the shared requests' jobs and customers, one batch each.
  interface SharedJob {
    id: number
    customer_id: number | null
    shipping_address: string | null
    shipping_city: string | null
    shipping_state: string | null
    shipping_zip: string | null
  }
  const sharedJobs = [...new Set(summaries.filter((r) => r.shareCustomerDetails && r.jobRequestIds?.length === 1).map((r) => r.jobRequestId).filter((id): id is number => id != null))]
  const jobById = new Map<number, SharedJob>()
  const customerById = new Map<number, ARDetail['customer']>()
  if (sharedJobs.length) {
    const { data: jobs, error: jobErr } = await supabase
      .from('job_requests')
      .select('id, customer_id, shipping_address, shipping_city, shipping_state, shipping_zip')
      .in('id', sharedJobs)
    if (jobErr) throw new Error(`job_requests: ${jobErr.message}`)
    for (const j of (jobs ?? []) as SharedJob[]) {
      jobById.set(j.id, j)
    }
    const customerIds = [...new Set([...jobById.values()].map((j) => j.customer_id).filter((v): v is number => v != null))]
    if (customerIds.length) {
      const { data: custs, error: custErr } = await supabase
        .from('customers')
        .select('id, name, company, email, phone')
        .in('id', customerIds)
      if (custErr) throw new Error(`customers: ${custErr.message}`)
      for (const c of (custs ?? []) as ({ id: number } & Exclude<ARDetail['customer'], null>)[]) {
        customerById.set(c.id, { name: c.name, company: c.company, email: c.email, phone: c.phone })
      }
    }
  }

  return summaries.map((summary) => {
    const job = summary.shareCustomerDetails && summary.jobRequestIds?.length === 1 && summary.jobRequestId != null ? jobById.get(summary.jobRequestId) : undefined
    return {
      ...summary,
      jobSchedules: (summary.jobRequestIds ?? []).flatMap((id) => schedules.has(id) ? [schedules.get(id)!] : []),
      items: itemsByAr.get(summary.id) ?? [],
      customer: job?.customer_id != null ? customerById.get(job.customer_id) ?? null : null,
      shipping: job
        ? {
            address: job.shipping_address,
            city: job.shipping_city,
            state: job.shipping_state,
            zip: job.shipping_zip,
          }
        : null,
    }
  })
}

/** Saved request context for the supplier-thread notification, including closed history. */
export async function supplierAvailabilityEventContext(arId: number, forSupplierId?: number) {
  let query = supabase.from('availability_requests')
    .select('id, job_request_id, supplier_id').eq('id', arId)
  if (forSupplierId != null) query = query.eq('supplier_id', forSupplierId)
  const { data: ar, error: arError } = await query.single()
  if (arError) throw new Error(arError.message)
  const { data: supplier, error } = await supabase.from('suppliers')
    .select('name, rosie_thread_id').eq('id', ar.supplier_id).single()
  if (error) throw new Error(error.message)
  return {
    jobRequestId: ar.job_request_id as number | null,
    supplierId: ar.supplier_id as number,
    supplierName: supplier.name as string,
    threadId: supplier.rosie_thread_id as string | null,
    availabilityRequestId: arId,
  }
}

/** Submit atomically with the closure guard, then notify the supplier's thread. */
export async function submitAvailabilityRequest(arId: number, forSupplierId: number, supplierNote?: string | null) {
  if (supplierNote !== undefined && supplierNote !== null && (typeof supplierNote !== "string" || supplierNote.length > 10000)) throw new Error("Supplier note must be text of 10000 characters or fewer")
  const { error } = supplierNote === undefined
    ? await supabase.rpc('answer_availability_request', { p_request_id: arId, p_supplier_id: forSupplierId, p_submit: true })
    : await supabase.rpc('submit_availability_request_note', { p_request_id: arId, p_supplier_id: forSupplierId, p_note: supplierNote })
  if (error) throw new Error(error.message)
  return supplierAvailabilityEventContext(arId, forSupplierId)
}

/**
 * Admin-side status write — the request's own column, moved from the drawer's
 * pill or its Save button.
 *
 * `submitted_at` follows the status rather than being set apart from it: the
 * admin marking a request Submitted is the same event the portal's Submit
 * stamps, and a request pushed back to `new` has no submitted date to show.
 * `processing` and `closed` leave the stamp alone — neither unanswers
 * anything, and the portal's button reads **Re-Submit** off it.
 */
export async function setAvailabilityRequestStatus(arId: number, status: string): Promise<void> {
  if (!['new', 'processing', 'submitted', 'closed', 'hidden'].includes(status)) {
    throw new Error('status must be one of: new, processing, submitted, closed, hidden')
  }
  const stamp =
    status === 'submitted'
      ? { submitted_at: new Date().toISOString() }
      : status === 'new'
        ? { submitted_at: null }
        : {}
  const { data, error } = await supabase
    .from('availability_requests')
    .update({ status, ...stamp })
    .eq('id', arId)
    .eq('is_active', true)
    .select('id')
  if (error) throw new Error(`availability_requests: ${error.message}`)
  if (!data?.length) throw new Error('availability request not found')
}

/** Active suppliers: partners receive portal requests; other suppliers use public links. */
export async function listAvailabilitySuppliers() {
  const suppliers: { id: number; name: string; city: string | null; state: string | null; is_lps_partner: boolean }[] = []
  // The full supplier directory exceeds PostgREST's default 1,000-row cap.
  while (true) {
    const { data, error } = await supabase.from('suppliers')
      .select('id, name, city, state, is_lps_partner').eq('is_active', true)
      .order('name', { ascending: true }).order('id', { ascending: true })
      .range(suppliers.length, suppliers.length + 999)
    if (error) throw new Error(`suppliers: ${error.message}`)
    suppliers.push(...(data ?? []))
    if ((data?.length ?? 0) < 1000) return suppliers
  }
}

/** The portal's idea of its supplier: must exist, be active, and be an LPS Partner. */
export async function partnerSupplier(id: number): Promise<{ id: number; name: string } | null> {
  const { data, error } = await supabase
    .from('suppliers')
    .select('id, name, is_lps_partner')
    .eq('id', id)
    .eq('is_active', true)
    .maybeSingle()
  if (error) throw new Error(`suppliers: ${error.message}`)
  const s = data as { id: number; name: string; is_lps_partner: boolean } | null
  return s?.is_lps_partner ? { id: s.id, name: s.name } : null
}

/**
 * The suppliers engaged on each of these job requests — an availability
 * request counts as engagement. What a request card's links are built from.
 */
export async function supplierLinksByRequest(
  jobRequestIds: number[],
): Promise<Record<number, SupplierLink[]>> {
  if (!jobRequestIds.length) return {}

  const links = await availabilityLinks<{ availability_request_id: number; job_request_id: number }>(supabase.from('availability_request_jobs')
    .select('availability_request_id, job_request_id').in('job_request_id', jobRequestIds)
    .order('availability_request_id').order('job_request_id'))
  if (!links?.length) return {}
  const { data: ars, error: arErr } = await supabase
    .from('availability_requests')
    .select('id, record_name, supplier_id, status, created_at, submitted_at')
    .in('id', [...new Set(links.map((link) => link.availability_request_id))])
    .eq('is_active', true)
    .order('created_at', { ascending: false })
  if (arErr) throw new Error(`availability_requests: ${arErr.message}`)
  const linkedRequests = (ars ?? []).flatMap((ar) => links
    .filter((link) => link.availability_request_id === ar.id)
    .map((link) => ({ ...ar, job_request_id: link.job_request_id })))

  // job → supplier → every AR link, newest first (the AR list is newest-first).
  const engaged = new Map<number, Map<number, SupplierLink['availabilityRequests']>>()
  for (const r of linkedRequests as {
    record_name?: string | null
    id: number
    job_request_id: number
    supplier_id: number
    status: string
    created_at: string | null
    submitted_at: string | null
  }[]) {
    const bySupplier =
      engaged.get(r.job_request_id) ?? new Map<number, SupplierLink['availabilityRequests']>()
    bySupplier.set(r.supplier_id, [
      ...(bySupplier.get(r.supplier_id) ?? []),
      { id: r.id, recordName: r.record_name ?? null, status: r.status, createdAt: r.created_at ?? null, submittedAt: r.submitted_at ?? null },
    ])
    engaged.set(r.job_request_id, bySupplier)
  }

  const supplierIds = [...new Set([...engaged.values()].flatMap((m) => [...m.keys()]))]
  if (!supplierIds.length) return {}
  const { data: sups, error: supErr } = await supabase
    .from('suppliers')
    .select('id, name, is_lps_partner, rosie_thread_id')
    .in('id', supplierIds)
  if (supErr) throw new Error(`suppliers: ${supErr.message}`)
  const meta = new Map(
    (
      (sups ?? []) as { id: number; name: string; is_lps_partner: boolean; rosie_thread_id: string | null }[]
    ).map((s) => [s.id, s]),
  )

  const out: Record<number, SupplierLink[]> = {}
  for (const [job, bySupplier] of engaged) {
    out[job] = [...bySupplier.entries()]
      .map(([supplierId, availabilityRequests]) => {
        const s = meta.get(supplierId)
        return s
          ? {
              supplierId,
              name: s.name,
              lpsPartner: s.is_lps_partner,
              availabilityRequests,
              rosieThreadId: s.rosie_thread_id,
            }
          : null
      })
      .filter(Boolean) as SupplierLink[]
  }
  return out
}

// ------------------------------------------------- the portal's item view
//
// Every open line this supplier has, flat — what the portal's **By item** view
// groups by plant. A separate read rather than a wider `listPortalRequests()`:
// it carries `mapped_inventory_id`, which is deliberately not on the column
// list the rest of the portal's reads share.

/** Like `AR_ITEM_COLUMNS`, plus the mapping the By-item view groups on. */
const AR_ITEM_MAPPED_COLUMNS = `${AR_ITEM_COLUMNS}, mapped_inventory_id`

/**
 * One supplier's **open** requests, line by line, with the catalogue row each
 * line maps to.
 *
 * Closed requests are excluded for the same reason the portal home excludes
 * them: closing is ours, and a closed request is finished work rather than
 * something to group and answer. That also means every line this view shows is
 * one the supplier may still act on, so nothing here is undraggable.
 *
 * Three batched reads, not a join. Nothing about the job behind a request
 * crosses into the result beyond its name, which the portal already prints.
 */
export async function listPortalItemLines(supplierId: number): Promise<SupplierItemLine[]> {
  const { data: arData, error: arErr } = await supabase
    .from('availability_requests')
    .select(AR_COLUMNS)
    .eq('supplier_id', supplierId)
    .eq('is_active', true)
    .neq('status', 'closed').neq('status', 'hidden')
    .order('created_at', { ascending: false })
    .limit(500)
  if (arErr) throw new Error(`availability_requests: ${arErr.message}`)
  const ars = (arData ?? []) as ARRecord[]
  if (!ars.length) return []
  const arById = new Map(ars.map((r) => [r.id, r]))

  const { data: itemData, error: itemErr } = await supabase
    .from('availability_request_items')
    .select(AR_ITEM_MAPPED_COLUMNS)
    .in('availability_request_id', ars.map((r) => r.id))
    .eq('is_active', true)
    .order('id', { ascending: true })
  if (itemErr) throw new Error(`availability_request_items: ${itemErr.message}`)
  const items = (itemData ?? []) as (ARItemRecord & { mapped_inventory_id: string | null })[]
  if (!items.length) return []

  const linkedJobs = await jobsByAvailability(ars.map((r) => r.id))
  const jobs = await jobNames([...new Set([...linkedJobs.values()].flat())])

  // Who each job is for — fetched **only** for the requests that were shared
  // with customer details, so a request that wasn't cannot leak one through
  // this route any more than through the cards.
  const customerByJob = await sharedCustomerNames(ars.filter((ar) => linkedJobs.get(ar.id)?.length === 1)
    .map((ar) => ({ ...ar, job_request_id: linkedJobs.get(ar.id)![0] })))

  // The mapped catalogue rows. A mapping whose row has since been retired
  // keeps its id and resolves to no name — the group falls back to what the
  // line was asked as, rather than disappearing.
  const invIds = [...new Set(items.map((i) => i.mapped_inventory_id).filter((v): v is string => !!v))]
  const invById = new Map<string, { name: string; size: string | null }>()
  if (invIds.length) {
    const { data, error } = await supabase
      .from('inventory')
      .select('id, name, size')
      .in('id', invIds)
      .eq('is_active', true)
    if (error) throw new Error(`inventory: ${error.message}`)
    for (const row of (data ?? []) as { id: string; name: string; size: string | null }[]) {
      invById.set(row.id, { name: row.name, size: row.size })
    }
  }

  return items.flatMap((raw) => {
    const ar = arById.get(raw.availability_request_id)
    if (!ar) return []
    const inv = raw.mapped_inventory_id ? invById.get(raw.mapped_inventory_id) : undefined
    const sourceJobs = linkedJobs.get(ar.id) ?? []
    const jobName = sourceJobs.map((id) => jobs.get(id) || `JR-${id}`).join(' · ') || null
    return [{
      ...toARItem(raw),
      arId: ar.id,
      arStatus: ar.status,
      arCreatedAt: ar.created_at,
      // The same name and redaction the portal's own cards use.
      arName: jobName ? redactPartnerRequestRefs(jobName) : 'Availability request',
      arCustomer: ar.share_customer_details && sourceJobs.length === 1
        ? customerByJob.get(sourceJobs[0]) ?? null
        : null,
      mappedInventoryId: raw.mapped_inventory_id,
      mappedName: inv?.name ?? null,
      mappedSize: inv?.size ?? null,
    }]
  })
}

/**
 * job id → the customer's company-or-name, for the requests that share it.
 *
 * Two reads and nothing speculative: the jobs named by requests with
 * `share_customer_details`, then those jobs' customers. A request without the
 * flag never reaches either query.
 */
async function sharedCustomerNames(ars: ARRecord[]): Promise<Map<number, string>> {
  const jobIds = [...new Set(ars.filter((r) => r.share_customer_details).map((r) => r.job_request_id).filter((id): id is number => id != null))]
  if (!jobIds.length) return new Map()

  const { data: jobData, error: jobErr } = await supabase
    .from('job_requests')
    .select('id, customer_id')
    .in('id', jobIds)
  if (jobErr) throw new Error(`job_requests: ${jobErr.message}`)
  const jobs = (jobData ?? []) as { id: number; customer_id: number | null }[]

  const customerIds = [...new Set(jobs.map((j) => j.customer_id).filter((v): v is number => v != null))]
  if (!customerIds.length) return new Map()

  const { data: custData, error: custErr } = await supabase
    .from('customers')
    .select('id, name, company')
    .in('id', customerIds)
  if (custErr) throw new Error(`customers: ${custErr.message}`)
  const labelById = new Map(
    ((custData ?? []) as { id: number; name: string; company: string | null }[]).map((c) => [
      c.id,
      // The same preference the portal's cards use: the company if there is
      // one, otherwise the person.
      c.company || c.name,
    ]),
  )

  const out = new Map<number, string>()
  for (const job of jobs) {
    const label = job.customer_id != null ? labelById.get(job.customer_id) : undefined
    if (label) out.set(job.id, label)
  }
  return out
}

/**
 * Point one line at a catalogue row — or at nothing.
 *
 * Deliberately **not** part of `updateARItem`: that function's whitelist is the
 * four answer columns, and a mapping is a different kind of statement about a
 * line. Keeping them apart means a mapping can never ride in on an answer
 * write, or the reverse.
 *
 * The catalogue row must belong to **the same company** as the request's
 * supplier (`head_branch_id`). A company's farms are one catalogue from the
 * portal's point of view, so a cross-farm mapping within the company is a real
 * answer; a mapping to somebody else's row is not a thing to allow at all.
 */
export async function setARItemMapping(
  arId: number,
  itemId: number,
  inventoryId: string | null,
  opts: { forSupplierId?: number } = {},
): Promise<void> {
  const ar = await arForWrite(arId, opts.forSupplierId)

  if (inventoryId != null) {
    const companyId = await companyOf(ar.supplier_id)
    const { data: row, error: invErr } = await supabase
      .from('inventory')
      .select('id, supplier_id')
      .eq('id', inventoryId)
      .eq('is_active', true)
      .maybeSingle()
    if (invErr) throw new Error(`inventory: ${invErr.message}`)
    const inv = row as { id: string; supplier_id: number | null } | null
    if (!inv?.supplier_id) throw new Error('catalogue row not found')
    if ((await companyOf(inv.supplier_id)) !== companyId) {
      throw new Error('that catalogue row belongs to a different supplier')
    }
  }

  const { data, error } = await supabase
    .from('availability_request_items')
    .update({ mapped_inventory_id: inventoryId })
    .eq('id', itemId)
    .eq('availability_request_id', ar.id)
    .eq('is_active', true)
    .select('id')
  if (error) throw new Error(`availability_request_items: ${error.message}`)
  if (!data?.length) throw new Error('line not found')
}

/** The company a location belongs to — its head branch, or itself. */
async function companyOf(supplierId: number): Promise<number> {
  const { data, error } = await supabase
    .from('suppliers')
    .select('id, head_branch_id')
    .eq('id', supplierId)
    .maybeSingle()
  if (error) throw new Error(`suppliers: ${error.message}`)
  const s = data as { id: number; head_branch_id: number | null } | null
  if (!s) throw new Error('supplier not found')
  return s.head_branch_id ?? s.id
}

/** Revoking clears the capability; publishing again always issues a fresh link. */
export async function setAvailabilityRequestPublic(id: number, isPublic: boolean, forSupplierId?: number) {
  await arForWrite(id, forSupplierId)
  let query = supabase.from('availability_requests')
    .update({ public_token: isPublic ? randomUUID() : null })
    .eq('id', id).eq('is_active', true)
  if (forSupplierId != null) query = query.eq('supplier_id', forSupplierId)
  const { data, error } = await query.select('public_token').single()
  if (error) throw new Error(error.message)
  return data.public_token as string | null
}

export async function publicAvailabilityRequest(token: string) {
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(token)) return null
  const { data, error } = await supabase.from('availability_requests')
    .select('id, supplier_id').eq('public_token', token)
    .eq('is_active', true).neq('status', 'closed').neq('status', 'hidden').maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  const { data: supplier, error: supplierError } = await supabase.from('suppliers')
    .select('id').eq('id', data.supplier_id).eq('is_active', true).maybeSingle()
  if (supplierError) throw new Error(supplierError.message)
  if (!supplier) return null
  const request = await availabilityRequest(data.id, { forSupplierId: data.supplier_id, publicToken: token })
  return request?.status === 'closed' ? null : request
}
