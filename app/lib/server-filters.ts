// Column filters, applied as SQL over the search result rather than in the
// browser.
//
// Why this exists: the browser only ever holds one page. Filtering it there
// means "filter within this page", which is a different question from the one
// the user asked. Measured on `Crape Myrtle`: 570 matches, 105 of them 15G, but
// only 73 in the 300-row first page — so 32 were unreachable by ticking the
// size box, and the row count in the header was wrong twice over.
//
// PostgREST applies these to the RPC's result set in an outer query, *before*
// its own `range()`, so pages and `count: 'exact'` are both correct. Every
// column named below is in `search_inventory`'s projection and on `inventory`,
// so the same spec drives the search path and the browse path.

import type { ColFilters } from '@/lib/table-config'

/** How one column-filter key reaches SQL. */
type FilterSpec =
  | { kind: 'in'; column: string }
  | { kind: 'range'; column: string }
  | { kind: 'ilike'; column: string }
  /**
   * Multi-valued cell: match the array column with `&&`. `normalize` is for a
   * column of plant *keys*, where the dropdown offers display names and the
   * selection has to be run through `plantKey` first.
   */
  | { kind: 'overlaps'; column: string; normalize?: boolean }

/**
 * Plant-table filter keys → the column they select on.
 *
 * `size` filters on the standardized bucket rather than the supplier's printed
 * text, matching what the dropdown offers. `cultivar` filters on the key array
 * because the cell is a comma-separated residual (`Wolff, Emperor 1`) and the
 * dropdown offers the individual names.
 */
export const PLANT_FILTERS: Record<string, FilterSpec> = {
  size: { kind: 'in', column: 'size_std' },
  cultivar: { kind: 'overlaps', column: 'cultivar_keys', normalize: true },
  price: { kind: 'range', column: 'unit_price' },
  qty: { kind: 'range', column: 'quantity' },
  h: { kind: 'range', column: 'height_std' },
  w: { kind: 'range', column: 'width_std' },
  cal: { kind: 'range', column: 'caliper_std' },
  name: { kind: 'ilike', column: 'name' },
  common_name: { kind: 'ilike', column: 'common_name' },
  botanical_name: { kind: 'ilike', column: 'botanical_name' },
  notes: { kind: 'ilike', column: 'notes' },
  internal_notes: { kind: 'ilike', column: 'internal_notes' },
}

/**
 * Plant-search master-row filters. The master rows are derived from the
 * matched inventory, so filtering them is filtering the inventory by its
 * supplier's attributes — which the RPC already projects.
 */
export const MASTER_FILTERS: Record<string, FilterSpec> = {
  category: { kind: 'in', column: 'supplier_category' },
  city: { kind: 'in', column: 'supplier_city' },
  state: { kind: 'in', column: 'supplier_state' },
}

/**
 * Photo-catalogue filters, over `search_plant_photos`' projection — and over
 * `plant_photos` itself, which the grid reads directly when there is no query.
 * Every column named here exists on both, so one spec drives both paths.
 *
 * `supplier` selects on the id rather than the name: two locations of the same
 * company share a name, and picking "Everde Growers" must not silently mean
 * whichever one happened to sort first.
 */
export const PHOTO_FILTERS: Record<string, FilterSpec> = {
  size: { kind: 'in', column: 'size_std' },
  supplier: { kind: 'in', column: 'supplier_id' },
  // Identical to the plant table's, and deliberately so: `plant_photos` carries
  // the same three name parts and the same derived `cultivar_keys`, so the same
  // filter works over both without a second normalization rule.
  cultivar: { kind: 'overlaps', column: 'cultivar_keys', normalize: true },
  // `tags` is a plain text[] of the vocabulary itself — the trigger lowercases
  // and trims it — so the dropdown offers exactly what the column holds and no
  // normalization is needed on the way out, unlike `cultivar`.
  tag: { kind: 'overlaps', column: 'tags' },
}

/**
 * Suppliers-table filters, over `search_suppliers`' own projection.
 *
 * `lps_partner` selects on the boolean with the strings `'true'` / `'false'`,
 * which is what the toolbar chip stores; the page maps them to and from the
 * words it shows.
 */
export const SUPPLIER_FILTERS: Record<string, FilterSpec> = {
  category: { kind: 'in', column: 'category' },
  city: { kind: 'in', column: 'city' },
  state: { kind: 'in', column: 'state' },
  lps_partner: { kind: 'in', column: 'is_lps_partner' },
  availability_source_type: { kind: 'in', column: 'availability_source_type' },
  availability_update_days: { kind: 'range', column: 'availability_update_days' },
  name: { kind: 'ilike', column: 'name' },
  notes: { kind: 'ilike', column: 'notes' },
}

/** One filter, resolved to a column and ready to apply. */
export type ServerFilter =
  | { kind: 'in'; column: string; values: string[] }
  | { kind: 'range'; column: string; min?: number; max?: number }
  | { kind: 'ilike'; column: string; value: string }
  | { kind: 'overlaps'; column: string; values: string[] }

/**
 * `normalize_plant_key` in TypeScript — lowercase, letters only.
 *
 * A deliberate mirror of the database function, needed because the Cultivar
 * dropdown offers display names ("Emperor 1") while `cultivar_keys` holds
 * normalized ones ("emperor"). Keep the two in step; the rule has been stable
 * since the column was introduced and is one line in both languages.
 */
export function plantKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z]/g, '')
}

const PREFIX = { plant: 'f', master: 'm', supplier: 's', photo: 'p' } as const
type Scope = keyof typeof PREFIX

/**
 * Serialize filter state into a stable query string.
 *
 * Stable means: same filters, same string, so the value can be a `useEffect`
 * dependency and a debounce key without refetching on every keystroke of an
 * unrelated field. Keys are sorted for that reason.
 */
export function filterQuery(scope: Scope, specs: Record<string, FilterSpec>, filters: ColFilters): string {
  const params = new URLSearchParams()
  const p = PREFIX[scope]
  for (const key of Object.keys(filters).sort()) {
    const spec = specs[key]
    if (!spec) continue
    const value = filters[key]

    if (spec.kind === 'in' || spec.kind === 'overlaps') {
      if (!Array.isArray(value) || value.length === 0) continue
      // A key column holds normalized keys while the dropdown offers display
      // names, so the selection is normalized on the way out. A plain array
      // column (tags) already offers exactly what it stores.
      const values = spec.kind === 'overlaps' && spec.normalize
        ? value.map(plantKey).filter(Boolean)
        : value
      for (const v of [...new Set(values)].sort()) params.append(`${p}.${key}`, v)
    } else if (spec.kind === 'ilike') {
      if (typeof value !== 'string' || !value.trim()) continue
      params.set(`${p}.${key}`, value.trim())
    } else {
      if (!value || typeof value !== 'object' || Array.isArray(value)) continue
      const min = value.min?.trim() ? Number(value.min) : undefined
      const max = value.max?.trim() ? Number(value.max) : undefined
      // A half-typed or contradictory bound is not a filter yet — drop it
      // rather than sending the server something it has to reject.
      if (min !== undefined && !Number.isFinite(min)) continue
      if (max !== undefined && !Number.isFinite(max)) continue
      if (min !== undefined && max !== undefined && min > max) continue
      if (min !== undefined) params.set(`${p}.${key}.min`, String(min))
      if (max !== undefined) params.set(`${p}.${key}.max`, String(max))
    }
  }
  return params.toString()
}

/**
 * Parse and validate the query string back into filters.
 *
 * The request arrives from the browser, so every key is checked against the
 * spec map — an unrecognized key is ignored rather than turned into a column
 * name, which is what keeps this from becoming a filter-by-any-column oracle.
 */
export function parseFilters(
  scope: Scope,
  specs: Record<string, FilterSpec>,
  params: URLSearchParams,
): ServerFilter[] {
  const out: ServerFilter[] = []
  const p = PREFIX[scope]

  for (const [key, spec] of Object.entries(specs)) {
    if (spec.kind === 'in' || spec.kind === 'overlaps') {
      const values = params.getAll(`${p}.${key}`).filter(Boolean)
      if (values.length) out.push({ kind: spec.kind, column: spec.column, values })
    } else if (spec.kind === 'ilike') {
      const value = params.get(`${p}.${key}`)?.trim()
      if (value) out.push({ kind: 'ilike', column: spec.column, value })
    } else {
      const rawMin = params.get(`${p}.${key}.min`)
      const rawMax = params.get(`${p}.${key}.max`)
      const min = rawMin == null || rawMin.trim() === '' ? undefined : Number(rawMin)
      const max = rawMax == null || rawMax.trim() === '' ? undefined : Number(rawMax)
      if (min !== undefined && !Number.isFinite(min)) throw new Error(`${key}_min must be a number`)
      if (max !== undefined && !Number.isFinite(max)) throw new Error(`${key}_max must be a number`)
      if (min !== undefined && max !== undefined && min > max) {
        throw new Error(`${key}_min cannot exceed ${key}_max`)
      }
      if (min !== undefined || max !== undefined) {
        out.push({ kind: 'range', column: spec.column, min, max })
      }
    }
  }
  return out
}

/**
 * The filters this spec does *not* cover, which therefore stay in the browser.
 *
 * There is one on the suppliers table — `# Items` is a per-supplier COUNT
 * fetched in a second pass, not a column `search_suppliers` returns, so it
 * cannot be filtered in SQL over the RPC result.
 */
export function clientOnlyFilters(filters: ColFilters, specs: Record<string, FilterSpec>): ColFilters {
  return Object.fromEntries(Object.entries(filters).filter(([key]) => !specs[key]))
}

/** A PostgREST filter builder — the subset used here. */
interface Filterable<T> {
  in(column: string, values: readonly string[]): T
  overlaps(column: string, values: readonly string[]): T
  gte(column: string, value: number): T
  lte(column: string, value: number): T
  ilike(column: string, pattern: string): T
}

/**
 * Apply the filters to a PostgREST query.
 *
 * `%` and `_` are escaped in `ilike` patterns so a user typing them searches
 * for the character rather than turning it into a wildcard.
 */
export function applyServerFilters<T extends Filterable<T>>(query: T, filters: ServerFilter[]): T {
  let out = query
  for (const filter of filters) {
    if (filter.kind === 'in') {
      out = out.in(filter.column, filter.values)
    } else if (filter.kind === 'overlaps') {
      out = out.overlaps(filter.column, filter.values)
    } else if (filter.kind === 'ilike') {
      out = out.ilike(filter.column, `%${filter.value.replace(/[%_]/g, (c) => `\\${c}`)}%`)
    } else {
      if (filter.min !== undefined) out = out.gte(filter.column, filter.min)
      if (filter.max !== undefined) out = out.lte(filter.column, filter.max)
    }
  }
  return out
}
