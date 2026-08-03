'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { ChevronDown, EyeOffIcon } from '@/components/workspace/icons'
import {
  PlantHeaderRow, PlantRowLine, plantsWidth,
} from '@/components/workspace/plant-table'
import { PLANT_SEARCH_LABELS, SearchOverlay } from '@/components/workspace/search-loader'
import { Shell, useIsMobile, useToast } from '@/components/workspace/shell'
import { ColumnPicker, FilterControl, MultiFilter, badgeFor, fileHref } from '@/components/workspace/table-parts'
import { Toolbar } from '@/components/workspace/toolbar'
import { MASTER_COLS, PLANT_COLS, type ColumnDef } from '@/lib/columns'
import { formatDate, money, num } from '@/lib/format'
import type { PlantGroup, PlantRow } from '@/lib/rows'
import { refinePlantGroups } from '@/lib/search-refine'
import {
  matchesSizeFilter, parseSizeQuery, sizeChoicesFor, type SizeChoice, type TypedSize,
} from '@/lib/size-range'
import { applyFilters, optionsFor, useTableConfig } from '@/lib/table-config'
import { useDebounced } from '@/lib/use-debounced'
import { cn } from '@/lib/utils'

// Supplier-panel fields — everything on the master row that isn't already shown
// as the heading, the count, the category badge or the state.
const PANEL_FIXED = ['name', 'plant_count', 'category', 'state']
const PLANT_SEARCH_KEY = 'lps.plant-search.query.v1'
const PLANT_SIZE_CHOICE_KEY = 'lps.plant-search.size-choice.v1'
const RETIRED_PLANT_SIZE_KEY = 'lps.plant-search.size.v1'

// Mobile filter sheet. The result-size selector appears beside the search field,
// so this sheet carries the remaining supplier/location and price filters.
const MOBILE_FILTERS = [
  { key: 'category', label: 'Supplier category', master: true },
  { key: 'state', label: 'State', master: true },
  { key: 'city', label: 'City', master: true },
  { key: 'price', label: 'Price', master: false },
] as const

function ResultSizeControl({
  typed,
  choices,
  selected,
  onSelect,
  onClearTyped,
}: {
  typed: TypedSize | null
  choices: SizeChoice[]
  selected: string[]
  onSelect: (keys: string[]) => void
  onClearTyped: () => void
}) {
  if (typed) {
    return (
      <button
        type="button"
        onClick={onClearTyped}
        className="inline-flex h-8 w-full items-center justify-between gap-2 rounded-[7px] border border-primary bg-secondary px-2.5 text-[12px] font-semibold text-primary md:w-auto"
        title="Remove size from search"
      >
        <span>Size: {typed.label}</span>
        <span aria-hidden="true" className="text-[16px] leading-none">×</span>
      </button>
    )
  }

  const byLabel = new Map(choices.map((choice) => [choice.label, choice.key]))
  const labels = choices.map((choice) => choice.label)
  const selectedLabels = selected
    .map((key) => choices.find((choice) => choice.key === key)?.label)
    .filter((label): label is string => !!label)

  return (
    <div className="w-full md:w-[170px]">
      <MultiFilter
        allLabel="Size: Any"
        options={labels}
        selected={selectedLabels}
        selectionLabel="Size"
        buttonClassName="h-8 text-[12px] px-2"
        filterPlaceholder="Filter sizes…"
        onChange={(next) => onSelect(next.map((label) => byLabel.get(label)!).filter(Boolean))}
      />
    </div>
  )
}

export default function PlantSearchPage() {
  const router = useRouter()
  const isMobile = useIsMobile()
  const toast = useToast()
  const plantCfg = useTableConfig('plants')
  const masterCfg = useTableConfig('plantMaster')

  const [query, setQuery] = useState('')
  const [searchHydrated, setSearchHydrated] = useState(false)
  const debouncedQuery = useDebounced(query)
  const parsedSearch = useMemo(() => parseSizeQuery(query), [query])
  const debouncedSearch = useMemo(() => parseSizeQuery(debouncedQuery), [debouncedQuery])
  const [groups, setGroups] = useState<PlantGroup[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedSizes, setSelectedSizes] = useState<string[]>([])
  const hasQuery = query.trim().length > 0
  // The loader covers the debounce window too, so it appears on the first
  // keystroke rather than 300ms later when the fetch actually fires.
  const searching = searchHydrated && hasQuery && (loading || query !== debouncedQuery)
  const [panelW, setPanelW] = useState(292)
  const [hiddenPlants, setHiddenPlants] = useState<string[]>([])
  const [hiddenSuppliers, setHiddenSuppliers] = useState<number[]>([])
  const [supplierPick, setSupplierPick] = useState<string[]>([])
  const [filtersOpen, setFiltersOpen] = useState(false)
  // Mobile only: supplier cards whose plant list is collapsed.
  const [collapsed, setCollapsed] = useState<number[]>([])
  const [expandedPlants, setExpandedPlants] = useState<string[]>([])
  const [refreshNonce, setRefreshNonce] = useState(0)

  useEffect(() => {
    const refresh = () => setRefreshNonce((value) => value + 1)
    window.addEventListener('lps:refresh', refresh)
    return () => window.removeEventListener('lps:refresh', refresh)
  }, [])

  // A URL query wins on arrival; otherwise restore the last question and size
  // choice from this browser. Results themselves are always fetched again.
  useEffect(() => {
    const url = new URL(window.location.href)
    const hasUrlQuery = url.searchParams.has('q')
    setQuery(url.searchParams.get('q') ?? window.localStorage.getItem(PLANT_SEARCH_KEY) ?? '')
    let savedSizes: string[] = []
    try {
      const stored = JSON.parse(window.localStorage.getItem(PLANT_SIZE_CHOICE_KEY) ?? '[]') as unknown
      savedSizes = Array.isArray(stored) ? stored.filter((value): value is string => typeof value === 'string') : []
    } catch {
      // The previous single-select version stored one raw key rather than JSON.
      const stored = window.localStorage.getItem(PLANT_SIZE_CHOICE_KEY)
      if (stored) savedSizes = [stored]
    }
    setSelectedSizes(hasUrlQuery ? url.searchParams.getAll('size') : savedSizes)
    window.localStorage.removeItem(RETIRED_PLANT_SIZE_KEY)
    setSearchHydrated(true)

    const restoreFromHistory = () => {
      const historyUrl = new URL(window.location.href)
      setQuery(historyUrl.searchParams.get('q') ?? '')
      setSelectedSizes(historyUrl.searchParams.getAll('size'))
    }
    window.addEventListener('popstate', restoreFromHistory)
    return () => window.removeEventListener('popstate', restoreFromHistory)
  }, [])

  // Keep navigation back to this page meaningful without adding an entry for
  // every keystroke. Retired range parameters are removed during migration.
  useEffect(() => {
    if (!searchHydrated) return
    const url = new URL(window.location.href)
    if (hasQuery) {
      url.searchParams.set('q', query)
      window.localStorage.setItem(PLANT_SEARCH_KEY, query)
    } else {
      url.searchParams.delete('q')
      window.localStorage.removeItem(PLANT_SEARCH_KEY)
    }
    url.searchParams.delete('size')
    if (selectedSizes.length > 0 && !parsedSearch.size) {
      for (const key of selectedSizes) url.searchParams.append('size', key)
      window.localStorage.setItem(PLANT_SIZE_CHOICE_KEY, JSON.stringify(selectedSizes))
    } else {
      window.localStorage.removeItem(PLANT_SIZE_CHOICE_KEY)
    }
    url.searchParams.delete('size_unit')
    url.searchParams.delete('size_min')
    url.searchParams.delete('size_max')
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
  }, [hasQuery, parsedSearch.size, query, searchHydrated, selectedSizes])

  useEffect(() => {
    if (!searchHydrated) return
    if (!debouncedSearch.plantQuery) {
      setGroups([])
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    fetch(`/api/plants?q=${encodeURIComponent(debouncedSearch.plantQuery)}`)
      .then((r) => r.json())
      .then((body: { groups?: PlantGroup[] }) => {
        if (cancelled) return
        setGroups(body.groups ?? [])
        setLoading(false)
      })
      .catch(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [debouncedSearch.plantQuery, refreshNonce, searchHydrated])

  const savePlant = useCallback(
    async (row: PlantRow, col: ColumnDef, next: string) => {
      if (!col.writes) return
      const res = await fetch('/api/rows', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ table: col.writes.table, id: row.id, column: col.writes.column, value: next }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        toast(body.error ?? `Could not save ${col.label}`)
        return
      }
      setGroups((prev) =>
        prev.map((g) => ({
          ...g,
          plants: g.plants.map((p) =>
            p.id === row.id ? { ...p, values: { ...p.values, [col.key]: next || null } } : p,
          ),
        })),
      )
      toast(`${col.label} updated`)
    },
    [toast],
  )

  // The RPC casts a deliberately broad fuzzy/alias net. Multi-word identities
  // prefer rows containing every requested word, so `Agave Americana` does not
  // inherit every tree and shrub whose epithet happens to be `americana`.
  const refinedGroups = useMemo(
    () => refinePlantGroups(groups, parsedSearch.plantQuery),
    [groups, parsedSearch.plantQuery],
  )

  // Plant-level column filters apply across every supplier; a supplier whose
  // plants all filter out drops off the page entirely.
  const visibleGroups = useMemo(() => {
    const masterRows = refinedGroups.map((g) => g.supplier)
    const keptSuppliers = new Set(
      applyFilters(masterRows, masterCfg.filters, masterCfg.sort).map((r) => r.id),
    )
    const ordered = masterCfg.sort
      ? applyFilters(masterRows, masterCfg.filters, masterCfg.sort).map(
          (r) => refinedGroups.find((g) => g.supplier.id === r.id)!,
        )
      : refinedGroups

    return ordered
      .filter(
        (g) =>
          keptSuppliers.has(g.supplier.id) &&
          !hiddenSuppliers.includes(g.supplier.id) &&
          (supplierPick.length === 0 || supplierPick.includes(String(g.supplier.values.name ?? ''))),
      )
      .map((g) => ({
        ...g,
        plants: applyFilters(
          g.plants.filter(
            (p) =>
              !hiddenPlants.includes(p.id) &&
              matchesSizeFilter(p.values, parsedSearch.size, selectedSizes),
          ),
          plantCfg.filters,
          plantCfg.sort,
        ),
      }))
      .filter((g) => g.plants.length > 0)
  }, [refinedGroups, masterCfg.filters, masterCfg.sort, plantCfg.filters, plantCfg.sort, hiddenPlants, hiddenSuppliers, parsedSearch.size, selectedSizes, supplierPick])

  const supplierNames = useMemo(
    () => [...new Set(refinedGroups.map((g) => String(g.supplier.values.name ?? '')))].sort((a, b) => a.localeCompare(b)),
    [refinedGroups],
  )

  const allPlants = useMemo(() => refinedGroups.flatMap((g) => g.plants), [refinedGroups])
  const sizeChoices = useMemo(() => sizeChoicesFor(allPlants), [allPlants])
  const shownPlants = visibleGroups.reduce((n, g) => n + g.plants.length, 0)

  useEffect(() => {
    if (loading || allPlants.length === 0 || selectedSizes.length === 0) return
    const valid = new Set(sizeChoices.map((choice) => choice.key))
    const next = selectedSizes.filter((key) => valid.has(key))
    if (next.length !== selectedSizes.length) setSelectedSizes(next)
  }, [allPlants.length, loading, selectedSizes, sizeChoices])

  const panelDetailCols = MASTER_COLS.filter(
    (c) => !masterCfg.config.hidden.includes(c.key) && !PANEL_FIXED.includes(c.key),
  )
  const panelH = Math.max(140, 100 + panelDetailCols.length * 18)

  const startPanelResize = (e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startW = panelW
    const move = (ev: MouseEvent) =>
      setPanelW(Math.min(Math.max(startW + (ev.clientX - startX), 200), 480))
    const up = () => {
      document.removeEventListener('mousemove', move)
      document.removeEventListener('mouseup', up)
    }
    document.addEventListener('mousemove', move)
    document.addEventListener('mouseup', up)
  }

  const activeFilterCount =
    (supplierPick.length > 0 ? 1 : 0) +
    (parsedSearch.size || selectedSizes.length > 0 ? 1 : 0) +
    Object.keys(plantCfg.filters).length +
    Object.keys(masterCfg.filters).length

  const hasFilters = !!query || activeFilterCount > 0

  const toolbar = (
    <Toolbar
      placeholder="Search plant name, optionally with size (15g)…"
      query={query}
      onQuery={(next) => {
        const nextSearch = parseSizeQuery(next)
        if (nextSearch.size || nextSearch.plantQuery !== parsedSearch.plantQuery) setSelectedSizes([])
        setQuery(next)
      }}
      controls={
        !searching && allPlants.length > 0 ? (
          <ResultSizeControl
            typed={parsedSearch.size}
            choices={sizeChoices}
            selected={selectedSizes}
            onSelect={setSelectedSizes}
            onClearTyped={() => setQuery(parsedSearch.plantQuery)}
          />
        ) : undefined
      }
      hasFilters={hasFilters}
      onClear={() => {
        setQuery('')
        setSelectedSizes([])
        setSupplierPick([])
        plantCfg.clearFilters()
        masterCfg.clearFilters()
      }}
      summary={
        searching
          ? 'Searching…'
          : hasQuery
            ? `${visibleGroups.length} suppliers · ${shownPlants} of ${allPlants.length} plants`
            : 'Search by plant name'
      }
    />
  )

  const plantW = plantsWidth(plantCfg)

  const mobilePlantSpecs = (plant: PlantRow) => [
    { label: '', value: plant.values.size },
    { label: 'H', value: plant.values.h },
    { label: 'W', value: plant.values.w },
    { label: 'Cal', value: plant.values.cal },
  ].filter((spec) => spec.value != null && spec.value !== '')

  const detailText = (g: PlantGroup, col: ColumnDef) => {
    const v = g.supplier.values[col.key]
    if (col.key === 'city') return [v, g.supplier.values.state].filter(Boolean).join(', ')
    if (col.key === 'updated' || col.key === 'created_at') return formatDate(v as string | null)
    if (col.money) return money(v)
    if (col.num) return num(v)
    return Array.isArray(v) ? v.join(', ') : v == null ? '' : String(v)
  }

  return (
    <Shell page="inventory" title="Plant search" subtitle="Grouped by supplier" toolbar={toolbar} hideHeaderOnMobile>
      {!searchHydrated ? null : !hasQuery ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
          <span className="text-[15px] font-semibold">What plant are you looking for?</span>
          <span className="max-w-[430px] text-[12.5px] text-muted-foreground">
            Search by plant name, with an optional size such as “15g Agave Americana”.
          </span>
        </div>
      ) : isMobile ? (
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-3 pb-5">
          {/* Mobile has no column heads, so the filters they carry live here. */}
          <div className="shrink-0 rounded-xl border border-border bg-card">
            <button
              type="button"
              onClick={() => setFiltersOpen((v) => !v)}
              className="flex w-full items-center gap-2 p-3 text-left text-[13px] font-semibold"
            >
              <span>Filters</span>
              {activeFilterCount > 0 && (
                <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-secondary-foreground">
                  {activeFilterCount}
                </span>
              )}
              <span className="ml-auto text-[12px] font-normal text-muted-foreground">
                {shownPlants} of {allPlants.length} plants
              </span>
            </button>
            {filtersOpen && (
              <div className="flex flex-col gap-3 border-t border-lps-hair p-3">
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] font-bold uppercase tracking-[.05em] text-muted-foreground">
                    Supplier
                  </span>
                  <MultiFilter
                    allLabel="All suppliers"
                    options={supplierNames}
                    selected={supplierPick}
                    onChange={setSupplierPick}
                  />
                </div>
                {MOBILE_FILTERS.map(({ key, label, master }) => {
                  const cfg = master ? masterCfg : plantCfg
                  const col = (master ? MASTER_COLS : PLANT_COLS).find((c) => c.key === key)!
                  return (
                    <div key={label} className="flex flex-col gap-1">
                      <span className="text-[11px] font-bold uppercase tracking-[.05em] text-muted-foreground">
                        {label}
                      </span>
                      <FilterControl
                        col={col}
                        value={cfg.filters[key]}
                        options={
                          master
                            ? optionsFor(groups.map((g) => g.supplier), key)
                            : optionsFor(allPlants, key)
                        }
                        onFilter={(v) => cfg.setColFilter(key, v)}
                      />
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {visibleGroups.map((g) => {
            const open = !collapsed.includes(g.supplier.id)
            return (
            <div key={g.supplier.id} className="shrink-0 overflow-hidden rounded-xl border border-border bg-card">
              <div className="flex items-start gap-2 border-b border-lps-hair bg-lps-tint p-3">
                <div className="flex min-w-0 flex-1 flex-col gap-1.5 text-left">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => router.push(`/suppliers/${g.supplier.id}`)}
                      className="min-w-0 flex-1 truncate border-none bg-transparent p-0 text-left text-[14px] font-bold text-primary underline underline-offset-2"
                    >
                      {String(g.supplier.values.name ?? '')}
                    </button>
                    <span className="text-[11px] font-semibold text-muted-foreground">
                      {g.plants.length} match{g.plants.length === 1 ? '' : 'es'}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {g.supplier.values.category && (
                      <Badge variant={badgeFor(String(g.supplier.values.category)) as 'default' | 'secondary' | 'outline'}>
                        {String(g.supplier.values.category)}
                      </Badge>
                    )}
                    <span className="text-[11.5px] text-muted-foreground">
                      {[g.supplier.values.city, g.supplier.values.state].filter(Boolean).join(', ')}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setCollapsed((prev) =>
                      open ? [...prev, g.supplier.id] : prev.filter((id) => id !== g.supplier.id),
                    )
                  }
                  aria-expanded={open}
                  aria-label={open ? 'Collapse plants' : 'Expand plants'}
                  className="inline-flex size-7 flex-none items-center justify-center rounded-md text-muted-foreground"
                >
                  <ChevronDown size={16} className={open ? '' : '-rotate-90'} />
                </button>
              </div>
              <div className={cn('flex flex-col', !open && 'hidden')}>
                {g.plants.map((p) => {
                  const detailsOpen = expandedPlants.includes(p.id)
                  return (
                    <div key={p.id} className="border-b border-lps-hair last:border-b-0">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedPlants((prev) =>
                            detailsOpen ? prev.filter((id) => id !== p.id) : [...prev, p.id],
                          )
                        }
                        aria-expanded={detailsOpen}
                        className="flex w-full items-start gap-3 p-3 text-left"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13px] font-semibold">{String(p.values.name ?? '')}</div>
                          {p.values.other && (
                            <div className="truncate text-[11px] text-muted-foreground">{String(p.values.other)}</div>
                          )}
                          {mobilePlantSpecs(p).length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[11.5px] text-muted-foreground">
                              {mobilePlantSpecs(p).map((spec) => (
                                <span key={spec.label || 'size'}>
                                  {spec.label && <span className="text-lps-dim">{spec.label} </span>}
                                  {String(spec.value)}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-none items-start gap-1.5 text-right">
                          <div>
                            <div className="text-[14px] font-bold tabular-nums">{money(p.values.price)}</div>
                            <div className="text-[11px] text-muted-foreground tabular-nums">
                              {p.values.qty == null ? '—' : `${num(p.values.qty)} avail`}
                            </div>
                          </div>
                          <ChevronDown size={14} className={cn('mt-1.5 text-lps-dim', !detailsOpen && '-rotate-90')} />
                        </div>
                      </button>
                      {detailsOpen && (
                        <div className="flex flex-col gap-2 border-t border-lps-hair bg-lps-tint px-3 py-2.5 text-[11.5px]">
                          {p.values.other && (
                            <div>
                              <span className="font-semibold text-lps-dim">Other names: </span>
                              <span className="text-muted-foreground">{String(p.values.other)}</span>
                            </div>
                          )}
                          {p.values.notes && (
                            <div>
                              <span className="font-semibold text-lps-dim">Notes: </span>
                              <span className="text-muted-foreground">{String(p.values.notes)}</span>
                            </div>
                          )}
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
                            {p.values.updated && <span>Updated {formatDate(String(p.values.updated))}</span>}
                            {p.sourcePath && (
                              <a
                                href={fileHref(p.sourcePath)}
                                target="_blank"
                                rel="noreferrer"
                                className="font-semibold text-primary hover:underline"
                              >
                                Open source
                              </a>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
            )
          })}
          {!searching && visibleGroups.length === 0 && (
            <div className="p-12 text-center text-[13px] text-muted-foreground">Nothing matches this search.</div>
          )}
        </div>
      ) : (
        <div className="mx-4 mb-4 mt-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card">
          <div className="relative min-h-0 flex-1 overflow-auto">
            <div style={{ width: panelW + plantW, minWidth: '100%' }}>
              {/* Sticky header: supplier panel head + plant column heads */}
              <div className="sticky top-0 z-30 flex items-stretch border-b border-border">
                <div
                  data-menu
                  className="relative flex flex-none flex-col gap-1.5 border-r border-border bg-lps-headrow p-[8px_10px]"
                  style={{ width: panelW, minWidth: panelW }}
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-[.05em] text-muted-foreground">
                      Supplier
                    </span>
                    <span className="ml-auto text-[10.5px] text-lps-dim">
                      {visibleGroups.length} group{visibleGroups.length === 1 ? '' : 's'}
                    </span>
                    <ColumnPicker
                      title="Supplier fields"
                      cols={MASTER_COLS.filter((c) => !PANEL_FIXED.includes(c.key))}
                      hidden={masterCfg.config.hidden}
                      onToggle={masterCfg.toggleColumn}
                      align="right"
                      size="sm"
                    />
                  </div>
                  <MultiFilter
                    allLabel="All suppliers"
                    options={supplierNames}
                    selected={supplierPick}
                    onChange={setSupplierPick}
                  />
                  <div
                    onMouseDown={startPanelResize}
                    className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize select-none hover:bg-lps-edge"
                  />
                </div>
                <PlantHeaderRow cfg={plantCfg} options={(key) => optionsFor(allPlants, key)} />
              </div>

              {visibleGroups.map((g) => {
                return (
                  <div
                    key={g.supplier.id}
                    className="flex items-stretch border-b border-border bg-card"
                    style={{ height: panelH }}
                  >
                    <div
                      className={cn(
                        'sticky left-0 z-[14] flex flex-none flex-col gap-1.5 overflow-y-auto overflow-x-hidden border-r border-border bg-card p-[11px_14px]',
                      )}
                      style={{ width: panelW, minWidth: panelW }}
                    >
                      <div className="flex items-start gap-1.5">
                        <button
                          type="button"
                          onClick={() => router.push(`/suppliers/${g.supplier.id}`)}
                          className="min-w-0 flex-1 cursor-pointer border-none bg-transparent p-0 text-left text-[14px] font-bold text-primary"
                        >
                          {String(g.supplier.values.name ?? '')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setHiddenSuppliers((prev) => [...prev, g.supplier.id])}
                          title="Hide supplier"
                          aria-label="Hide supplier"
                          className="inline-flex size-[22px] flex-none cursor-pointer items-center justify-center rounded-md border-none bg-transparent text-lps-dim hover:bg-muted hover:text-foreground"
                        >
                          <EyeOffIcon size={13} />
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        {g.supplier.values.category && (
                          <Badge variant={badgeFor(String(g.supplier.values.category)) as 'default' | 'secondary' | 'outline'}>
                            {String(g.supplier.values.category)}
                          </Badge>
                        )}
                        <span className="whitespace-nowrap rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-semibold text-secondary-foreground">
                          {g.plants.length} match{g.plants.length === 1 ? '' : 'es'}
                        </span>
                      </div>

                      <div className="flex min-w-0 flex-col gap-0.5">
                        {panelDetailCols.map((col) => {
                          const text = detailText(g, col)
                          if (!text) return null
                          return (
                            <span key={col.key} className="truncate text-[11.5px] text-muted-foreground">
                              <span className="text-lps-dim">{col.label}: </span>
                              {text}
                            </span>
                          )
                        })}
                      </div>
                    </div>

                    <div className="flex min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden">
                      {g.plants.map((p) => (
                        <PlantRowLine
                          key={p.id}
                          row={p}
                          cfg={plantCfg}
                          onHide={() => setHiddenPlants((prev) => [...prev, p.id])}
                          onEdit={(col, next) => savePlant(p, col, next)}
                        />
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>

            {!searching && visibleGroups.length === 0 && (
              <div className="flex flex-col items-center gap-2 px-5 py-14 text-center">
                <span className="text-[14px] font-semibold">Nothing matches these filters</span>
                <span className="text-[12.5px] text-muted-foreground">
                  Clear a column filter, or try a common name — search maps synonyms.
                </span>
              </div>
            )}
          </div>

          {(hiddenPlants.length > 0 || hiddenSuppliers.length > 0) && (
            <div className="flex flex-none items-center gap-2.5 border-t border-border bg-lps-tint px-3 py-[7px] text-[11.5px] text-muted-foreground">
              <span>
                {hiddenSuppliers.length > 0 && `${hiddenSuppliers.length} supplier${hiddenSuppliers.length === 1 ? '' : 's'}`}
                {hiddenSuppliers.length > 0 && hiddenPlants.length > 0 && ' · '}
                {hiddenPlants.length > 0 && `${hiddenPlants.length} row${hiddenPlants.length === 1 ? '' : 's'}`} hidden
              </span>
              <button
                type="button"
                onClick={() => {
                  setHiddenPlants([])
                  setHiddenSuppliers([])
                }}
                className="cursor-pointer border-none bg-transparent text-[11.5px] font-semibold text-primary underline"
              >
                Restore
              </button>
            </div>
          )}
        </div>
      )}
      <SearchOverlay show={searching} labels={PLANT_SEARCH_LABELS} />
    </Shell>
  )
}
