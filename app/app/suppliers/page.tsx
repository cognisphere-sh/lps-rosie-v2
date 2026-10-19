'use client'

import { useRouter } from 'next/navigation'
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { AgentChatButton } from '@/components/workspace/agent-chat-button'
import { ChevronDown, EyeOffIcon } from '@/components/workspace/icons'
import { SUPPLIER_SEARCH_LABELS, SearchOverlay } from '@/components/workspace/search-loader'
import { Shell, useIsMobile, useToast } from '@/components/workspace/shell'
import { SupplierFilters } from '@/components/workspace/supplier-filters'
import { Cell, ColumnHead, ColumnPicker, LpsTag, badgeFor } from '@/components/workspace/table-parts'
import { Toolbar } from '@/components/workspace/toolbar'
import { Badge } from '@/components/ui/badge'
import { supplierAgentThreads } from '@/lib/agents'
import { SUPPLIER_COLS, type ColumnDef } from '@/lib/columns'
import { formatDate } from '@/lib/format'
import type { SupplierCompany, SupplierRow } from '@/lib/rows'
import { SUPPLIER_FILTERS, clientOnlyFilters, filterQuery } from '@/lib/server-filters'
import { SUPPLIER_SORTS, clientOnlySort, sortQuery } from '@/lib/server-sort'
import { appendSupplierPage, fetchSupplierPage } from '@/lib/supplier-page-loading'
import { applyFilters, compareOptions, useTableConfig } from '@/lib/table-config'
import { useDebouncedSearch } from '@/lib/use-debounced'

// The column picker's head, and each company row's two agent buttons beside
// its hide button. Farm rows carry the hide button alone.
const ACTIONS_W = 16 + 26 + 2 * 24
/** Leading gutter holding the expander on a company with more than one farm. */
const EXPAND_W = 28

export default function SuppliersPage() {
  const router = useRouter()
  const isMobile = useIsMobile()
  const toast = useToast()
  const cfg = useTableConfig('suppliers')

  const [query, setQuery] = useState('')
  const [companies, setCompanies] = useState<SupplierCompany[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageCount, setPageCount] = useState(1)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadMoreError, setLoadMoreError] = useState(false)
  const loadRequestId = useRef(0)
  const [hiddenRows, setHiddenRows] = useState<number[]>([])
  const [expandedCompanies, setExpandedCompanies] = useState<number[]>([])
  // Active items per location, from the second pass below. Kept beside the rows
  // rather than inside them because the company row's figure is a sum over
  // every farm — including the ones this search did not match.
  const [counts, setCounts] = useState<Record<number, number>>({})
  const [refreshNonce, setRefreshNonce] = useState(0)
  const [facets, setFacets] = useState<Record<string, string[]>>({})

  useEffect(() => {
    const refresh = () => {
      loadRequestId.current += 1
      if (isMobile) setPage(1)
      setLoadingMore(false)
      setLoadMoreError(false)
      setRefreshNonce((value) => value + 1)
    }
    window.addEventListener('lps:refresh', refresh)
    return () => window.removeEventListener('lps:refresh', refresh)
  }, [isMobile])

  // Column filters and the header sort both run as SQL over the RPC result, so
  // they travel with the request rather than being applied to whichever page
  // came back. They share one debounce timer: a filter click and a sort click
  // landing together should cost one request, not two.
  const serverQuery = useMemo(
    () =>
      [filterQuery('supplier', SUPPLIER_FILTERS, cfg.filters), sortQuery(SUPPLIER_SORTS, cfg.sort)]
        .filter(Boolean)
        .join('&'),
    [cfg.filters, cfg.sort],
  )
  // A load-more response belongs only to the exact raw query/filter/sort state
  // that launched it, including the debounce window before a new fetch begins.
  const activeRequestKey = useRef('')
  activeRequestKey.current = `${query}\n${serverQuery}\n${isMobile ? 'mobile' : 'desktop'}\n${refreshNonce}`
  const {
    query: debouncedQuery, filters: debouncedServerQuery, settled,
  } = useDebouncedSearch(query, serverQuery)
  // The loader covers the debounce window too, so it appears on the first
  // keystroke rather than 300ms later when the fetch actually fires. Loading
  // another mobile page leaves the already revealed cards in place instead.
  const searching = loading || !settled

  // A new search, filter or sort starts again at page 1 — page 3 of the old
  // ordering means nothing once the ordering changes.
  //
  // Reset while rendering, not in an effect. An effect commits *after* the
  // fetch effect below has already run once against the outgoing page number,
  // so searching from page 3 would cost two requests: one for the stale page,
  // one for page 1.
  const searchKey = `${debouncedQuery}\n${debouncedServerQuery}`
  const pagingKey = `${searchKey}\n${isMobile ? 'mobile' : 'desktop'}`
  const [pagedFor, setPagedFor] = useState(pagingKey)
  if (pagedFor !== pagingKey) {
    setPagedFor(pagingKey)
    setPage(1)
    setLoadMoreError(false)
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
    // Mobile pages after the first are explicit load-more requests below. The
    // committed `page` advances only after one succeeds, so retry cannot skip.
    if (isMobile && page > 1) return
    let cancelled = false
    setLoading(true)
    const filterSuffix = debouncedServerQuery ? `&${debouncedServerQuery}` : ''
    fetchSupplierPage(`/api/suppliers?q=${encodeURIComponent(debouncedQuery)}&page=${page}${filterSuffix}`)
      .then((body) => {
        if (cancelled) return
        setCompanies(body.companies ?? [])
        setExpandedCompanies([])
        setTotal(body.total ?? 0)
        setPageCount(body.pageCount ?? 1)
        setLoading(false)
      })
      .catch(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [debouncedQuery, debouncedServerQuery, page, refreshNonce, isMobile])

  // Second pass: "# Items" needs one COUNT per location, so it arrives after
  // the table has already rendered rather than holding it up. Every location of
  // every company is counted, not just the matching ones — the company row's
  // figure has to speak for the whole company.
  useEffect(() => {
    const ids = [...new Set(companies.flatMap((company) => company.locationIds))]
    const missing = ids.filter((id) => counts[id] == null)
    if (!missing.length) return
    let cancelled = false
    fetch(`/api/suppliers?counts=1&ids=${missing.join(',')}`)
      .then((r) => r.json())
      .then((body: { counts?: Record<string, number> }) => {
        if (cancelled || !body.counts) return
        setCounts((prev) => ({ ...prev, ...body.counts }))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [companies, counts])

  const saveCell = useCallback(
    async (row: SupplierRow, col: ColumnDef, next: string) => {
      if (!col.writes) return
      // Optimistic: show the value now, put the row's old values back if the
      // write is refused.
      const apply = (values: SupplierRow['values']) => {
        const patch = (candidate: SupplierRow) =>
          candidate.id === row.id ? { ...candidate, values } : candidate
        setCompanies((prev) =>
          prev.map((company) => ({
            ...company,
            head: patch(company.head),
            locations: company.locations.map(patch),
          })),
        )
      }
      apply({ ...row.values, [col.key]: next || null })
      const res = await fetch('/api/rows', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ table: col.writes.table, id: row.id, column: col.writes.column, value: next }),
      })
      if (!res.ok) {
        apply(row.values)
        toast(`Could not save ${col.label}`, 'error')
        return
      }
      toast(`${col.label} updated`)
    },
    [toast],
  )

  // Everything except `# Items` was filtered and sorted in SQL before this page
  // arrived; that one is a per-location COUNT from a second pass, so it has no
  // column to filter or order on and stays here. The columns assembled per page
  // — the contact and source lists — sort here for the same reason.
  //
  // Both apply to the **company row**, which is the row the page shows: a range
  // on `# Items` is a question about the company, not about one of its farms.
  const visibleCompanies = useMemo(() => {
    const withCount = (row: SupplierRow, itemCount: number | null): SupplierRow => ({
      ...row,
      values: { ...row.values, item_count: itemCount },
    })
    const countOf = (ids: number[]) =>
      ids.every((id) => counts[id] == null)
        ? null
        : ids.reduce((sum, id) => sum + (counts[id] ?? 0), 0)

    const candidates = companies
      .filter((company) => !hiddenRows.includes(company.id))
      .map((company) => ({
        ...company,
        head: withCount(company.head, countOf(company.locationIds)),
        locations: company.locations
          .filter((location) => !hiddenRows.includes(location.id))
          .map((location) => withCount(location, countOf([location.id]))),
      }))

    const ordered = applyFilters(
      candidates.map((company) => company.head),
      clientOnlyFilters(cfg.filters, SUPPLIER_FILTERS),
      clientOnlySort(cfg.sort, SUPPLIER_SORTS),
    )
    const byId = new Map(candidates.map((company) => [company.id, company]))
    return ordered.map((row) => byId.get(row.id)!).filter(Boolean)
  }, [companies, counts, hiddenRows, cfg.filters, cfg.sort])

  const toggleCompany = (id: number) =>
    setExpandedCompanies((prev) =>
      prev.includes(id) ? prev.filter((companyId) => companyId !== id) : [...prev, id],
    )

  /** "2 of 5 farms" — only worth saying when the company has more than one. */
  const farmLabel = (company: SupplierCompany) =>
    company.locationCount > 1
      ? `${company.matchedCount} of ${company.locationCount} farms`
      : null

  const optionList = useCallback(
    (key: string) => [...(facets[key] ?? [])].sort(compareOptions(key)),
    [facets],
  )

  const hasFilters = Object.keys(cfg.filters).length > 0 || !!query

  const clearAll = () => {
    // The sheet exposes Clear all even when no criterion is active. If mobile
    // has appended pages, restore the committed first page immediately rather
    // than waiting for a debounced query change that may never happen.
    loadRequestId.current += 1
    setPage(1)
    setLoadingMore(false)
    setLoadMoreError(false)
    setExpandedCompanies([])
    if (!hasFilters) setCompanies((current) => current.slice(0, 50))
    setQuery('')
    cfg.clearFilters()
  }

  const loadMore = async () => {
    if (loadingMore || page >= pageCount) return
    const nextPage = page + 1
    const requestKey = activeRequestKey.current
    const requestId = ++loadRequestId.current
    const filterSuffix = debouncedServerQuery ? `&${debouncedServerQuery}` : ''
    setLoadingMore(true)
    setLoadMoreError(false)
    try {
      const body = await fetchSupplierPage(
        `/api/suppliers?q=${encodeURIComponent(debouncedQuery)}&page=${nextPage}${filterSuffix}`,
      )
      if (activeRequestKey.current !== requestKey || loadRequestId.current !== requestId) return
      setCompanies((current) => appendSupplierPage(current, body.companies ?? []))
      if (body.total != null) setTotal(body.total)
      if (body.pageCount != null) setPageCount(body.pageCount)
      // Commit only after the exact bounded page succeeded. An HTTP/network
      // failure leaves this unchanged, so Retry requests this same page.
      setPage(nextPage)
    } catch {
      if (activeRequestKey.current === requestKey && loadRequestId.current === requestId) {
        setLoadMoreError(true)
      }
    } finally {
      setLoadingMore(false)
    }
  }

  const toolbar = (rightActions: React.ReactNode) => (
    <Toolbar
      rightActions={rightActions}
      placeholder="Search name, contact, email, city…"
      query={query}
      onQuery={setQuery}
      controls={
        <SupplierFilters
          mobile={isMobile}
          filters={cfg.filters}
          options={optionList}
          onFilter={(key, value) => cfg.setColFilter(key, value)}
          onClear={clearAll}
        />
      }
      hasFilters={hasFilters}
      onClear={clearAll}
      summary={
        searching
          ? 'Searching…'
          : `${visibleCompanies.length}/${total} Companies`
      }
      pagination={isMobile ? undefined : { page, pageCount, onPage: setPage, busy: searching }}
    />
  )

  const tableWidth = EXPAND_W + ACTIONS_W + cfg.visible.reduce((n, c) => n + cfg.widthOf(c), 0)

  const mobileCard = (
    row: SupplierRow,
    { company, expanded, onToggle }: {
      /** Present on the company row; absent on a farm nested under it. */
      company?: SupplierCompany
      expanded?: boolean
      onToggle?: () => void
    } = {},
  ) => (
    <div key={row.id} className={company ? '' : 'border-t border-lps-hair bg-lps-tint/40 pl-3'}>
      <div className="relative">
        <button
          type="button"
          onClick={() => router.push(`/suppliers/${row.id}`)}
          className="flex w-full flex-col gap-2 p-3.5 text-left"
        >
          <div className="flex items-start justify-between gap-2.5">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[14px] font-bold leading-tight">
                <span className="min-w-0 truncate">{String(row.values.name ?? '')}</span>
                {!!row.values.is_lps_partner && <LpsTag />}
              </div>
              <div className="text-[12px] text-muted-foreground">
                {[row.values.city, row.values.state].filter(Boolean).join(', ') || 'No address on file'}
              </div>
            </div>
            <div className="flex flex-none flex-col items-end gap-[3px] text-right">
              <div className="text-[16px] font-bold tabular-nums">
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
          <span className="text-[13px] font-semibold text-primary">
            {company && company.locationCount > 1 ? 'Open company →' : 'Open supplier →'}
          </span>
        </button>
        {/* The company's two conversations, outside the card's own button — a
            button within a button is not a button. The nested farm rows carry
            no pair: they are locations of the company whose threads these are. */}
        {company && (
          <div className="absolute bottom-3 right-3.5 flex items-center gap-1.5">
            {supplierAgentThreads(row.values).map(({ agentId, threadId }) => (
              <AgentChatButton
                key={agentId}
                agentId={agentId}
                threadId={threadId}
                label={company.name}
                subject={company.name}
                size={24}
              />
            ))}
          </div>
        )}
      </div>
      {company && onToggle && company.locationCount > 1 && (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={!!expanded}
          className="flex w-full items-center gap-2 border-t border-lps-hair bg-lps-tint px-3.5 py-2 text-left text-[12px] font-semibold text-muted-foreground"
        >
          <ChevronDown size={14} className={expanded ? '' : '-rotate-90'} />
          {farmLabel(company)}
        </button>
      )}
    </div>
  )

  const desktopRow = (
    row: SupplierRow,
    { company, expanded, onToggle }: {
      company?: SupplierCompany
      expanded?: boolean
      onToggle?: () => void
    } = {},
  ) => {
    const expandable = !!company && company.locationCount > 1
    return (
      <tr key={row.id} className="lps-row h-[48px] bg-card transition-colors hover:bg-muted">
        <td
          className="border-b border-lps-hair p-0 align-middle"
          style={{ width: EXPAND_W, minWidth: EXPAND_W }}
        >
          {expandable ? (
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={!!expanded}
              aria-label={expanded ? `Collapse ${company!.name}'s farms` : `Show ${company!.name}'s farms`}
              title={farmLabel(company!) ?? undefined}
              className="inline-flex size-[26px] cursor-pointer items-center justify-center rounded-[7px] border-none bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <ChevronDown size={14} className={expanded ? '' : '-rotate-90'} />
            </button>
          ) : (
            // A farm row: the rule marks it as sitting under the row above.
            !company && <span className="mx-auto block h-full w-px bg-lps-edge" />
          )}
        </td>
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
              tag={col.kind === 'link' && row.values.is_lps_partner ? <LpsTag /> : undefined}
              onOpen={col.kind === 'link' ? () => router.push(`/suppliers/${row.id}`) : undefined}
              onSave={col.edit ? (next) => saveCell(row, col, next) : undefined}
            />
          </td>
        ))}
        <td
          className="sticky right-0 z-10 border-b border-l border-lps-hair bg-card p-[4px_6px]"
          style={{ width: ACTIONS_W, minWidth: ACTIONS_W }}
        >
          <div className="flex items-center justify-end gap-1.5">
            {company &&
              supplierAgentThreads(row.values).map(({ agentId, threadId }) => (
                <AgentChatButton
                  key={agentId}
                  agentId={agentId}
                  threadId={threadId}
                  label={company.name}
                  subject={company.name}
                  size={22}
                />
              ))}
            <button
              type="button"
              onClick={() => setHiddenRows((prev) => [...prev, row.id])}
              title={company ? 'Hide company until refresh' : 'Hide farm until refresh'}
              aria-label={company ? 'Hide company' : 'Hide farm'}
              className="inline-flex size-[26px] cursor-pointer items-center justify-center rounded-[7px] border-none bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <EyeOffIcon size={14} />
            </button>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <Shell page="suppliers" title="Suppliers" toolbar={toolbar} hideHeaderOnMobile hideHeaderOnDesktop>
      {isMobile ? (
        <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-auto p-3 pb-5">
          {visibleCompanies.map((company) => {
            const open = expandedCompanies.includes(company.id)
            return (
              <div
                key={company.id}
                // A long result page must scroll; without flex-none, flexbox
                // shrinks every card to its borders and overflow-hidden clips
                // all content into the horizontal lines seen on mobile.
                className="flex-none overflow-hidden rounded-xl border border-border bg-card"
              >
                {mobileCard(company.head, {
                  company,
                  expanded: open,
                  onToggle: () => toggleCompany(company.id),
                })}
                {open && company.locations.map((location) => mobileCard(location))}
              </div>
            )
          })}
          {!searching && visibleCompanies.length === 0 && (
            <div className="p-12 text-center text-[13px] text-muted-foreground">Nothing matches these filters.</div>
          )}
          {!searching && visibleCompanies.length > 0 && page < pageCount && (
            <div className="flex flex-none flex-col items-center gap-1.5">
              {loadMoreError && (
                <p role="alert" className="text-[12px] text-destructive">Couldn’t load more suppliers.</p>
              )}
              <button
                type="button"
                disabled={loadingMore}
                onClick={loadMore}
                className="min-h-11 rounded-lg px-4 text-[12px] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-60"
              >
                {loadingMore ? 'Loading…' : loadMoreError ? 'Retry load 50 more' : 'Load 50 more'}
              </button>
            </div>
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
                  <th
                    className="sticky top-0 z-20 border-b border-border bg-lps-headrow p-0"
                    style={{ width: EXPAND_W, minWidth: EXPAND_W }}
                  >
                    <span className="sr-only">Expand company</span>
                  </th>
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
                        onSort={() => cfg.cycleSort(col.key)}
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
                {visibleCompanies.map((company) => {
                  const open = expandedCompanies.includes(company.id)
                  return (
                    <Fragment key={company.id}>
                      {desktopRow(company.head, {
                        company,
                        expanded: open,
                        onToggle: () => toggleCompany(company.id),
                      })}
                      {open && company.locations.map((location) => desktopRow(location))}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>

            {!searching && visibleCompanies.length === 0 && (
              <div className="flex flex-col items-center gap-2 px-5 py-14 text-center">
                <span className="text-[14px] font-semibold">Nothing matches these filters</span>
                <span className="text-[13px] text-muted-foreground">
                  Clear a column filter, or search a common name — search is typo-tolerant.
                </span>
              </div>
            )}
          </div>

          {hiddenRows.length > 0 && (
            <div className="flex flex-none items-center gap-2.5 border-t border-border bg-lps-tint px-3 py-[7px] text-[12px] text-muted-foreground">
              <span>{hiddenRows.length} row{hiddenRows.length === 1 ? '' : 's'} hidden</span>
              <button
                type="button"
                onClick={() => setHiddenRows([])}
                className="cursor-pointer border-none bg-transparent text-[12px] font-semibold text-primary underline"
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
