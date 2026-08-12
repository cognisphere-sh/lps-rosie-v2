import 'server-only'

import type { DimensionRanges } from '@/lib/dimension-ranges'
import { sourceUrl, supabase } from '@/lib/supabase'
import type {
  Contact,
  PlantGroup,
  PlantRow,
  SourceLink,
  SupplierRef,
  SupplierRow,
  SupplierSource,
} from '@/lib/rows'

export const PAGE_SIZE = 50

interface SupplierRecord {
  id: number
  name: string
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
  availability_source_type: string | null
  availability_update_days: number | null
  hosted_availability_url: string | null
  is_active?: boolean
  created_at: string | null
  updated_at: string | null
}

interface InventoryRecord {
  id: string
  name: string
  other_names: string | null
  size: string | null
  unit_price: number | null
  quantity: number | null
  supplier_id: number | null
  source_id?: string | null
  notes: string | null
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
      item_count: extras.itemCount ?? null,
      city: s.city,
      state: s.state,
      notes: s.notes,
      communication_notes: s.communication_notes,
      created_at: s.created_at,
      updated: s.updated_at,
    },
  }
}

function toPlantRow(
  r: InventoryRecord,
  sourceDetails?: { path: string; ingestedAt: string | null } | null,
): PlantRow {
  const path = sourceDetails?.path ?? r.source ?? null
  return {
    id: r.id,
    supplierId: r.supplier_id,
    sourcePath: path,
    values: {
      name: r.name,
      other: r.other_names ?? null,
      size: r.size,
      price: r.unit_price,
      qty: r.quantity,
      h: r.height,
      w: r.width,
      cal: r.caliper,
      h_std: r.height_std,
      w_std: r.width_std,
      cal_std: r.caliper_std,
      notes: r.notes,
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
 * Both the search RPC and `inventory_enriched` carry `source_id`, but neither
 * exposes the source ingestion timestamp. Resolve it once per result batch;
 * manual/source-less rows deliberately remain blank.
 */
async function withSourceDetails(records: InventoryRecord[]): Promise<PlantRow[]> {
  const ids = [...new Set(records.map((r) => r.source_id).filter((v): v is string => !!v))]
  const details = await detailsBySourceId(ids)
  return records.map((r) => toPlantRow(r, r.source_id ? details.get(r.source_id) ?? null : null))
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

/**
 * Active contacts per supplier, primary first.
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
    .from('contacts')
    .select('id, supplier_id, name, email, phone, title_department, notes, is_primary, created_at, updated_at')
    .in('supplier_id', ids)
    .eq('is_active', true)
    .order('is_primary', { ascending: false })
    .order('id', { ascending: true })

  if (error) throw new Error(`contacts: ${error.message}`)
  for (const row of (data ?? []) as Contact[]) {
    const list = map.get(row.supplier_id) ?? []
    list.push(row)
    map.set(row.supplier_id, list)
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

export async function listSuppliers(search: string): Promise<SupplierRow[]> {
  const { data, error } = await supabase
    .rpc('search_suppliers', { search })
    .range(0, PAGE_SIZE - 1)

  if (error) throw new Error(`search_suppliers: ${error.message}`)
  const records = (data ?? []) as SupplierRecord[]
  const ids = records.map((r) => r.id)
  const [sources, contacts] = await Promise.all([sourcesBySupplier(ids), contactsBySupplier(ids)])
  return records.map((r) =>
    toSupplierRow(r, { sources: sources.get(r.id) ?? [], contacts: contacts.get(r.id) ?? [] }),
  )
}

/**
 * Plant search, grouped by supplier — the master rows on the Plant search page
 * are the suppliers that matched, with their matching plants underneath.
 *
 * `search_inventory` cannot be called with an empty query (it walks all ~74k
 * active rows and blows the statement timeout — see docs/supabase-schema.md),
 * so an empty search browses `inventory_enriched` instead.
 */
const dimensionRpcArgs = (ranges: DimensionRanges) => ({
  height_min: ranges.heightMin ?? null,
  height_max: ranges.heightMax ?? null,
  width_min: ranges.widthMin ?? null,
  width_max: ranges.widthMax ?? null,
  caliper_min: ranges.caliperMin ?? null,
  caliper_max: ranges.caliperMax ?? null,
})

async function inventorySearch(term: string, ranges: DimensionRanges): Promise<InventoryRecord[]> {
  const { data, error } = await supabase
    .rpc('search_inventory', { search: term, ...dimensionRpcArgs(ranges) })
    .range(0, 299)
  if (error) throw new Error(`search_inventory: ${error.message}`)
  return (data ?? []) as InventoryRecord[]
}

export async function searchPlantGroups(
  search: string,
  ranges: DimensionRanges = {},
): Promise<PlantGroup[]> {
  const term = search.trim()
  let records: InventoryRecord[]

  if (term) {
    // The RPC owns full-query identity semantics. An empty specific query must
    // stay empty: splitting it into individual words here can turn an unknown
    // cultivar into a broad generic result and defeat the backend safety gate.
    records = await inventorySearch(term, ranges)
  } else {
    // Browsing with no search term. Ordering the whole catalogue by updated_at
    // returns rows from only the one or two suppliers ingested most recently,
    // which makes a page grouped *by supplier* look broken. So pick the
    // suppliers behind the newest availability files first, then read their
    // plants — the default view is then a real spread of groups.
    const { data: recent, error: recentErr } = await supabase
      .from('inventory_sources')
      .select('supplier_id, created_at')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .range(0, 59)
    if (recentErr) throw new Error(`inventory_sources: ${recentErr.message}`)

    const recentSuppliers = [
      ...new Set((recent ?? []).map((r) => (r as { supplier_id: number }).supplier_id)),
    ].slice(0, 8)

    // One capped read per supplier rather than a single big one: a shared limit
    // gets eaten by whichever supplier happens to sort first (two suppliers with
    // 150 rows each would fill a 300-row budget on their own), leaving the rest
    // of the groups empty.
    const perSupplier = await Promise.all(
      recentSuppliers.map(async (supplierId) => {
        const { data, error } = await supabase
          .from('inventory_enriched')
          .select('*')
          .eq('is_active', true)
          .eq('supplier_id', supplierId)
          .order('updated_at', { ascending: false })
          .range(0, 29)
        if (error) throw new Error(`inventory_enriched: ${error.message}`)
        return (data ?? []) as InventoryRecord[]
      }),
    )
    records = perSupplier.flat()
  }

  const supplierIds = [...new Set(records.map((r) => r.supplier_id).filter((id): id is number => id != null))]
  if (!supplierIds.length) return []

  const [{ data: sups, error: supErr }, sources, contacts, plantRows] = await Promise.all([
    supabase.from('suppliers').select('*').in('id', supplierIds),
    sourcesBySupplier(supplierIds),
    contactsBySupplier(supplierIds),
    withSourceDetails(records),
  ])
  if (supErr) throw new Error(`suppliers: ${supErr.message}`)

  const byId = new Map((sups ?? []).map((s) => [(s as SupplierRecord).id, s as SupplierRecord]))

  const groups = new Map<number, PlantGroup>()
  for (const plant of plantRows) {
    if (plant.supplierId == null) continue
    const record = byId.get(plant.supplierId)
    if (!record) continue

    let group = groups.get(plant.supplierId)
    if (!group) {
      group = {
        supplier: toSupplierRow(record, {
          sources: sources.get(plant.supplierId) ?? [],
          contacts: contacts.get(plant.supplierId) ?? [],
        }),
        plants: [],
      }
      groups.set(plant.supplierId, group)
    }
    group.plants.push(plant)
  }

  // The master row's aggregates describe the *matched* plants, not the
  // supplier's whole catalogue — same as the design.
  for (const group of groups.values()) {
    const prices = group.plants
      .map((p) => p.values.price)
      .filter((v): v is number => typeof v === 'number')
    group.supplier.values.plant_count = group.plants.length
    group.supplier.values.cheapest = prices.length ? Math.min(...prices) : null
    group.supplier.values.in_stock = group.plants.reduce(
      (n, p) => n + (typeof p.values.qty === 'number' ? p.values.qty : 0),
      0,
    )
  }

  return [...groups.values()]
}

export async function getSupplier(id: number): Promise<SupplierRow | null> {
  const [{ data, error }, sources, contacts, counts] = await Promise.all([
    supabase.from('suppliers').select('*').eq('id', id).maybeSingle(),
    sourcesBySupplier([id]),
    contactsBySupplier([id]),
    itemCounts([id]),
  ])
  if (error) throw new Error(`suppliers(${id}): ${error.message}`)
  if (!data) return null
  return toSupplierRow(data as SupplierRecord, {
    sources: sources.get(id) ?? [],
    contacts: contacts.get(id) ?? [],
    itemCount: counts[id] ?? 0,
  })
}

export async function getSupplierSources(id: number): Promise<SupplierSource[]> {
  const { data, error } = await supabase
    .from('inventory_sources')
    .select('*')
    .eq('supplier_id', id)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`inventory_sources(${id}): ${error.message}`)
  return ((data ?? []) as { id: string; file_path: string; notes: string | null; created_at: string }[]).map(
    (s) => ({ ...s, url: sourceUrl(s.file_path) }),
  )
}

export const PROFILE_PAGE_SIZE = 100

/**
 * One supplier's plants, one page at a time — a supplier can carry thousands of
 * rows, so the profile pages through them rather than capping the list.
 * Fetches PAGE_SIZE + 1 to report `hasMore` without a second count query.
 */
export async function getSupplierPlants(
  id: number,
  search: string,
  page = 1,
  ranges: DimensionRanges = {},
): Promise<{ plants: PlantRow[]; hasMore: boolean }> {
  const term = search.trim()
  const from = (page - 1) * PROFILE_PAGE_SIZE
  const to = from + PROFILE_PAGE_SIZE

  if (term) {
    const { data, error } = await supabase
      .rpc('search_inventory', { search: term, supplier_ids: [id], ...dimensionRpcArgs(ranges) })
      .range(from, to)
    if (error) throw new Error(`search_inventory: ${error.message}`)
    const records = (data ?? []) as InventoryRecord[]
    return {
      plants: await withSourceDetails(records.slice(0, PROFILE_PAGE_SIZE)),
      hasMore: records.length > PROFILE_PAGE_SIZE,
    }
  }

  let query = supabase
    .from('inventory_enriched')
    .select('*')
    .eq('supplier_id', id)
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
  if (ranges.heightMin != null) query = query.gte('height_std', ranges.heightMin)
  if (ranges.heightMax != null) query = query.lte('height_std', ranges.heightMax)
  if (ranges.widthMin != null) query = query.gte('width_std', ranges.widthMin)
  if (ranges.widthMax != null) query = query.lte('width_std', ranges.widthMax)
  if (ranges.caliperMin != null) query = query.gte('caliper_std', ranges.caliperMin)
  if (ranges.caliperMax != null) query = query.lte('caliper_std', ranges.caliperMax)
  const { data, error } = await query.range(from, to)
  if (error) throw new Error(`inventory_enriched: ${error.message}`)
  const records = (data ?? []) as InventoryRecord[]
  return {
    plants: await withSourceDetails(records.slice(0, PROFILE_PAGE_SIZE)),
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
  suppliers: [
    'name', 'city', 'state', 'notes', 'communication_notes',
    'availability_source_type', 'availability_update_days', 'hosted_availability_url',
  ],
  inventory: ['name', 'unit_price', 'quantity', 'height', 'width', 'caliper', 'notes'],
  contacts: ['name', 'email', 'phone', 'title_department', 'notes'],
}

const NUMERIC = new Set(['unit_price', 'quantity', 'availability_update_days'])
// `availability_update_days` is an integer column, so a fractional value would
// be rejected by Postgres rather than rounded. Say so here instead.
const INTEGER = new Set(['availability_update_days'])

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
  raw: string,
): Promise<void> {
  await updateFields(table, id, { [column]: raw })
}

/** Validate and update several cells on one row in one atomic database write. */
export async function updateFields(
  table: string,
  id: string | number,
  changes: Record<string, string>,
): Promise<void> {
  const entries = Object.entries(changes)
  if (entries.length === 0) throw new Error('at least one change is required')

  const values: Record<string, string | number | null> = {}
  for (const [column, raw] of entries) {
    if (!WRITABLE[table]?.includes(column)) {
      throw new Error(`refusing to write ${table}.${column}`)
    }

    let value: string | number | null = raw.trim() === '' ? null : raw.trim()
    if (value !== null && NUMERIC.has(column)) {
      const n = Number(value)
      if (!Number.isFinite(n)) throw new Error(`${column} must be a number`)
      if (INTEGER.has(column) && !Number.isInteger(n)) {
        throw new Error(`${column} must be a whole number of days`)
      }
      value = n
    }
    values[column] = value
    // The standardized value is derived evidence, not a guess. A manual source-
    // string edit invalidates it until ingestion/review supplies a paired value.
    if (table === 'inventory' && column === 'height') values.height_std = null
    if (table === 'inventory' && column === 'width') values.width_std = null
    if (table === 'inventory' && column === 'caliper') values.caliper_std = null
  }

  const { error } = await supabase.from(table).update(values).eq('id', id)
  if (error) throw new Error(`${table} update: ${error.message}`)
}

/** Soft delete — the schema's convention is to flip is_active, never DELETE. */
export async function softDelete(table: string, id: string | number): Promise<void> {
  if (table !== 'suppliers' && table !== 'inventory' && table !== 'contacts') {
    throw new Error(`refusing to delete from ${table}`)
  }
  // A retired contact keeps its is_primary flag as history, but the partial
  // unique index only covers active rows, so the supplier is left free to
  // promote someone else.
  const { error } = await supabase.from(table).update({ is_active: false }).eq('id', id)
  if (error) throw new Error(`${table} delete: ${error.message}`)
}

/** Add a person to a supplier. The first contact a supplier gets is its primary. */
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

  const { count, error: countErr } = await supabase
    .from('contacts')
    .select('id', { count: 'exact', head: true })
    .eq('supplier_id', supplierId)
    .eq('is_active', true)
  if (countErr) throw new Error(`contacts: ${countErr.message}`)

  const { data, error } = await supabase
    .from('contacts')
    .insert({ ...values, supplier_id: supplierId, is_primary: (count ?? 0) === 0 })
    .select('id, supplier_id, name, email, phone, title_department, notes, is_primary, created_at, updated_at')
    .single()
  if (error) throw new Error(`contacts insert: ${error.message}`)
  return data as Contact
}

/**
 * Promote one contact to the supplier's primary.
 *
 * `contacts_one_primary_idx` allows a single active primary per supplier, so
 * the incumbent has to be demoted first — promoting before demoting would trip
 * the unique index.
 */
export async function setPrimaryContact(id: number): Promise<void> {
  const { data, error } = await supabase
    .from('contacts')
    .select('supplier_id')
    .eq('id', id)
    .eq('is_active', true)
    .maybeSingle()
  if (error) throw new Error(`contacts(${id}): ${error.message}`)
  if (!data) throw new Error(`no active contact ${id}`)

  const { error: demoteErr } = await supabase
    .from('contacts')
    .update({ is_primary: false })
    .eq('supplier_id', (data as { supplier_id: number }).supplier_id)
    .eq('is_active', true)
    .eq('is_primary', true)
  if (demoteErr) throw new Error(`contacts demote: ${demoteErr.message}`)

  const { error: promoteErr } = await supabase
    .from('contacts')
    .update({ is_primary: true })
    .eq('id', id)
  if (promoteErr) throw new Error(`contacts promote: ${promoteErr.message}`)
}
