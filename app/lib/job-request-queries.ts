import 'server-only'

import { supplierLinksByRequest } from '@/lib/availability-queries'
import type { CustomerType } from '@/lib/customers'
import { quoteLineTotal, quoteSubtotal } from '@/lib/job-request-html-quote'
import { parseEntries } from '@/lib/notes'
import type {
  JobAddress,
  JobChange,
  JobNote,
  JobRequestFacets,
  JobRequestItem,
  JobRequestRow,
  Candidate,
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
  note_internal: string | null
  note_for_customer: string | null
  created_at: string | null
  updated_at: string | null
}

/** One row of the `job_lines` view (0130): the line plus its selected candidate's values. */
interface ItemRecord {
  id: number
  job_request_id: number
  name: string
  size: string | null
  requested_size: string | null
  demanded_quantity: number | null
  available_quantity: number | null
  unit_price: number | null
  total: number | null
  status: string
  note_internal: string | null
  note_for_customer: string | null
  updated_at: string | null
  selected_candidate_id: number
  default_candidate_id: number
}

interface CustomerRecord {
  id: number
  name: string
  company: string | null
  email: string | null
  phone: string | null
  type: CustomerType | null
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
 * `note_internal` is deliberately absent from this timestamped-note parser:
 * its raw Markdown is preserved for editing and rendered by the UI.
 */
function noteEntries(text: string | null, kind: JobNote['kind']): JobNote[] {
  return parseEntries(text).map((e) => ({ kind, ...e }))
}

function notesOf(r: { note_for_customer: string | null }): JobNote[] {
  return [
    ...noteEntries(r.note_for_customer, 'shared'),
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
    // The customer's ask, not the selected candidate's size.
    size: r.requested_size,
    quantity: r.demanded_quantity == null ? null : Number(r.demanded_quantity),
    availableQuantity: r.available_quantity == null ? null : Number(r.available_quantity),
    unitPrice: r.unit_price == null ? null : Number(r.unit_price),
    total: r.total == null ? null : Number(r.total),
    status: r.status,
    notes: notesOf(r),
    noteForCustomer: r.note_for_customer,
    noteInternal: r.note_internal,
    updatedAt: r.updated_at,
    selectedCandidateId: r.selected_candidate_id,
    defaultCandidateId: r.default_candidate_id,
  }
}

const REQUEST_COLUMNS =
  'id, customer_id, name, status, expected_install_date, fulfillment_method, billing_address, billing_city, billing_state, billing_zip, shipping_address, shipping_city, shipping_state, shipping_zip, note_internal, note_for_customer, created_at, updated_at'

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
  candidates: Map<number, Candidate[]> = new Map(),
): JobRequestRow {
  const statusCounts: StatusCounts = {}
  for (const it of all) statusCounts[it.status] = (statusCounts[it.status] ?? 0) + 1
  // The same subtotal Copy Quote prints: unavailable is zero, then availability, then demand.
  const lineTotal = quoteSubtotal(all.map(toItem))

  return {
    id: r.id,
    name: r.name,
    status: r.status,
    expectedInstallDate: r.expected_install_date,
    fulfillmentMethod: r.fulfillment_method,
    customer,
    billing: addressOf(r.billing_address, r.billing_city, r.billing_state, r.billing_zip),
    shipping: addressOf(r.shipping_address, r.shipping_city, r.shipping_state, r.shipping_zip),
    notes: notesOf(r),
    noteForCustomer: r.note_for_customer,
    noteInternal: r.note_internal,
    itemCount: all.length,
    statusCounts,
    lineTotal,
    supplierLinks,
    items: visible.map((it) => ({ ...toItem(it), candidates: candidates.get(it.id) ?? [] })),
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
      .from('job_lines')
      .select(
        'id, job_request_id, name, size, requested_size, demanded_quantity, available_quantity, unit_price, total, status, note_internal, note_for_customer, updated_at, selected_candidate_id, default_candidate_id',
      )
      .in('job_request_id', ids)
      .eq('is_active', true)
      .order('id', { ascending: true })
      .range(from, from + CHUNK - 1)
    if (error) throw new Error(`job_lines: ${error.message}`)
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

/** Active candidates of the given job lines, grouped by line, oldest first; hidden ones (0124) flagged. */
async function candidatesByItem(jobItemIds: number[]): Promise<Map<number, Candidate[]>> {
  const map = new Map<number, Candidate[]>()
  // Keep each IN filter small enough for PostgREST URLs.
  for (let start = 0; start < jobItemIds.length; start += 100) {
    const { data, error } = await supabase
      .from('candidates')
      .select('id, job_request_item_id, supplier_id, name, size, status, available_quantity, unit_price, note_for_supplier, note_from_supplier, note_for_customer, description, is_original, availability_request_id, offered_candidate_id, offer_description, hide_from_lps, availability_requests(status), suppliers!inner(name)')
      .in('job_request_item_id', jobItemIds.slice(start, start + 100))
      .eq('is_active', true)
      .order('id', { ascending: true })
    if (error) throw new Error(`candidates: ${error.message}`)
    for (const row of (data ?? []) as unknown as {
      id: number
      job_request_item_id: number
      supplier_id: number
      name: string
      size: string | null
      status: string | null
      available_quantity: number | null
      unit_price: number | null
      note_for_supplier: string | null
      note_from_supplier: string | null
      note_for_customer: string | null
      description: string | null
      is_original: boolean
      availability_request_id: number | null
      offered_candidate_id: number | null
      offer_description: string | null
      hide_from_lps: boolean
      availability_requests: { status: string } | null
      suppliers: { name: string }
    }[]) {
      map.set(row.job_request_item_id, [...(map.get(row.job_request_item_id) ?? []), {
        id: row.id,
        supplierId: row.supplier_id,
        supplierName: row.suppliers.name,
        name: row.name,
        size: row.size,
        description: row.description,
        isOriginal: row.is_original,
        unitPrice: row.unit_price == null ? null : Number(row.unit_price),
        availableQuantity: row.available_quantity == null ? null : Number(row.available_quantity),
        status: row.status,
        arId: row.availability_request_id,
        arStatus: row.availability_requests?.status ?? null,
        noteForSupplier: row.note_for_supplier,
        noteFromSupplier: row.note_from_supplier,
        noteForCustomer: row.note_for_customer,
        offeredCandidateId: row.offered_candidate_id,
        offerDescription: row.offer_description,
        hidden: row.hide_from_lps,
      }])
    }
  }
  return map
}

/** True when the candidate is an active one of this job's line. */
async function candidateOfLine(requestId: number, itemId: number, candidateId: number): Promise<boolean> {
  const { data, error } = await supabase.from('candidates')
    .select('id, job_request_items!candidates_job_request_item_id_fkey!inner(job_request_id)')
    .eq('id', candidateId).eq('job_request_item_id', itemId)
    .eq('job_request_items.job_request_id', requestId).eq('is_active', true).maybeSingle()
  if (error) throw new Error(`candidates: ${error.message}`)
  return data != null
}

/**
 * Make a candidate the line's selection (`select_candidate`). Nothing is
 * copied: the line reads its values from the selected candidate (`job_lines`).
 */
export async function selectCandidate(requestId: number, itemId: number, candidateId: number): Promise<boolean> {
  if (!await candidateOfLine(requestId, itemId, candidateId)) return false
  const { error } = await supabase.rpc('select_candidate', {
    p_job_request_item_id: itemId, p_candidate_id: candidateId,
  })
  if (error) throw new Error(error.message)
  return true
}

/** Drop the line's selection back to its default candidate (`unselect_candidate`). */
export async function unselectCandidate(requestId: number, itemId: number, candidateId: number): Promise<boolean> {
  if (!await candidateOfLine(requestId, itemId, candidateId)) return false
  const { error } = await supabase.rpc('unselect_candidate', { p_job_request_item_id: itemId })
  if (error) throw new Error(error.message)
  return true
}

/**
 * Add the candidate to one of this job's ARs (its supplier's; the database
 * checks). Only a Draft or New AR takes candidates; `reopen` first moves a
 * submitted one back to New (`reopen_availability_request`) — LPS's explicit
 * "Reopen and add" — once the candidate is known to be addable.
 */
export async function addCandidateToRequest(requestId: number, itemId: number, candidateId: number, arId: number, reopen = false): Promise<boolean> {
  if (!await candidateOfLine(requestId, itemId, candidateId)) return false
  if (reopen) {
    // Reopen only for an add that can succeed: a refused add must not leave the AR New.
    const { data: ar, error: arError } = await supabase.from('availability_requests')
      .select('supplier_id').eq('id', arId).eq('job_request_id', requestId).maybeSingle()
    if (arError) throw new Error(`availability_requests: ${arError.message}`)
    const { data: unasked, error: candidateError } = ar ? await supabase.from('candidates').select('id')
      .eq('id', candidateId).eq('supplier_id', (ar as { supplier_id: number }).supplier_id)
      .is('availability_request_id', null).maybeSingle() : { data: null, error: null }
    if (candidateError) throw new Error(`candidates: ${candidateError.message}`)
    if (!unasked) throw new Error(`Only an unasked candidate of this AR's supplier can be added to AR-${arId}`)
    const { error } = await supabase.rpc('reopen_availability_request', { p_request_id: arId })
    if (error) throw new Error(error.message)
  }
  const { error } = await supabase.rpc('add_candidates_to_availability_request', {
    p_request_id: arId, p_candidate_ids: [candidateId],
  })
  if (error) throw new Error(error.message)
  return true
}

/** Hide a candidate from the line table, or show it again (`hide_from_lps`, 0124). */
export async function setCandidateHidden(requestId: number, itemId: number, candidateId: number, hidden: boolean): Promise<boolean> {
  if (!await candidateOfLine(requestId, itemId, candidateId)) return false
  const { error } = await supabase.from('candidates').update({ hide_from_lps: hidden }).eq('id', candidateId)
  if (error) throw new Error(`candidates: ${error.message}`)
  return true
}

/** Soft-delete a candidate; a line selecting it falls back to its default (the default itself is refused). */
export async function deleteCandidate(requestId: number, itemId: number, candidateId: number): Promise<boolean> {
  if (!await candidateOfLine(requestId, itemId, candidateId)) return false
  const { error } = await supabase.rpc('delete_candidate', { p_candidate_id: candidateId })
  if (error) throw new Error(error.message)
  return true
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
      .from('job_lines')
      .select('job_request_id')
      .eq('is_active', true)
    if (filters.itemStatus?.length) q = q.in('status', filters.itemStatus)
    if (filters.size?.length) q = q.in('size', filters.size)
    if (search.trim()) q = q.ilike('name', `%${search.trim()}%`)

    const { data, error } = await q.order('id', { ascending: true }).range(from, from + CHUNK - 1)
    if (error) throw new Error(`job_lines: ${error.message}`)
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

export interface RequestTotals {
  itemCount: number
  subtotal: number
}

function visibleRequestItem(item: Pick<ItemRecord, 'job_request_id' | 'status' | 'size' | 'name'>, filters: JobRequestFilters, search: string, matchedItems: Set<number> | null) {
  if (filters.itemStatus?.length && !filters.itemStatus.includes(item.status)) return false
  if (filters.size?.length && !(item.size && filters.size.includes(item.size))) return false
  return !(search && matchedItems?.has(item.job_request_id) && !item.name.toLowerCase().includes(search.toLowerCase()))
}

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
): Promise<{ requests: JobRequestRow[]; total: number; pageCount: number; totals: RequestTotals }> {
  if ((filters.status && !filters.status.length) || (filters.itemStatus && !filters.itemStatus.length)) return { requests: [], total: 0, pageCount: 1, totals: { itemCount: 0, subtotal: 0 } }
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

  if (restrictTo && !restrictTo.length) return { requests: [], total: 0, pageCount: 1, totals: { itemCount: 0, subtotal: 0 } }
  const createdAfter = filters.createdWithin ? daysAgoIso(filters.createdWithin) : null
  const updatedAfter = filters.updatedWithin ? daysAgoIso(filters.updatedWithin) : null
  const filteredJobs = <Columns extends string>(columns: Columns, count = false) => {
    let query = supabase.from('job_requests').select(columns, count ? { count: 'exact' } : {}).eq('is_active', true)
    if (restrictTo) query = query.in('id', restrictTo)
    if (filters.status?.length) query = query.in('status', filters.status)
    if (filters.customerId?.length) query = query.in('customer_id', filters.customerId)
    if (createdAfter) query = query.gte('created_at', createdAfter)
    if (updatedAfter) query = query.gte('updated_at', updatedAfter)
    return query
  }

  const from = (page - 1) * JOB_REQUEST_PAGE_SIZE
  const { data, error, count } = await filteredJobs(REQUEST_COLUMNS, true)
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

  const candidateMap = await candidatesByItem([...itemMap.values()].flat().map((it) => it.id))
  const requests: JobRequestRow[] = records.map((r) => {
    const all = itemMap.get(r.id) ?? []

    // The visible subset. Request-level filters already selected the request;
    // these decide which of its lines the expanded table draws. A search that
    // reached this request through one of its plants narrows to the plants it
    // matched; one that reached it through the customer or the id keeps them all.
    const visible = all.filter((item) => visibleRequestItem(item, filters, q, itemIdSet))

    const customer = r.customer_id == null ? null : customerMap.get(r.customer_id) ?? null
    return toRow(r, all, customer, visible, linkMap[r.id] ?? [], candidateMap)
  })

  // Scan only ids and amount fields for the footer, across every result page.
  // Use the same job filters and visible-line predicate as the expanded cards.
  const totals: RequestTotals = { itemCount: 0, subtotal: 0 }
  let cents = 0
  for (let offset = 0; ; offset += CHUNK) {
    const { data: jobs, error: jobsError } = await filteredJobs('id').order('id', { ascending: true }).range(offset, offset + CHUNK - 1)
    if (jobsError) throw new Error(`job totals: ${jobsError.message}`)
    const ids = (jobs ?? []).map((job) => (job as unknown as { id: number }).id)
    // Keep each IN filter small enough for PostgREST URLs.
    for (let start = 0; start < ids.length; start += 100) {
      for (let itemOffset = 0; ; itemOffset += CHUNK) {
        const { data: lines, error: linesError } = await supabase.from('job_lines')
          .select('id, job_request_id, name, size, status, demanded_quantity, available_quantity, unit_price').eq('is_active', true)
          .in('job_request_id', ids.slice(start, start + 100)).order('id', { ascending: true }).range(itemOffset, itemOffset + CHUNK - 1)
        if (linesError) throw new Error(`item totals: ${linesError.message}`)
        for (const item of lines ?? []) {
          if (!visibleRequestItem(item, filters, q, itemIdSet)) continue
          totals.itemCount++
          cents += Math.round((quoteLineTotal({
            status: item.status,
            quantity: item.demanded_quantity == null ? null : Number(item.demanded_quantity),
            availableQuantity: item.available_quantity == null ? null : Number(item.available_quantity),
            unitPrice: item.unit_price == null ? null : Number(item.unit_price),
          }) ?? 0) * 100)
        }
        if ((lines ?? []).length < CHUNK) break
      }
    }
    if (ids.length < CHUNK) break
  }
  totals.subtotal = cents / 100

  const total = count ?? requests.length
  return {
    requests,
    total,
    pageCount: Math.max(1, Math.ceil(total / JOB_REQUEST_PAGE_SIZE)),
    totals,
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
  const candidateMap = await candidatesByItem(all.map((it) => it.id))
  return toRow(r, all, customer, all, linkMap[r.id] ?? [], candidateMap)
}

async function customersById(ids: number[]): Promise<Map<number, JobRequestRow['customer']>> {
  const map = new Map<number, JobRequestRow['customer']>()
  if (!ids.length) return map
  const { data, error } = await supabase
    .from('customers')
    .select('id, name, company, email, phone, type, rosie_thread_id')
    .in('id', [...new Set(ids)])
  if (error) throw new Error(`customers: ${error.message}`)
  for (const c of (data ?? []) as CustomerRecord[]) {
    map.set(c.id, {
      id: c.id, name: c.name, company: c.company, email: c.email, phone: c.phone, type: c.type,
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
    supabase.from('job_lines').select('size').eq('is_active', true).not('size', 'is', null).limit(CHUNK),
    supabase.from('customers').select('id, name, company').eq('is_active', true).order('name').limit(500),
  ])
  if (sizeErr) throw new Error(`job_lines: ${sizeErr.message}`)
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
  orders?: number
  orderItems?: number
  threads?: number
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

/** Delete the job and exclusively owned records atomically; shared records survive. */
export async function deleteJobRequest(id: number): Promise<JobRequestDeletion | null> {
  const { data, error } = await supabase.rpc('delete_job_request', { p_job_request_id: id })
  if (error) throw new Error(`job_requests delete: ${error.message}`)
  return data as JobRequestDeletion | null
}

/**
 * Delete one line of a job request — permanently, and scoped to its request.
 *
 * The request id is part of the lookup rather than decoration: it is what stops
 * a wrong id in the URL from deleting a line of somebody else's job.
 *
 * Its changelog and unasked candidates go with it; candidates asked on an AR
 * stay on that AR, unlinked from the line (0130).
 *
 * Returns null if the request has no such line.
 */
export async function deleteJobRequestItem(
  requestId: number,
  itemId: number,
): Promise<JobRequestDeletion | null> {
  const { data, error } = await supabase.rpc('delete_job_request_item', {
    p_job_request_id: requestId,
    p_job_request_item_id: itemId,
  })
  if (error) throw new Error(`job_request_items delete: ${error.message}`)
  return data as JobRequestDeletion | null
}

/** Add an editable placeholder line to an active request; the database gives it its default candidate. */
export async function createJobRequestItem(requestId: number): Promise<number> {
  const { data: request, error: requestError } = await supabase.from('job_requests')
    .select('id').eq('id', requestId).eq('is_active', true).maybeSingle()
  if (requestError) throw new Error(`job_requests: ${requestError.message}`)
  if (!request) throw new Error('Job request not found')
  const { data, error } = await supabase.from('job_request_items')
    .insert({ job_request_id: requestId, name: 'New item' }).select('id').single()
  if (error) throw new Error(`job_request_items insert: ${error.message}`)
  return Number((data as { id: number }).id)
}
