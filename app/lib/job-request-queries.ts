import 'server-only'

import { coverOf } from '@/lib/job-requests'
import type {
  JobAddress,
  JobNote,
  JobRequestFacets,
  JobRequestItem,
  JobRequestRow,
  StatusCounts,
} from '@/lib/rows'
import { supabase } from '@/lib/supabase'

export const JOB_REQUEST_PAGE_SIZE = 25

/** PostgREST caps one response at 1,000 rows; page anything unbounded. */
const CHUNK = 1000

interface RequestRecord {
  id: number
  customer_id: number | null
  status: string
  needs_attention: boolean
  billing_address: string | null
  billing_city: string | null
  billing_state: string | null
  billing_zip: string | null
  shipping_address: string | null
  shipping_city: string | null
  shipping_state: string | null
  shipping_zip: string | null
  customer_notes: string | null
  internal_notes: string | null
  external_notes: string | null
  created_at: string | null
  updated_at: string | null
}

interface ItemRecord {
  id: number
  job_request_id: number
  name: string
  size: string | null
  quantity: number | null
  available_quantity: number | null
  unit_price: number | null
  total: number | null
  status: string
  needs_attention: boolean
  customer_notes: string | null
  internal_notes: string | null
  external_notes: string | null
  updated_at: string | null
}

interface CustomerRecord {
  id: number
  name: string
  company: string | null
  email: string | null
  phone: string | null
}

export interface JobRequestFilters {
  status?: string[]
  itemStatus?: string[]
  size?: string[]
  customerId?: number[]
  /** Only requests needing attention, by their own flag or an item's. */
  needsOnly?: boolean
  /** Days back from now; undefined means all time. */
  createdWithin?: number
  updatedWithin?: number
}

/**
 * Split one of the three note columns into entries.
 *
 * `internal_notes` and `communication_notes` are append-only text: entries are
 * separated by a blank line and stamped `[YYYY-MM-DD HH:MM America/Chicago]`
 * (the `job-requests` skill's format). Text that predates the convention, or a
 * customer's verbatim message, has no stamp — it stays one unstamped entry
 * rather than being reshaped.
 */
function noteEntries(text: string | null, kind: JobNote['kind']): JobNote[] {
  if (!text?.trim()) return []
  return text
    .split(/\n\s*\n/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const m = chunk.match(/^\[([^\]]+)\]\s*([\s\S]*)$/)
      return m
        ? { kind, stamp: m[1], text: m[2].trim() }
        : { kind, stamp: null, text: chunk }
    })
}

function notesOf(r: { customer_notes: string | null; internal_notes: string | null; external_notes: string | null }): JobNote[] {
  return [
    ...noteEntries(r.customer_notes, 'customer'),
    ...noteEntries(r.external_notes, 'shared'),
    ...noteEntries(r.internal_notes, 'internal'),
  ]
}

const addressOf = (
  address: string | null,
  city: string | null,
  state: string | null,
  zip: string | null,
): JobAddress => ({ address, city, state, zip })

/**
 * Whether a line item is waiting on a person.
 *
 * Its own flag is the explicit signal; an unanswered availability is the
 * implicit one, and is what makes the design's "Needs input" count non-zero
 * before anyone has flagged anything by hand.
 */
const needsAttention = (flag: boolean, quantity: unknown, available: unknown) =>
  flag ||
  coverOf(
    quantity == null ? null : Number(quantity),
    available == null ? null : Number(available),
  ) === 'unanswered'

const recordNeedsAttention = (r: {
  needs_attention: boolean
  quantity: number | null
  available_quantity: number | null
}) => needsAttention(r.needs_attention, r.quantity, r.available_quantity)

function toItem(r: ItemRecord): JobRequestItem {
  return {
    id: r.id,
    name: r.name,
    size: r.size,
    quantity: r.quantity == null ? null : Number(r.quantity),
    availableQuantity: r.available_quantity == null ? null : Number(r.available_quantity),
    unitPrice: r.unit_price == null ? null : Number(r.unit_price),
    total: r.total == null ? null : Number(r.total),
    status: r.status,
    needsAttention: recordNeedsAttention(r),
    notes: notesOf(r),
    externalNotes: r.external_notes,
    updatedAt: r.updated_at,
  }
}

/** Every item of the given requests, paged past the PostgREST row cap. */
async function itemsByRequest(ids: number[]): Promise<Map<number, ItemRecord[]>> {
  const map = new Map<number, ItemRecord[]>()
  if (!ids.length) return map

  for (let from = 0; ; from += CHUNK) {
    const { data, error } = await supabase
      .from('job_request_items')
      .select(
        'id, job_request_id, name, size, quantity, available_quantity, unit_price, total, status, needs_attention, customer_notes, internal_notes, external_notes, updated_at',
      )
      .in('job_request_id', ids)
      .eq('is_active', true)
      .order('id', { ascending: true })
      .range(from, from + CHUNK - 1)
    if (error) throw new Error(`job_request_items: ${error.message}`)
    const rows = (data ?? []) as ItemRecord[]
    for (const row of rows) {
      const list = map.get(row.job_request_id) ?? []
      list.push(row)
      map.set(row.job_request_id, list)
    }
    if (rows.length < CHUNK) break
  }
  return map
}

/** Request ids owning at least one active item matching the item-level filters. */
async function requestIdsMatchingItems(
  filters: JobRequestFilters,
  search: string,
): Promise<number[] | null> {
  const wantsItemFilter =
    !!filters.itemStatus?.length || !!filters.size?.length || !!search.trim()
  if (!wantsItemFilter) return null

  const ids = new Set<number>()
  for (let from = 0; ; from += CHUNK) {
    let q = supabase
      .from('job_request_items')
      .select('job_request_id')
      .eq('is_active', true)
    if (filters.itemStatus?.length) q = q.in('status', filters.itemStatus)
    if (filters.size?.length) q = q.in('size', filters.size)
    if (search.trim()) q = q.ilike('name', `%${search.trim()}%`)

    const { data, error } = await q.order('id', { ascending: true }).range(from, from + CHUNK - 1)
    if (error) throw new Error(`job_request_items: ${error.message}`)
    const rows = (data ?? []) as { job_request_id: number }[]
    for (const r of rows) ids.add(r.job_request_id)
    if (rows.length < CHUNK) break
  }
  return [...ids]
}

/**
 * Request ids holding at least one line that is waiting on somebody — flagged
 * by hand, or simply never answered on availability.
 *
 * This is the other half of "Needs input": the request's own flag only covers
 * what a person marked, and the toolbar counts unanswered lines too. Without
 * this, filtering by Needs input hides a request whose flag is clear but whose
 * lines are not — while still counting those lines in the total.
 */
async function requestIdsNeedingAttention(): Promise<number[]> {
  const ids = new Set<number>()
  for (let from = 0; ; from += CHUNK) {
    const { data, error } = await supabase
      .from('job_request_items')
      .select('job_request_id')
      .eq('is_active', true)
      .or('needs_attention.eq.true,available_quantity.is.null')
      .order('id', { ascending: true })
      .range(from, from + CHUNK - 1)
    if (error) throw new Error(`job_request_items: ${error.message}`)
    const rows = (data ?? []) as { job_request_id: number }[]
    for (const r of rows) ids.add(r.job_request_id)
    if (rows.length < CHUNK) break
  }
  return [...ids]
}

/** Requests whose customer matches the search, so a name finds their requests. */
async function requestIdsMatchingCustomer(search: string): Promise<number[]> {
  const q = search.trim()
  if (!q) return []
  const { data, error } = await supabase
    .from('customers')
    .select('id')
    .or(`name.ilike.%${q}%,company.ilike.%${q}%,email.ilike.%${q}%`)
    .limit(500)
  if (error) throw new Error(`customers: ${error.message}`)
  const customerIds = (data ?? []).map((c) => (c as { id: number }).id)
  if (!customerIds.length) return []

  const { data: reqs, error: reqErr } = await supabase
    .from('job_requests')
    .select('id')
    .in('customer_id', customerIds)
    .limit(CHUNK)
  if (reqErr) throw new Error(`job_requests: ${reqErr.message}`)
  return (reqs ?? []).map((r) => (r as { id: number }).id)
}

const daysAgoIso = (days: number) =>
  new Date(Date.now() - days * 86_400_000).toISOString()

/**
 * One page of job requests, each carrying every one of its line items.
 *
 * Counts and `lineTotal` are computed over **all** of a request's items, never
 * over the filtered subset, so a collapsed card reports the whole request while
 * the expanded table shows only what the item filters let through. The page's
 * `items` array is the filtered set; `itemCount` is the true one.
 */
export async function listJobRequests(
  search: string,
  filters: JobRequestFilters,
  page: number,
): Promise<{ requests: JobRequestRow[]; total: number; pageCount: number }> {
  const q = search.trim()

  // Item- and customer-level matches both narrow the request set. A search
  // matches either a plant on the request or the customer it belongs to, so the
  // two id sets are unioned before they filter; a filter (status/size) with no
  // search intersects nothing and simply restricts.
  const itemIds = await requestIdsMatchingItems(filters, q)
  const itemIdSet = itemIds ? new Set(itemIds) : null
  let restrictTo: number[] | null = itemIds
  if (q) {
    const customerIds = await requestIdsMatchingCustomer(q)
    const numeric = /^\s*(?:JR-)?(\d+)\s*$/i.exec(q)
    const union = new Set<number>([...(itemIds ?? []), ...customerIds])
    if (numeric) union.add(Number(numeric[1]))
    restrictTo = [...union]
  }

  let query = supabase
    .from('job_requests')
    .select(
      'id, customer_id, status, needs_attention, billing_address, billing_city, billing_state, billing_zip, shipping_address, shipping_city, shipping_state, shipping_zip, customer_notes, internal_notes, external_notes, created_at, updated_at',
      { count: 'exact' },
    )
    .eq('is_active', true)

  if (restrictTo) {
    if (!restrictTo.length) return { requests: [], total: 0, pageCount: 1 }
    query = query.in('id', restrictTo)
  }
  if (filters.status?.length) query = query.in('status', filters.status)
  if (filters.customerId?.length) query = query.in('customer_id', filters.customerId)
  if (filters.createdWithin) query = query.gte('created_at', daysAgoIso(filters.createdWithin))
  if (filters.updatedWithin) query = query.gte('updated_at', daysAgoIso(filters.updatedWithin))
  // The request's own flag OR a line waiting on someone — applied in SQL so the
  // page and its `count` describe the same set.
  if (filters.needsOnly) {
    const attn = await requestIdsNeedingAttention()
    query = attn.length
      ? query.or(`needs_attention.eq.true,id.in.(${attn.join(',')})`)
      : query.eq('needs_attention', true)
  }

  const from = (page - 1) * JOB_REQUEST_PAGE_SIZE
  const { data, error, count } = await query
    .order('needs_attention', { ascending: false })
    .order('updated_at', { ascending: false, nullsFirst: false })
    .order('id', { ascending: false })
    .range(from, from + JOB_REQUEST_PAGE_SIZE - 1)
  if (error) throw new Error(`job_requests: ${error.message}`)

  const records = (data ?? []) as RequestRecord[]
  const [itemMap, customerMap] = await Promise.all([
    itemsByRequest(records.map((r) => r.id)),
    customersById(records.map((r) => r.customer_id).filter((v): v is number => v != null)),
  ])

  const requests: JobRequestRow[] = records.map((r) => {
    const all = itemMap.get(r.id) ?? []
    const statusCounts: StatusCounts = {}
    let lineTotal = 0
    let attentionCount = 0
    for (const it of all) {
      statusCounts[it.status] = (statusCounts[it.status] ?? 0) + 1
      lineTotal += it.total == null ? 0 : Number(it.total)
      if (recordNeedsAttention(it)) attentionCount++
    }

    // The visible subset. Request-level filters already selected the request;
    // these decide which of its lines the expanded table draws. A search that
    // reached this request through one of its plants narrows to the plants it
    // matched; one that reached it through the customer or the id keeps them all.
    const matchedByItem = itemIdSet?.has(r.id) ?? false
    const visible = all.filter((it) => {
      if (filters.itemStatus?.length && !filters.itemStatus.includes(it.status)) return false
      if (filters.size?.length && !(it.size && filters.size.includes(it.size))) return false
      if (q && matchedByItem && !it.name.toLowerCase().includes(q.toLowerCase())) return false
      return true
    })

    const customer = r.customer_id == null ? null : customerMap.get(r.customer_id) ?? null
    return {
      id: r.id,
      status: r.status,
      needsAttention: r.needs_attention || attentionCount > 0,
      customer,
      billing: addressOf(r.billing_address, r.billing_city, r.billing_state, r.billing_zip),
      shipping: addressOf(r.shipping_address, r.shipping_city, r.shipping_state, r.shipping_zip),
      customerNotes: r.customer_notes,
      notes: notesOf(r),
      externalNotes: r.external_notes,
      itemCount: all.length,
      attentionCount,
      statusCounts,
      lineTotal,
      items: visible.map(toItem),
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }
  })

  const total = count ?? requests.length
  return {
    requests,
    total,
    pageCount: Math.max(1, Math.ceil(total / JOB_REQUEST_PAGE_SIZE)),
  }
}

async function customersById(ids: number[]): Promise<Map<number, JobRequestRow['customer']>> {
  const map = new Map<number, JobRequestRow['customer']>()
  if (!ids.length) return map
  const { data, error } = await supabase
    .from('customers')
    .select('id, name, company, email, phone')
    .in('id', [...new Set(ids)])
  if (error) throw new Error(`customers: ${error.message}`)
  for (const c of (data ?? []) as CustomerRecord[]) {
    map.set(c.id, { id: c.id, name: c.name, company: c.company, email: c.email, phone: c.phone })
  }
  return map
}

/** The option lists the toolbar chips offer. Sizes come from the live items. */
export async function jobRequestFacets(): Promise<JobRequestFacets> {
  const [{ data: sizes, error: sizeErr }, { data: customers, error: custErr }] = await Promise.all([
    supabase.from('job_request_items').select('size').eq('is_active', true).not('size', 'is', null).limit(CHUNK),
    supabase.from('customers').select('id, name, company').eq('is_active', true).order('name').limit(500),
  ])
  if (sizeErr) throw new Error(`job_request_items: ${sizeErr.message}`)
  if (custErr) throw new Error(`customers: ${custErr.message}`)

  return {
    size: [...new Set((sizes ?? []).map((s) => (s as { size: string }).size).filter(Boolean))].sort(
      (a, b) => (parseFloat(a) || 0) - (parseFloat(b) || 0) || a.localeCompare(b),
    ),
    customer: (customers ?? []) as JobRequestFacets['customer'],
  }
}

/** Totals for the header line, over the whole active set rather than a page. */
export async function jobRequestSummary(): Promise<{ requests: number; items: number; attention: number }> {
  const [{ count: requests }, { data: items, error }] = await Promise.all([
    supabase.from('job_requests').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase
      .from('job_request_items')
      .select('needs_attention, quantity, available_quantity')
      .eq('is_active', true)
      .limit(CHUNK),
  ])
  if (error) throw new Error(`job_request_items: ${error.message}`)
  const rows = (items ?? []) as ItemRecord[]
  return {
    requests: requests ?? 0,
    items: rows.length,
    attention: rows.filter((i) => recordNeedsAttention(i)).length,
  }
}
