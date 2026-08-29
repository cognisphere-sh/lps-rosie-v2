import 'server-only'

import type {
  ARDetail,
  ARItem,
  ARSummary,
  SupplierItemLine,
  SupplierLink,
} from '@/lib/availability'
import { AR_RESPONSES } from '@/lib/availability'
import { redactPartnerRequestRefs } from '@/lib/partner-display'
import { supabase } from '@/lib/supabase'

// The reads and writes behind availability requests (migration 0062).
// Server-only for the same reason every other query module is: the client
// holds the project's secret key.

interface ARRecord {
  id: number
  job_request_id: number
  supplier_id: number
  share_customer_details: boolean
  status: string
  submitted_at: string | null
  created_at: string
  lps_notes: string | null
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
  'id, job_request_id, supplier_id, share_customer_details, status, submitted_at, created_at, lps_notes'
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
  const { data, error } = await supabase.from('job_requests').select('id, name').in('id', ids)
  if (error) throw new Error(`job_requests: ${error.message}`)
  return new Map(
    (data ?? []).map((r) => [(r as { id: number }).id, (r as { name: string | null }).name]),
  )
}

async function summarize(records: ARRecord[]): Promise<ARSummary[]> {
  if (!records.length) return []
  const suppliers = await supplierNames([...new Set(records.map((r) => r.supplier_id))])
  const jobs = await jobNames([...new Set(records.map((r) => r.job_request_id))])

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
    id: r.id,
    jobRequestId: r.job_request_id,
    jobName: jobs.get(r.job_request_id) ?? null,
    supplierId: r.supplier_id,
    supplierName: suppliers.get(r.supplier_id) ?? `Supplier ${r.supplier_id}`,
    shareCustomerDetails: r.share_customer_details,
    status: r.status,
    submittedAt: r.submitted_at,
    createdAt: r.created_at,
    itemCount: counts.get(r.id)?.items ?? 0,
    answeredCount: counts.get(r.id)?.answered ?? 0,
    lpsNotes: r.lps_notes,
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
  if (scope.jobRequestId != null) q = q.eq('job_request_id', scope.jobRequestId)
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
  opts: { forSupplierId?: number } = {},
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
  if (opts.forSupplierId != null && ar.supplier_id !== opts.forSupplierId) return null

  const [summary] = await summarize([ar])

  const { data: itemData, error: itemErr } = await supabase
    .from('availability_request_items')
    .select(AR_ITEM_COLUMNS)
    .eq('availability_request_id', id)
    .eq('is_active', true)
    .order('id', { ascending: true })
  if (itemErr) throw new Error(`availability_request_items: ${itemErr.message}`)

  // Who the job is for — only crosses the line to the supplier when the
  // request was created with `share_customer_details`.
  let customer: ARDetail['customer'] = null
  let shipping: ARDetail['shipping'] = null
  const disclose = opts.forSupplierId == null || ar.share_customer_details
  if (disclose) {
    const { data: job, error: jobErr } = await supabase
      .from('job_requests')
      .select('customer_id, shipping_address, shipping_city, shipping_state, shipping_zip')
      .eq('id', ar.job_request_id)
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
    items: ((itemData ?? []) as ARItemRecord[]).map(toARItem),
    customer,
    shipping,
  }
}

/**
 * What our own catalogue already says a line costs at this supplier, keyed by
 * job-request item id — seeded into the request so they confirm or correct a
 * number instead of typing one from scratch.
 *
 * Deliberately narrow. The look-up runs in `search_inventory`'s **exact
 * identity mode** (the quoted query, migration 0057 — no fuzzy tail), scoped
 * to this supplier's own rows and to the size asked for, and a price is taken
 * only when every surviving row agrees on one. Anything less certain goes out
 * blank: an empty box costs the supplier a moment, a wrong number in front of
 * them costs more. A failed look-up is never a failed request.
 */
async function catalogPrices(
  supplierId: number,
  items: { id: number; name: string; size: string | null }[],
): Promise<Map<number, number>> {
  const found = new Map<number, number>()
  await Promise.all(
    items.map(async (item) => {
      const name = item.name.replace(/"/g, '').trim()
      if (!name) return
      const { data, error } = await supabase
        .rpc('search_inventory', { search: `"${name}"` })
        .eq('supplier_id', supplierId)
        .gt('unit_price', 0)
      if (error) return
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
  return found
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
  jobRequestId: number
  supplierId: number
  shareCustomerDetails: boolean
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
  if (!supplier.is_lps_partner) {
    throw new Error('supplier is not an LPS Partner')
  }

  if (!input.itemIds.length) throw new Error('at least one line is required')
  const { data: items, error: itemErr } = await supabase
    .from('job_request_items')
    .select('id, name, size, quantity')
    .in('id', input.itemIds)
    .eq('job_request_id', input.jobRequestId)
    .eq('is_active', true)
  if (itemErr) throw new Error(`job_request_items: ${itemErr.message}`)
  if (!items?.length) throw new Error('no active lines of this request match the selection')

  const { data: created, error: arErr } = await supabase
    .from('availability_requests')
    .insert({
      job_request_id: input.jobRequestId,
      supplier_id: input.supplierId,
      share_customer_details: input.shareCustomerDetails,
    })
    .select('id')
    .single()
  if (arErr) throw new Error(`availability_requests: ${arErr.message}`)
  const arId = (created as { id: number }).id

  const lines = items as {
    id: number
    name: string
    size: string | null
    quantity: number | null
  }[]
  const prices = await catalogPrices(input.supplierId, lines)

  const { error: insErr } = await supabase.from('availability_request_items').insert(
    lines.map((it) => ({
      availability_request_id: arId,
      job_request_item_id: it.id,
      name: it.name,
      size: it.size,
      quantity: it.quantity,
      unit_price: prices.get(it.id) ?? null,
    })),
  )
  if (insErr) {
    // Don't leave a request with no lines behind the failure.
    await supabase.from('availability_requests').delete().eq('id', arId)
    throw new Error(`availability_request_items: ${insErr.message}`)
  }


  return arId
}

/** The response columns a supplier may write; everything else is the ask. */
const AR_ITEM_WRITABLE = ['status', 'available_quantity', 'unit_price', 'notes'] as const

/**
 * Write one line's answer, scoped: the item must belong to the request, and —
 * from the portal — the request to that supplier, still open.
 *
 * A write **from the portal** also moves the request itself to `processing`:
 * the supplier has started on it, which is what the portal's Processing tab
 * asks. Only their own hand does that — the admin drawer enters answers a
 * supplier gave by phone, and those are ours, not a sign they are working the
 * portal. `closed` never moves (`arForWrite` refuses it first).
 */
export async function updateARItem(
  arId: number,
  itemId: number,
  changes: Record<string, string>,
  opts: { forSupplierId?: number } = {},
): Promise<void> {
  const ar = await arForWrite(arId, opts.forSupplierId)

  const values: Record<string, string | number | null> = {}
  for (const [column, raw] of Object.entries(changes)) {
    if (!(AR_ITEM_WRITABLE as readonly string[]).includes(column)) {
      throw new Error(`refusing to write availability_request_items.${column}`)
    }
    const trimmed = raw.trim()
    if (column === 'status') {
      if (trimmed === '') values.status = null
      else if ((AR_RESPONSES as readonly string[]).includes(trimmed)) values.status = trimmed
      else throw new Error(`status must be one of: ${AR_RESPONSES.join(', ')}`)
      continue
    }
    if (column === 'available_quantity' || column === 'unit_price') {
      if (trimmed === '') {
        values[column] = null
        continue
      }
      const n = Number(trimmed)
      if (!Number.isFinite(n)) throw new Error(`${column} must be a number`)
      values[column] = n
      continue
    }
    values[column] = trimmed === '' ? null : trimmed
  }
  if (!Object.keys(values).length) throw new Error('at least one change is required')

  const { data, error } = await supabase
    .from('availability_request_items')
    .update(values)
    .eq('id', itemId)
    .eq('availability_request_id', ar.id)
    .eq('is_active', true)
    .select('id')
  if (error) throw new Error(`availability_request_items: ${error.message}`)
  if (!data?.length) throw new Error('line not found')

  if (opts.forSupplierId != null && ar.status !== 'processing') {
    // Best-effort: the answer is already saved, and a request left reading
    // New costs a tab, not data.
    await supabase
      .from('availability_requests')
      .update({ status: 'processing' })
      .eq('id', ar.id)
      .eq('is_active', true)
  }
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
  if (ar.status === 'closed') throw new Error('this request is closed')
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
    .order('created_at', { ascending: false })
    .limit(500)
  if (error) throw new Error(`availability_requests: ${error.message}`)
  const records = (data ?? []) as ARRecord[]
  if (!records.length) return []

  const summaries = await summarize(records)

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
  const sharedJobs = [...new Set(records.filter((r) => r.share_customer_details).map((r) => r.job_request_id))]
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
    const job = summary.shareCustomerDetails ? jobById.get(summary.jobRequestId) : undefined
    return {
      ...summary,
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

/** The supplier pressed Submit. Returns context for the notification. */
export async function submitAvailabilityRequest(
  arId: number,
  forSupplierId: number,
): Promise<{
  jobRequestId: number
  supplierId: number
  supplierName: string
  rosieThreadId: string | null
}> {
  const ar = await arForWrite(arId, forSupplierId)
  const { error } = await supabase
    .from('availability_requests')
    .update({ status: 'submitted', submitted_at: new Date().toISOString() })
    .eq('id', ar.id)
  if (error) throw new Error(`availability_requests: ${error.message}`)
  const { data: supplier, error: sErr } = await supabase
    .from('suppliers')
    .select('name, rosie_thread_id')
    .eq('id', ar.supplier_id)
    .maybeSingle()
  if (sErr) throw new Error(`suppliers: ${sErr.message}`)
  const s = supplier as { name: string; rosie_thread_id: string | null } | null
  return {
    jobRequestId: ar.job_request_id,
    supplierId: ar.supplier_id,
    supplierName: s?.name ?? `Supplier ${ar.supplier_id}`,
    rosieThreadId: s?.rosie_thread_id ?? null,
  }
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
  if (!['new', 'processing', 'submitted', 'closed'].includes(status)) {
    throw new Error('status must be one of: new, processing, submitted, closed')
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

/** The suppliers an availability request can be sent to — the LPS Partners. */
export async function listLpsPartners(): Promise<
  { id: number; name: string; city: string | null; state: string | null }[]
> {
  const { data, error } = await supabase
    .from('suppliers')
    .select('id, name, city, state')
    .eq('is_active', true)
    .eq('is_lps_partner', true)
    .order('name', { ascending: true })
  if (error) throw new Error(`suppliers: ${error.message}`)
  return (data ?? []) as { id: number; name: string; city: string | null; state: string | null }[]
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

  const { data: ars, error: arErr } = await supabase
    .from('availability_requests')
    .select('id, job_request_id, supplier_id, status, created_at')
    .in('job_request_id', jobRequestIds)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
  if (arErr) throw new Error(`availability_requests: ${arErr.message}`)

  // job → supplier → every AR link, newest first (the AR list is newest-first).
  const engaged = new Map<number, Map<number, { id: number; status: string }[]>>()
  for (const r of (ars ?? []) as {
    id: number
    job_request_id: number
    supplier_id: number
    status: string
  }[]) {
    const bySupplier =
      engaged.get(r.job_request_id) ?? new Map<number, { id: number; status: string }[]>()
    bySupplier.set(r.supplier_id, [
      ...(bySupplier.get(r.supplier_id) ?? []),
      { id: r.id, status: r.status },
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
    .neq('status', 'closed')
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

  const jobs = await jobNames([...new Set(ars.map((r) => r.job_request_id))])

  // Who each job is for — fetched **only** for the requests that were shared
  // with customer details, so a request that wasn't cannot leak one through
  // this route any more than through the cards.
  const customerByJob = await sharedCustomerNames(ars)

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
    const jobName = jobs.get(ar.job_request_id) ?? null
    return [{
      ...toARItem(raw),
      arId: ar.id,
      arStatus: ar.status,
      arCreatedAt: ar.created_at,
      // The same name and redaction the portal's own cards use.
      arName: jobName ? redactPartnerRequestRefs(jobName) : 'Availability request',
      arCustomer: ar.share_customer_details
        ? customerByJob.get(ar.job_request_id) ?? null
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
  const jobIds = [...new Set(ars.filter((r) => r.share_customer_details).map((r) => r.job_request_id))]
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
