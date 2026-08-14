'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { DEFAULT_HIDDEN, TABLE_COLS, splitMultiValue, type ColumnDef, type TableId } from '@/lib/columns'
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

function read(): Partial<Record<TableId, TableConfig>> {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}')
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
    const stored = read()[table]
    setConfig(stored ? { ...defaults(table), ...stored } : defaults(table))
    hydrated.current = true
  }, [table])

  // Persist as a side effect of the config changing, not inside the state
  // updater. The `hydrated` guard matters: without it the first render would
  // write the defaults straight over whatever was stored, and no layout would
  // ever survive a reload.
  useEffect(() => {
    if (!hydrated.current) return
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

  const widthOf = (c: ColumnDef) => config.widths[c.key] ?? c.width

  const toggleColumn = (key: string) =>
    save({
      hidden: config.hidden.includes(key)
        ? config.hidden.filter((k) => k !== key)
        : [...config.hidden, key],
    })

  const moveColumn = (fromKey: string, toKey: string) => save({ order: reorder(orderedKeys, fromKey, toKey) })

  const resizeColumn = (key: string, width: number) =>
    save({ widths: { ...config.widths, [key]: Math.max(64, Math.round(width)) } })

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
