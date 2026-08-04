import 'server-only'

import { sourceUrl, supabase } from '@/lib/supabase'
import type {
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
  phone: string | null
  email: string | null
  poc_name: string | null
  poc_email: string | null
  poc_phone: string | null
  website: string | null
  latitude: number | null
  longitude: number | null
  notes: string | null
  communication_notes: string | null
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
  source?: string | null
  updated_at: string | null
}

function toSupplierRow(
  s: SupplierRecord,
  extras: { sources?: SourceLink[]; itemCount?: number | null } = {},
): SupplierRow {
  const ref: SupplierRef = {
    id: s.id,
    latitude: s.latitude,
    longitude: s.longitude,
    is_active: s.is_active ?? true,
    address: s.address,
  }
  const sources = extras.sources ?? []
  return {
    id: s.id,
    ref,
    sourceLinks: sources,
    values: {
      name: s.name,
      category: s.category,
      poc_name: s.poc_name,
      poc_email: s.poc_email,
      poc_phone: s.poc_phone,
      email: s.email,
      phone: s.phone,
      website: s.website,
      inventory_sources: sources.map((f) => f.label),
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

function toPlantRow(r: InventoryRecord, sourcePath?: string | null): PlantRow {
  const path = sourcePath ?? r.source ?? null
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
      notes: r.notes,
      source: path ? fileLabel(path) : null,
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

/** `inventory_sources.file_path` for a set of source ids. */
async function pathsBySourceId(ids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  if (!ids.length) return map
  const { data, error } = await supabase
    .from('inventory_sources')
    .select('id, file_path')
    .in('id', ids)
  if (error) throw new Error(`inventory_sources: ${error.message}`)
  for (const row of (data ?? []) as { id: string; file_path: string }[]) {
    map.set(row.id, row.file_path)
  }
  return map
}

/**
 * `inventory_enriched` carries `source_id` but not the file path, so browse
 * results need a second lookup to render the Source column as a link. The
 * search RPC already returns `source`, so it skips this.
 */
async function withSourcePaths(records: InventoryRecord[]): Promise<PlantRow[]> {
  const ids = [...new Set(records.map((r) => r.source_id).filter((v): v is string => !!v))]
  const paths = await pathsBySourceId(ids)
  return records.map((r) => toPlantRow(r, r.source_id ? paths.get(r.source_id) ?? null : null))
}

/** Active source files per supplier, for the "Inventory sources" column. */
async function sourcesBySupplier(ids: number[]): Promise<Map<number, SourceLink[]>> {
  const map = new Map<number, SourceLink[]>()
  if (!ids.length) return map

  const { data, error } = await supabase
    .from('inventory_sources')
    .select('supplier_id, file_path')
    .in('supplier_id', ids)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`inventory_sources: ${error.message}`)
  for (const row of (data ?? []) as { supplier_id: number; file_path: string }[]) {
    const list = map.get(row.supplier_id) ?? []
    list.push({ label: fileLabel(row.file_path), path: row.file_path })
    map.set(row.supplier_id, list)
  }
  return map
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
  const sources = await sourcesBySupplier(records.map((r) => r.id))
  return records.map((r) => toSupplierRow(r, { sources: sources.get(r.id) ?? [] }))
}

/**
 * Plant search, grouped by supplier — the master rows on the Plant search page
 * are the suppliers that matched, with their matching plants underneath.
 *
 * `search_inventory` cannot be called with an empty query (it walks all ~74k
 * active rows and blows the statement timeout — see docs/supabase-schema.md),
 * so an empty search browses `inventory_enriched` instead.
 */
async function inventorySearch(term: string): Promise<InventoryRecord[]> {
  const { data, error } = await supabase
    .rpc('search_inventory', { search: term })
    .range(0, 299)
  if (error) throw new Error(`search_inventory: ${error.message}`)
  return (data ?? []) as InventoryRecord[]
}

export async function searchPlantGroups(search: string): Promise<PlantGroup[]> {
  const term = search.trim()
  let records: InventoryRecord[]
  let fromSearchRpc = false

  if (term) {
    records = await inventorySearch(term)
    fromSearchRpc = true

    // The alias graph resolves a whole common name (`Live oak`) but cannot
    // combine that species alias with a cultivar term (`Boardwalk`). Only when
    // the full multi-word query returns nothing, search its words in parallel
    // and use the smallest non-empty result set — the most selective term.
    if (records.length === 0) {
      const words = [...new Set(term.match(/[\p{L}\p{N}]+/gu) ?? [])]
        .filter((word) => word.length >= 3)
      if (words.length > 1) {
        const candidates = await Promise.all(
          words.map(async (word) => ({ word, records: await inventorySearch(word) })),
        )
        const best = candidates
          .filter((candidate) => candidate.records.length > 0)
          .sort((a, b) => a.records.length - b.records.length || b.word.length - a.word.length)[0]
        records = best?.records ?? []
      }
    }
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

  const [{ data: sups, error: supErr }, sources, plantRows] = await Promise.all([
    supabase.from('suppliers').select('*').in('id', supplierIds),
    sourcesBySupplier(supplierIds),
    fromSearchRpc ? Promise.resolve(records.map((r) => toPlantRow(r))) : withSourcePaths(records),
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
        supplier: toSupplierRow(record, { sources: sources.get(plant.supplierId) ?? [] }),
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
  const [{ data, error }, sources, counts] = await Promise.all([
    supabase.from('suppliers').select('*').eq('id', id).maybeSingle(),
    sourcesBySupplier([id]),
    itemCounts([id]),
  ])
  if (error) throw new Error(`suppliers(${id}): ${error.message}`)
  if (!data) return null
  return toSupplierRow(data as SupplierRecord, {
    sources: sources.get(id) ?? [],
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
): Promise<{ plants: PlantRow[]; hasMore: boolean }> {
  const term = search.trim()
  const from = (page - 1) * PROFILE_PAGE_SIZE
  const to = from + PROFILE_PAGE_SIZE

  if (term) {
    const { data, error } = await supabase
      .rpc('search_inventory', { search: term, supplier_ids: [id] })
      .range(from, to)
    if (error) throw new Error(`search_inventory: ${error.message}`)
    const records = (data ?? []) as InventoryRecord[]
    return {
      plants: records.slice(0, PROFILE_PAGE_SIZE).map((r) => toPlantRow(r)),
      hasMore: records.length > PROFILE_PAGE_SIZE,
    }
  }

  const { data, error } = await supabase
    .from('inventory_enriched')
    .select('*')
    .eq('supplier_id', id)
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .range(from, to)
  if (error) throw new Error(`inventory_enriched: ${error.message}`)
  const records = (data ?? []) as InventoryRecord[]
  return {
    plants: await withSourcePaths(records.slice(0, PROFILE_PAGE_SIZE)),
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
  suppliers: [
    'name', 'poc_name', 'poc_email', 'poc_phone', 'email', 'phone', 'city', 'state',
    'notes', 'communication_notes',
  ],
  inventory: ['name', 'unit_price', 'quantity', 'height', 'width', 'caliper', 'notes'],
}

const NUMERIC = new Set(['unit_price', 'quantity'])

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
      value = n
    }
    values[column] = value
  }

  const { error } = await supabase.from(table).update(values).eq('id', id)
  if (error) throw new Error(`${table} update: ${error.message}`)
}

/** Soft delete — the schema's convention is to flip is_active, never DELETE. */
export async function softDelete(table: string, id: string | number): Promise<void> {
  if (table !== 'suppliers' && table !== 'inventory') {
    throw new Error(`refusing to delete from ${table}`)
  }
  const { error } = await supabase.from(table).update({ is_active: false }).eq('id', id)
  if (error) throw new Error(`${table} delete: ${error.message}`)
}
