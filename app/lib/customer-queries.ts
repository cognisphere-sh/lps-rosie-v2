import { ACTIVE_JOB_STATUSES } from '@/lib/job-requests'
import 'server-only'

import type { CustomerFacets, CustomerRequest, CustomerRow, JobAddress } from '@/lib/rows'
import type { CustomerType } from '@/lib/customers'
import { supabase } from '@/lib/supabase'

export const CUSTOMER_PAGE_SIZE = 25

/** PostgREST caps one response at 1,000 rows; page anything unbounded. */
const CHUNK = 1000

/** Statuses that mean the request is still live — what `openCount` counts. */
const OPEN_STATUSES: readonly string[] = ACTIVE_JOB_STATUSES

interface CustomerRecord {
  id: number
  name: string
  company: string | null
  type: CustomerType | null
  email: string | null
  phone: string | null
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  notes: string | null
  rosie_thread_id: string | null
  created_at: string | null
  updated_at: string | null
}

const COLUMNS =
  'id, name, company, type, email, phone, address, city, state, zip, notes, rosie_thread_id, created_at, updated_at'

export interface CustomerFilters {
  state?: string[]
  /** Only customers with at least one active request. */
  withRequestsOnly?: boolean
}

/**
 * Every active request of the given customers, with its line count and total.
 *
 * Two passes rather than one join: PostgREST aggregates are disabled on this
 * project, so the sum is done here over the item rows. Only `job_request_id`
 * and `total` are fetched for that — the rest of a line item is nothing this
 * page shows.
 */
async function requestsByCustomer(
  customerIds: number[],
): Promise<Map<number, CustomerRequest[]>> {
  const map = new Map<number, CustomerRequest[]>()
  if (!customerIds.length) return map

  const requests: {
    id: number
    customer_id: number
    status: string
    created_at: string | null
  }[] = []
  for (let from = 0; ; from += CHUNK) {
    const { data, error } = await supabase
      .from('job_requests')
      .select('id, customer_id, status, created_at')
      .in('customer_id', customerIds)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, from + CHUNK - 1)
    if (error) throw new Error(`job_requests: ${error.message}`)
    const page = (data ?? []) as typeof requests
    requests.push(...page)
    if (page.length < CHUNK) break
  }
  if (!requests.length) return map

  const totals = new Map<number, { lines: number; total: number }>()
  const requestIds = requests.map((r) => r.id)
  for (let from = 0; ; from += CHUNK) {
    const { data, error } = await supabase
      .from('job_request_items')
      .select('job_request_id, total')
      .in('job_request_id', requestIds)
      .eq('is_active', true)
      .order('id', { ascending: true })
      .range(from, from + CHUNK - 1)
    if (error) throw new Error(`job_request_items: ${error.message}`)
    const page = (data ?? []) as { job_request_id: number; total: number | null }[]
    for (const row of page) {
      const acc = totals.get(row.job_request_id) ?? { lines: 0, total: 0 }
      acc.lines += 1
      acc.total += row.total == null ? 0 : Number(row.total)
      totals.set(row.job_request_id, acc)
    }
    if (page.length < CHUNK) break
  }

  for (const r of requests) {
    const acc = totals.get(r.id) ?? { lines: 0, total: 0 }
    const list = map.get(r.customer_id) ?? []
    list.push({
      id: r.id,
      status: r.status,
      itemCount: acc.lines,
      lineTotal: acc.total,
      createdAt: r.created_at,
    })
    map.set(r.customer_id, list)
  }
  return map
}

/** Customer ids owning at least one active request — for the toolbar toggle. */
async function customerIdsWithRequests(): Promise<number[]> {
  const ids = new Set<number>()
  for (let from = 0; ; from += CHUNK) {
    const { data, error } = await supabase
      .from('job_requests')
      .select('customer_id')
      .eq('is_active', true)
      .not('customer_id', 'is', null)
      .order('id', { ascending: true })
      .range(from, from + CHUNK - 1)
    if (error) throw new Error(`job_requests: ${error.message}`)
    const page = (data ?? []) as { customer_id: number }[]
    for (const r of page) ids.add(r.customer_id)
    if (page.length < CHUNK) break
  }
  return [...ids]
}

const addressOf = (r: CustomerRecord): JobAddress => ({
  address: r.address,
  city: r.city,
  state: r.state,
  zip: r.zip,
})

function toRow(r: CustomerRecord, requests: CustomerRequest[]): CustomerRow {
  return {
    id: r.id,
    name: r.name,
    company: r.company,
    type: r.type,
    email: r.email,
    phone: r.phone,
    address: addressOf(r),
    notes: r.notes,
    rosieThreadId: r.rosie_thread_id,
    requests,
    openCount: requests.filter((req) => OPEN_STATUSES.includes(req.status)).length,
    lineTotal: requests.reduce((sum, req) => sum + req.lineTotal, 0),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

/** One customer, whole — what their own page is built from. */
export async function customer(id: number): Promise<CustomerRow | null> {
  const { data, error } = await supabase
    .from('customers')
    .select(COLUMNS)
    .eq('id', id)
    .eq('is_active', true)
    .maybeSingle()
  if (error) throw new Error(`customers: ${error.message}`)
  if (!data) return null

  const record = data as unknown as CustomerRecord
  const requests = await requestsByCustomer([record.id])
  return toRow(record, requests.get(record.id) ?? [])
}

/**
 * One page of customers, each carrying its own job-request rollup.
 *
 * Ordered by name because that is how a person looks a customer up — unlike
 * the request list, which is ordered by what needs attention. A search matches
 * any of the four ways of naming or reaching someone.
 */
export async function listCustomers(
  search: string,
  filters: CustomerFilters,
  page: number,
): Promise<{ customers: CustomerRow[]; total: number; pageCount: number }> {
  const q = search.trim()

  let query = supabase.from('customers').select(COLUMNS, { count: 'exact' }).eq('is_active', true)

  if (q) {
    // `,` and `)` would break out of the or() grammar; PostgREST has no
    // parameter binding for it, so the two characters are simply removed.
    const safe = q.replace(/[,()]/g, ' ')
    query = query.or(
      `name.ilike.%${safe}%,company.ilike.%${safe}%,email.ilike.%${safe}%,phone.ilike.%${safe}%`,
    )
  }
  if (filters.state?.length) query = query.in('state', filters.state)
  if (filters.withRequestsOnly) {
    const ids = await customerIdsWithRequests()
    if (!ids.length) return { customers: [], total: 0, pageCount: 1 }
    query = query.in('id', ids)
  }

  const from = (page - 1) * CUSTOMER_PAGE_SIZE
  const { data, error, count } = await query
    .order('name', { ascending: true })
    .order('id', { ascending: true })
    .range(from, from + CUSTOMER_PAGE_SIZE - 1)
  if (error) throw new Error(`customers: ${error.message}`)

  const records = (data ?? []) as CustomerRecord[]
  const requestMap = await requestsByCustomer(records.map((r) => r.id))

  const customers = records.map((r) => toRow(r, requestMap.get(r.id) ?? []))

  const total = count ?? customers.length
  return { customers, total, pageCount: Math.max(1, Math.ceil(total / CUSTOMER_PAGE_SIZE)) }
}

/** The option list the State chip offers, over every active customer. */
export async function customerFacets(): Promise<CustomerFacets> {
  const { data, error } = await supabase
    .from('customers')
    .select('state')
    .eq('is_active', true)
    .not('state', 'is', null)
    .limit(CHUNK)
  if (error) throw new Error(`customers: ${error.message}`)
  return {
    state: [...new Set((data ?? []).map((r) => (r as { state: string }).state).filter(Boolean))].sort(),
  }
}

/** Totals for the header line, over the whole active set rather than a page. */
export async function customerSummary(): Promise<{ customers: number; withRequests: number }> {
  const [{ count }, withRequests] = await Promise.all([
    supabase.from('customers').select('id', { count: 'exact', head: true }).eq('is_active', true),
    customerIdsWithRequests(),
  ])
  return { customers: count ?? 0, withRequests: withRequests.length }
}
