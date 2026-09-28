'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import {
  DEFAULT_HIDDEN, SUPPLIER_VISIBLE, TABLE_COLS, splitMultiValue, type ColumnDef, type TableId,
} from '@/lib/columns'
import { compareSizeStd } from '@/lib/size-std'

export interface TableConfig {
  order: string[]
  hidden: string[]
  widths: Record<string, number>
}

export type Sort = { column: string; direction: 'asc' | 'desc' } | null
export type ColFilter = string | string[] | { min?: string; max?: string }
export type ColFilters = Record<string, ColFilter>

const STORAGE_KEY = 'lps.tables.v1'
const CAL_VISIBLE_MIGRATION_KEY = 'lps.tables.v1.cal-visible'
export const SUPPLIER_DEFAULT_MIGRATION_KEY = 'lps.tables.v1.suppliers-seven-column-default-v1'
export const SUPPLIER_CATEGORY_WIDTH_MIGRATION_KEY = 'lps.tables.v1.suppliers-category-min-width-v1'
export const REQUEST_SUPPLIERS_MIGRATION_KEY = 'lps.tables.v1.request-suppliers-before-internal-v1'

/** Put `suppliers` immediately left of `note_internal` (or last), in place. */
function placeSuppliersBeforeInternalNote(order: string[]) {
  const at = order.indexOf('suppliers')
  if (at >= 0) order.splice(at, 1)
  const internal = order.indexOf('note_internal')
  order.splice(internal >= 0 ? internal : order.length, 0, 'suppliers')
}

/** Once: layouts saved while Suppliers first sat beside Plant Name move it left of Internal note. */
export function moveStoredRequestSuppliers(
  layouts: Partial<Record<TableId, TableConfig>>,
): Partial<Record<TableId, TableConfig>> {
  const items = layouts.requestItems
  if (!items || !Array.isArray(items.order)) return layouts
  const order = [...items.order]
  placeSuppliersBeforeInternalNote(order)
  return { ...layouts, requestItems: { ...items, order } }
}
const MIN_COLUMN_WIDTH = 64
const SUPPLIER_CATEGORY_MIN_WIDTH = TABLE_COLS.suppliers.find(
  (column) => column.key === 'category',
)?.minWidth ?? MIN_COLUMN_WIDTH
const FILTER_VALUE_KEYS = new Map(
  Object.values(TABLE_COLS)
    .flat()
    .filter((column) => column.filterValueKey)
    .map((column) => [column.key, column.filterValueKey!] as const),
)
/** Column keys whose cell holds a comma-separated list — see ColumnDef.multiValue. */
const MULTI_VALUE_KEYS = new Set(
  Object.values(TABLE_COLS).flat().filter((column) => column.multiValue).map((column) => column.key),
)

function defaults(table: TableId): TableConfig {
  return { order: TABLE_COLS[table].map((c) => c.key), hidden: [...DEFAULT_HIDDEN[table]], widths: {} }
}

export function resolvedColumnWidth(config: TableConfig, column: ColumnDef): number {
  const saved = config.widths[column.key]
  const width = typeof saved === 'number' && Number.isFinite(saved) ? saved : column.width
  return column.minWidth == null ? width : Math.max(column.minWidth, width)
}

export function normalizeStoredTableConfig(table: TableId, stored: unknown): TableConfig {
  const fallback = defaults(table)
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return fallback
  const candidate = stored as Partial<TableConfig>
  const order = Array.isArray(candidate.order)
    ? candidate.order.filter((key): key is string => typeof key === 'string')
    : fallback.order
  const hidden = Array.isArray(candidate.hidden)
    ? candidate.hidden.filter((key): key is string => typeof key === 'string')
    : fallback.hidden
  const widths = candidate.widths && typeof candidate.widths === 'object' && !Array.isArray(candidate.widths)
    ? Object.fromEntries(
        Object.entries(candidate.widths).filter(
          (entry): entry is [string, number] => typeof entry[1] === 'number' && Number.isFinite(entry[1]),
        ),
      )
    : {}
  // Keep saved column positions, visibility and widths across the note rename.
  if (table === 'requestItems') {
    const renamed: Record<string, string> = { external_notes: 'note_for_customer', sourcing_notes: 'note_internal' }
    const keyOf = (key: string) => renamed[key] ?? key
    const renamedOrder = order.map(keyOf)
    // Layouts saved before the Suppliers column place it left of Internal note, not last.
    if (!renamedOrder.includes('suppliers')) placeSuppliersBeforeInternalNote(renamedOrder)
    return { order: renamedOrder, hidden: hidden.map(keyOf),
      widths: Object.fromEntries(Object.entries(widths).map(([key, width]) => [keyOf(key), width])) }
  }
  return { order, hidden, widths }
}

export function normalizeStoredTableLayouts(
  layouts: unknown,
): Partial<Record<TableId, TableConfig>> {
  if (!layouts || typeof layouts !== 'object' || Array.isArray(layouts)) return {}
  const current = layouts as Record<string, unknown>
  const normalized: Record<string, unknown> = { ...current }
  for (const table of Object.keys(TABLE_COLS) as TableId[]) {
    if (Object.prototype.hasOwnProperty.call(current, table)) {
      normalized[table] = normalizeStoredTableConfig(table, current[table])
    }
  }
  return normalized as Partial<Record<TableId, TableConfig>>
}

export function resizedColumnWidth(column: ColumnDef | undefined, width: number): number {
  return Math.max(column?.minWidth ?? MIN_COLUMN_WIDTH, Math.round(width))
}

/**
 * Move `fromKey` to where `toKey` sits. Operates on the full key list (hidden
 * columns included) so hiding a column and showing it again brings it back
 * where it was dragged to.
 *
 * Dropping rightward inserts *after* the target, leftward *before* it. The
 * design's original always inserted before, which makes dragging a column onto
 * its immediate right-hand neighbour a silent no-op — the single most common
 * "nudge this one over" gesture. Direction-aware insertion makes adjacent swaps
 * work both ways.
 */
export function reorder(keys: string[], fromKey: string, toKey: string): string[] {
  if (fromKey === toKey) return keys
  const fromIdx = keys.indexOf(fromKey)
  const toIdx = keys.indexOf(toKey)
  if (fromIdx === -1 || toIdx === -1) return keys

  const next = keys.filter((k) => k !== fromKey)
  const target = next.indexOf(toKey)
  next.splice(fromIdx < toIdx ? target + 1 : target, 0, fromKey)
  return next
}

export function showCaliperInStoredPlants(
  layouts: Partial<Record<TableId, TableConfig>>,
): Partial<Record<TableId, TableConfig>> {
  const plants = layouts.plants
  if (!plants || !Array.isArray(plants.hidden) || !plants.hidden.includes('cal')) return layouts
  return { ...layouts, plants: { ...plants, hidden: plants.hidden.filter((key) => key !== 'cal') } }
}

/** Parse persisted layouts without letting corrupt local data break a table. */
export function parseStoredTableLayouts(raw: string | null): Partial<Record<TableId, TableConfig>> {
  try {
    const parsed: unknown = JSON.parse(raw ?? '{}')
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Partial<Record<TableId, TableConfig>>
      : {}
  } catch {
    return {}
  }
}

/**
 * Adopt the seven-column Suppliers default once for an existing saved layout.
 *
 * The product rollout wins for the seven promoted columns: they become visible
 * in the requested order. Every other supplier column becomes hidden, while
 * its relative saved order is retained behind those seven. Saved widths are
 * untouched. The version marker around this helper means subsequent user
 * visibility/reorder changes persist normally and are never forced again.
 */
export function migrateStoredSupplierDefault(
  layouts: unknown,
): Partial<Record<TableId, TableConfig>> {
  if (!layouts || typeof layouts !== 'object' || Array.isArray(layouts)) return {}
  const current = layouts as Partial<Record<TableId, TableConfig>>
  const supplier = current.suppliers
  if (!supplier || typeof supplier !== 'object' || Array.isArray(supplier)) return current

  const allKeys = TABLE_COLS.suppliers.map((column) => column.key)
  const legacyOrder = Array.isArray(supplier.order)
    ? supplier.order.filter(
        (key, index, order): key is string =>
          typeof key === 'string' && allKeys.includes(key) && order.indexOf(key) === index,
      )
    : []
  const remaining = [
    ...legacyOrder.filter((key) => !SUPPLIER_VISIBLE.includes(key)),
    ...allKeys.filter((key) => !SUPPLIER_VISIBLE.includes(key) && !legacyOrder.includes(key)),
  ]
  const widths = supplier.widths && typeof supplier.widths === 'object' && !Array.isArray(supplier.widths)
    ? supplier.widths
    : {}

  return {
    ...current,
    suppliers: {
      order: [...SUPPLIER_VISIBLE, ...remaining],
      hidden: allKeys.filter((key) => !SUPPLIER_VISIBLE.includes(key)),
      widths,
    },
  }
}

export function migrateStoredSupplierCategoryWidth(
  layouts: Partial<Record<TableId, TableConfig>>,
): Partial<Record<TableId, TableConfig>> {
  const supplier = layouts.suppliers
  if (!supplier || !supplier.widths || typeof supplier.widths !== 'object' || Array.isArray(supplier.widths)) {
    return layouts
  }
  const category = supplier.widths.category
  if (typeof category !== 'number' || !Number.isFinite(category) || category >= SUPPLIER_CATEGORY_MIN_WIDTH) {
    return layouts
  }
  return {
    ...layouts,
    suppliers: {
      ...supplier,
      widths: { ...supplier.widths, category: SUPPLIER_CATEGORY_MIN_WIDTH },
    },
  }
}

export function applyStoredLayoutMigrations(
  layouts: Partial<Record<TableId, TableConfig>>,
  pending: { caliper: boolean; suppliers: boolean; supplierCategoryWidth?: boolean; requestSuppliers?: boolean },
): Partial<Record<TableId, TableConfig>> {
  let next = layouts
  if (pending.caliper) next = showCaliperInStoredPlants(next)
  if (pending.suppliers) next = migrateStoredSupplierDefault(next)
  if (pending.supplierCategoryWidth) next = migrateStoredSupplierCategoryWidth(next)
  if (pending.requestSuppliers) next = moveStoredRequestSuppliers(next)
  return next
}

function read(): Partial<Record<TableId, TableConfig>> {
  if (typeof window === 'undefined') return {}
  try {
    let layouts = normalizeStoredTableLayouts(
      parseStoredTableLayouts(window.localStorage.getItem(STORAGE_KEY)),
    )
    const migrateCaliper = !window.localStorage.getItem(CAL_VISIBLE_MIGRATION_KEY)
    const migrateSuppliers = !window.localStorage.getItem(SUPPLIER_DEFAULT_MIGRATION_KEY)
    const migrateSupplierCategoryWidth = !window.localStorage.getItem(SUPPLIER_CATEGORY_WIDTH_MIGRATION_KEY)
    const migrateRequestSuppliers = !window.localStorage.getItem(REQUEST_SUPPLIERS_MIGRATION_KEY)
    layouts = applyStoredLayoutMigrations(layouts, {
      caliper: migrateCaliper,
      suppliers: migrateSuppliers,
      supplierCategoryWidth: migrateSupplierCategoryWidth,
      requestSuppliers: migrateRequestSuppliers,
    })
    if (migrateCaliper || migrateSuppliers || migrateSupplierCategoryWidth || migrateRequestSuppliers) {
      // Write the migrated payload before its markers. If storage fails, the
      // migration remains eligible to retry instead of marking stale data done.
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(layouts))
      if (migrateCaliper) window.localStorage.setItem(CAL_VISIBLE_MIGRATION_KEY, '1')
      if (migrateSuppliers) window.localStorage.setItem(SUPPLIER_DEFAULT_MIGRATION_KEY, '1')
      if (migrateSupplierCategoryWidth) {
        window.localStorage.setItem(SUPPLIER_CATEGORY_WIDTH_MIGRATION_KEY, '1')
      }
      if (migrateRequestSuppliers) window.localStorage.setItem(REQUEST_SUPPLIERS_MIGRATION_KEY, '1')
    }
    return layouts
  } catch {
    return {}
  }
}

/**
 * Column layout for one table: order, visibility and widths, persisted so a
 * reload keeps the arrangement (Settings → "Reset column layouts" clears it).
 * Sorting and per-column filters are deliberately *not* persisted — they are
 * about the current question, not the layout.
 */
export function useTableConfig(table: TableId) {
  const [config, setConfig] = useState<TableConfig>(() => defaults(table))
  const [sort, setSort] = useState<Sort>(null)
  const [filters, setFilters] = useState<ColFilters>({})
  const hydrated = useRef(false)

  // Read the persisted layout after mount, so server and client render the same
  // markup on the first pass and hydration doesn't mismatch.
  useEffect(() => {
    hydrated.current = false
    setConfig(normalizeStoredTableConfig(table, read()[table]))
  }, [table])

  // Persist as a side effect of the config changing, not inside the state
  // updater. The first pass only arms the guard: hydration's state update then
  // rerenders with the normalized stored config, which is the first value safe
  // to write back. Otherwise the render defaults can overwrite storage before
  // hydration has applied it.
  useEffect(() => {
    if (!hydrated.current) {
      hydrated.current = true
      return
    }
    try {
      const all = read()
      all[table] = config
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
    } catch {
      // Private mode / quota — the layout just won't survive a reload.
    }
  }, [table, config])

  const save = useCallback((patch: Partial<TableConfig>) => {
    setConfig((prev) => ({ ...prev, ...patch }))
  }, [])

  const cols = TABLE_COLS[table]
  const allKeys = cols.map((c) => c.key)
  const orderedKeys = [
    ...config.order.filter((k) => allKeys.includes(k)),
    ...allKeys.filter((k) => !config.order.includes(k)),
  ]
  const visible = orderedKeys
    .map((k) => cols.find((c) => c.key === k))
    .filter((c): c is ColumnDef => !!c && !config.hidden.includes(c.key))

  const widthOf = (c: ColumnDef) => resolvedColumnWidth(config, c)

  const toggleColumn = (key: string) =>
    save({
      hidden: config.hidden.includes(key)
        ? config.hidden.filter((k) => k !== key)
        : [...config.hidden, key],
    })

  const moveColumn = (fromKey: string, toKey: string) => save({ order: reorder(orderedKeys, fromKey, toKey) })

  const resizeColumn = (key: string, width: number) => {
    const column = cols.find((candidate) => candidate.key === key)
    save({ widths: { ...config.widths, [key]: resizedColumnWidth(column, width) } })
  }

  // none → asc → desc → none
  const cycleSort = (key: string) =>
    setSort((cur) =>
      cur?.column !== key
        ? { column: key, direction: 'asc' }
        : cur.direction === 'asc'
          ? { column: key, direction: 'desc' }
          : null,
    )

  const setColFilter = (key: string, value: ColFilter) =>
    setFilters((prev) => {
      const next = { ...prev }
      const empty =
        value == null ||
        (typeof value === 'string' && value === '') ||
        (Array.isArray(value) && value.length === 0) ||
        (typeof value === 'object' && !Array.isArray(value) && !value.min && !value.max)
      if (empty) delete next[key]
      else next[key] = value
      return next
    })

  return {
    cols, config, visible, orderedKeys, widthOf, sort, filters,
    toggleColumn, moveColumn, resizeColumn, cycleSort, setColFilter,
    clearFilters: () => setFilters({}),
    resetLayout: () => save(defaults(table)),
  }
}

export function resetAllLayouts() {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // nothing to do
  }
}

/** Apply the per-column filters + sort that the header row collects. */
export function applyFilters<T extends { values: Record<string, unknown> }>(
  rows: T[],
  filters: ColFilters,
  sort: Sort,
): T[] {
  let out = rows.filter((row) =>
    Object.entries(filters).every(([key, filter]) => {
      const raw = row.values[FILTER_VALUE_KEYS.get(key) ?? key]
      const text = Array.isArray(raw) ? raw.join(', ') : raw == null ? '' : String(raw)

      if (typeof filter === 'string') return text.toLowerCase().includes(filter.toLowerCase())
      if (Array.isArray(filter)) {
        if (filter.length === 0) return true
        // A multi-value cell matches on any one of its names, so selecting
        // "Emperor 1" keeps a row whose cultivar reads "Wolff, Emperor 1".
        if (MULTI_VALUE_KEYS.has(key)) return splitMultiValue(raw).some((v) => filter.includes(v))
        return filter.includes(text)
      }

      // Missing numeric values are not zero. Keep them when no range is active,
      // but exclude them from any min/max query.
      if (raw == null || raw === '') return !filter.min && !filter.max
      const n = Number(raw)
      if (!Number.isFinite(n)) return false
      const min = filter.min ? Number(filter.min) : null
      const max = filter.max ? Number(filter.max) : null
      if (min !== null && Number.isFinite(min) && n < min) return false
      if (max !== null && Number.isFinite(max) && n > max) return false
      return true
    }),
  )

  if (sort) {
    const dir = sort.direction === 'desc' ? -1 : 1
    out = [...out].sort((a, b) => {
      const valueKey = FILTER_VALUE_KEYS.get(sort.column) ?? sort.column
      const av = a.values[valueKey]
      const bv = b.values[valueKey]
      // Missing values stay at the end in both directions; descending price
      // must not promote unpriced inventory above real supplier prices.
      const aMissing = av == null || av === ''
      const bMissing = bv == null || bv === ''
      if (aMissing || bMissing) return aMissing === bMissing ? 0 : aMissing ? 1 : -1
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
      // Sizes order by their standard, not alphabetically — otherwise 100G
      // sorts between 10G and 15G.
      if (valueKey === 'size_std') return compareSizeStd(String(av), String(bv)) * dir
      return String(av).localeCompare(String(bv)) * dir
    })
  }
  return out
}

/**
 * Distinct values for a multiselect column's option list.
 *
 * A column that filters on a companion value (Size offers the standardized
 * `size_std` buckets, not the supplier's own size text) lists that companion,
 * so the options line up with what `applyFilters` compares against.
 */
/**
 * Sort one multiselect's options.
 *
 * Sizes order by their standard rather than alphabetically — otherwise 100G
 * sorts between 10G and 15G.
 */
export function compareOptions(key: string): (a: string, b: string) => number {
  const valueKey = FILTER_VALUE_KEYS.get(key) ?? key
  return valueKey === 'size_std' ? compareSizeStd : (a, b) => a.localeCompare(b)
}

export function optionsFor<T extends { values: Record<string, unknown> }>(
  rows: T[],
  key: string,
): string[] {
  const valueKey = FILTER_VALUE_KEYS.get(key) ?? key
  const multiValue = MULTI_VALUE_KEYS.has(key)
  const seen = new Set<string>()
  for (const row of rows) {
    const raw = row.values[valueKey]
    if (raw == null || raw === '') continue
    if (multiValue) for (const part of splitMultiValue(raw)) seen.add(part)
    else seen.add(String(raw))
  }
  return [...seen].sort(valueKey === 'size_std' ? compareSizeStd : (a, b) => a.localeCompare(b))
}
