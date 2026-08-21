'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  ChevronDown, ChevronRight, CloseIcon, MapPinIcon,
} from '@/components/workspace/icons'
import { EditableText, patchRow } from '@/components/workspace/editable'
import {
  DemandSummary,
  NOTE_KIND,
  RequestBody,
  StatusPill,
  newestNote,
} from '@/components/workspace/job-request'
import { Shell, useToast } from '@/components/workspace/shell'
import { useOutsideClose } from '@/components/workspace/table-parts'
import { Toolbar, type Chip } from '@/components/workspace/toolbar'
import { formatDate } from '@/lib/format'
import { shortStamp } from '@/lib/notes'
import {
  ITEM_STATUS_OPTIONS,
  REQUEST_STATUS_OPTIONS,
  itemPill,
  requestRef,
  requestStatusLabel,
  requestStatusTone,
  toneDot,
  toneStyle,
} from '@/lib/job-requests'
import type { JobRequestFacets, JobRequestRow } from '@/lib/rows'
import { useDebouncedSearch } from '@/lib/use-debounced'
import { cn } from '@/lib/utils'

const DATE_RANGES = [
  { label: 'Today', days: 1 },
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 14 days', days: 14 },
  { label: 'Last 30 days', days: 30 },
]
const daysFor = (label: string) => DATE_RANGES.find((r) => r.label === label)?.days

const EMPTY_FACETS: JobRequestFacets = { size: [], customer: [] }

/**
 * What the Status chip starts on: every status but Archived.
 *
 * An archived request is one somebody has already finished with, and there are
 * only ever more of them. The chip is a plain multi-select, so this is a
 * starting selection and not a rule — ticking Archived brings them back.
 */
const OPEN_STATUSES = REQUEST_STATUS_OPTIONS.filter((o) => o.value !== 'archived').map(
  (o) => o.label,
)
const sameSet = (a: string[], b: string[]) =>
  a.length === b.length && a.every((v) => b.includes(v))

/** Option labels back to the values the API filters on. */
const valuesOf = (labels: string[], options: { value: string; label: string }[]) =>
  labels.map((l) => options.find((o) => o.label === l)?.value).filter(Boolean) as string[]

function RequestCard({
  request,
  expanded,
  selected,
  version,
  onToggle,
  onSelect,
  onSaved,
}: {
  request: JobRequestRow
  expanded: boolean
  /** Every selected line id on the page; the card reads its own out of it. */
  selected: Set<number>
  /** Bumped after every write — what makes an open history drawer refresh. */
  version: number
  onToggle: () => void
  /** Select or clear these line ids; the page owns the set. */
  onSelect: (ids: number[], on: boolean) => void
  onSaved: () => void
}) {
  // The second level of expansion, kept on the card: opening a request's
  // details is a fact about looking at that card, not about the page, and the
  // card stays mounted while its lines collapse and reopen.
  const [detailsOpen, setDetailsOpen] = useState(false)

  const tone = requestStatusTone(request.status)
  const customerName = request.customer?.company || request.customer?.name
  const contact = request.customer?.company && request.customer.name ? request.customer.name : null
  const edit = { table: 'job_requests', id: request.id, onSaved }

  // The head keeps only where it is going; the street lives in the drawer.
  const locality = [
    request.shipping.city ?? request.billing.city,
    request.shipping.state ?? request.billing.state,
  ]
    .filter(Boolean)
    .join(', ')

  const latest = newestNote(request.notes)

  return (
    <div
      // `flex-none` matters: as a flex child this card would otherwise be
      // *shrunk* to fit the scroll container, and because it clips its own
      // overflow (for the rounded corners) the line table would be cut off
      // with nothing to scroll it back into view.
      className="flex-none overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md"
    >
      {/* The head is a div, not a button: it carries the status picker, and a
          button inside a button is invalid HTML. The chevron is the
          keyboard-reachable control; clicking the head also toggles. */}
      <div onClick={onToggle} className="flex cursor-pointer flex-col gap-1.5 px-3.5 py-2.5 hover:bg-lps-tint">
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            aria-expanded={expanded}
            aria-label={`${expanded ? 'Collapse' : 'Expand'} ${requestRef(request.id)}`}
            onClick={(e) => {
              e.stopPropagation()
              onToggle()
            }}
            className="flex size-5 flex-none cursor-pointer items-center justify-center rounded-md border-none bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
          <span className="text-[13.5px] font-bold tracking-tight text-primary">
            {requestRef(request.id)}
          </span>
          {/* What the job is called. Unnamed requests show nothing here rather
              than a stand-in: `JR-<id>` beside it is already their name. */}
          <span
            className="min-w-0 max-w-[22rem] truncate text-[13.5px] font-semibold text-foreground"
            onClick={(e) => e.stopPropagation()}
          >
            <EditableText
              {...edit}
              column="name"
              value={request.name}
              placeholder="Name this job"
              title="Click to rename this job"
            />
          </span>
          <StatusPill
            {...edit}
            column="status"
            value={request.status}
            label={requestStatusLabel(request.status)}
            tone={tone}
            options={REQUEST_STATUS_OPTIONS}
          />
          <span
            className="ml-auto whitespace-nowrap text-[11px] text-lps-dim"
            title={`Created ${formatDate(request.createdAt)}`}
          >
            {formatDate(request.updatedAt)}
          </span>
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 pl-[30px] text-[12px]">
          <span className="font-semibold text-foreground">
            {customerName ?? <span className="italic text-muted-foreground">Unassigned customer</span>}
          </span>
          {contact && <span className="text-muted-foreground">· {contact}</span>}
          {locality && (
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <MapPinIcon size={11} /> {locality}
            </span>
          )}
        </div>

        {/* Collapsed cards keep the same scan strip. The expanded body owns the
            single full-width strip so counts and subtotal are never repeated. */}
        {!expanded && (
          <div className="pl-[30px]">
            <DemandSummary
              lineTotal={request.lineTotal}
              itemCount={request.itemCount}
              counts={request.statusCounts}
            />
          </div>
        )}

        {/* The expanded body gives notes their complete secondary drawer; the
            collapsed card keeps only the latest line for triage. */}
        {!expanded && latest && (
          <div
            className="flex min-w-0 items-baseline gap-2 border-t border-lps-hair pl-[30px] pt-2"
            title={latest.text}
          >
            <span
              className="flex-none rounded-full px-1.5 py-px text-[9.5px] font-bold uppercase tracking-wide"
              style={toneStyle(NOTE_KIND[latest.kind].tone)}
            >
              {NOTE_KIND[latest.kind].label}
            </span>
            <span className="min-w-0 truncate text-[11.5px] text-muted-foreground">
              {latest.text}
            </span>
            {latest.stamp && (
              <span className="ml-auto flex-none whitespace-nowrap text-[10.5px] text-lps-dim">
                {shortStamp(latest.stamp)}
              </span>
            )}
          </div>
        )}
      </div>

      {expanded && (
        <RequestBody
          request={request}
          version={version}
          detailsOpen={detailsOpen}
          onToggleDetails={() => setDetailsOpen((v) => !v)}
          selected={selected}
          onSelect={onSelect}
          onSaved={onSaved}
        />
      )}
    </div>
  )
}

/** The selected lines of one request — an availability request is per job. */
interface ARGroup {
  requestId: number
  label: string
  itemIds: number[]
}

/**
 * Send the selected lines to an onboarded supplier as an availability request.
 *
 * One request per job: a selection spanning several jobs creates one per job,
 * because `availability_requests` ties a supplier's answer to the job it is
 * for. Only onboarded suppliers are offered — everyone else is reached through
 * their conversation thread (via daisy), not a portal they will never open.
 */
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
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void (async () => {
      const res = await fetch('/api/availability-requests/suppliers')
      if (res.ok) {
        const body = (await res.json()) as { suppliers: typeof suppliers }
        setSuppliers(body.suppliers)
      }
      setLoaded(true)
    })().catch(() => setLoaded(true))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const create = async () => {
    if (supplierId == null) return
    setBusy(true)
    const results = await Promise.allSettled(
      groups.map((g) =>
        fetch('/api/availability-requests', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            jobRequestId: g.requestId,
            supplierId,
            shareCustomerDetails: share,
            itemIds: g.itemIds,
          }),
        }).then(async (res) => {
          if (!res.ok) {
            const body = (await res.json().catch(() => ({}))) as { error?: string }
            throw new Error(body.error ?? 'failed')
          }
        }),
      ),
    )
    setBusy(false)
    const failed = results.filter((r) => r.status === 'rejected').length
    if (failed) {
      toast(`${groups.length - failed} of ${groups.length} sent · ${failed} failed`)
    } else {
      toast(
        groups.length === 1
          ? 'Availability request sent'
          : `${groups.length} availability requests sent`,
      )
    }
    onCreated()
    onClose()
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
              One request per job will be created.
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
              No onboarded suppliers yet — mark one as{' '}
              <em>Portal onboarded</em> on their profile first.
            </span>
          )}
        </label>

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
            disabled={busy || supplierId == null}
            className="cursor-pointer rounded-full bg-primary px-4 py-1.5 text-[12px] font-bold text-primary-foreground disabled:opacity-50"
          >
            {busy ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * What can be done to a set of selected lines.
 *
 * Every action here is a write this app already owns. The design also offers
 * Email quote, Text quote, PDF quote and Place order; none of those are wired,
 * because none of them exist yet — rosie has no mailbox and may not contact a
 * customer unbidden (`docs/harness/agent-rosie.md`), and the order tables are
 * deferred by migration 0055. Buttons that only looked like they sent
 * something would be worse than their absence. Send availability request *is*
 * wired since migration 0062 — it writes `availability_requests`, which is a
 * database row an onboarded supplier reads in their portal, not outreach.
 */
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

export default function RequestsPage() {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<string[]>(OPEN_STATUSES)
  const [itemStatus, setItemStatus] = useState<string[]>([])
  const [customer, setCustomer] = useState<string[]>([])
  const [created, setCreated] = useState<string[]>([])
  const [updated, setUpdated] = useState<string[]>([])
  const [page, setPage] = useState(1)

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
  /** Bumped after a write, to refetch the page and everything derived from it. */
  const [reloads, setReloads] = useState(0)
  const reload = useCallback(() => setReloads((n) => n + 1), [])

  const customerIds = useMemo(() => {
    const map = new Map<string, number>()
    for (const c of facets.customer) map.set(c.company || c.name, c.id)
    return map
  }, [facets.customer])

  const serverQuery = useMemo(() => {
    const p = new URLSearchParams()
    // Every list filter goes over as a comma-separated set, which is what the
    // route has always parsed; an empty one is left off and means "all".
    if (status.length) p.set('status', valuesOf(status, REQUEST_STATUS_OPTIONS).join(','))
    if (itemStatus.length) p.set('itemStatus', valuesOf(itemStatus, ITEM_STATUS_OPTIONS).join(','))
    if (customer.length) {
      p.set('customer', customer.map((c) => customerIds.get(c)).filter(Boolean).join(','))
    }
    // The date chips are single-pick: two ranges back from now are one range.
    if (created.length) p.set('created', String(daysFor(created[0]) ?? ''))
    if (updated.length) p.set('updated', String(daysFor(updated[0]) ?? ''))
    return p.toString()
  }, [status, itemStatus, customer, created, updated, customerIds])

  const { query: debounced, filters: debouncedFilters, settled } = useDebouncedSearch(query, serverQuery)

  // Reset to page 1 during render when the result set changes underneath, so a
  // stale page never costs a second request — the pattern the other lists use.
  const searchKey = `${debounced}|${debouncedFilters}`
  const [lastKey, setLastKey] = useState(searchKey)
  if (searchKey !== lastKey) {
    setLastKey(searchKey)
    setPage(1)
  }

  useEffect(() => {
    let cancelled = false
    fetch('/api/requests?facets=1')
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || d.error) return
        setFacets(d.facets ?? EMPTY_FACETS)
        setSummary(d.summary ?? { requests: 0, items: 0 })
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [reloads])

  useEffect(() => {
    let cancelled = false
    setBusy(true)
    const params = new URLSearchParams(debouncedFilters)
    params.set('q', debounced)
    params.set('page', String(page))
    fetch(`/api/requests?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return
        if (d.error) {
          setError(d.error)
          setRequests([])
          return
        }
        setError('')
        setRequests(d.requests ?? [])
        setTotal(d.total ?? 0)
        setPageCount(d.pageCount ?? 1)
      })
      .catch((e) => {
        if (!cancelled) setError(String(e))
      })
      .finally(() => {
        if (!cancelled) setBusy(false)
      })
    return () => {
      cancelled = true
    }
  }, [debounced, debouncedFilters, page, reloads])

  // A search or an item filter is asking about *lines*, so the cards that
  // matched open themselves — otherwise the answer is hidden behind a chevron.
  const drillingIn = debounced.trim() !== '' || itemStatus.length > 0
  useEffect(() => {
    if (drillingIn) setExpanded(new Set(requests.map((r) => r.id)))
  }, [drillingIn, requests])

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
      options: DATE_RANGES.map((r) => r.label),
      onChange: setCreated,
      allLabel: 'All time',
      single: true,
    },
    {
      label: 'Updated',
      values: updated,
      options: DATE_RANGES.map((r) => r.label),
      onChange: setUpdated,
      allLabel: 'All time',
      single: true,
    },
  ]

  // "Clear all" returns the page to how it opens — which is not "no filters at
  // all", since the Status chip opens with Archived left out.
  const hasFilters =
    !sameSet(status, OPEN_STATUSES) ||
    itemStatus.length > 0 ||
    customer.length > 0 ||
    created.length > 0 ||
    updated.length > 0 ||
    query !== ''

  const clearAll = () => {
    setQuery('')
    setStatus(OPEN_STATUSES)
    setItemStatus([])
    setCustomer([])
    setCreated([])
    setUpdated([])
  }

  return (
    <Shell
      page="requests"
      title="Job Requests"
      subtitle={`${summary.requests} open ${summary.requests === 1 ? 'request' : 'requests'} · ${summary.items} line items`}
      toolbar={
        <Toolbar
          placeholder="Search plants, customers, JR-…"
          query={query}
          onQuery={setQuery}
          chips={chips}
          hasFilters={hasFilters}
          onClear={clearAll}
          summary={`${total} ${total === 1 ? 'request' : 'requests'}`}
          pagination={{ page, pageCount, onPage: setPage, busy }}
          controls={
            <>
              <button
                type="button"
                onClick={() =>
                  setExpanded(allExpanded ? new Set() : new Set(requests.map((r) => r.id)))
                }
                className="cursor-pointer rounded-full border border-border bg-card px-[11px] py-[5px] text-[12px] font-semibold text-muted-foreground"
              >
                {allExpanded ? 'Collapse all' : 'Expand all'}
              </button>
            </>
          }
        />
      }
    >
      {/* The Shell hands its children a fixed, overflow-hidden box, so this is
          the scroll container. Without `min-h-0 flex-1 overflow-auto` the cards
          push past its bottom edge with nothing to scroll them back. */}
      <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-auto p-3 pb-5 md:p-4">
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
        {arDialogOpen && (
          <AvailabilityRequestDialog
            // Selected lines grouped by their request — an availability
            // request is per job, so a cross-job selection creates one each.
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
            selected={selected}
            version={reloads}
            onToggle={() => toggle(request.id)}
            onSelect={select}
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
