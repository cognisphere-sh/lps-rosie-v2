// Column sorting, applied as SQL over the search result rather than in the
// browser.
//
// Why this exists, and why it reads like lib/server-filters.ts: the browser only
// ever holds one page. Sorting it there means "sort within this page", which is
// a different question from the one the header button asks. The cheapest match
// among the 300 rows relevance happened to return is not the cheapest of the 570
// that matched, and "Name ▲" on the suppliers table only ever reordered the
// fifty rows already on screen.
//
// PostgREST applies `order()` to the RPC's result set in an outer query, before
// its own `range()`, so page 1 really is the top of the whole ordering. Every
// column named below is in its search function's projection — and, for the plant
// map, on `inventory` too, so the same spec drives the search path and the
// browse path.

import type { Sort } from '@/lib/table-config'

/**
 * Suppliers-table sort keys → the column `search_suppliers` orders by.
 *
 * What is missing from it is not columns: `other_contacts`,
 * `inventory_sources` and `last_ingestion_date` are assembled per page from
 * follow-up queries, `# Items` is a per-supplier COUNT from a second pass, and
 * `communication_notes` is on `suppliers` but outside the RPC's projection.
 * Those keep sorting the page — see `clientOnlySort`.
 */
export const SUPPLIER_SORTS: Record<string, string> = {
  name: 'name',
  category: 'category',
  primary_contact_name: 'primary_contact_name',
  primary_contact_email: 'primary_contact_email',
  primary_contact_phone: 'primary_contact_phone',
  website: 'website',
  availability_source_type: 'availability_source_type',
  availability_update_days: 'availability_update_days',
  hosted_availability_url: 'hosted_availability_url',
  city: 'city',
  state: 'state',
  notes: 'notes',
  created_at: 'created_at',
  updated: 'updated_at',
}

/**
 * Plant-table sort keys → the column `search_inventory` and `inventory` order
 * by.
 *
 * `size` is deliberately absent. The column holds bucket names, so SQL would
 * order them as text and put 100G between 10G and 15G; the canonical order is a
 * rule rather than something an index can express (lib/size-std.ts), so Size
 * keeps sorting the page. `source` and `ingestion_date` are resolved from
 * `inventory_sources` after the page arrives and are not columns here either.
 */
export const PLANT_SORTS: Record<string, string> = {
  name: 'name',
  common_name: 'common_name',
  botanical_name: 'botanical_name',
  cultivar: 'cultivar_variety_trade_name',
  price: 'unit_price',
  qty: 'quantity',
  h: 'height_std',
  w: 'width_std',
  cal: 'caliper_std',
  notes: 'notes',
  internal_notes: 'internal_notes',
  updated: 'updated_at',
}

/** One sort, resolved to a column and ready to apply. */
export interface ServerSort {
  column: string
  ascending: boolean
}

/**
 * Serialize the header's sort into a stable query string.
 *
 * Same contract as `filterQuery`: the value is a `useEffect` dependency and part
 * of a debounce key, so an unchanged sort has to serialize identically. A column
 * this spec does not cover serializes to nothing — the browser sorts that one.
 */
export function sortQuery(sorts: Record<string, string>, sort: Sort): string {
  if (!sort || !sorts[sort.column]) return ''
  return new URLSearchParams({ sort: sort.column, dir: sort.direction }).toString()
}

/**
 * Parse it back.
 *
 * The key is looked up in the spec rather than used as a column name, for the
 * reason `parseFilters` gives: the request arrives from the browser, and turning
 * whatever it sent into an ORDER BY would be an order-by-any-column oracle.
 */
export function parseSort(
  sorts: Record<string, string>,
  params: URLSearchParams,
): ServerSort | null {
  const column = sorts[params.get('sort') ?? '']
  return column ? { column, ascending: params.get('dir') !== 'desc' } : null
}

/**
 * The sort this spec does *not* cover, which therefore stays in the browser.
 *
 * Mirrors `clientOnlyFilters`. A server-sorted column returns `null` so the page
 * renders the order the database chose; anything else falls through unchanged
 * and sorts the page, which is all a value computed after the fetch can do.
 */
export function clientOnlySort(sort: Sort, sorts: Record<string, string>): Sort {
  return sort && sorts[sort.column] ? null : sort
}
