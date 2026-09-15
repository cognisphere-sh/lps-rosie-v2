'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { ChevronDown, CloseIcon } from '@/components/workspace/icons'
import {
  onAvailabilityRequestStatusChanged,
  onRenameThread,
} from '@/lib/chat-bus'
import { patchRow } from '@/components/workspace/editable'
import { DeleteRequestDialog, deleteRequestFromApi } from '@/components/workspace/request-delete'
import { RequestCard } from '@/components/workspace/request-list-card'
import { Shell, useToast } from '@/components/workspace/shell'
import { useOutsideClose } from '@/components/workspace/table-parts'
import {
  RequestsToolbar,
  useResolvedRequestsMobile,
} from '@/components/workspace/requests-toolbar'
import type { Chip } from '@/components/workspace/toolbar'
import { withAvailabilityRequestStatus } from '@/lib/availability'
import {
  ITEM_STATUS_OPTIONS,
  REQUEST_STATUS_OPTIONS,
  itemPill,
  requestRef,
  toneDot,
} from '@/lib/job-requests'
import {
  REQUEST_DATE_RANGES,
  buildRequestFilterQuery,
  buildRequestListUrl,
  normalizeStoredRequestStatusLabels,
} from '@/lib/request-list-state'
import { isApsSupplier } from '@/lib/orders'
import type { JobRequestFacets, JobRequestItem, JobRequestRow } from '@/lib/rows'
import { useDebouncedSearch } from '@/lib/use-debounced'
import { useJobUpdates } from '@/lib/use-job-updates'
import { cn } from '@/lib/utils'

const EMPTY_FACETS: JobRequestFacets = { size: [], customer: [] }
const REQUESTS_VISIT_STORE = 'lps.requests.visit.v1'

/** All current stages. Clearing the filter includes legacy archived jobs. */
const DEFAULT_STATUSES = ['Availability', 'Committed']
const sameSet = (a: string[], b: string[]) =>
  a.length === b.length && a.every((v) => b.includes(v))

/** The selected lines grouped by their source job. */
interface ARGroup {
  requestId: number
  label: string
  itemIds: number[]
}

/** Send selected lines from one or more jobs in a combined supplier request. */
function AvailabilityRequestDialog({
  groups,
  onClose,
  onCreated,
}: {
  groups: ARGroup[]
  onClose: () => void
  onCreated: () => void
}) {
  const toast = useToast()
  const [suppliers, setSuppliers] = useState<
    { id: number; name: string; city: string | null; state: string | null }[]
  >([])
  const [loaded, setLoaded] = useState(false)
  const [supplierId, setSupplierId] = useState<number | null>(null)
  const [share, setShare] = useState(false)
  const [consolidate, setConsolidate] = useState(false)
  const [quoteReady, setQuoteReady] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void (async () => {
      const res = await fetch('/api/availability-requests/suppliers')
      if (res.ok) {
        const body = (await res.json()) as { suppliers: typeof suppliers }
        setSuppliers(body.suppliers)
        setSupplierId(body.suppliers.find((supplier) => isApsSupplier(supplier.name))?.id ?? null)
      }
      setLoaded(true)
    })().catch(() => setLoaded(true))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const create = async () => {
    if (supplierId == null) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/availability-requests', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          jobRequestIds: groups.map((group) => group.requestId), supplierId,
          shareCustomerDetails: share, consolidateItems: consolidate,
          itemIds: groups.flatMap((group) => group.itemIds),
        }),
      })
      const body = await res.json() as { error?: string }
      if (!res.ok) throw new Error(body.error ?? 'Could not create availability request')
      toast('Availability request created')
      onCreated()
      onClose()
    } catch (e) { setError((e as Error).message) }
    finally { setBusy(false) }
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-[440px] flex-col gap-3 rounded-2xl border border-border bg-popover p-4 shadow-[var(--lps-shadow)]"
      >
        <span className="text-[14px] font-bold text-foreground">Send availability request</span>
        <div className="flex flex-col gap-1 rounded-lg border border-lps-hair bg-lps-bubble p-2.5">
          {groups.map((g) => (
            <span key={g.requestId} className="text-[12px] text-foreground">
              <strong>{g.label}</strong> · {g.itemIds.length}{' '}
              {g.itemIds.length === 1 ? 'line' : 'lines'}
            </span>
          ))}
          {groups.length > 1 && (
            <span className="text-[11px] text-muted-foreground">
              One combined availability request will be created.
            </span>
          )}
        </div>

        <label className="flex flex-col gap-0.5">
          <span className="text-[10.5px] font-bold uppercase tracking-[.05em] text-muted-foreground">
            Supplier
          </span>
          <select
            value={supplierId ?? ''}
            onChange={(e) => setSupplierId(e.target.value ? Number(e.target.value) : null)}
            className="h-9 cursor-pointer rounded-md border border-input bg-background px-2 text-[13px] outline-none"
          >
            <option value="">Choose a supplier…</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.city ? ` — ${[s.city, s.state].filter(Boolean).join(', ')}` : ''}
              </option>
            ))}
          </select>
          {loaded && suppliers.length === 0 && (
            <span className="text-[11.5px] text-muted-foreground">
              No LPS Partners yet — mark one as an{' '}
              <em>LPS Partner</em> on their profile first.
            </span>
          )}
        </label>

        <p className="text-[12px] text-muted-foreground">Generate the quote using APS pricing first. Quick quotes stop at Quote; send availability only when Chris approves.</p>
        <label className="flex items-center gap-2 text-[12.5px]">
          <input type="checkbox" checked={quoteReady} onChange={(event) => setQuoteReady(event.target.checked)} />
          Quote prepared; Chris approved sending availability
        </label>
        {groups.length > 1 && <label className="flex items-center gap-2 text-[12.5px]">
          <input type="checkbox" checked={consolidate} onChange={(event) => setConsolidate(event.target.checked)} />
          Combine identical plant lines across jobs
        </label>}
        {error && <p role="alert" className="text-[12px] text-destructive">{error}</p>}
        <label className="flex cursor-pointer items-center gap-2 text-[12.5px] text-foreground">
          <input
            type="checkbox"
            checked={share}
            onChange={(e) => setShare(e.target.checked)}
            className="size-4 accent-[var(--primary)]"
          />
          Share customer details with the supplier
        </label>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-full border border-border bg-card px-4 py-1.5 text-[12px] font-semibold text-foreground"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void create()}
            disabled={busy || supplierId == null || !quoteReady}
            className="cursor-pointer rounded-full bg-primary px-4 py-1.5 text-[12px] font-bold text-primary-foreground disabled:opacity-50"
          >
            {busy ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  )
}

/** Bulk status edits and combined availability requests; Orders live on each job. */
function SelectionBar({
  ids,
  onClear,
  onSaved,
  onAvailabilityRequest,
}: {
  ids: number[]
  onClear: () => void
  onSaved: () => void
  onAvailabilityRequest: () => void
}) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [menu, setMenu] = useState(false)
  const pop = useOutsideClose(menu, () => setMenu(false))

  const apply = async (column: string, value: string, done: string) => {
    setMenu(false)
    setBusy(true)
    // `allSettled`, not `all`: one rejected line must not hide the ones that
    // went through, and the count of failures is what the toast should say.
    const results = await Promise.allSettled(
      ids.map((id) => patchRow('job_request_items', id, column, value)),
    )
    const failed = results.filter((r) => r.status === 'rejected').length
    setBusy(false)
    onSaved()
    if (failed) {
      toast(`${ids.length - failed} of ${ids.length} updated · ${failed} failed`)
      return
    }
    toast(`${done} · ${ids.length} ${ids.length === 1 ? 'line' : 'lines'}`)
    onClear()
  }

  return (
    <div className="lps-pop sticky top-0 z-[60] flex flex-none flex-wrap items-center gap-2 rounded-xl border border-lps-edge bg-secondary px-3 py-2">
      <span className="whitespace-nowrap text-[13px] font-bold text-foreground">
        {ids.length} selected
      </span>
      <span className="h-[22px] w-px bg-lps-edge" />
      <div ref={pop} data-menu className="relative">
        <button
          type="button"
          disabled={busy}
          onClick={() => setMenu((v) => !v)}
          className="flex cursor-pointer items-center gap-1.5 rounded-full border border-border bg-card px-[11px] py-[5px] text-[12px] font-semibold text-foreground disabled:opacity-50"
        >
          Set status <ChevronDown size={12} />
        </button>
        {menu && (
          <div className="lps-pop absolute left-0 top-[calc(100%+6px)] z-[80] min-w-[190px] rounded-xl border border-border bg-popover p-1.5 shadow-[var(--lps-shadow)]">
            {ITEM_STATUS_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => void apply('status', o.value, `Set to ${o.label}`)}
                className="flex w-full cursor-pointer items-center gap-2 rounded-lg border-none bg-transparent px-2 py-1.5 text-left text-[12.5px] text-muted-foreground hover:bg-muted"
              >
                <span
                  className="size-2 flex-none rounded-full"
                  style={{ background: toneDot(itemPill(o.value, null, null).tone) }}
                />
                {o.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={onAvailabilityRequest}
        className="flex cursor-pointer items-center gap-1.5 rounded-full border border-border bg-card px-[11px] py-[5px] text-[12px] font-semibold text-foreground disabled:opacity-50"
      >
        Availability request
      </button>
      <button
        type="button"
        onClick={onClear}
        className="ml-auto flex cursor-pointer items-center gap-1.5 rounded-full border-none bg-transparent px-2 py-[5px] text-[12px] font-semibold text-muted-foreground hover:text-foreground"
      >
        Clear <CloseIcon size={11} />
      </button>
    </div>
  )
}

/** "3 lines, 2 availability requests and their answers, its change history". */
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`


export default function RequestsPage() {
  const toast = useToast()
  const requestsMobile = useResolvedRequestsMobile()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<string[]>(DEFAULT_STATUSES)
  // Desktop owns Item status. Mobile always queries all item statuses while
  // this value remains parked for a truthful return to desktop/session restore.
  const [itemStatus, setItemStatus] = useState<string[]>([])
  const [customer, setCustomer] = useState<string[]>([])
  const [created, setCreated] = useState<string[]>([])
  const [updated, setUpdated] = useState<string[]>([])
  const [page, setPage] = useState(1)
  // Gate the first list fetch until this tab's last management view is
  // validated and restored; otherwise defaults flash and make a wasted fetch.
  const [restored, setRestored] = useState(false)
  const pendingCustomer = useRef<string[]>([])
  const didRestore = useRef(false)

  const [requests, setRequests] = useState<JobRequestRow[]>([])
  const [total, setTotal] = useState(0)
  const [pageCount, setPageCount] = useState(1)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [facets, setFacets] = useState<JobRequestFacets>(EMPTY_FACETS)
  const [summary, setSummary] = useState({ requests: 0, items: 0 })
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  /** Selected line ids, across every card on the page. */
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [arDialogOpen, setArDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<JobRequestRow | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const deleteReturnFocus = useRef<HTMLElement | null>(null)
  const requestList = useRef<HTMLDivElement>(null)
  /** Bumped after a write, to refetch the page and everything derived from it. */
  const [reloads, setReloads] = useState(0)
  const reload = useCallback(() => setReloads((n) => n + 1), [])
  const [dataVersion, setDataVersion] = useState(0)
  const listGeneration = useRef(0)
  const facetGeneration = useRef(0)

  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(REQUESTS_VISIT_STORE) ?? 'null') as Partial<{
        query: string; status: string[]; itemStatus: string[]; customer: string[]
        created: string[]; updated: string[]; page: number
      }> | null
      const allowedDates = new Set<string>(REQUEST_DATE_RANGES.map((option) => option.label))
      if (saved) {
        setQuery(typeof saved.query === 'string' ? saved.query.slice(0, 500) : '')
        setStatus(normalizeStoredRequestStatusLabels(saved.status, REQUEST_STATUS_OPTIONS, DEFAULT_STATUSES))
        setItemStatus(normalizeStoredRequestStatusLabels(saved.itemStatus, ITEM_STATUS_OPTIONS, []))
        pendingCustomer.current = Array.isArray(saved.customer) ? saved.customer.filter((v) => typeof v === 'string') : []
        setCreated(Array.isArray(saved.created) ? saved.created.filter((v) => allowedDates.has(v)).slice(0, 1) : [])
        setUpdated(Array.isArray(saved.updated) ? saved.updated.filter((v) => allowedDates.has(v)).slice(0, 1) : [])
        setPage(Number.isSafeInteger(saved.page) && (saved.page ?? 0) > 0 && (saved.page ?? 0) <= 10_000 ? saved.page! : 1)
      }
    } catch { /* malformed tab state falls back to defaults */ }
  }, [])

  useEffect(() => {
    if (!restored) return
    sessionStorage.setItem(REQUESTS_VISIT_STORE, JSON.stringify({ query, status, itemStatus, customer, created, updated, page }))
  }, [restored, query, status, itemStatus, customer, created, updated, page])

  // Job names are renamed from the chat panel's thread picker, not on this
  // page. That writes the name shown on these cards, so refetch it here.
  useEffect(
    () => onRenameThread(({ threadId }) => { if (threadId.startsWith('jr-')) reload() }),
    [reload],
  )

  // The drawer has already re-read the one AR it wrote. Patch its status/date into
  // the mounted cards instead of refetching the full request page and facets.
  useEffect(
    () => onAvailabilityRequestStatusChanged(({ arId, status, submittedAt }) => {
      setRequests((current) => current.map((request) => {
        const supplierLinks = withAvailabilityRequestStatus(request.supplierLinks, arId, status, submittedAt)
        return supplierLinks === request.supplierLinks ? request : { ...request, supplierLinks }
      }))
    }),
    [],
  )

  const customerIds = useMemo(() => {
    const map = new Map<string, number>()
    for (const c of facets.customer) map.set(c.company || c.name, c.id)
    return map
  }, [facets.customer])

  const effectiveItemStatus = requestsMobile === false ? itemStatus : []
  const serverQuery = useMemo(() => buildRequestFilterQuery({
    status,
    itemStatus: effectiveItemStatus,
    customer,
    created,
    updated,
    customerIds,
    requestStatusOptions: REQUEST_STATUS_OPTIONS,
    itemStatusOptions: ITEM_STATUS_OPTIONS,
  }), [status, effectiveItemStatus, customer, created, updated, customerIds])

  const { query: debounced, filters: debouncedFilters, settled } = useDebouncedSearch(query, serverQuery)

  // Reset to page 1 during render when the result set changes underneath, so a
  // stale page never costs a second request — the pattern the other lists use.
  const searchKey = `${debounced}|${debouncedFilters}`
  const [lastKey, setLastKey] = useState(searchKey)
  if (searchKey !== lastKey) {
    setLastKey(searchKey)
    setPage(1)
  }

  const loadFacets = useCallback(async () => {
    const mine = ++facetGeneration.current
    try {
      const response = await fetch('/api/requests?facets=1', { cache: 'no-store' })
      const data = await response.json()
      if (mine !== facetGeneration.current) return
      if (!response.ok || data.error) throw new Error(data.error ?? 'Could not load job filters')
      const nextFacets = data.facets ?? EMPTY_FACETS
      setFacets(nextFacets)
      setSummary(data.summary ?? { requests: 0, items: 0 })
      if (!didRestore.current) {
        didRestore.current = true
        const allowedCustomers = new Set(nextFacets.customer.map((c: { name: string; company: string | null }) => c.company || c.name))
        setCustomer(pendingCustomer.current.filter((name) => allowedCustomers.has(name)))
        setRestored(true)
      }
    } catch {
      if (mine === facetGeneration.current && !didRestore.current) {
        didRestore.current = true
        setRestored(true)
      }
    }
  }, [])

  useEffect(() => {
    void loadFacets()
    return () => { facetGeneration.current++ }
  }, [loadFacets, reloads])

  const loadRequests = useCallback(async () => {
    if (!restored || !settled || debounced !== query || debouncedFilters !== serverQuery) return
    const mine = ++listGeneration.current
    setBusy(true)
    try {
      const response = await fetch(buildRequestListUrl(debouncedFilters, debounced, page), { cache: 'no-store' })
      const data = await response.json()
      if (mine !== listGeneration.current) return
      if (!response.ok || data.error) throw new Error(data.error ?? 'Could not load jobs')
      setError('')
      setRequests(data.requests ?? [])
      setTotal(data.total ?? 0)
      const pages = data.pageCount ?? 1
      setPageCount(pages)
      if (page > Math.max(1, pages)) setPage(Math.max(1, pages))
      setDataVersion((n) => n + 1)
    } catch (cause) {
      // Keep mounted cards and drafts on transient background read failures.
      if (mine === listGeneration.current) setError(String(cause))
    } finally {
      if (mine === listGeneration.current) setBusy(false)
    }
  }, [debounced, debouncedFilters, page, restored, settled, query, serverQuery])

  useEffect(() => {
    void loadRequests()
    return () => { listGeneration.current++ }
  }, [loadRequests, reloads])

  useJobUpdates(() => Promise.all([loadFacets(), loadRequests()]))

  // A search or an item filter is asking about *lines*, so the cards that
  // matched open themselves — otherwise the answer is hidden behind a chevron.
  const drillingIn = debounced.trim() !== '' || effectiveItemStatus.length > 0
  const expansionBaseline = useRef({ key: '', ids: new Set<number>() })
  useEffect(() => {
    const key = `${searchKey}|${page}|${drillingIn}`
    const previous = expansionBaseline.current
    if (drillingIn) setExpanded((current) => {
      if (previous.key !== key) return new Set(requests.map((r) => r.id))
      const next = new Set(current)
      for (const request of requests) if (!previous.ids.has(request.id)) next.add(request.id)
      return next
    })
    expansionBaseline.current = { key, ids: new Set(requests.map((r) => r.id)) }
  }, [drillingIn, requests, searchKey, page])

  // A selection only means something over lines you can see. When a filter,
  // a search or a page turn changes what came back, anything that fell out of
  // view leaves the selection with it — otherwise "12 selected" would act on
  // rows nobody has in front of them.
  const visibleIds = useMemo(
    () => requests.flatMap((r) => r.items.map((i) => i.id)),
    [requests],
  )
  useEffect(() => {
    setSelected((prev) => {
      if (!prev.size) return prev
      const kept = new Set(visibleIds.filter((id) => prev.has(id)))
      return kept.size === prev.size ? prev : kept
    })
  }, [visibleIds])

  const select = useCallback((ids: number[], on: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev)
      for (const id of ids) {
        if (on) next.add(id)
        else next.delete(id)
      }
      return next
    })
  }, [])

  /** Delete a whole request after the explicit dialog confirms it. */
  const deleteRequest = useCallback(
    async (request: JobRequestRow) => {
      const ref = requestRef(request.id)
      setDeleteError('')
      setDeleting(true)
      try {
        const { ok, body } = await deleteRequestFromApi(request.id)
        if (!ok) {
          const message = `Could not delete ${ref}${body.error ? ` — ${body.error}` : ''}`
          setDeleteError(message)
          toast(message)
          return
        }
        const d = body.deleted
        toast(
          `${ref} deleted · ${plural(d?.items ?? 0, 'line')}` +
            (d?.availabilityRequests ? `, ${plural(d.availabilityRequests, 'availability request')}` : ''),
        )
        deleteReturnFocus.current = requestList.current
        setDeleteTarget(null)
        reload()
      } catch {
        const message = `Could not delete ${ref} — check your connection and try again.`
        setDeleteError(message)
        toast(message)
      } finally {
        setDeleting(false)
      }
    },
    [reload, toast],
  )

  /**
   * Delete one line — permanently. A supplier already asked about it keeps
   * their answer (`availability_request_items` is SET NULL, not cascaded), so
   * the confirm says so rather than letting it be a surprise afterwards.
   */
  const deleteItem = useCallback(
    async (request: JobRequestRow, item: JobRequestItem) => {
      const label = [item.name, item.size].filter(Boolean).join(' · ') || 'this line'
      // The card knows the job has suppliers engaged, not which lines they were
      // asked about — so this says what happens to an answer if there is one,
      // and the toast afterwards says how many there actually were.
      const kept = request.supplierLinks.length
        ? ' Any supplier answer about it is kept, no longer linked to a line.'
        : ''
      if (
        !window.confirm(
          `Delete ${label} from ${requestRef(request.id)} permanently?${kept} This cannot be undone.`,
        )
      ) {
        return
      }

      const res = await fetch(`/api/requests/${request.id}/items/${item.id}`, { method: 'DELETE' })
      const body = (await res.json().catch(() => ({}))) as {
        error?: string
        deleted?: { answers: number }
      }
      if (!res.ok) {
        toast(`Could not delete the line${body.error ? ` — ${body.error}` : ''}`)
        return
      }
      const answers = body.deleted?.answers ?? 0
      toast(
        'Line deleted' +
          (answers ? ` · ${plural(answers, 'supplier answer')} kept, no longer linked` : ''),
      )
      reload()
    },
    [reload, toast],
  )

  const toggle = useCallback((id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const allExpanded = requests.length > 0 && requests.every((r) => expanded.has(r.id))

  const chips: Chip[] = [
    {
      label: 'Status',
      values: status,
      options: REQUEST_STATUS_OPTIONS.map((o) => o.label),
      onChange: setStatus,
      allLabel: 'All statuses',
    },
    {
      label: 'Item status',
      values: itemStatus,
      options: ITEM_STATUS_OPTIONS.map((o) => o.label),
      onChange: setItemStatus,
      allLabel: 'All item statuses',
    },
    {
      label: 'Customer',
      values: customer,
      options: facets.customer.map((c) => c.company || c.name),
      onChange: setCustomer,
      allLabel: 'All customers',
    },
    {
      label: 'Created',
      values: created,
      options: REQUEST_DATE_RANGES.map((range) => range.label),
      onChange: setCreated,
      allLabel: 'All time',
      single: true,
    },
    {
      label: 'Updated',
      values: updated,
      options: REQUEST_DATE_RANGES.map((range) => range.label),
      onChange: setUpdated,
      allLabel: 'All time',
      single: true,
    },
  ]

  // "Clear all" returns the page to how it opens — which is not "no filters at
  // all", since the Status chip opens with Archived left out.
  const hasFilters =
    !sameSet(status, DEFAULT_STATUSES) ||
    effectiveItemStatus.length > 0 ||
    customer.length > 0 ||
    created.length > 0 ||
    updated.length > 0 ||
    query !== ''

  const clearAll = () => {
    setQuery('')
    setStatus(DEFAULT_STATUSES)
    if (requestsMobile === false) setItemStatus([])
    setCustomer([])
    setCreated([])
    setUpdated([])
  }

  return (
    <Shell
      page="requests"
      title="All jobs"
      hideHeaderOnMobile
      hideHeaderOnDesktop
      toolbar={(rightActions) => (
        <RequestsToolbar
          rightActions={rightActions}
          placeholder="Search plants, customers, JR-…"
          query={query}
          onQuery={setQuery}
          chips={chips}
          statusBaseline={DEFAULT_STATUSES}
          resolvedMobile={requestsMobile}
          hasFilters={hasFilters}
          onClear={clearAll}
          summary={`${total} ${total === 1 ? 'request' : 'requests'} · ${summary.items} line ${summary.items === 1 ? 'item' : 'items'}`}
          pagination={{ page, pageCount, onPage: setPage, busy }}
          controls={requestsMobile === false ? (
            <button
              type="button"
              onClick={() =>
                setExpanded(allExpanded ? new Set() : new Set(requests.map((r) => r.id)))
              }
              className="cursor-pointer rounded-full border border-border bg-card px-[11px] py-[5px] text-[12px] font-semibold text-muted-foreground"
            >
              {allExpanded ? 'Collapse all' : 'Expand all'}
            </button>
          ) : undefined}
        />
      )}
    >
      {/* The Shell hands its children a fixed, overflow-hidden box, so this is
          the scroll container. Without `min-h-0 flex-1 overflow-auto` the cards
          push past its bottom edge with nothing to scroll them back. */}
      <div
        ref={requestList}
        tabIndex={-1}
        aria-label="Job requests"
        className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-auto p-3 pb-5 outline-none md:p-4"
      >
        {error && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-[13px] text-destructive">
            {error}
          </div>
        )}
        {!error && !busy && requests.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <span className="text-[14px] font-semibold text-foreground">
              {hasFilters ? 'No job requests match these filters' : 'No job requests yet'}
            </span>
            <span className="text-[12.5px] text-muted-foreground">
              {hasFilters
                ? 'Try clearing the status, customer, or search filters.'
                : 'Requests appear here as Rosie takes them in.'}
            </span>
          </div>
        )}
        {selected.size > 0 && (
          <SelectionBar
            ids={[...selected]}
            onClear={() => setSelected(new Set())}
            onSaved={reload}
            onAvailabilityRequest={() => setArDialogOpen(true)}
          />
        )}
        {deleteTarget && (
          <DeleteRequestDialog
            request={deleteTarget}
            busy={deleting}
            error={deleteError}
            returnFocus={deleteReturnFocus}
            onCancel={() => {
              setDeleteError('')
              setDeleteTarget(null)
            }}
            onConfirm={() => void deleteRequest(deleteTarget)}
          />
        )}
        {arDialogOpen && (
          <AvailabilityRequestDialog
            // Each source job retains its allocation in the combined request.
            groups={requests.flatMap((r) => {
              const itemIds = r.items.filter((it) => selected.has(it.id)).map((it) => it.id)
              return itemIds.length
                ? [{ requestId: r.id, label: r.name ?? requestRef(r.id), itemIds }]
                : []
            })}
            onClose={() => setArDialogOpen(false)}
            onCreated={() => {
              setSelected(new Set())
              reload()
            }}
          />
        )}
        {requests.map((request) => (
          <RequestCard
            key={request.id}
            request={request}
            expanded={expanded.has(request.id)}
            mobile={requestsMobile}
            selected={selected}
            version={dataVersion}
            onToggle={() => toggle(request.id)}
            onSelect={select}
            onDelete={(returnFocus) => {
              deleteReturnFocus.current = returnFocus
              setDeleteError('')
              setDeleteTarget(request)
            }}
            onDeleteItem={(item) => deleteItem(request, item)}
            onSaved={reload}
          />
        ))}
        {(busy || !settled) && requests.length === 0 && (
          <div className="py-16 text-center text-[12.5px] text-muted-foreground">Loading…</div>
        )}
      </div>
    </Shell>
  )
}
