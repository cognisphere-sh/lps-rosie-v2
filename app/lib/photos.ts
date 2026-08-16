import 'server-only'

import type { PhotoCard, PhotoFacets } from '@/lib/rows'
import { applyServerFilters, type ServerFilter } from '@/lib/server-filters'
import { supabase } from '@/lib/supabase'

export const PHOTO_PAGE_SIZE = 60

/**
 * How long a signed image URL lives.
 *
 * The bucket is private, so every `<img>` on the grid is a signed link. An hour
 * is long enough that a page left open keeps rendering and short enough that a
 * URL copied out of devtools stops working the same session.
 */
const SIGNED_URL_TTL = 3600

/** One row of `plant_photos`, as both the RPC and the table return it. */
export interface PhotoRecord {
  id: string
  storage_bucket: string
  storage_path: string
  mime_type: string | null
  byte_size: number | null
  image_width: number | null
  image_height: number | null
  supplier_id: number | null
  name: string | null
  common_name: string | null
  botanical_name: string | null
  cultivar_variety_trade_name: string | null
  size: string | null
  size_std: string | null
  height: string | null
  width: string | null
  caliper: string | null
  tags: string[] | null
  caption: string | null
  notes: string | null
  source: string | null
  captured_at: string | null
  created_at: string | null
  /** Present only on the search path — the browse path has nothing to rank. */
  relevance?: number
  /** Present only on the search path; the browse path resolves it separately. */
  supplier_name?: string | null
  supplier_category?: string | null
  supplier_city?: string | null
  supplier_state?: string | null
}

/**
 * Supplier names for photos read straight off the table.
 *
 * The RPC already projects them; the browse path does not, so one lookup per
 * page fills the same fields rather than making the card handle two shapes.
 */
async function suppliersById(ids: number[]): Promise<Map<number, { name: string; city: string | null; state: string | null }>> {
  const map = new Map<number, { name: string; city: string | null; state: string | null }>()
  if (!ids.length) return map
  const { data, error } = await supabase
    .from('suppliers')
    .select('id, name, city, state')
    .in('id', ids)
  if (error) throw new Error(`suppliers: ${error.message}`)
  for (const row of (data ?? []) as { id: number; name: string; city: string | null; state: string | null }[]) {
    map.set(row.id, { name: row.name, city: row.city, state: row.state })
  }
  return map
}

function toCard(
  r: PhotoRecord,
  supplier?: { name: string; city: string | null; state: string | null } | null,
): PhotoCard {
  const name = supplier?.name ?? r.supplier_name ?? null
  return {
    id: r.id,
    imageUrl: `/api/photos/${r.id}/image`,
    // A photo with no identity at all still has to say something on the card.
    name: r.name ?? 'Unidentified plant',
    commonName: r.common_name,
    botanicalName: r.botanical_name,
    cultivar: r.cultivar_variety_trade_name,
    size: r.size,
    height: r.height,
    width: r.width,
    caliper: r.caliper,
    tags: r.tags ?? [],
    caption: r.caption,
    notes: r.notes,
    source: r.source,
    capturedAt: r.captured_at,
    createdAt: r.created_at,
    mimeType: r.mime_type,
    byteSize: r.byte_size,
    pixels:
      r.image_width && r.image_height ? { width: r.image_width, height: r.image_height } : null,
    supplier:
      r.supplier_id != null && name
        ? {
            id: r.supplier_id,
            name,
            city: supplier?.city ?? r.supplier_city ?? null,
            state: supplier?.state ?? r.supplier_state ?? null,
          }
        : null,
  }
}

async function toCards(records: PhotoRecord[]): Promise<PhotoCard[]> {
  // Only the browse path needs the lookup — the RPC already carried the names.
  const missing = [
    ...new Set(
      records
        .filter((r) => r.supplier_id != null && r.supplier_name === undefined)
        .map((r) => r.supplier_id as number),
    ),
  ]
  const byId = await suppliersById(missing)
  return records.map((r) => toCard(r, r.supplier_id != null ? byId.get(r.supplier_id) : null))
}

/**
 * One page of the catalogue.
 *
 * With a query this is `search_plant_photos` with the column filters applied as
 * SQL over its result — same contract as plant search, so a filtered page and
 * its `count` describe the same set. With no query it is the table itself,
 * newest first: unlike plant search, browsing a photo catalogue is the point,
 * and the RPC cannot serve it (an empty search has nothing to rank).
 */
export async function searchPhotos(
  search: string,
  filters: ServerFilter[] = [],
  page = 1,
): Promise<{ photos: PhotoCard[]; total: number }> {
  const term = search.trim()
  const from = (page - 1) * PHOTO_PAGE_SIZE

  if (term) {
    const { data, error, count } = await applyServerFilters(
      supabase.rpc('search_plant_photos', { search: term }, { count: 'exact' }),
      filters,
    )
      // Stated explicitly rather than relying on the function's own ORDER BY
      // surviving PostgREST's outer query. The tie-breakers match the function.
      .order('relevance', { ascending: false })
      .order('captured_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .range(from, from + PHOTO_PAGE_SIZE - 1)
    if (error) throw new Error(`search_plant_photos: ${error.message}`)
    const records = (data ?? []) as PhotoRecord[]
    return { photos: await toCards(records), total: count ?? records.length }
  }

  const { data, error, count } = await applyServerFilters(
    supabase.from('plant_photos').select('*', { count: 'exact' }).eq('is_active', true),
    filters,
  )
    // `id` is a tie-breaker, not a preference: without a total order two pages
    // can repeat or skip a row whose timestamps tie.
    .order('created_at', { ascending: false })
    .order('id', { ascending: true })
    .range(from, from + PHOTO_PAGE_SIZE - 1)
  if (error) throw new Error(`plant_photos: ${error.message}`)
  const records = (data ?? []) as PhotoRecord[]
  return { photos: await toCards(records), total: count ?? records.length }
}

/**
 * The values each dropdown offers, for one search and deliberately *not*
 * narrowed by the active filters — options derived from already-filtered rows
 * would collapse to whatever is selected.
 *
 * Suppliers are offered as ids paired with names because two locations of one
 * company share a name; the filter selects on `supplier_id`.
 */
export async function photoFacets(search: string): Promise<PhotoFacets> {
  const term = search.trim()

  const { data, error } = term
    ? await supabase
        .rpc('search_plant_photos', { search: term })
        .select(
          'size_std, tags, cultivar_variety_trade_name, supplier_id, supplier_name, supplier_city, supplier_state',
        )
        .limit(20000)
    : await supabase
        .from('plant_photos')
        .select('size_std, tags, cultivar_variety_trade_name, supplier_id')
        .eq('is_active', true)
        .limit(20000)
  if (error) throw new Error(`plant photo facets: ${error.message}`)

  const size = new Set<string>()
  const tag = new Set<string>()
  const cultivar = new Set<string>()
  const suppliers = new Map<number, { name: string; city: string | null; state: string | null }>()
  type Row = {
    size_std: string | null
    tags: string[] | null
    cultivar_variety_trade_name: string | null
    supplier_id: number | null
    supplier_name?: string | null
    supplier_city?: string | null
    supplier_state?: string | null
  }

  for (const row of (data ?? []) as Row[]) {
    if (row.size_std) size.add(row.size_std)
    for (const t of row.tags ?? []) if (t) tag.add(t)
    // The cultivar cell is a comma-separated residual (`Wolff, Emperor 1`), so
    // the dropdown offers the individual names — the same grain `cultivar_keys`
    // matches, and the same split the plant facets use.
    for (const part of (row.cultivar_variety_trade_name ?? '').split(/[,;|]/)) {
      const value = part.trim()
      if (value) cultivar.add(value)
    }
    if (row.supplier_id != null && !suppliers.has(row.supplier_id)) {
      suppliers.set(row.supplier_id, {
        name: row.supplier_name ?? '',
        city: row.supplier_city ?? null,
        state: row.supplier_state ?? null,
      })
    }
  }

  // The browse path has no supplier columns in its projection; fill the blanks.
  const unnamed = [...suppliers.entries()].filter(([, s]) => !s.name).map(([id]) => id)
  if (unnamed.length) {
    for (const [id, s] of await suppliersById(unnamed)) suppliers.set(id, s)
  }

  return {
    size: [...size],
    tag: [...tag],
    cultivar: [...cultivar],
    supplier: [...suppliers.entries()]
      .filter(([, s]) => s.name)
      .map(([id, s]) => ({ id, ...s }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  }
}

/**
 * A short-lived signed URL for one photo's bytes.
 *
 * The id is resolved to a path *here*, from the row. The browser never supplies
 * a storage path, so this cannot be turned into a signing oracle for arbitrary
 * objects in the bucket — which is the whole reason the bucket is private.
 */
export async function signedPhotoUrl(id: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('plant_photos')
    .select('storage_bucket, storage_path')
    .eq('id', id)
    .eq('is_active', true)
    .maybeSingle()
  if (error) throw new Error(`plant_photos(${id}): ${error.message}`)
  if (!data) return null

  const row = data as { storage_bucket: string; storage_path: string }
  const signed = await supabase.storage
    .from(row.storage_bucket)
    .createSignedUrl(row.storage_path, SIGNED_URL_TTL)
  if (signed.error) throw new Error(`sign ${row.storage_path}: ${signed.error.message}`)
  return signed.data.signedUrl
}
