import 'server-only'

import { SUPPLIER_CATEGORIES } from '@/lib/columns'
import { CUSTOMER_TYPES } from '@/lib/customers'
import { ITEM_STATUSES, REQUEST_STATUSES } from '@/lib/job-requests'
import { applyServerFilters, type ServerFilter } from '@/lib/server-filters'
import type { ServerSort } from '@/lib/server-sort'
import { sourceUrl, supabase } from '@/lib/supabase'
import type {
  Contact,
  ContactLink,
  PlantGroup,
  PlantRow,
  SourceLink,
  SupplierCompany,
  SupplierProfile,
  SupplierRef,
  SupplierRow,
  SupplierSource,
} from '@/lib/rows'

export const PAGE_SIZE = 50
export const PLANT_PAGE_SIZE = 300

interface SupplierRecord {
  id: number
  name: string
  /** Added by migration 0049; search_suppliers does not project it, so callers augment it. */
  head_branch_id?: number | null
  category: string | null
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  website: string | null
  latitude: number | null
  longitude: number | null
  notes: string | null
  communication_notes: string | null
  /** Migrations 0064/0068. Only `select('*')` reads carry them; search projections don't. */
  daisy_thread_id?: string | null
  rosie_thread_id?: string | null
  availability_source_type: string | null
  availability_update_days: number | null
  hosted_availability_url: string | null
  /** Migrations 0062/0074 — the LPS Partner flag. `search_suppliers` projects it. */
  is_lps_partner?: boolean
  is_active?: boolean
  created_at: string | null
  updated_at: string | null
}

interface InventoryRecord {
  id: string
  /** Derived by the database from the three parts below — never written here. */
  name: string
  common_name: string | null
  botanical_name: string | null
  cultivar_variety_trade_name: string | null
  cultivar_keys: string[] | null
  size: string | null
  size_std: string | null
  unit_price: number | null
  quantity: number | null
  supplier_id: number | null
  /** Projected by `search_inventory`; absent when reading `inventory` directly. */
  supplier_name?: string | null
  source_id?: string | null
  notes: string | null
  internal_notes: string | null
  height: string | null
  width: string | null
  caliper: string | null
  height_std: number | null
  width_std: number | null
  caliper_std: number | null
  source?: string | null
  updated_at: string | null
}

/** "Jane Ruiz [Sales Manager]" — falls back to whatever identifies the person. */
function contactLabel(c: Contact): string {
  const who = c.name || c.email || c.phone || 'Unnamed contact'
  return c.title_department ? `${who} [${c.title_department}]` : who
}

function toSupplierRow(
  s: SupplierRecord,
  extras: { sources?: SourceLink[]; itemCount?: number | null; contacts?: Contact[] } = {},
): SupplierRow {
  const ref: SupplierRef = {
    id: s.id,
    headBranchId: s.head_branch_id ?? s.id,
    latitude: s.latitude,
    longitude: s.longitude,
    is_active: s.is_active ?? true,
    address: s.address,
  }
  const sources = extras.sources ?? []
  // Primary first (see contactsBySupplier), so the head of the list is the
  // supplier's default point of contact and the tail is everyone else.
  const contacts = extras.contacts ?? []
  const [primary, ...others] = contacts
  return {
    id: s.id,
    ref,
    sourceLinks: sources,
    contacts,
    values: {
      name: s.name,
      category: s.category,
      primary_contact_name: primary?.name ?? null,
      primary_contact_email: primary?.email ?? null,
      primary_contact_phone: primary?.phone ?? null,
      other_contacts: others.map(contactLabel),
      website: s.website,
      inventory_sources: sources.map((f) => f.label),
      last_ingestion_date: sources[0]?.ingestedAt ?? null,
      availability_source_type: s.availability_source_type,
      availability_update_days: s.availability_update_days,
      hosted_availability_url: s.hosted_availability_url,
      is_lps_partner: s.is_lps_partner ?? null,
      item_count: extras.itemCount ?? null,
      address: s.address,
      city: s.city,
      state: s.state,
      zip: s.zip,
      notes: s.notes,
      communication_notes: s.communication_notes,
      daisy_thread_id: s.daisy_thread_id ?? null,
      rosie_thread_id: s.rosie_thread_id ?? null,
      created_at: s.created_at,
      updated: s.updated_at,
    },
  }
}

function toPlantRow(
  r: InventoryRecord,
  sourceDetails?: { path: string; ingestedAt: string | null } | null,
  /** The farm's name, where the caller resolved it — `search_inventory` projects it. */
  branch?: string | null,
): PlantRow {
  const path = sourceDetails?.path ?? r.source ?? null
  return {
    id: r.id,
    supplierId: r.supplier_id,
    sourcePath: path,
    values: {
      name: r.name,
      // Which farm holds the row. Plant search groups by company, so without
      // this the rows under one card would not say where the stock actually is.
      branch: branch ?? r.supplier_name ?? null,
      common_name: r.common_name,
      botanical_name: r.botanical_name,
      cultivar: r.cultivar_variety_trade_name,
      size: r.size,
      size_std: r.size_std,
      price: r.unit_price,
      qty: r.quantity,
      h: r.height,
      w: r.width,
      cal: r.caliper,
      h_std: r.height_std,
      w_std: r.width_std,
      cal_std: r.caliper_std,
      notes: r.notes,
      internal_notes: r.internal_notes ?? null,
      source: path ? fileLabel(path) : null,
      ingestion_date: sourceDetails?.ingestedAt ?? null,
      updated: r.updated_at,
    },
  }
}

/**
 * `inventory_sources.file_path` is not consistent: most rows hold a bare object
 * key, but some hold a full public storage URL and others a link to a supplier's
 * own catalogue page. Pull the object key out of the storage URLs so they can be
 * signed like any other upload instead of leaking the public URL.
 */
function storageKey(path: string): string | null {
  if (!/^https?:\/\//i.test(path)) return path
  const marker = '/storage/v1/object/public/lps/'
  const at = path.indexOf(marker)
  if (at === -1) return null
  return decodeURIComponent(path.slice(at + marker.length).split('?')[0])
}

/** Display name for a source: the file name, or the host for a catalogue link. */
function fileLabel(path: string): string {
  const key = storageKey(path)
  if (key) return key.split('/').pop() || key

  try {
    const url = new URL(path)
    const last = decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() ?? '')
    // A real filename is more useful than the host; a bare page path is not.
    return /\.[a-z0-9]{2,5}$/i.test(last) ? last : url.hostname.replace(/^www\./, '')
  } catch {
    return path
  }
}

/** Source provenance for a set of source ids, including active-only ingestion time. */
async function detailsBySourceId(
  ids: string[],
): Promise<Map<string, { path: string; ingestedAt: string | null }>> {
  const map = new Map<string, { path: string; ingestedAt: string | null }>()
  if (!ids.length) return map
  const { data, error } = await supabase
    .from('inventory_sources')
    .select('id, file_path, created_at, is_active')
    .in('id', ids)
  if (error) throw new Error(`inventory_sources: ${error.message}`)
  for (const row of (data ?? []) as { id: string; file_path: string; created_at: string; is_active: boolean }[]) {
    map.set(row.id, { path: row.file_path, ingestedAt: row.is_active ? row.created_at : null })
  }
  return map
}

/**
 * Both the search RPC and `inventory` carry `source_id`, but neither
 * exposes the source ingestion timestamp. Resolve it once per result batch;
 * manual/source-less rows deliberately remain blank.
 */
async function withSourceDetails(
  records: InventoryRecord[],
  /** Farm names by supplier id, for the browse path — `inventory` has no `supplier_name`. */
  branches?: Map<number, string>,
): Promise<PlantRow[]> {
  const ids = [...new Set(records.map((r) => r.source_id).filter((v): v is string => !!v))]
  const details = await detailsBySourceId(ids)
  return records.map((r) =>
    toPlantRow(
      r,
      r.source_id ? details.get(r.source_id) ?? null : null,
      r.supplier_id == null ? null : branches?.get(r.supplier_id) ?? null,
    ),
  )
}

/** Active source files per supplier, for the "Inventory sources" column. */
async function sourcesBySupplier(ids: number[]): Promise<Map<number, SourceLink[]>> {
  const map = new Map<number, SourceLink[]>()
  if (!ids.length) return map

  // PostgREST caps one response at 1,000 rows; a supplier page can collectively
  // exceed that, so page until every active source is represented.
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('inventory_sources')
      .select('supplier_id, file_path, created_at')
      .in('supplier_id', ids)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .range(from, from + 999)

    if (error) throw new Error(`inventory_sources: ${error.message}`)
    const rows = (data ?? []) as { supplier_id: number; file_path: string; created_at: string }[]
    for (const row of rows) {
      const list = map.get(row.supplier_id) ?? []
      list.push({ label: fileLabel(row.file_path), path: row.file_path, ingestedAt: row.created_at })
      map.set(row.supplier_id, list)
    }
    if (rows.length < 1000) break
  }
  return map
}

/** The contact half of a `supplier_contacts` row, as PostgREST embeds it. */
type LinkedContact = {
  supplier_id: number
  is_primary: boolean
  contacts: Omit<Contact, 'supplier_id' | 'is_primary' | 'also_at'> | null
}

/**
 * Active contacts per supplier, primary first.
 *
 * Contacts are many-to-many with suppliers (migration 0034): one rep covers
 * several locations of the same company, so the supplier and the primary flag
 * live on the `supplier_contacts` link, not on the person. A contact shows up
 * here only when both the link and the person are active.
 *
 * `search_suppliers` already resolves the primary contact into its
 * `primary_contact_*` columns, but `getSupplier` reads the `suppliers` table
 * directly and the profile needs the whole list anyway — so every caller goes
 * through this and the row mapping has one shape to handle.
 */
async function contactsBySupplier(ids: number[]): Promise<Map<number, Contact[]>> {
  const map = new Map<number, Contact[]>()
  if (!ids.length) return map

  const { data, error } = await supabase
    .from('supplier_contacts')
    .select(
      'supplier_id, is_primary, contacts!inner(id, name, email, phone, title_department, notes, created_at, updated_at, is_active)',
    )
    .in('supplier_id', ids)
    .eq('is_active', true)
    .eq('contacts.is_active', true)
    .order('is_primary', { ascending: false })
    .order('contact_id', { ascending: true })

  if (error) throw new Error(`supplier_contacts: ${error.message}`)
  const links = (data ?? []) as unknown as LinkedContact[]
  const alsoAt = await otherLocationsOf(links.map((l) => l.contacts?.id ?? 0))

  for (const link of links) {
    if (!link.contacts) continue
    const list = map.get(link.supplier_id) ?? []
    list.push({
      ...link.contacts,
      supplier_id: link.supplier_id,
      is_primary: link.is_primary,
      also_at: (alsoAt.get(link.contacts.id) ?? []).filter(
        (l) => l.supplier_id !== link.supplier_id,
      ),
    })
    map.set(link.supplier_id, list)
  }
  return map
}

/**
 * Every active location each of these contacts covers.
 *
 * The profile has to say so: the card edits the person, not the link, so
 * changing a phone number there changes it at every location that shares them.
 */
async function otherLocationsOf(contactIds: number[]): Promise<Map<number, ContactLink[]>> {
  const map = new Map<number, ContactLink[]>()
  if (!contactIds.length) return map

  const { data, error } = await supabase
    .from('supplier_contacts')
    .select('contact_id, supplier_id, suppliers!inner(name, is_active)')
    .in('contact_id', contactIds)
    .eq('is_active', true)
    .eq('suppliers.is_active', true)

  if (error) throw new Error(`supplier_contacts locations: ${error.message}`)
  type Row = { contact_id: number; supplier_id: number; suppliers: { name: string } | null }
  for (const row of (data ?? []) as unknown as Row[]) {
    const list = map.get(row.contact_id) ?? []
    list.push({ supplier_id: row.supplier_id, supplier_name: row.suppliers?.name ?? '' })
    map.set(row.contact_id, list)
  }
  return map
}

/** One supplier's active contacts, primary first — the profile's Contacts tab. */
export async function getSupplierContacts(id: number): Promise<Contact[]> {
  return (await contactsBySupplier([id])).get(id) ?? []
}

// Active inventory count per supplier. PostgREST has aggregate functions
// disabled on this project, so this is one indexed COUNT per supplier — ~2s for
// a page of 50, which is why the suppliers page loads it as a second pass
// rather than blocking the table.
// ponytail: a `supplier_item_counts(ids bigint[])` RPC would make it one query;
// add it if the second pass ever feels slow.
export async function itemCounts(ids: number[]): Promise<Record<number, number>> {
  const pairs = await Promise.all(
    ids.map(async (id) => {
      const { count } = await supabase
        .from('inventory')
        .select('id', { count: 'exact', head: true })
        .eq('supplier_id', id)
        .eq('is_active', true)
      return [id, count ?? 0] as const
    }),
  )
  return Object.fromEntries(pairs)
}

/**
 * One page of suppliers, plus how many the search matched in total.
 *
 * `count: 'exact'` asks PostgREST for the size of the whole RPC result, not the
 * page — the header says "of 1,234", so a page-length total would be a lie.
 */
export async function listSuppliers(
  search: string,
  page = 1,
  filters: ServerFilter[] = [],
  sort: ServerSort | null = null,
): Promise<{ companies: SupplierCompany[]; total: number }> {
  // Supplier Search paginates companies, not farms. Grouping a 50-location SQL
  // page afterwards would repeat Everde on several pages and make the total a
  // location count, so read the (small: ~1,400 rows) match set first, attach
  // migration 0049's head_branch_id, group, and only then take the company page.
  const records: SupplierRecord[] = []
  for (let from = 0; ; from += 1000) {
    let query = applyServerFilters(supabase.rpc('search_suppliers', { search }), filters)
    // A header sort replaces relevance across the whole location match set.
    // Company order is the first matching location in that stable order.
    if (sort) {
      query = query
        .order(sort.column, { ascending: sort.ascending, nullsFirst: false })
        .order('id', { ascending: true })
    }
    const { data, error } = await query.range(from, from + 999)
    if (error) throw new Error(`search_suppliers: ${error.message}`)
    const batch = (data ?? []) as SupplierRecord[]
    records.push(...batch)
    if (batch.length < 1000) break
  }

  if (!records.length) return { companies: [], total: 0 }

  // search_suppliers predates head_branch_id and deliberately has no grouping
  // responsibility. Read the one missing key from suppliers and keep every
  // location record otherwise byte-for-byte from the ranked/filtered RPC.
  const headByLocation = new Map<number, number>()
  for (let at = 0; at < records.length; at += 500) {
    const ids = records.slice(at, at + 500).map((record) => record.id)
    const { data, error } = await supabase
      .from('suppliers')
      .select('id, head_branch_id')
      .in('id', ids)
    if (error) throw new Error(`supplier company keys: ${error.message}`)
    for (const row of (data ?? []) as { id: number; head_branch_id: number }[]) {
      headByLocation.set(row.id, row.head_branch_id)
    }
  }

  const grouped = new Map<number, SupplierRecord[]>()
  for (const record of records) {
    const headId = headByLocation.get(record.id) ?? record.id
    record.head_branch_id = headId
    grouped.set(headId, [...(grouped.get(headId) ?? []), record])
  }

  const total = grouped.size
  const fromCompany = (page - 1) * PAGE_SIZE
  const pageEntries = [...grouped.entries()].slice(fromCompany, fromCompany + PAGE_SIZE)
  if (!pageEntries.length) return { companies: [], total }

  // The row the page shows is the head office, matched or not — so it is read
  // here rather than picked out of the match set. Its siblings come with it:
  // `# Items` and the ingestion columns on that row are company-wide, and a
  // farm that did not answer the query still holds stock the company has.
  const headIds = pageEntries.map(([headId]) => headId)
  const [{ data: heads, error: headError }, { data: activeLocations, error: locationError }] = await Promise.all([
    supabase.from('suppliers').select('*').in('id', headIds),
    supabase.from('suppliers').select('id, head_branch_id').in('head_branch_id', headIds).eq('is_active', true),
  ])
  if (headError) throw new Error(`supplier company heads: ${headError.message}`)
  if (locationError) throw new Error(`supplier company locations: ${locationError.message}`)

  const headRecords = new Map((heads ?? []).map((row) => [(row as SupplierRecord).id, row as SupplierRecord]))
  const companyLocationIds = new Map<number, number[]>()
  for (const row of (activeLocations ?? []) as { id: number; head_branch_id: number }[]) {
    companyLocationIds.set(row.head_branch_id, [...(companyLocationIds.get(row.head_branch_id) ?? []), row.id])
  }
  const locationIdsOf = (headId: number, matches: SupplierRecord[]) => [
    ...new Set([...(companyLocationIds.get(headId) ?? []), ...matches.map((record) => record.id)]),
  ]

  // Sources for every location in these companies, not just the matching ones,
  // because the head row's ingestion columns speak for the whole company.
  // Contacts stay per row: the head office's own people are what its row shows.
  const everyLocationId = [
    ...new Set(pageEntries.flatMap(([headId, matches]) => locationIdsOf(headId, matches))),
  ]
  const contactIds = [...new Set([...headIds, ...pageEntries.flatMap(([, m]) => m.map((r) => r.id))])]
  const [sources, contacts] = await Promise.all([
    sourcesBySupplier(everyLocationId),
    contactsBySupplier(contactIds),
  ])

  return {
    companies: pageEntries.map(([headId, matches]) => {
      const locationIds = locationIdsOf(headId, matches)
      const head = headRecords.get(headId) ?? matches[0]
      const headRow = toSupplierRow(head, {
        // Newest first, so `last_ingestion_date` reads the latest drop anywhere
        // in the company — toSupplierRow takes it from the head of this list.
        sources: locationIds
          .flatMap((id) => sources.get(id) ?? [])
          .sort((a, b) => b.ingestedAt.localeCompare(a.ingestedAt)),
        contacts: contacts.get(headId) ?? [],
      })
      const locations = matches
        .filter((record) => record.id !== headId)
        .map((record) =>
          toSupplierRow(record, {
            sources: sources.get(record.id) ?? [],
            contacts: contacts.get(record.id) ?? [],
          }),
        )
        .sort((a, b) => String(a.values.name ?? '').localeCompare(String(b.values.name ?? '')))
      return {
        id: headId,
        name: head?.name ?? String(headRow.values.name ?? ''),
        head: headRow,
        locations,
        locationCount: locationIds.length,
        matchedCount: matches.length,
        locationIds,
      }
    }),
    total,
  }
}

/**
 * Plant search, grouped by **company** — one card per company, with every
 * matching plant from every one of its farms underneath it, each row naming its
 * farm in `values.branch`.
 *
 * Inventory itself stays location-scoped: `inventory.supplier_id` is a farm and
 * nothing here changes that. The company is the unit of presentation, because a
 * buyer asking "who has 15G Live Oak" wants one Everde, not four.
 *
 * `search_inventory` returns nothing for an empty query — there is nothing to
 * rank — so an empty search browses `inventory` directly instead.
 */
/**
 * One page of the search, with every column filter applied as SQL over the
 * RPC's result set.
 *
 * The filters go on *outside* the function, which is what makes the page and
 * the `count` agree with each other: PostgREST applies them before its own
 * `range()`, so "showing 73 of 570" can no longer mean "73 of the 300 rows we
 * happened to fetch". See lib/server-filters.ts.
 */
async function inventorySearch(
  term: string,
  filters: ServerFilter[],
  page: number,
  sort: ServerSort | null,
): Promise<{ records: InventoryRecord[]; total: number }> {
  const from = (page - 1) * PLANT_PAGE_SIZE
  // Ordering is stated explicitly rather than relying on the function's own
  // ORDER BY surviving PostgREST's outer query. `relevance` is IDF-weighted
  // term coverage; the tie-breakers match what the function does internally.
  let query = applyServerFilters(
    supabase.rpc('search_inventory', { search: term }, { count: 'exact' }),
    filters,
  )
  // A header sort outranks relevance, because asking for the cheapest match is
  // asking across the whole result set and not within the page relevance chose.
  // Relevance stays underneath it, so equal prices still lead with the best
  // match. Missing values go last either way — descending price must not
  // promote unpriced inventory above real supplier prices.
  if (sort) query = query.order(sort.column, { ascending: sort.ascending, nullsFirst: false })
  const { data, error, count } = await query
    .order('relevance', { ascending: false })
    .order('updated_at', { ascending: false })
    .range(from, from + PLANT_PAGE_SIZE - 1)
  if (error) throw new Error(`search_inventory: ${error.message}`)
  const records = (data ?? []) as InventoryRecord[]
  return { records, total: count ?? records.length }
}

/**
 * The values each multiselect offers, for one search.
 *
 * Deliberately computed from the search *without* the column filters: options
 * derived from already-filtered rows would collapse to whatever is selected, so
 * picking one size would make every other size disappear from the list. Keyed
 * on the search term alone, so it is fetched once per query rather than on
 * every filter change.
 */
export async function plantFacets(
  search: string,
  supplierIds?: number[],
): Promise<Record<string, string[]>> {
  const term = search.trim()
  // A supplier's own tab browses rather than searches, so with no query its
  // facets come from that company's inventory instead of from a match set.
  if (!term) return supplierIds?.length ? inventoryFacets(supplierIds) : {}
  let facetQuery = supabase
    .rpc('search_inventory', { search: term })
    .select('size_std, cultivar_variety_trade_name, supplier_category, supplier_city, supplier_state')
  if (supplierIds?.length) facetQuery = facetQuery.in('supplier_id', supplierIds)
  const { data, error } = await facetQuery
    // ponytail: a facet on a match set larger than this is truncated. Raise it
    // or move to a distinct-values RPC if a real query ever exceeds it.
    .limit(20000)
  if (error) throw new Error(`search_inventory facets: ${error.message}`)

  const facets: Record<string, Set<string>> = {
    size: new Set(), cultivar: new Set(), category: new Set(), city: new Set(), state: new Set(),
  }
  type FacetRow = {
    size_std: string | null
    cultivar_variety_trade_name: string | null
    supplier_category: string | null
    supplier_city: string | null
    supplier_state: string | null
  }
  for (const row of (data ?? []) as FacetRow[]) {
    if (row.size_std) facets.size.add(row.size_std)
    if (row.supplier_category) facets.category.add(row.supplier_category)
    if (row.supplier_city) facets.city.add(row.supplier_city)
    if (row.supplier_state) facets.state.add(row.supplier_state)
    // The cultivar cell is a comma-separated residual, so the dropdown offers
    // the individual names — the same grain the `cultivar_keys` filter matches.
    for (const part of (row.cultivar_variety_trade_name ?? '').split(/[,;|]/)) {
      const name = part.trim()
      if (name) facets.cultivar.add(name)
    }
  }
  return Object.fromEntries(Object.entries(facets).map(([k, v]) => [k, [...v]]))
}

/** Facets for a profile's whole active inventory — the no-search case. */
async function inventoryFacets(supplierIds: number[]): Promise<Record<string, string[]>> {
  const { data, error } = await supabase
    .from('inventory')
    .select('size_std, cultivar_variety_trade_name')
    .in('supplier_id', supplierIds)
    .eq('is_active', true)
    .limit(20000)
  if (error) throw new Error(`inventory facets: ${error.message}`)
  const size = new Set<string>()
  const cultivar = new Set<string>()
  for (const row of (data ?? []) as { size_std: string | null; cultivar_variety_trade_name: string | null }[]) {
    if (row.size_std) size.add(row.size_std)
    for (const part of (row.cultivar_variety_trade_name ?? '').split(/[,;|]/)) {
      const name = part.trim()
      if (name) cultivar.add(name)
    }
  }
  return { size: [...size], cultivar: [...cultivar] }
}

export async function searchPlantGroups(
  search: string,
  filters: ServerFilter[] = [],
  page = 1,
  sort: ServerSort | null = null,
): Promise<{ groups: PlantGroup[]; total: number }> {
  const term = search.trim()
  let records: InventoryRecord[]
  // Matches across the whole search, not just this page — the header counts it.
  let total: number

  if (term) {
    // The RPC owns full-query identity semantics. An empty specific query must
    // stay empty: splitting it into individual words here can turn an unknown
    // cultivar into a broad generic result and defeat the backend safety gate.
    ;({ records, total } = await inventorySearch(term, filters, page, sort))
  } else {
    // Browsing with no search term: one real page of the catalogue. The RPC
    // cannot serve this — an empty `search` has nothing to rank and returns
    // zero rows by design — so the filters, the count and the page all go
    // straight to the table, which gets the same contract the search branch
    // has: `total` is every matching row, not just what this page holds.
    //
    // The trade this makes is the supplier spread. Ordering the catalogue by
    // updated_at surfaces the one or two suppliers ingested most recently, so
    // page 1 is a shallow set of groups rather than a broad one. Correct
    // counts and working pagination were worth more than the wider first page.
    const from = (page - 1) * PLANT_PAGE_SIZE
    let query = applyServerFilters(
      supabase.from('inventory').select('*', { count: 'exact' }).eq('is_active', true),
      filters,
    )
    if (sort) query = query.order(sort.column, { ascending: sort.ascending, nullsFirst: false })
    const { data, error, count } = await query
      // `name` and `id` are tie-breakers, not preferences: without a total
      // order, two pages can repeat or skip a row that ties on updated_at.
      .order('updated_at', { ascending: false })
      .order('name', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + PLANT_PAGE_SIZE - 1)
    if (error) throw new Error(`inventory: ${error.message}`)
    records = (data ?? []) as InventoryRecord[]
    total = count ?? records.length
  }

  const supplierIds = [...new Set(records.map((r) => r.supplier_id).filter((id): id is number => id != null))]
  if (!supplierIds.length) return { groups: [], total }

  const { data: sups, error: supErr } = await supabase.from('suppliers').select('*').in('id', supplierIds)
  if (supErr) throw new Error(`suppliers: ${supErr.message}`)
  const supplierRecords = (sups ?? []) as SupplierRecord[]
  const byId = new Map(supplierRecords.map((supplier) => [supplier.id, supplier]))
  const headOf = (id: number) => byId.get(id)?.head_branch_id ?? id

  const headIds = [...new Set(supplierRecords.map((supplier) => supplier.head_branch_id ?? supplier.id))]
  const [{ data: heads, error: headError }, { data: companyLocations, error: companyLocationError }] =
    await Promise.all([
      supabase.from('suppliers').select('*').in('id', headIds),
      supabase.from('suppliers').select('id, head_branch_id').in('head_branch_id', headIds).eq('is_active', true),
    ])
  if (headError) throw new Error(`supplier company heads: ${headError.message}`)
  if (companyLocationError) throw new Error(`supplier company locations: ${companyLocationError.message}`)
  const headRecords = new Map((heads ?? []).map((row) => [(row as SupplierRecord).id, row as SupplierRecord]))

  // Every active location of every company on this page, so the card's own
  // columns (its files, its last ingestion) speak for the company the way the
  // Suppliers table's row does — even for farms this search did not match.
  const companyLocationIds = new Map<number, Set<number>>()
  for (const location of (companyLocations ?? []) as { id: number; head_branch_id: number }[]) {
    const set = companyLocationIds.get(location.head_branch_id) ?? new Set<number>()
    set.add(location.id)
    companyLocationIds.set(location.head_branch_id, set)
  }
  for (const id of supplierIds) {
    const head = headOf(id)
    const set = companyLocationIds.get(head) ?? new Set<number>()
    set.add(id)
    companyLocationIds.set(head, set)
  }

  const [sources, contacts, plantRows] = await Promise.all([
    sourcesBySupplier([...new Set([...companyLocationIds.values()].flatMap((set) => [...set]))]),
    contactsBySupplier(headIds),
    // The browse path reads `inventory`, which has no `supplier_name`, so the
    // Branch column's farm names are resolved from the supplier records here.
    withSourceDetails(records, new Map(supplierRecords.map((r) => [r.id, r.name]))),
  ])

  const groups = new Map<number, PlantGroup>()
  const matchedFarms = new Map<number, Set<number>>()
  for (const plant of plantRows) {
    if (plant.supplierId == null) continue
    const record = byId.get(plant.supplierId)
    if (!record) continue
    const headId = record.head_branch_id ?? record.id

    let group = groups.get(headId)
    if (!group) {
      const head = headRecords.get(headId) ?? record
      const locationIds = [...(companyLocationIds.get(headId) ?? new Set([record.id]))]
      group = {
        companyId: headId,
        companyName: head.name,
        company: toSupplierRow(head, {
          sources: locationIds
            .flatMap((id) => sources.get(id) ?? [])
            .sort((a, b) => b.ingestedAt.localeCompare(a.ingestedAt)),
          contacts: contacts.get(headId) ?? [],
        }),
        locationCount: locationIds.length,
        matchedLocations: 0,
        plants: [],
      }
      groups.set(headId, group)
      matchedFarms.set(headId, new Set())
    }
    group.plants.push({
      ...plant,
      stockLocation: { name: record.name, city: record.city, state: record.state },
    })
    matchedFarms.get(headId)!.add(plant.supplierId)
  }

  // The card's aggregates describe the *matched* plants across the company, not
  // any one farm's whole catalogue — same as the design.
  for (const [headId, group] of groups) {
    const prices = group.plants
      .map((p) => p.values.price)
      .filter((v): v is number => typeof v === 'number')
    group.matchedLocations = matchedFarms.get(headId)?.size ?? 1
    group.company.values.plant_count = group.plants.length
    group.company.values.cheapest = prices.length ? Math.min(...prices) : null
    group.company.values.in_stock = group.plants.reduce(
      (n, p) => n + (typeof p.values.qty === 'number' ? p.values.qty : 0),
      0,
    )
  }

  return { groups: [...groups.values()], total }
}

/** Option lists for the suppliers table, unnarrowed by its own filters. */
export async function supplierFacets(search: string): Promise<Record<string, string[]>> {
  const { data, error } = await supabase
    .rpc('search_suppliers', { search })
    .select('category, city, state, availability_source_type')
    .limit(20000)
  if (error) throw new Error(`search_suppliers facets: ${error.message}`)

  const facets: Record<string, Set<string>> = {
    category: new Set(), city: new Set(), state: new Set(), availability_source_type: new Set(),
  }
  for (const row of (data ?? []) as Record<string, string | null>[]) {
    for (const key of Object.keys(facets)) {
      const value = row[key]
      if (value) facets[key].add(value)
    }
  }
  return Object.fromEntries(Object.entries(facets).map(([k, v]) => [k, [...v]]))
}

/** Active source files per supplier, with the ids and URLs the Files tab needs. */
async function sourcesByLocation(ids: number[]): Promise<Map<number, SupplierSource[]>> {
  const map = new Map<number, SupplierSource[]>()
  if (!ids.length) return map
  const { data, error } = await supabase
    .from('inventory_sources')
    .select('id, supplier_id, file_path, notes, created_at')
    .in('supplier_id', ids)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
  if (error) throw new Error(`inventory_sources(${ids.join(',')}): ${error.message}`)

  type Row = { id: string; supplier_id: number; file_path: string; notes: string | null; created_at: string }
  for (const row of (data ?? []) as Row[]) {
    const { supplier_id, ...source } = row
    map.set(supplier_id, [...(map.get(supplier_id) ?? []), { ...source, url: sourceUrl(source.file_path) }])
  }
  return map
}

/**
 * Everything one supplier profile page renders.
 *
 * **The page is one page per company.** Opened on a head-branch id its scope is
 * every active location of the company, so its tabs list the contacts, files
 * and notes of all of them and tag each entry with the farm it belongs to.
 * Opened on a farm id the scope is that farm alone — the farm keeps its own
 * page, reachable from the company's Farms tab.
 *
 * `head_branch_id` is never null and never chains (docs/supabase-schema.md), so
 * one equality on it is the whole company and a single-site supplier is its own
 * head — which makes the company case and the lone-farm case the same code.
 */
export async function getSupplierProfile(id: number): Promise<SupplierProfile | null> {
  const { data: self, error: selfError } = await supabase
    .from('suppliers')
    .select('id, head_branch_id')
    .eq('id', id)
    .maybeSingle()
  if (selfError) throw new Error(`suppliers(${id}) head branch: ${selfError.message}`)
  if (!self) return null
  const headId = (self as { head_branch_id: number }).head_branch_id

  const { data: siblings, error: siblingError } = await supabase
    .from('suppliers')
    .select('id')
    .eq('head_branch_id', headId)
    .eq('is_active', true)
  if (siblingError) throw new Error(`suppliers locations(${headId}): ${siblingError.message}`)
  const companyIds = [...new Set([...((siblings ?? []) as { id: number }[]).map((r) => r.id), headId])]
  const scopeIds = id === headId ? companyIds : [id]

  const [{ data: rows, error: rowError }, sources, contacts, counts] = await Promise.all([
    supabase.from('suppliers').select('*').in('id', scopeIds),
    sourcesByLocation(scopeIds),
    contactsBySupplier(scopeIds),
    itemCounts(scopeIds),
  ])
  if (rowError) throw new Error(`suppliers(${scopeIds.join(',')}): ${rowError.message}`)
  if (!rows?.length) return null

  const locations = (rows as SupplierRecord[])
    .map((record) => ({
      row: toSupplierRow(record, {
        sources: sourceLinksOf(sources.get(record.id) ?? []),
        contacts: contacts.get(record.id) ?? [],
        itemCount: counts[record.id] ?? 0,
      }),
      is_head: record.id === headId,
      sources: sources.get(record.id) ?? [],
    }))
    // Head office first; the rest alphabetically, as the Farms tab lists them.
    .sort((a, b) =>
      Number(b.is_head) - Number(a.is_head) ||
      String(a.row.values.name ?? '').localeCompare(String(b.row.values.name ?? '')),
    )

  const headName =
    locations.find((location) => location.is_head)?.row.values.name ??
    (await supabase.from('suppliers').select('name').eq('id', headId).maybeSingle()).data?.name ??
    ''

  return {
    subjectId: id,
    company: { id: headId, name: String(headName), locationCount: companyIds.length },
    locations,
  }
}

/** The `SourceLink` shape the row's "Inventory sources" column renders. */
function sourceLinksOf(sources: SupplierSource[]): SourceLink[] {
  return sources.map((source) => ({
    label: fileLabel(source.file_path),
    path: source.file_path,
    ingestedAt: source.created_at,
  }))
}

export const PROFILE_PAGE_SIZE = 100

/**
 * One company's plants, one page at a time — a supplier can carry thousands of
 * rows, so the profile pages through them rather than capping the list.
 * Fetches PAGE_SIZE + 1 to report `hasMore` without a second count query.
 *
 * `ids` is the profile's scope: every location of the company on a company
 * page, one farm on a farm page. Each row names its farm in `values.branch`,
 * which is what the Inventory tab groups its farm cards by.
 */
export async function getSupplierPlants(
  ids: number[],
  search: string,
  page = 1,
  filters: ServerFilter[] = [],
  sort: ServerSort | null = null,
): Promise<{ plants: PlantRow[]; hasMore: boolean }> {
  const term = search.trim()
  const from = (page - 1) * PROFILE_PAGE_SIZE
  const to = from + PROFILE_PAGE_SIZE

  if (term) {
    // `supplier_ids` left the RPC with the other filter parameters (migration
    // 0045) — scoping to a company's farms is the same outer filter as any other.
    let query = applyServerFilters(
      supabase.rpc('search_inventory', { search: term }).in('supplier_id', ids),
      filters,
    )
    // Same rule as the plant search: a header sort orders the supplier's whole
    // matched inventory, not the hundred rows this page happens to hold, and
    // relevance drops to being its tie-breaker.
    if (sort) query = query.order(sort.column, { ascending: sort.ascending, nullsFirst: false })
    const { data, error } = await query
      .order('relevance', { ascending: false })
      .order('updated_at', { ascending: false })
      .range(from, to)
    if (error) throw new Error(`search_inventory: ${error.message}`)
    const records = (data ?? []) as InventoryRecord[]
    return {
      plants: await withSourceDetails(records.slice(0, PROFILE_PAGE_SIZE)),
      hasMore: records.length > PROFILE_PAGE_SIZE,
    }
  }

  let query = applyServerFilters(
    supabase
      .from('inventory')
      .select('*')
      .in('supplier_id', ids)
      .eq('is_active', true),
    filters,
  )
  if (sort) query = query.order(sort.column, { ascending: sort.ascending, nullsFirst: false })
  const [{ data, error }, { data: farms, error: farmError }] = await Promise.all([
    query.order('updated_at', { ascending: false }).range(from, to),
    // `inventory` carries no `supplier_name`, so the Branch column's farm names
    // are read here — `search_inventory` above projects them itself.
    supabase.from('suppliers').select('id, name').in('id', ids),
  ])
  if (error) throw new Error(`inventory: ${error.message}`)
  if (farmError) throw new Error(`suppliers(${ids.join(',')}): ${farmError.message}`)
  const records = (data ?? []) as InventoryRecord[]
  return {
    plants: await withSourceDetails(
      records.slice(0, PROFILE_PAGE_SIZE),
      new Map(((farms ?? []) as { id: number; name: string }[]).map((farm) => [farm.id, farm.name])),
    ),
    hasMore: records.length > PROFILE_PAGE_SIZE,
  }
}

/**
 * Resolve a source file to a temporary signed URL.
 *
 * The path arrives from the browser, so it is checked against
 * `inventory_sources.file_path` first — signing whatever string a client sends
 * would turn this into an oracle for any object in the `lps` bucket. Paths that
 * are already full URLs are returned untouched.
 */
export async function signedSourceUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('inventory_sources')
    .select('file_path')
    .eq('file_path', path)
    .limit(1)
  if (error) throw new Error(`inventory_sources: ${error.message}`)
  if (!data?.length) return null

  // Rows that stored a full public storage URL still get signed — the object key
  // is recoverable from the URL, and a signed link is what we want to hand out.
  const key = storageKey(path)
  if (!key) return path

  const signed = await supabase.storage.from('lps').createSignedUrl(key, 3600)
  if (signed.error) throw new Error(`sign ${key}: ${signed.error.message}`)
  return signed.data.signedUrl
}

// ---------------------------------------------------------------- mutations

const WRITABLE: Record<string, string[]> = {
  // No email/phone: those moved to `contacts` in migration 0016 and the
  // columns are gone. Reaching a supplier is a contacts write now.
  // No `communication_notes`: retired by migration 0063, and the
  // `supplier_messages` transcript that replaced it was dropped 2026-08-23 —
  // the frozen column archive remains, and nothing may write it.
  // No `is_lps_partner`: it is derived from the company's portal logins and
  // maintained by the `app_users_sync_lps_partner` trigger (migration 0084).
  // A write here would be overwritten the next time an account moved, and in
  // the meantime would claim a portal that nobody can sign into.
  suppliers: [
    'name', 'category', 'address', 'city', 'state', 'zip', 'notes',
    'availability_source_type', 'availability_update_days', 'hosted_availability_url',
  ],
  // No `name`: it is derived by the database from the three name parts
  // (migration 0040), so writing it here would be silently overwritten by
  // `trg_inventory_derive_identity`. Edit the part, not the composition.
  // `notes` is the supplier's own text about the offering; `internal_notes` is
  // ours (migration 0039). Both are editable, neither is a substitute.
  inventory: [
    'common_name', 'botanical_name', 'cultivar_variety_trade_name',
    'unit_price', 'quantity', 'height', 'width', 'caliper', 'notes', 'internal_notes',
  ],
  // The person, not the link: editing these changes the contact at every
  // location they cover. `is_primary` lives on `supplier_contacts` and is set
  // through `setPrimaryContact`.
  contacts: ['name', 'email', 'phone', 'title_department', 'notes'],
  // No `name` or any `*_key`: derived by `trg_plant_photos_derive_identity`,
  // exactly as on `inventory`. No `supplier_id`, `captured_at` or `source`
  // either — provenance and attribution are cataloguing decisions that belong
  // to whoever received the photo, not to a passing correction in the grid.
  // `size` *is* editable here, unlike on `inventory`, because no ingestion
  // pipeline owns a photo's size — someone typing what the label says is the
  // only way it ever gets fixed.
  plant_photos: [
    'common_name', 'botanical_name', 'cultivar_variety_trade_name',
    'size', 'height', 'width', 'caliper', 'tags', 'caption', 'notes',
  ],
  // Customer and internal sourcing notes are editable. Customer mapping remains
  // a find-or-create decision rather than a typed correction.
  job_requests: [
    'name', 'status', 'note_for_customer', 'note_internal', 'expected_install_date', 'fulfillment_method',
    'billing_address', 'billing_city', 'billing_state', 'billing_zip',
    'shipping_address', 'shipping_city', 'shipping_state', 'shipping_zip',
  ],
  // No `total`: `job_lines` computes it. Status, price, avail and the customer
  // note live on the line's selected candidate (0130) and are written through
  // `update_job_line`. Name, size, demand and the internal note are the line's
  // own columns: the customer's ask, never the candidate's.
  job_request_items: [
    'name', 'size', 'demanded_quantity', 'available_quantity', 'unit_price',
    'status', 'note_for_customer', 'note_internal',
  ],
  // `notes` is durable facts about the customer, edited in place. There is no
  // contact-log column beside it any more: `communication_notes` was dropped by
  // migration 0073 and the customer's rosie thread carries that history.
  customers: [
    'name', 'company', 'type', 'email', 'phone', 'address', 'city', 'state', 'zip', 'notes',
  ],
}

/**
 * Columns whose value must be one of a fixed vocabulary.
 *
 * The database CHECK is the real guard; this exists so a bad value comes back
 * as a sentence naming the allowed ones rather than a constraint-violation
 * string, and so the server does not depend on the dropdown having been honest.
 */
const ENUMS: Record<string, readonly string[]> = {
  'suppliers.category': SUPPLIER_CATEGORIES,
  'customers.type': CUSTOMER_TYPES,
  'job_requests.status': REQUEST_STATUSES,
  'job_requests.fulfillment_method': ['pickup', 'delivery'],
  'job_request_items.status': ITEM_STATUSES,
}

/** Job line values held by the selected candidate (0130), written through `update_job_line`. */
const JOB_LINE_VALUES = new Set(['status', 'unit_price', 'available_quantity', 'note_for_customer'])

const NUMERIC = new Set([
  'unit_price', 'quantity', 'demanded_quantity', 'availability_update_days', 'available_quantity',
])
// Checkbox columns arrive as the strings a form produces.
// Array columns arrive as one comma-separated field. Splitting is all this does
// — `trg_plant_photos_derive_identity` lowercases, trims, dedupes and sorts the
// result, so there is one definition of what a tag list is and it is the
// database's.
const ARRAY = new Set(['tags'])
// `availability_update_days` is an integer column, so a fractional value would
// be rejected by Postgres rather than rounded. Say so here instead.
const INTEGER = new Set(['availability_update_days'])
// Boolean columns arrive as the strings a dropdown produces; anything but a
// literal 'true' means false. Empty since `is_lps_partner` became derived
// (2026-08-30) — kept because the coercion below is the contract for the next
// writable boolean, not because one exists today.
const BOOLEAN = new Set<string>([])

/**
 * Update one cell. The table/column pair is checked against a whitelist here,
 * on the server, because the request body arrives from the browser — a client
 * that asked to write `is_active` or a column on another table must not be able
 * to just because the UI would never send it.
 */
export async function updateCell(
  table: string,
  id: string | number,
  column: string,
  raw: string | null,
): Promise<void> {
  await updateFields(table, id, { [column]: raw })
}

/**
 * Validate and update several cells on one row in one atomic database write.
 * `null` is a job line's customer note following the supplier's reply again;
 * anywhere else it reads as an emptied field.
 */
export async function updateFields(
  table: string,
  id: string | number,
  changes: Record<string, string | null>,
): Promise<void> {
  const entries = Object.entries(changes)
  if (entries.length === 0) throw new Error('at least one change is required')

  const values: Record<string, string | number | boolean | string[] | null> = {}
  for (const [column, given] of entries) {
    if (!WRITABLE[table]?.includes(column)) {
      throw new Error(`refusing to write ${table}.${column}`)
    }

    // The customer note is an override on the selected candidate: '' keeps it
    // deliberately blank, null follows the supplier's reply.
    if (table === 'job_request_items' && column === 'note_for_customer') {
      values[column] = given === null ? null : given.trim()
      continue
    }
    const raw = given ?? ''

    const allowed = ENUMS[`${table}.${column}`]
    if (allowed) {
      // Empty classification dropdowns clear to NULL. Statuses remain required.
      const nullable = (table === 'suppliers' && column === 'category')
        || (table === 'customers' && column === 'type')
        || (table === 'job_requests' && column === 'fulfillment_method')
      if (nullable && raw.trim() === '') {
        values[column] = null
        continue
      }
      if (!allowed.includes(raw)) {
        throw new Error(`${column} must be one of: ${allowed.join(', ')}`)
      }
      values[column] = raw
      continue
    }

    if (column === 'expected_install_date' && raw.trim() && (!/^\d{4}-\d{2}-\d{2}$/.test(raw.trim()) || Number.isNaN(Date.parse(raw.trim())) || new Date(raw.trim()).toISOString().slice(0, 10) !== raw.trim())) {
      throw new Error('Expected delivery / installation date must be a valid YYYY-MM-DD date')
    }

    if (ARRAY.has(column)) {
      // `tags` is NOT NULL, so an emptied field is an empty array, not null.
      values[column] = raw.split(',').map((part) => part.trim()).filter(Boolean)
      continue
    }

    if (BOOLEAN.has(column)) {
      values[column] = raw.trim() === 'true'
      continue
    }

    let value: string | number | null = raw.trim() === '' ? null : raw.trim()
    if (table === 'job_request_items' && column === 'name' && value === null) throw new Error('Plant name is required')
    if (value !== null && NUMERIC.has(column)) {
      const n = Number(value)
      if (!Number.isFinite(n)) throw new Error(`${column} must be a number`)
      if (INTEGER.has(column) && !Number.isInteger(n)) {
        throw new Error(`${column} must be a whole number of days`)
      }
      // Demand is positive; supplier availability can also be zero.
      // Naming the rule beats surfacing a constraint-violation string.
      if ((column === 'quantity' || column === 'demanded_quantity') && n <= 0) {
        throw new Error(`${column} must be greater than zero`)
      }
      if (column === 'available_quantity' && n < 0) {
        throw new Error('available quantity cannot be negative')
      }
      value = n
    }
    values[column] = value
    // The standardized value is derived evidence, not a guess. A manual source-
    // string edit invalidates it until ingestion/review supplies a paired value.
    if (table === 'inventory' && column === 'height') values.height_std = null
    if (table === 'inventory' && column === 'width') values.width_std = null
    if (table === 'inventory' && column === 'caliper') values.caliper_std = null
    // Same rule for a photo's size: `size_std` is a reviewed bucket, not
    // something to guess from freshly typed text. It drops out of the Size
    // filter until Daisy sets it — which is the honest state, not a bug.
    if (table === 'plant_photos' && column === 'size') values.size_std = null
  }

  if (table === 'job_request_items' && Object.keys(values).some((column) => JOB_LINE_VALUES.has(column))) {
    if (!Object.keys(values).every((column) => JOB_LINE_VALUES.has(column))) {
      throw new Error('write a line\'s status, price, availability or customer note apart from its other fields')
    }
    const { error } = await supabase.rpc('update_job_line', { p_item_id: Number(id), p_changes: values })
    // Bare, like the other RPC callers: its RAISE messages are written for people,
    // and a `fn_name:` prefix reads as plumbing to errorCopy.
    if (error) throw new Error(error.message)
    return
  }

  const { error } = await supabase.from(table).update(values).eq('id', id)
  if (error) throw new Error(`${table} update: ${error.message}`)
}

/**
 * Retire one ingested file. Its inventory rows go with it.
 *
 * The cascade belongs to the database — `trg_cascade_source_deactivation`
 * (migration 0048) retires every row whose `source_id` is this file, so a
 * hand-written UPDATE cannot leave live rows pointing at a dead source. All
 * this does is flip the file and report what the trigger is about to take.
 *
 * The count is read first for that reason: afterwards those rows are inactive
 * and indistinguishable from ones retired for their own reasons earlier.
 */
export async function deactivateSource(id: string): Promise<number> {
  const { count, error } = await supabase
    .from('inventory')
    .select('id', { count: 'exact', head: true })
    .eq('source_id', id)
    .eq('is_active', true)
  if (error) throw new Error(`inventory count (source ${id}): ${error.message}`)

  const { error: sourceError } = await supabase
    .from('inventory_sources')
    .update({ is_active: false })
    .eq('id', id)
  if (sourceError) throw new Error(`inventory_sources delete: ${sourceError.message}`)

  return count ?? 0
}

/** Soft delete — the schema's convention is to flip is_active, never DELETE. */
export async function softDelete(table: string, id: string | number): Promise<void> {
  // Not `contacts`: a contact can cover several locations, so removing one from
  // a supplier retires that link, not the person — see `unlinkContact`. Not
  // `inventory_sources` either: retiring a file has to take its rows with it —
  // see `deactivateSource`.
  //
  // `plant_photos` is a plain soft delete with no cascade in either direction:
  // a photo is evidence of what a plant looks like, not a claim about stock, so
  // it neither retires anything nor is retired by anything. The object stays in
  // the bucket — the row still points at it, and deleting bytes is not
  // reversible.
  if (table !== 'suppliers' && table !== 'inventory' && table !== 'plant_photos') {
    throw new Error(`refusing to delete from ${table}`)
  }
  const { error } = await supabase.from(table).update({ is_active: false }).eq('id', id)
  if (error) throw new Error(`${table} delete: ${error.message}`)
}

/** Active `supplier_contacts` links for one supplier. */
async function activeLinkCount(supplierId: number): Promise<number> {
  const { count, error } = await supabase
    .from('supplier_contacts')
    .select('id', { count: 'exact', head: true })
    .eq('supplier_id', supplierId)
    .eq('is_active', true)
  if (error) throw new Error(`supplier_contacts: ${error.message}`)
  return count ?? 0
}

/**
 * Add a person to a supplier: the contact row, then the link that puts them at
 * this location. The first contact a supplier gets is its primary.
 */
export async function createContact(
  supplierId: number,
  fields: Record<string, string>,
): Promise<Contact> {
  const values: Record<string, string | null> = {}
  for (const column of WRITABLE.contacts) {
    const raw = fields[column]
    if (raw !== undefined) values[column] = raw.trim() || null
  }
  if (!values.name && !values.email && !values.phone) {
    throw new Error('a contact needs at least a name, email or phone')
  }

  const isPrimary = (await activeLinkCount(supplierId)) === 0

  const { data, error } = await supabase
    .from('contacts')
    .insert(values)
    .select('id, name, email, phone, title_department, notes, created_at, updated_at')
    .single()
  if (error) throw new Error(`contacts insert: ${error.message}`)

  const contact = data as Omit<Contact, 'supplier_id' | 'is_primary' | 'also_at'>
  const { error: linkErr } = await supabase
    .from('supplier_contacts')
    .insert({ supplier_id: supplierId, contact_id: contact.id, is_primary: isPrimary })
  if (linkErr) throw new Error(`supplier_contacts insert: ${linkErr.message}`)

  return { ...contact, supplier_id: supplierId, is_primary: isPrimary, also_at: [] }
}

/**
 * Promote one contact to the supplier's primary.
 *
 * `supplier_contacts_one_primary_idx` allows a single active primary per
 * supplier, so the incumbent has to be demoted first — promoting before
 * demoting would trip the unique index. The flag is per location: the same
 * person can be primary at one of a company's nurseries and not at another.
 */
export async function setPrimaryContact(supplierId: number, contactId: number): Promise<void> {
  const { error: demoteErr } = await supabase
    .from('supplier_contacts')
    .update({ is_primary: false })
    .eq('supplier_id', supplierId)
    .eq('is_active', true)
    .eq('is_primary', true)
  if (demoteErr) throw new Error(`supplier_contacts demote: ${demoteErr.message}`)

  const { data, error } = await supabase
    .from('supplier_contacts')
    .update({ is_primary: true })
    .eq('supplier_id', supplierId)
    .eq('contact_id', contactId)
    .eq('is_active', true)
    .select('id')
  if (error) throw new Error(`supplier_contacts promote: ${error.message}`)
  if (!data?.length) throw new Error(`contact ${contactId} is not active at supplier ${supplierId}`)
}

/**
 * Remove a contact from one supplier — the link goes inactive, the person does
 * not. Someone who covers three of a company's farms keeps answering for the
 * other two; only their last link retires the contact itself.
 */
export async function unlinkContact(supplierId: number, contactId: number): Promise<void> {
  const { data, error } = await supabase
    .from('supplier_contacts')
    .update({ is_active: false })
    .eq('supplier_id', supplierId)
    .eq('contact_id', contactId)
    .eq('is_active', true)
    .select('id')
  if (error) throw new Error(`supplier_contacts unlink: ${error.message}`)
  if (!data?.length) throw new Error(`contact ${contactId} is not active at supplier ${supplierId}`)

  const { count, error: countErr } = await supabase
    .from('supplier_contacts')
    .select('id', { count: 'exact', head: true })
    .eq('contact_id', contactId)
    .eq('is_active', true)
  if (countErr) throw new Error(`supplier_contacts: ${countErr.message}`)
  if ((count ?? 0) > 0) return

  const { error: retireErr } = await supabase
    .from('contacts')
    .update({ is_active: false })
    .eq('id', contactId)
  if (retireErr) throw new Error(`contacts delete: ${retireErr.message}`)
}
