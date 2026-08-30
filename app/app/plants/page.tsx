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
import { MASTER_COLS, PLANT_COLS, plantEditPatch, type ColumnDef } from '@/lib/columns'
import { formatDate, money, num } from '@/lib/format'
import { scrollPlantNameWithKeyboard } from '@/lib/plant-name-scroll'
import type { PlantGroup, PlantRow } from '@/lib/rows'
import { MASTER_FILTERS, PLANT_FILTERS, filterQuery } from '@/lib/server-filters'
import { PLANT_SORTS, clientOnlySort, sortQuery } from '@/lib/server-sort'
import { applyFilters, compareOptions, useTableConfig } from '@/lib/table-config'
import { useDebouncedSearch } from '@/lib/use-debounced'
import { cn } from '@/lib/utils'

// Company-panel fields with a fixed compact placement, or deliberately kept
// off search cards. City and contact routes remain on the linked profile.
const PANEL_FIXED = [
  'name', 'plant_count', 'category', 'state', 'city',
  'primary_contact_email', 'primary_contact_phone', 'updated',
]
const PLANT_SEARCH_KEY = 'lps.plant-search.query.v1'
const PLANT_SIZE_CHOICE_KEY = 'lps.plant-search.size-choice.v3'
// Earlier versions stored a normalised size key ("gallon:15"), then the row's
// own size text ("15 G"). The selector now holds standardized buckets ("15G"),
// so neither of those means anything here.
const RETIRED_PLANT_SIZE_KEYS = [
  'lps.plant-search.size.v1', 'lps.plant-search.size-choice.v1', 'lps.plant-search.size-choice.v2',
]

// Size and supplier/location filters appear beside the search field. These
// remaining numeric filters use a compact disclosure in that same toolbar.
const MOBILE_FILTERS = [
  { key: 'price', label: 'Price', master: false },
  { key: 'h', label: 'Height (ft)', master: false },
  { key: 'w', label: 'Width (in)', master: false },
  { key: 'cal', label: 'Caliper (in)', master: false },
] as const

function ResultSizeControl({
  options,
  selected,
  onSelect,
}: {
  options: string[]
  selected: string[]
  onSelect: (sizes: string[]) => void
}) {
  return (
    <div className="w-[calc(50%-4px)] md:w-[170px]">
      <MultiFilter
        allLabel="Size: Any"
        options={options}
        selected={selected}
        selectionLabel="Size"
        buttonClassName="h-8 text-[12px] px-2"
        filterPlaceholder="Filter sizes…"
        onChange={onSelect}
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
  const [groups, setGroups] = useState<PlantGroup[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageCount, setPageCount] = useState(1)
  const [loading, setLoading] = useState(false)
  const [selectedSizes, setSelectedSizes] = useState<string[]>([])
  const [facets, setFacets] = useState<Record<string, string[]>>({})
  const hasQuery = query.trim().length > 0

  // Every column filter, and the plant table's header sort, is applied as SQL
  // over the search result, so the whole state travels to the server as one
  // stable string. Stable matters: it is a `useEffect` dependency, so an
  // unchanged filter set must serialize identically or the page would refetch
  // on every render.
  //
  // The Size selector lives in its own state (it is persisted to the URL) but
  // is the same `size` filter as far as the server is concerned.
  const serverQuery = useMemo(
    () =>
      [
        filterQuery('plant', PLANT_FILTERS, { ...plantCfg.filters, size: selectedSizes }),
        filterQuery('master', MASTER_FILTERS, masterCfg.filters),
        sortQuery(PLANT_SORTS, plantCfg.sort),
      ]
        .filter(Boolean)
        .join('&'),
    [plantCfg.filters, plantCfg.sort, masterCfg.filters, selectedSizes],
  )
  const {
    query: debouncedQuery, filters: debouncedServerQuery, settled,
  } = useDebouncedSearch(query, serverQuery)
  // The loader covers the debounce window too, so it appears on the first
  // keystroke rather than 300ms later when the fetch actually fires.
  const searching = searchHydrated && hasQuery && (loading || !settled)
  const [panelW, setPanelW] = useState(292)
  const [hiddenPlants, setHiddenPlants] = useState<string[]>([])
  const [hiddenCompanies, setHiddenCompanies] = useState<number[]>([])
  const [supplierPick, setSupplierPick] = useState<string[]>([])
  const [filtersOpen, setFiltersOpen] = useState(false)
  // Which companies are collapsed. Mobile only — the desktop layout puts the
  // card beside its rows rather than above them, so there is nothing to fold.
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
      savedSizes = []
    }
    setSelectedSizes(hasUrlQuery ? url.searchParams.getAll('size') : savedSizes)
    for (const key of RETIRED_PLANT_SIZE_KEYS) window.localStorage.removeItem(key)
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
    if (selectedSizes.length > 0) {
      for (const key of selectedSizes) url.searchParams.append('size', key)
      window.localStorage.setItem(PLANT_SIZE_CHOICE_KEY, JSON.stringify(selectedSizes))
    } else {
      window.localStorage.removeItem(PLANT_SIZE_CHOICE_KEY)
    }
    url.searchParams.delete('size_unit')
    url.searchParams.delete('size_min')
    url.searchParams.delete('size_max')
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
  }, [hasQuery, query, searchHydrated, selectedSizes])

  // A new question, filter or sort starts again at page 1 — page 4 of the old
  // result set means nothing once the set or its ordering changes.
  //
  // Reset while rendering, not in an effect. An effect commits *after* the
  // fetch effect below has already run once against the outgoing page number,
  // so searching from page 3 would cost two requests: one for the stale page,
  // one for page 1.
  const searchKey = `${debouncedQuery}\n${debouncedServerQuery}`
  const [pagedFor, setPagedFor] = useState(searchKey)
  if (pagedFor !== searchKey) {
    setPagedFor(searchKey)
    setPage(1)
  }

  // The values each dropdown offers, for this search and deliberately *not*
  // narrowed by the active filters: options derived from filtered rows would
  // collapse to whatever is already selected. Keyed on the search term only,
  // so changing a filter never refetches them.
  useEffect(() => {
    if (!searchHydrated || !debouncedQuery) {
      setFacets({})
      return
    }
    let cancelled = false
    fetch(`/api/plants?facets=1&q=${encodeURIComponent(debouncedQuery)}`)
      .then((r) => r.json())
      .then((body: { facets?: Record<string, string[]> }) => {
        if (!cancelled) setFacets(body.facets ?? {})
      })
      .catch(() => !cancelled && setFacets({}))
    return () => {
      cancelled = true
    }
  }, [debouncedQuery, refreshNonce, searchHydrated])

  useEffect(() => {
    if (!searchHydrated) return
    if (!debouncedQuery) {
      setGroups([])
      setTotal(0)
      setPageCount(1)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    const filterSuffix = debouncedServerQuery ? `&${debouncedServerQuery}` : ''
    fetch(`/api/plants?q=${encodeURIComponent(debouncedQuery)}&page=${page}${filterSuffix}`)
      .then((r) => r.json())
      .then((body: { groups?: PlantGroup[]; total?: number; pageCount?: number }) => {
        if (cancelled) return
        const nextGroups = body.groups ?? []
        setGroups(nextGroups)
        setTotal(body.total ?? 0)
        setPageCount(body.pageCount ?? 1)
        // A new result set is a company shortlist: expand one to read its rows.
        setCollapsed(nextGroups.map((group) => group.companyId))
        setLoading(false)
      })
      .catch(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [debouncedServerQuery, debouncedQuery, page, refreshNonce, searchHydrated])

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
            p.id === row.id
              ? {
                  ...p,
                  values: { ...p.values, ...plantEditPatch(p.values, col, next) },
                }
              : p,
          ),
        })),
      )
      toast(`${col.label} updated`)
    },
    [toast],
  )

  // Quoted literal retrieval is enforced in search_inventory before these
  // groups arrive. Do not normalize, expand or reinterpret its result in the
  // browser; unquoted ranking also remains the RPC's responsibility.
  const refinedGroups = groups

  // Column filters, and the plant table's sort, ran in SQL before this page was
  // fetched, so nothing here re-applies them. What is left is genuinely
  // view-local: rows the user hid, the supplier shortlist, the supplier panel's
  // own sort — the master rows *are* this page's groups, so ordering them is
  // arranging what came back rather than asking a new question — and the plant
  // columns SQL cannot order (Size, Source, Ingested; see PLANT_SORTS). A size
  // typed into the query is not handled here either: it is a ranking signal the
  // search itself applies.
  const visibleGroups = useMemo(() => {
    const masterRows = refinedGroups.map((g) => g.company)
    const ordered = masterCfg.sort
      ? applyFilters(masterRows, {}, masterCfg.sort).map(
          (r) => refinedGroups.find((g) => g.company.id === r.id)!,
        )
      : refinedGroups

    return ordered
      .filter(
        (g) =>
          !hiddenCompanies.includes(g.companyId) &&
          (supplierPick.length === 0 || supplierPick.includes(g.companyName)),
      )
      .map((g) => ({
        ...g,
        plants: applyFilters(
          g.plants.filter(
            (p) => !hiddenPlants.includes(p.id),
          ),
          {},
          clientOnlySort(plantCfg.sort, PLANT_SORTS),
        ),
      }))
      .filter((g) => g.plants.length > 0)
  }, [refinedGroups, masterCfg.sort, plantCfg.sort, hiddenPlants, hiddenCompanies, supplierPick])

  const supplierNames = useMemo(
    () => [...new Set(refinedGroups.map((group) => group.companyName))].sort((a, b) => a.localeCompare(b)),
    [refinedGroups],
  )

  const shownPlants = visibleGroups.reduce((n, g) => n + g.plants.length, 0)

  // Options come from the facet call, which sees the whole match set rather
  // than this page of it — so ticking one value never removes the others.
  const optionList = useCallback(
    (key: string) => [...(facets[key] ?? [])].sort(compareOptions(key)),
    [facets],
  )
  const sizeOptions = useMemo(() => optionList('size'), [optionList])

  // A size that this search cannot offer is a leftover from the previous one.
  useEffect(() => {
    if (loading || sizeOptions.length === 0 || selectedSizes.length === 0) return
    const valid = new Set(sizeOptions)
    const next = selectedSizes.filter((size) => valid.has(size))
    if (next.length !== selectedSizes.length) setSelectedSizes(next)
  }, [loading, selectedSizes, sizeOptions])

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

  // Cultivar is a plant-level column, so the toolbar dropdown and the column
  // header's own filter are the same piece of state — set one, both show it.
  const cultivarOptions = useMemo(() => optionList('cultivar'), [optionList])
  const cultivarFilter = Array.isArray(plantCfg.filters.cultivar) ? plantCfg.filters.cultivar : []
  const categoryFilter = Array.isArray(masterCfg.filters.category) ? masterCfg.filters.category : []
  const cityFilter = Array.isArray(masterCfg.filters.city) ? masterCfg.filters.city : []
  const stateFilter = Array.isArray(masterCfg.filters.state) ? masterCfg.filters.state : []
  const activeFilterCount =
    (supplierPick.length > 0 ? 1 : 0) +
    (selectedSizes.length > 0 ? 1 : 0) +
    Object.keys(plantCfg.filters).length +
    Object.keys(masterCfg.filters).length
  const advancedFilterCount = MOBILE_FILTERS.filter(({ key }) => plantCfg.filters[key] != null).length

  const hasFilters = !!query || activeFilterCount > 0

  const toolbar = (rightActions: React.ReactNode) => (
    <Toolbar
      rightActions={rightActions}
      placeholder={'Search plant name; use "quotes" for a literal phrase…'}
      query={query}
      onQuery={setQuery}
      controls={
        <>
          <ResultSizeControl
            options={sizeOptions}
            selected={selectedSizes}
            onSelect={setSelectedSizes}
          />
          <div className="w-[calc(50%-4px)] md:w-[170px]">
            <MultiFilter
              allLabel="Cultivar: Any"
              selectionLabel="Cultivar"
              accessibleName="Cultivar"
              options={cultivarOptions}
              selected={cultivarFilter}
              onChange={(next) => plantCfg.setColFilter('cultivar', next)}
              buttonClassName="min-h-11 px-2 text-[12px]"
              filterPlaceholder="Filter cultivars…"
              restoreFocusOnClose
            />
          </div>
          <div className="w-[calc(50%-4px)] md:w-[160px]">
            <MultiFilter
              allLabel="All supplier types"
              selectionLabel="Type"
              options={optionList('category')}
              selected={categoryFilter}
              onChange={(next) => masterCfg.setColFilter('category', next)}
              buttonClassName="h-8 px-2 text-[12px]"
              filterPlaceholder="Filter supplier types…"
            />
          </div>
          <div className="w-[calc(50%-4px)] md:w-[160px]">
            <MultiFilter
              allLabel="All cities"
              selectionLabel="City"
              options={optionList('city')}
              selected={cityFilter}
              onChange={(next) => masterCfg.setColFilter('city', next)}
              buttonClassName="h-8 px-2 text-[12px]"
              filterPlaceholder="Filter cities…"
            />
          </div>
          <div className="w-[calc(50%-4px)] md:w-[140px]">
            <MultiFilter
              allLabel="All states"
              selectionLabel="State"
              options={optionList('state')}
              selected={stateFilter}
              onChange={(next) => masterCfg.setColFilter('state', next)}
              buttonClassName="h-8 px-2 text-[12px]"
              filterPlaceholder="Filter states…"
            />
          </div>
          <button
            type="button"
            onClick={() => setFiltersOpen((value) => !value)}
            aria-expanded={filtersOpen}
            className="flex h-8 w-full items-center justify-between rounded-[7px] border border-border bg-background px-2.5 text-left text-[12px] md:hidden"
          >
            <span>Price &amp; dimensions</span>
            <span className="flex items-center gap-1.5">
              {advancedFilterCount > 0 && (
                <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-semibold text-secondary-foreground">
                  {advancedFilterCount}
                </span>
              )}
              <ChevronDown size={14} className={cn(filtersOpen && 'rotate-180')} />
            </span>
          </button>
          {filtersOpen && (
            <div className="grid w-full grid-cols-2 gap-3 rounded-xl border border-border bg-background p-3 md:hidden">
              {MOBILE_FILTERS.map(({ key, label }) => {
                const col = PLANT_COLS.find((candidate) => candidate.key === key)!
                return (
                  <div key={key} className="flex min-w-0 flex-col gap-1">
                    <span className="text-[10.5px] font-bold uppercase tracking-[.05em] text-muted-foreground">
                      {label}
                    </span>
                    <FilterControl
                      col={col}
                      value={plantCfg.filters[key]}
                      options={[]}
                      onFilter={(value) => plantCfg.setColFilter(key, value)}
                    />
                  </div>
                )
              })}
            </div>
          )}
        </>
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
            ? `${visibleGroups.length} companies · Showing ${shownPlants} of ${total.toLocaleString('en-US')} plants`
            : 'Search by plant name'
      }
      pagination={hasQuery ? { page, pageCount, onPage: setPage, busy: searching } : undefined}
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
    const v = g.company.values[col.key]
    if (col.key === 'city') return [v, g.company.values.state].filter(Boolean).join(', ')
    if (col.key === 'updated' || col.key === 'created_at' || col.key === 'ingestion_date') return formatDate(v as string | null)
    if (col.money) return money(v)
    if (col.num) return num(v)
    return Array.isArray(v) ? v.join(', ') : v == null ? '' : String(v)
  }

  const toggleCompany = (id: number) =>
    setCollapsed((prev) =>
      prev.includes(id) ? prev.filter((companyId) => companyId !== id) : [...prev, id],
    )

  /** "3 farms" — only worth saying when the company has more than one. */
  const farmLabel = (g: PlantGroup) =>
    g.locationCount > 1
      ? `${g.matchedLocations} of ${g.locationCount} farms`
      : null

  const mobileCompanyGroup = (g: PlantGroup) => {
    const open = !collapsed.includes(g.companyId)
    return (
      <div key={g.companyId} className="shrink-0 overflow-hidden rounded-xl border border-border bg-card">
        <div className={cn('flex items-start gap-2 bg-lps-tint p-3', open && 'border-b border-lps-hair')}>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5 text-left">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => router.push(`/suppliers/${g.companyId}`)}
                className="min-w-0 truncate border-none bg-transparent p-0 text-left text-[14px] font-bold text-primary underline underline-offset-2"
              >
                {g.companyName}
              </button>
              {g.company.values.state && (
                <span className="flex-none text-[11.5px] font-semibold text-muted-foreground">
                  {String(g.company.values.state)}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {g.company.values.category && (
                <Badge variant={badgeFor(String(g.company.values.category)) as 'default' | 'secondary' | 'outline'}>
                  {String(g.company.values.category)}
                </Badge>
              )}
              <span className="text-[11px] font-semibold text-muted-foreground">
                {g.plants.length} match{g.plants.length === 1 ? '' : 'es'}
              </span>
              {g.company.values.updated && (
                <span className="text-[11px] text-muted-foreground">
                  Updated {formatDate(String(g.company.values.updated))}
                </span>
              )}
              {farmLabel(g) && (
                <span className="text-[11.5px] text-muted-foreground">{farmLabel(g)}</span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => toggleCompany(g.companyId)}
            aria-expanded={open}
            aria-label={open ? 'Collapse company inventory' : 'Expand company inventory'}
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
                  onKeyDown={(event) => {
                    const name = event.currentTarget.querySelector<HTMLElement>('[data-plant-name-scroll]')
                    if (name && scrollPlantNameWithKeyboard(name, event.key)) event.preventDefault()
                  }}
                  className="flex w-full items-start gap-3 p-3 text-left"
                >
                  <div className="min-w-0 flex-1">
                    <div
                      data-plant-name-scroll
                      title={String(p.values.name ?? '')}
                      className="lps-plant-name-scroll max-w-full overflow-x-auto overflow-y-hidden overscroll-x-contain whitespace-nowrap text-[13px] font-semibold touch-pan-x"
                    >
                      {String(p.values.name ?? '')}
                    </div>
                    {/* The card is the company; this row's stock sits at one farm. */}
                    {g.locationCount > 1 && p.values.branch && (
                      <div className="mt-0.5 truncate text-[11px] font-semibold text-primary">
                        {String(p.values.branch)}
                      </div>
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
                      <div className={cn('text-[14px] tabular-nums', p.values.price == null ? 'text-[11px] italic text-lps-dim' : 'font-bold')}>
                        {p.values.price == null ? 'Price unavailable' : money(p.values.price)}
                      </div>
                      <div className="text-[11px] text-muted-foreground tabular-nums">
                        {p.values.qty == null ? '—' : `${num(p.values.qty)} avail`}
                      </div>
                    </div>
                    <ChevronDown size={14} className={cn('mt-1.5 text-lps-dim', !detailsOpen && '-rotate-90')} />
                  </div>
                </button>
                {detailsOpen && (
                  <div className="flex flex-col gap-2 border-t border-lps-hair bg-lps-tint px-3 py-2.5 text-[11.5px]">
                    {p.values.notes && (
                      <div>
                        <span className="font-semibold text-lps-dim">Notes: </span>
                        <span className="text-muted-foreground">{String(p.values.notes)}</span>
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
                      {p.values.ingestion_date && <span>Ingested {formatDate(String(p.values.ingestion_date))}</span>}
                      {p.values.updated && <span>Row updated {formatDate(String(p.values.updated))}</span>}
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
  }

  const desktopCompanyGroup = (g: PlantGroup) => (
    <div
      key={g.companyId}
      className="flex items-stretch border-b border-border bg-card"
      style={{ height: panelH }}
    >
      <div
        className="sticky left-0 z-[14] flex flex-none flex-col gap-1.5 overflow-y-auto overflow-x-hidden border-r border-border bg-card p-[11px_14px]"
        style={{ width: panelW, minWidth: panelW }}
      >
        <div className="flex items-start gap-1.5">
          <button
            type="button"
            onClick={() => router.push(`/suppliers/${g.companyId}`)}
            className="min-w-0 cursor-pointer border-none bg-transparent p-0 text-left text-[14px] font-bold text-primary"
          >
            {g.companyName}
          </button>
          {g.company.values.state && (
            <span className="flex-none pt-px text-[11.5px] font-semibold text-muted-foreground">
              {String(g.company.values.state)}
            </span>
          )}
          <button
            type="button"
            onClick={() => setHiddenCompanies((prev) => [...prev, g.companyId])}
            title="Hide company"
            aria-label="Hide company"
            className="ml-auto inline-flex size-[22px] flex-none cursor-pointer items-center justify-center rounded-md border-none bg-transparent text-lps-dim hover:bg-muted hover:text-foreground"
          >
            <EyeOffIcon size={13} />
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {g.company.values.category && (
            <Badge variant={badgeFor(String(g.company.values.category)) as 'default' | 'secondary' | 'outline'}>
              {String(g.company.values.category)}
            </Badge>
          )}
          <span className="whitespace-nowrap rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-semibold text-secondary-foreground">
            {g.plants.length} match{g.plants.length === 1 ? '' : 'es'}
          </span>
          {g.company.values.updated && (
            <span className="whitespace-nowrap text-[11px] text-muted-foreground">
              Updated {formatDate(String(g.company.values.updated))}
            </span>
          )}
          {farmLabel(g) && (
            <span className="whitespace-nowrap text-[11px] text-muted-foreground">{farmLabel(g)}</span>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-0.5">
          {panelDetailCols.map((col) => {
            const text = detailText(g, col)
            if (!text) return null
            return (
              <span key={col.key} className="truncate text-[11.5px] text-muted-foreground">
                <span className="text-lps-dim">{col.label}: </span>{text}
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

  return (
    <Shell page="inventory" title="Plant search" toolbar={toolbar} hideHeaderOnMobile hideHeaderOnDesktop>
      {!searchHydrated ? null : !hasQuery ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
          <span className="text-[15px] font-semibold">What plant are you looking for?</span>
          <span className="max-w-[470px] text-[12.5px] text-muted-foreground">
            Search broadly by plant name, optionally with a size such as “15g Agave Americana”.
            Wrap a literal case-insensitive plant-identity substring in double quotes: "Italian Cypress".
          </span>
        </div>
      ) : isMobile ? (
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-3 pb-5">
          {visibleGroups.map(mobileCompanyGroup)}
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
                      Company
                    </span>
                    <span className="ml-auto text-[10.5px] text-lps-dim">
                      {visibleGroups.length} compan{visibleGroups.length === 1 ? 'y' : 'ies'}
                    </span>
                    <ColumnPicker
                      title="Company fields"
                      cols={MASTER_COLS.filter((c) => !PANEL_FIXED.includes(c.key))}
                      hidden={masterCfg.config.hidden}
                      onToggle={masterCfg.toggleColumn}
                      align="right"
                      size="sm"
                    />
                  </div>
                  <MultiFilter
                    allLabel="All companies"
                    options={supplierNames}
                    selected={supplierPick}
                    onChange={setSupplierPick}
                  />
                  <div
                    onMouseDown={startPanelResize}
                    className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize select-none hover:bg-lps-edge"
                  />
                </div>
                <PlantHeaderRow cfg={plantCfg} options={optionList} />
              </div>

              {visibleGroups.map(desktopCompanyGroup)}
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

          {(hiddenPlants.length > 0 || hiddenCompanies.length > 0) && (
            <div className="flex flex-none items-center gap-2.5 border-t border-border bg-lps-tint px-3 py-[7px] text-[11.5px] text-muted-foreground">
              <span>
                {hiddenCompanies.length > 0 && `${hiddenCompanies.length} compan${hiddenCompanies.length === 1 ? 'y' : 'ies'}`}
                {hiddenCompanies.length > 0 && hiddenPlants.length > 0 && ' · '}
                {hiddenPlants.length > 0 && `${hiddenPlants.length} row${hiddenPlants.length === 1 ? '' : 's'}`} hidden
              </span>
              <button
                type="button"
                onClick={() => {
                  setHiddenPlants([])
                  setHiddenCompanies([])
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
