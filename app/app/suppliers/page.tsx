'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { EyeOffIcon } from '@/components/workspace/icons'
import { SUPPLIER_SEARCH_LABELS, SearchOverlay } from '@/components/workspace/search-loader'
import { Shell, useIsMobile, useToast } from '@/components/workspace/shell'
import { Cell, ColumnHead, ColumnPicker, MultiFilter, badgeFor } from '@/components/workspace/table-parts'
import { Toolbar } from '@/components/workspace/toolbar'
import { Badge } from '@/components/ui/badge'
import { SUPPLIER_COLS, type ColumnDef } from '@/lib/columns'
import { formatDate } from '@/lib/format'
import type { SupplierRow } from '@/lib/rows'
import { SUPPLIER_FILTERS, clientOnlyFilters, filterQuery } from '@/lib/server-filters'
import { applyFilters, compareOptions, useTableConfig } from '@/lib/table-config'
import { useDebouncedSearch } from '@/lib/use-debounced'

const ACTIONS_W = 16 + 26

export default function SuppliersPage() {
  const router = useRouter()
  const isMobile = useIsMobile()
  const toast = useToast()
  const cfg = useTableConfig('suppliers')

  const [query, setQuery] = useState('')
  const [rows, setRows] = useState<SupplierRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageCount, setPageCount] = useState(1)
  const [loading, setLoading] = useState(true)
  const [hiddenRows, setHiddenRows] = useState<number[]>([])
  const [refreshNonce, setRefreshNonce] = useState(0)
  const [facets, setFacets] = useState<Record<string, string[]>>({})

  useEffect(() => {
    const refresh = () => setRefreshNonce((value) => value + 1)
    window.addEventListener('lps:refresh', refresh)
    return () => window.removeEventListener('lps:refresh', refresh)
  }, [])

  // Column filters run as SQL over the RPC result, so they travel with the
  // request rather than being applied to whichever page came back.
  const serverFilterQuery = useMemo(
    () => filterQuery('supplier', SUPPLIER_FILTERS, cfg.filters),
    [cfg.filters],
  )
  const {
    query: debouncedQuery, filters: debouncedFilterQuery, settled,
  } = useDebouncedSearch(query, serverFilterQuery)
  // The loader covers the debounce window too, so it appears on the first
  // keystroke rather than 300ms later when the fetch actually fires.
  const searching = loading || !settled

  // A new search or filter starts again at page 1.
  //
  // Reset while rendering, not in an effect. An effect commits *after* the
  // fetch effect below has already run once against the outgoing page number,
  // so searching from page 3 would cost two requests: one for the stale page,
  // one for page 1.
  const searchKey = `${debouncedQuery}\n${debouncedFilterQuery}`
  const [pagedFor, setPagedFor] = useState(searchKey)
  if (pagedFor !== searchKey) {
    setPagedFor(searchKey)
    setPage(1)
  }

  // Option lists for this search, deliberately not narrowed by the active
  // filters — otherwise picking one city would remove the rest from the list.
  useEffect(() => {
    let cancelled = false
    fetch(`/api/suppliers?facets=1&q=${encodeURIComponent(debouncedQuery)}`)
      .then((r) => r.json())
      .then((body: { facets?: Record<string, string[]> }) => {
        if (!cancelled) setFacets(body.facets ?? {})
      })
      .catch(() => !cancelled && setFacets({}))
    return () => {
      cancelled = true
    }
  }, [debouncedQuery, refreshNonce])

  // Debounced search → search_suppliers RPC. Stale responses are dropped so a
  // slow early query can't overwrite the results of a later one.
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const filterSuffix = debouncedFilterQuery ? `&${debouncedFilterQuery}` : ''
    fetch(`/api/suppliers?q=${encodeURIComponent(debouncedQuery)}&page=${page}${filterSuffix}`)
      .then((r) => r.json())
      .then((body: { rows?: SupplierRow[]; total?: number; pageCount?: number }) => {
        if (cancelled) return
        setRows(body.rows ?? [])
        setTotal(body.total ?? 0)
        setPageCount(body.pageCount ?? 1)
        setLoading(false)
      })
      .catch(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [debouncedQuery, debouncedFilterQuery, page, refreshNonce])

  // Second pass: "# Items" needs one COUNT per supplier, so it arrives after
  // the table has already rendered rather than holding it up.
  useEffect(() => {
    const ids = rows.map((r) => r.id)
    if (!ids.length || rows.every((r) => r.values.item_count != null)) return
    let cancelled = false
    fetch(`/api/suppliers?counts=1&ids=${ids.join(',')}`)
      .then((r) => r.json())
      .then((body: { counts?: Record<string, number> }) => {
        if (cancelled || !body.counts) return
        setRows((prev) =>
          prev.map((r) => ({ ...r, values: { ...r.values, item_count: body.counts![r.id] ?? 0 } })),
        )
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [rows])

  const saveCell = useCallback(
    async (row: SupplierRow, col: ColumnDef, next: string) => {
      if (!col.writes) return
      const res = await fetch('/api/rows', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ table: col.writes.table, id: row.id, column: col.writes.column, value: next }),
      })
      if (!res.ok) {
        toast(`Could not save ${col.label}`)
        return
      }
      setRows((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, values: { ...r.values, [col.key]: next || null } } : r)),
      )
      toast(`${col.label} updated`)
    },
    [toast],
  )

  // Everything except `# Items` was filtered in SQL before this page arrived;
  // that one is a per-supplier COUNT from a second pass, so it has no column to
  // filter on and stays here.
  const visibleRows = useMemo(
    () =>
      applyFilters(
        rows.filter((r) => !hiddenRows.includes(r.id)),
        clientOnlyFilters(cfg.filters, SUPPLIER_FILTERS),
        cfg.sort,
      ),
    [rows, hiddenRows, cfg.filters, cfg.sort],
  )

  const optionList = useCallback(
    (key: string) => [...(facets[key] ?? [])].sort(compareOptions(key)),
    [facets],
  )

  const categoryFilter = Array.isArray(cfg.filters.category) ? cfg.filters.category : []
  const cityFilter = Array.isArray(cfg.filters.city) ? cfg.filters.city : []
  const stateFilter = Array.isArray(cfg.filters.state) ? cfg.filters.state : []
  const hasFilters = Object.keys(cfg.filters).length > 0 || !!query

  const toolbar = (
    <Toolbar
      placeholder="Search name, contact, email, city…"
      query={query}
      onQuery={setQuery}
      controls={
        <>
          <div className="w-[calc(50%-4px)] md:w-[160px]">
            <MultiFilter
              allLabel="All supplier types"
              selectionLabel="Type"
              options={optionList('category')}
              selected={categoryFilter}
              onChange={(next) => cfg.setColFilter('category', next)}
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
              onChange={(next) => cfg.setColFilter('city', next)}
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
              onChange={(next) => cfg.setColFilter('state', next)}
              buttonClassName="h-8 px-2 text-[12px]"
              filterPlaceholder="Filter states…"
            />
          </div>
        </>
      }
      hasFilters={hasFilters}
      onClear={() => {
        setQuery('')
        cfg.clearFilters()
      }}
      summary={
        searching
          ? 'Searching…'
          : `Showing ${visibleRows.length} of ${total.toLocaleString('en-US')} suppliers`
      }
      pagination={{ page, pageCount, onPage: setPage, busy: searching }}
    />
  )

  const tableWidth = ACTIONS_W + cfg.visible.reduce((n, c) => n + cfg.widthOf(c), 0)

  return (
    <Shell page="suppliers" title="Suppliers" subtitle="Growers, nurseries and wholesalers" toolbar={toolbar} hideHeaderOnMobile>
      {isMobile ? (
        <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-auto p-3 pb-5">
          {visibleRows.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => router.push(`/suppliers/${row.id}`)}
              className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3.5 text-left"
            >
              <div className="flex items-start justify-between gap-2.5">
                <div className="min-w-0">
                  <div className="text-[14.5px] font-bold leading-tight">{String(row.values.name ?? '')}</div>
                  <div className="text-[11.5px] text-muted-foreground">
                    {[row.values.city, row.values.state].filter(Boolean).join(', ') || 'No address on file'}
                  </div>
                </div>
                <div className="flex flex-none flex-col items-end gap-[3px] text-right">
                  <div className="text-[15px] font-bold tabular-nums">
                    {row.values.item_count == null ? '—' : Number(row.values.item_count).toLocaleString('en-US')}
                  </div>
                  <div className="text-[11px] text-muted-foreground">items</div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {row.values.category && (
                  <Badge variant={badgeFor(String(row.values.category)) as 'default' | 'secondary' | 'outline'}>
                    {String(row.values.category)}
                  </Badge>
                )}
                {row.values.primary_contact_name && (
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
                    {String(row.values.primary_contact_name)}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-muted-foreground">
                Last ingested {formatDate(row.values.last_ingestion_date as string | null) || '—'}
              </div>
              <span className="text-[12.5px] font-semibold text-primary">Open supplier →</span>
            </button>
          ))}
          {!searching && visibleRows.length === 0 && (
            <div className="p-12 text-center text-[13px] text-muted-foreground">Nothing matches these filters.</div>
          )}
        </div>
      ) : (
        <div className="mx-4 mb-4 mt-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card">
          <div className="relative min-h-0 flex-1 overflow-auto">
            <table
              className="border-separate"
              style={{ width: tableWidth, borderSpacing: 0, tableLayout: 'fixed' }}
            >
              <thead>
                <tr>
                  {cfg.visible.map((col) => (
                    <th
                      key={col.key}
                      className="sticky top-0 z-20 border-b border-border bg-lps-headrow p-[8px_10px] align-top"
                      style={{ width: cfg.widthOf(col), minWidth: cfg.widthOf(col) }}
                    >
                      <ColumnHead
                        col={col}
                        width={cfg.widthOf(col)}
                        sort={cfg.sort}
                        filters={cfg.filters}
                        options={optionList(col.key)}
                        onSort={() => cfg.cycleSort(col.key)}
                        onFilter={(v) => cfg.setColFilter(col.key, v)}
                        onResize={(w) => cfg.resizeColumn(col.key, w)}
                        onMove={(from) => cfg.moveColumn(from, col.key)}
                      />
                    </th>
                  ))}
                  <th
                    className="sticky right-0 top-0 z-[22] border-b border-l border-border bg-lps-headrow p-1.5 align-top"
                    style={{ width: ACTIONS_W, minWidth: ACTIONS_W }}
                  >
                    <ColumnPicker
                      title="Columns"
                      cols={SUPPLIER_COLS}
                      hidden={cfg.config.hidden}
                      onToggle={cfg.toggleColumn}
                    />
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  <tr key={row.id} className="lps-row h-[48px] bg-card transition-colors hover:bg-muted">
                    {cfg.visible.map((col) => (
                      <td
                        key={col.key}
                        className="relative border-b border-lps-hair p-[5px_4px] align-middle"
                        style={{ width: cfg.widthOf(col), minWidth: cfg.widthOf(col), textAlign: col.align ?? 'left' }}
                      >
                        <Cell
                          col={col}
                          rowId={row.id}
                          links={col.kind === 'list' ? row.sourceLinks : undefined}
                          value={
                            col.key === 'created_at' || col.key === 'updated' || col.key === 'last_ingestion_date'
                              ? formatDate(row.values[col.key] as string | null)
                              : row.values[col.key] ?? null
                          }
                          onOpen={col.kind === 'link' ? () => router.push(`/suppliers/${row.id}`) : undefined}
                          onSave={col.edit ? (next) => saveCell(row, col, next) : undefined}
                        />
                      </td>
                    ))}
                    <td
                      className="sticky right-0 z-10 border-b border-l border-lps-hair bg-card p-[4px_6px]"
                      style={{ width: ACTIONS_W, minWidth: ACTIONS_W }}
                    >
                      <div className="flex items-center">
                        <button
                          type="button"
                          onClick={() => setHiddenRows((prev) => [...prev, row.id])}
                          title="Hide row until refresh"
                          aria-label="Hide row"
                          className="inline-flex size-[26px] cursor-pointer items-center justify-center rounded-[7px] border-none bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          <EyeOffIcon size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {!searching && visibleRows.length === 0 && (
              <div className="flex flex-col items-center gap-2 px-5 py-14 text-center">
                <span className="text-[14px] font-semibold">Nothing matches these filters</span>
                <span className="text-[12.5px] text-muted-foreground">
                  Clear a column filter, or search a common name — search is typo-tolerant.
                </span>
              </div>
            )}
          </div>

          {hiddenRows.length > 0 && (
            <div className="flex flex-none items-center gap-2.5 border-t border-border bg-lps-tint px-3 py-[7px] text-[11.5px] text-muted-foreground">
              <span>{hiddenRows.length} row{hiddenRows.length === 1 ? '' : 's'} hidden</span>
              <button
                type="button"
                onClick={() => setHiddenRows([])}
                className="cursor-pointer border-none bg-transparent text-[11.5px] font-semibold text-primary underline"
              >
                Restore
              </button>
            </div>
          )}
        </div>
      )}
      <SearchOverlay show={searching} labels={SUPPLIER_SEARCH_LABELS} />
    </Shell>
  )
}
