import 'server-only'

import { supplierLinksByRequest } from '@/lib/availability-queries'
import { parseEntries } from '@/lib/notes'
import type {
  JobAddress,
  JobChange,
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
  name: string | null
  status: string
  expected_install_date: string | null
  fulfillment_method: 'pickup' | 'delivery' | null
  billing_address: string | null
  billing_city: string | null
  billing_state: string | null
  billing_zip: string | null
  shipping_address: string | null
  shipping_city: string | null
  shipping_state: string | null
  shipping_zip: string | null
  customer_notes: string | null
  sourcing_notes: string | null
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
  customer_notes: string | null
  sourcing_notes: string | null
  external_notes: string | null
  updated_at: string | null
}

interface CustomerRecord {
  id: number
  name: string
  company: string | null
  email: string | null
  phone: string | null
  rosie_thread_id: string | null
}

export interface JobRequestFilters {
  status?: string[]
  itemStatus?: string[]
  size?: string[]
  customerId?: number[]
  /** Days back from now; undefined means all time. */
  createdWithin?: number
  updatedWithin?: number
}

/**
 * Split one of the three note columns into entries.
 *
 * `communication_notes` is append-only text: entries are separated by a blank
 * line and stamped `[YYYY-MM-DD HH:MM America/Chicago]` (the `job-requests`
 * skill's format). Text that predates the convention, or a customer's verbatim
 * message, has no stamp — it stays one unstamped entry rather than being
 * reshaped.
 *
 * `sourcing_notes` is deliberately absent from this timestamped-note parser:
 * its raw Markdown is preserved for editing and rendered by the UI.
 */
function noteEntries(text: string | null, kind: JobNote['kind']): JobNote[] {
  return parseEntries(text).map((e) => ({ kind, ...e }))
}

function notesOf(r: { customer_notes: string | null; external_notes: string | null }): JobNote[] {
  return [
    ...noteEntries(r.customer_notes, 'customer'),
    ...noteEntries(r.external_notes, 'shared'),
  ]
}

const addressOf = (
  address: string | null,
  city: string | null,
  state: string | null,
  zip: string | null,
): JobAddress => ({ address, city, state, zip })

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
    notes: notesOf(r),
    customerNotes: r.customer_notes,
    externalNotes: r.external_notes,
    sourcingNotes: r.sourcing_notes,
    updatedAt: r.updated_at,
  }
}

const REQUEST_COLUMNS =
  'id, customer_id, name, status, expected_install_date, fulfillment_method, billing_address, billing_city, billing_state, billing_zip, shipping_address, shipping_city, shipping_state, shipping_zip, customer_notes, sourcing_notes, external_notes, created_at, updated_at'

/**
 * Take the next job-request id without creating the row.
 *
 * The request's conversation is named after the row (`jr-<id>`), and rosie
 * writes the row from that conversation — so the id has to exist before the
 * row does. `reserve_job_request_id()` (migration 0072) is `nextval` on the
 * identity sequence and nothing else: an abandoned start leaves a gap in the
 * numbering, which is what a sequence is for.
 */
export async function reserveJobRequestId(): Promise<number> {
  const { data, error } = await supabase.rpc('reserve_job_request_id')
  if (error) throw new Error(`reserve_job_request_id: ${error.message}`)
  const id = Number(data)
  if (!Number.isInteger(id)) throw new Error('reserve_job_request_id returned no id')
  return id
}

/**
 * One request as the cards render it.
 *
 * `all` is every active line, which is what the rollups are computed over;
 * `visible` is the subset the item filters let through, which is what the
 * expanded table draws — so a collapsed card never lies about a request whose
 * lines are filtered out of view.
 */
function toRow(
  r: RequestRecord,
  all: ItemRecord[],
  customer: JobRequestRow['customer'],
  visible: ItemRecord[],
  supplierLinks: JobRequestRow['supplierLinks'] = [],
): JobRequestRow {
  const statusCounts: StatusCounts = {}
  let lineTotal = 0
  for (const it of all) {
    statusCounts[it.status] = (statusCounts[it.status] ?? 0) + 1
    lineTotal += it.total == null ? 0 : Number(it.total)
  }

  return {
    id: r.id,
    name: r.name,
    status: r.status,
    expectedInstallDate: r.expected_install_date,
    fulfillmentMethod: r.fulfillment_method,
    customer,
    billing: addressOf(r.billing_address, r.billing_city, r.billing_state, r.billing_zip),
    shipping: addressOf(r.shipping_address, r.shipping_city, r.shipping_state, r.shipping_zip),
    customerNotes: r.customer_notes,
    notes: notesOf(r),
    externalNotes: r.external_notes,
    sourcingNotes: r.sourcing_notes,
    itemCount: all.length,
    statusCounts,
    lineTotal,
    supplierLinks,
    items: visible.map(toItem),
    createdAt: r.created_at,
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
        'id, job_request_id, name, size, quantity, available_quantity, unit_price, total, status, customer_notes, sourcing_notes, external_notes, updated_at',
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
    .select(REQUEST_COLUMNS, { count: 'exact' })
    .eq('is_active', true)

  if (restrictTo) {
    if (!restrictTo.length) return { requests: [], total: 0, pageCount: 1 }
    query = query.in('id', restrictTo)
  }
  if (filters.status?.length) query = query.in('status', filters.status)
  if (filters.customerId?.length) query = query.in('customer_id', filters.customerId)
  if (filters.createdWithin) query = query.gte('created_at', daysAgoIso(filters.createdWithin))
  if (filters.updatedWithin) query = query.gte('updated_at', daysAgoIso(filters.updatedWithin))
  const from = (page - 1) * JOB_REQUEST_PAGE_SIZE
  const { data, error, count } = await query
    .order('updated_at', { ascending: false, nullsFirst: false })
    .order('id', { ascending: false })
    .range(from, from + JOB_REQUEST_PAGE_SIZE - 1)
  if (error) throw new Error(`job_requests: ${error.message}`)

  const records = (data ?? []) as RequestRecord[]
  const [itemMap, customerMap, linkMap] = await Promise.all([
    itemsByRequest(records.map((r) => r.id)),
    customersById(records.map((r) => r.customer_id).filter((v): v is number => v != null)),
    supplierLinksByRequest(records.map((r) => r.id)),
  ])

  const requests: JobRequestRow[] = records.map((r) => {
    const all = itemMap.get(r.id) ?? []

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
    return toRow(r, all, customer, visible, linkMap[r.id] ?? [])
  })

  const total = count ?? requests.length
  return {
    requests,
    total,
    pageCount: Math.max(1, Math.ceil(total / JOB_REQUEST_PAGE_SIZE)),
  }
}

/**
 * One request by id, with every one of its lines.
 *
 * Nothing filters here: this is the request as its own card shows it, fetched
 * when a page that does not list requests — a customer's card — opens one.
 */
export async function jobRequest(id: number): Promise<JobRequestRow | null> {
  const { data, error } = await supabase
    .from('job_requests')
    .select(REQUEST_COLUMNS)
    .eq('id', id)
    .eq('is_active', true)
    .maybeSingle()
  if (error) throw new Error(`job_requests: ${error.message}`)
  if (!data) return null

  const r = data as RequestRecord
  const [itemMap, customerMap, linkMap] = await Promise.all([
    itemsByRequest([r.id]),
    customersById(r.customer_id == null ? [] : [r.customer_id]),
    supplierLinksByRequest([r.id]),
  ])
  const all = itemMap.get(r.id) ?? []
  const customer = r.customer_id == null ? null : customerMap.get(r.customer_id) ?? null
  return toRow(r, all, customer, all, linkMap[r.id] ?? [])
}

async function customersById(ids: number[]): Promise<Map<number, JobRequestRow['customer']>> {
  const map = new Map<number, JobRequestRow['customer']>()
  if (!ids.length) return map
  const { data, error } = await supabase
    .from('customers')
    .select('id, name, company, email, phone, rosie_thread_id')
    .in('id', [...new Set(ids)])
  if (error) throw new Error(`customers: ${error.message}`)
  for (const c of (data ?? []) as CustomerRecord[]) {
    map.set(c.id, {
      id: c.id, name: c.name, company: c.company, email: c.email, phone: c.phone,
      rosieThreadId: c.rosie_thread_id,
    })
  }
  return map
}

/**
 * The option lists the toolbar chips offer. Sizes come from the live items.
 *
 * `size` is still computed although the toolbar stopped offering a Size chip:
 * the filter itself is intact on the server, and this is the list it would need.
 */
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

interface ChangeRecord {
  id: number
  item_id: number | null
  actor: string
  action: string
  changes: Record<string, unknown> | null
  created_at: string
}

/**
 * The whole change history of one request, newest first.
 *
 * Fetched on its own rather than with the request: it is unbounded, it is only
 * read when someone opens the drawer, and nothing else on the card depends on it.
 *
 * Item names are resolved without an `is_active` filter — a retired line still
 * has a history, and an entry that could not name what it was about would be
 * worse than useless.
 */
export async function jobRequestChangelog(requestId: number): Promise<JobChange[]> {
  const rows: ChangeRecord[] = []
  for (let from = 0; ; from += CHUNK) {
    const { data, error } = await supabase
      .from('job_request_changelog')
      .select('id, item_id, actor, action, changes, created_at')
      .eq('job_request_id', requestId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, from + CHUNK - 1)
    if (error) throw new Error(`job_request_changelog: ${error.message}`)
    const page = (data ?? []) as ChangeRecord[]
    rows.push(...page)
    if (page.length < CHUNK) break
  }

  const itemIds = [...new Set(rows.map((r) => r.item_id).filter((v): v is number => v != null))]
  const names = new Map<number, string>()
  if (itemIds.length) {
    const { data, error } = await supabase
      .from('job_request_items')
      .select('id, name')
      .in('id', itemIds)
    if (error) throw new Error(`job_request_items: ${error.message}`)
    for (const r of (data ?? []) as { id: number; name: string }[]) names.set(r.id, r.name)
  }

  return rows.map((r) => ({
    id: r.id,
    itemId: r.item_id,
    itemName: r.item_id == null ? null : names.get(r.item_id) ?? null,
    actor: r.actor,
    action: r.action === 'insert' ? 'insert' : 'update',
    changes: r.changes ?? {},
    createdAt: r.created_at,
  }))
}

/** Totals for the header line, over the whole active set rather than a page. */
export async function jobRequestSummary(): Promise<{ requests: number; items: number }> {
  const [{ count: requests }, { count: items }] = await Promise.all([
    supabase.from('job_requests').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('job_request_items').select('id', { count: 'exact', head: true }).eq('is_active', true),
  ])
  return { requests: requests ?? 0, items: items ?? 0 }
}

/**
 * What a delete took with it, so the toast can say and the confirm was honest.
 *
 * `answers` is the one line that is *not* a deletion: `availability_request_items`
 * references a line with ON DELETE SET NULL, deliberately — a supplier's answer
 * is theirs, and it keeps the name/size/quantity it was asked about. Deleting a
 * line loses the traceback to it, not the answer.
 */
export interface JobRequestDeletion {
  items: number
  availabilityRequests: number
  availabilityRequestItems: number
  changelog: number
  answers: number
}

/** `count: 'exact', head: true` over one table, filtered by one column. */
async function countWhere(table: string, column: string, values: number[]): Promise<number> {
  if (!values.length) return 0
  const { count, error } = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .in(column, values)
  if (error) throw new Error(`${table} count: ${error.message}`)
  return count ?? 0
}

/**
 * Permanently delete the job, its demand lines and its change history.
 * Migration 0092 preserves supplier asks, answers and orders. Shared asks stay
 * open for surviving jobs; orphaned asks close and revoke their public links.
 * Returns null if there is no such request.
 */
export async function deleteJobRequest(id: number): Promise<JobRequestDeletion | null> {
  const { data: found, error: findError } = await supabase
    .from('job_requests')
    .select('id')
    .eq('id', id)
    .maybeSingle()
  if (findError) throw new Error(`job_requests: ${findError.message}`)
  if (!found) return null

  const { data: links, error: arError } = await supabase
    .from('availability_request_jobs')
    .select('availability_request_id')
    .eq('job_request_id', id)
  if (arError) throw new Error(`availability_request_jobs: ${arError.message}`)
  const arIds = (links ?? []).map((row) => row.availability_request_id)

  const [items, changelog, arItems] = await Promise.all([
    countWhere('job_request_items', 'job_request_id', [id]),
    countWhere('job_request_changelog', 'job_request_id', [id]),
    countWhere('availability_request_items', 'availability_request_id', arIds),
  ])

  const { error } = await supabase.from('job_requests').delete().eq('id', id)
  if (error) throw new Error(`job_requests delete: ${error.message}`)

  return {
    items,
    availabilityRequests: 0,
    availabilityRequestItems: 0,
    changelog,
    answers: arItems,
  }
}

/**
 * Delete one line of a job request — permanently, and scoped to its request.
 *
 * The request id is part of the lookup rather than decoration: it is what stops
 * a wrong id in the URL from deleting a line of somebody else's job.
 *
 * Its changelog entries cascade away with it. Any `availability_request_items`
 * already asked about this line do **not** — see `JobRequestDeletion.answers`.
 *
 * Returns null if the request has no such line.
 */
export async function deleteJobRequestItem(
  requestId: number,
  itemId: number,
): Promise<JobRequestDeletion | null> {
  const { data: found, error: findError } = await supabase
    .from('job_request_items')
    .select('id')
    .eq('id', itemId)
    .eq('job_request_id', requestId)
    .maybeSingle()
  if (findError) throw new Error(`job_request_items: ${findError.message}`)
  if (!found) return null

  const [changelog, answers] = await Promise.all([
    countWhere('job_request_changelog', 'item_id', [itemId]),
    countWhere('availability_request_items', 'job_request_item_id', [itemId]),
  ])

  const { error } = await supabase.from('job_request_items').delete().eq('id', itemId)
  if (error) throw new Error(`job_request_items delete: ${error.message}`)

  return {
    items: 1,
    availabilityRequests: 0,
    availabilityRequestItems: 0,
    changelog,
    answers,
  }
}
