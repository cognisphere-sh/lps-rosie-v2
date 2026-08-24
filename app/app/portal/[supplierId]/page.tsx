'use client'

// The portal home: this supplier's availability requests as expandable cards,
// deliberately shaped like the admin app's Job Requests page — a toolbar
// (search, status and customer chips, sort, Expand all), collapsed cards that
// open in place to the line editor, and a Save per request that wakes daisy.
// The conversation is the docked chat sidebar (one thread per supplier), not
// part of any card. See app/api/portal/[supplierId]/route.ts for the auth
// caveat — these pages are outside the session gate until supplier auth lands.

import { useParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { ARLineTable, ARStatusPill } from '@/components/workspace/availability'
import { Toolbar, type Chip } from '@/components/workspace/toolbar'
import { ChevronDown, ChevronRight } from '@/components/workspace/icons'
import { PortalFrame } from '@/components/workspace/portal'
import {
  AR_RESPONSES,
  AR_RESPONSE_META,
  AR_STATUSES,
  arResponseLabel,
  arStatusLabel,
  arSubtotal,
  type ARDetail,
} from '@/lib/availability'
import { formatDate, money } from '@/lib/format'
import { toneDot } from '@/lib/job-requests'
import { cn } from '@/lib/utils'

const SORTS = [
  { id: 'newest', label: 'Newest first' },
  { id: 'oldest', label: 'Oldest first' },
  { id: 'status', label: 'Status' },
  { id: 'customer', label: 'Customer' },
] as const
type SortId = (typeof SORTS)[number]['id']

const DATE_RANGES = [
  { label: 'Today', days: 1 },
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 14 days', days: 14 },
  { label: 'Last 30 days', days: 30 },
]
const daysFor = (label: string) => DATE_RANGES.find((r) => r.label === label)?.days

/** The item-status filter's vocabulary: Pending (unanswered) + the four answers. */
const ITEM_FILTER_OPTIONS = ['Pending', ...AR_RESPONSES.map((v) => AR_RESPONSE_META[v].label)]
const itemMatches = (status: string | null, picked: string[]) =>
  picked.includes(status == null ? 'Pending' : arResponseLabel(status))

/** What a request's customer reads as — shared requests only. */
const customerLabel = (r: ARDetail) =>
  r.customer ? r.customer.company || r.customer.name : null

function RequestCard({
  request,
  expanded,
  onToggle,
  onPatch,
  onSave,
  saving,
}: {
  request: ARDetail
  expanded: boolean
  onToggle: () => void
  onPatch: (arId: number, itemId: number, changes: Record<string, string>) => Promise<void>
  onSave: (arId: number) => Promise<void>
  saving: boolean
}) {
  const editable = request.status !== 'closed'
  const pending = request.items.length - request.answeredCount
  const responseCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const it of request.items) {
      if (it.status) counts[it.status] = (counts[it.status] ?? 0) + 1
    }
    return counts
  }, [request.items])
  const subtotal = useMemo(() => arSubtotal(request.items), [request.items])

  return (
    <div className="flex-none overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md">
      {/* The head, in the admin Job Requests card's shape: ref · name ·
          status pill · date right, the customer on its own line, then the
          demand strip. Same rows, same weights — a supplier's card and the
          admin's should read as one design. */}
      <div
        onClick={onToggle}
        className="flex cursor-pointer flex-col gap-1.5 px-3.5 py-2.5 hover:bg-lps-tint"
      >
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            aria-expanded={expanded}
            aria-label={`${expanded ? 'Collapse' : 'Expand'} ${request.jobName ?? `request AR-${request.id}`}`}
            onClick={(e) => {
              e.stopPropagation()
              onToggle()
            }}
            className="flex size-5 flex-none cursor-pointer items-center justify-center rounded-md border-none bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
          <span className="text-[13.5px] font-bold tracking-tight text-primary">
            AR-{request.id}
          </span>
          {/* Unnamed requests show nothing here rather than a stand-in:
              `AR-<id>` beside it is already their name. */}
          {request.jobName && (
            <span className="min-w-0 max-w-[22rem] truncate text-[13.5px] font-semibold text-foreground">
              {request.jobName}
            </span>
          )}
          <ARStatusPill status={request.status} />
          <span className="ml-auto whitespace-nowrap text-[11px] text-lps-dim" title="Requested">
            {formatDate(request.createdAt)}
          </span>
        </div>

        {customerLabel(request) && (
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 pl-[30px] text-[12px]">
            <span className="font-semibold text-foreground">{customerLabel(request)}</span>
          </div>
        )}

        {/* The status strip, in the admin demand strip's shape: every state
            with its count, zeros included but dimmed — "nothing is
            unavailable" and "you haven't answered yet" must not render alike.
            Pending = lines the supplier hasn't answered. */}
        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 pl-[30px] text-[11.5px]">
          <span className="whitespace-nowrap text-muted-foreground">
            {request.items.length} {request.items.length === 1 ? 'line' : 'lines'}
          </span>
          <span className="h-3 w-px flex-none bg-lps-hair" />
          <span
            className={cn('inline-flex items-center gap-1 whitespace-nowrap', pending === 0 && 'opacity-45')}
          >
            <span className="size-[6px] flex-none rounded-full" style={{ background: toneDot('grey') }} />
            <span className="font-semibold tabular-nums text-foreground">{pending}</span>
            <span className="text-muted-foreground">Pending</span>
          </span>
          {AR_RESPONSES.map((s) => {
            const n = responseCounts[s] ?? 0
            return (
              <span
                key={s}
                className={cn('inline-flex items-center gap-1 whitespace-nowrap', n === 0 && 'opacity-45')}
              >
                <span
                  className="size-[6px] flex-none rounded-full"
                  style={{ background: toneDot(AR_RESPONSE_META[s].tone) }}
                />
                <span className="font-semibold tabular-nums text-foreground">{n}</span>
                <span className="text-muted-foreground">{AR_RESPONSE_META[s].label}</span>
              </span>
            )
          })}
          {/* What the answers add up to so far — the table's subtotal, on the
              collapsed card. Absent until some line carries both a quantity
              and a price. */}
          {subtotal != null && (
            <>
              <span className="h-3 w-px flex-none bg-lps-hair" />
              <span className="whitespace-nowrap">
                <span className="text-muted-foreground">Subtotal </span>
                <span className="font-semibold tabular-nums text-foreground">{money(subtotal)}</span>
              </span>
            </>
          )}
        </div>
      </div>

      {expanded && (
        <div className="flex flex-col gap-2.5 border-t border-border p-3">
          {/* LPS's job-level note to the supplier — delivery window, site
              constraints, what matters across the lines. Ours; read-only. */}
          {request.lpsNotes && (
            <div className="flex min-w-0 flex-col gap-0.5 rounded-lg border border-lps-hair bg-lps-bubble px-2.5 py-2">
              <span className="text-[10.5px] font-bold uppercase tracking-[.05em] text-lps-dim">
                Note from Local Plant Supply
              </span>
              <span className="whitespace-pre-wrap text-[12.5px] text-foreground">
                {request.lpsNotes}
              </span>
            </div>
          )}
          {(request.customer || request.shipping?.address) && (
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {request.customer && (
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[10.5px] font-bold uppercase tracking-[.05em] text-lps-dim">
                    Customer
                  </span>
                  <span className="text-[12.5px] text-foreground">
                    {[request.customer.company, request.customer.name].filter(Boolean).join(' · ')}
                  </span>
                  {(request.customer.phone || request.customer.email) && (
                    <span className="text-[11.5px] text-muted-foreground">
                      {[request.customer.phone, request.customer.email].filter(Boolean).join(' · ')}
                    </span>
                  )}
                </div>
              )}
              {request.shipping?.address && (
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[10.5px] font-bold uppercase tracking-[.05em] text-lps-dim">
                    Delivery
                  </span>
                  <span className="text-[12.5px] text-foreground">
                    {[
                      request.shipping.address,
                      [request.shipping.city, request.shipping.state].filter(Boolean).join(', '),
                      request.shipping.zip,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </div>
              )}
            </div>
          )}

          <ARLineTable
            items={request.items}
            editable={editable}
            onPatch={(itemId, changes) => onPatch(request.id, itemId, changes)}
          />

          {editable && request.status === 'new' && request.items.some((i) => i.unitPrice != null) && (
            <p className="m-0 text-[11.5px] text-muted-foreground">
              Prices we already have on file are filled in — please correct any that have changed.
            </p>
          )}

          {editable ? (
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => void onSave(request.id)}
                disabled={saving}
                className="cursor-pointer rounded-full bg-primary px-6 py-2 text-[12.5px] font-bold text-primary-foreground shadow-sm disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              <span className="text-[11.5px] text-muted-foreground">
                Saving sends your answers to Local Plant Supply — you can come back and refine them.
              </span>
            </div>
          ) : (
            <p className="m-0 text-[12px] text-muted-foreground">
              This request is closed — the lines are read-only.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export default function PortalHomePage() {
  const params = useParams<{ supplierId: string }>()
  const supplierId = Number.parseInt(params.supplierId, 10)

  const [supplierName, setSupplierName] = useState<string | null>(null)
  const [requests, setRequests] = useState<ARDetail[]>([])
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading')
  const [error, setError] = useState('')

  const [query, setQuery] = useState('')
  /** Chip selections hold option LABELS; empty = "all", like the admin toolbar. */
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [itemStatusFilter, setItemStatusFilter] = useState<string[]>([])
  const [customerFilter, setCustomerFilter] = useState<string[]>([])
  const [created, setCreated] = useState<string[]>([])
  const [sort, setSort] = useState<SortId>('newest')
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [savingId, setSavingId] = useState<number | null>(null)

  const load = useCallback(async () => {
    const res = await fetch(`/api/portal/${supplierId}`)
    if (!res.ok) {
      setState('missing')
      return
    }
    const body = (await res.json()) as { supplier: { name: string }; requests: ARDetail[] }
    setSupplierName(body.supplier.name)
    setRequests(body.requests)
    setState('ready')
  }, [supplierId])

  useEffect(() => {
    if (!Number.isInteger(supplierId)) {
      setState('missing')
      return
    }
    void load().catch(() => setState('missing'))
  }, [supplierId, load])

  const patchItem = useCallback(
    async (arId: number, itemId: number, changes: Record<string, string>) => {
      setError('')
      const res = await fetch(`/api/portal/${supplierId}/requests/${arId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ itemId, changes }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        setError(body.error ?? 'Could not save')
      }
      await load()
    },
    [supplierId, load],
  )

  const save = useCallback(
    async (arId: number) => {
      setSavingId(arId)
      setError('')
      const res = await fetch(`/api/portal/${supplierId}/requests/${arId}/submit`, {
        method: 'POST',
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        setError(body.error ?? 'Could not save')
      }
      await load()
      setSavingId(null)
    },
    [supplierId, load],
  )

  /** The header's overall stats, over everything — filters don't change them. */
  const stats = useMemo(() => {
    let newJobs = 0
    let pendingRows = 0
    let unavailableRows = 0
    for (const r of requests) {
      if (r.status === 'new') newJobs += 1
      for (const it of r.items) {
        if (it.status == null) pendingRows += 1
        else if (it.status === 'unavailable') unavailableRows += 1
      }
    }
    return { newJobs, pendingRows, unavailableRows }
  }, [requests])

  /** The customer chip's options — only shared requests carry a customer. */
  const customerOptions = useMemo(
    () => [...new Set(requests.map(customerLabel).filter((v): v is string => !!v))].sort(),
    [requests],
  )

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    const cutoff = created.length && daysFor(created[0]) != null
      ? new Date(Date.now() - daysFor(created[0])! * 86_400_000).toISOString()
      : null
    const list = requests.filter((r) => {
      if (statusFilter.length && !statusFilter.includes(arStatusLabel(r.status))) return false
      if (itemStatusFilter.length && !r.items.some((it) => itemMatches(it.status, itemStatusFilter))) {
        return false
      }
      if (customerFilter.length && !customerFilter.includes(customerLabel(r) ?? '')) return false
      if (cutoff && r.createdAt < cutoff) return false
      if (q) {
        const hay = [r.jobName ?? '', `ar-${r.id}`, customerLabel(r) ?? '', ...r.items.map((it) => it.name)]
          .join('\n')
          .toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
    const byCreated = (a: ARDetail, b: ARDetail) => b.createdAt.localeCompare(a.createdAt)
    return list.sort((a, b) => {
      if (sort === 'oldest') return -byCreated(a, b)
      if (sort === 'status') return a.status.localeCompare(b.status) || byCreated(a, b)
      if (sort === 'customer') {
        return (customerLabel(a) ?? '￿').localeCompare(customerLabel(b) ?? '￿') || byCreated(a, b)
      }
      return byCreated(a, b)
    })
  }, [requests, query, statusFilter, itemStatusFilter, customerFilter, created, sort])

  const allShownExpanded = shown.length > 0 && shown.every((r) => expanded.has(r.id))

  const chips: Chip[] = [
    {
      label: 'Status',
      allLabel: 'All statuses',
      options: AR_STATUSES.map((v) => arStatusLabel(v)),
      values: statusFilter,
      onChange: setStatusFilter,
    },
    {
      label: 'Item status',
      allLabel: 'All item statuses',
      options: ITEM_FILTER_OPTIONS,
      values: itemStatusFilter,
      onChange: setItemStatusFilter,
    },
    // Only shared requests carry a customer, so the chip appears only when
    // there is at least one to filter by.
    ...(customerOptions.length
      ? [{
          label: 'Customer',
          allLabel: 'All customers',
          options: customerOptions,
          values: customerFilter,
          onChange: setCustomerFilter,
        }]
      : []),
    {
      label: 'Requested',
      allLabel: 'Any time',
      options: DATE_RANGES.map((r) => r.label),
      values: created,
      onChange: setCreated,
      single: true,
    },
  ]
  const hasFilters = !!(
    query.trim() || statusFilter.length || itemStatusFilter.length ||
    customerFilter.length || created.length
  )
  const clearAll = () => {
    setQuery('')
    setStatusFilter([])
    setItemStatusFilter([])
    setCustomerFilter([])
    setCreated([])
  }

  if (state === 'missing') {
    return (
      <PortalFrame supplierId={supplierId} supplierName={supplierName} tab="requests">
        <p className="py-10 text-center text-[13px] text-muted-foreground">
          This portal link isn&apos;t active. Please check with your Local Plant Supply contact.
        </p>
      </PortalFrame>
    )
  }

  return (
    <PortalFrame
      supplierId={supplierId}
      supplierName={supplierName}
      tab="requests"
    >
      {/* Overall stats — over everything, not the filtered view. */}
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-1">
        <h1 className="m-0 font-serif text-[17px] font-bold text-foreground">
          Availability Requests
        </h1>
        <span className="text-[12px] text-muted-foreground">
          <strong className="text-foreground">{stats.newJobs}</strong>{' '}
          {stats.newJobs === 1 ? 'new job' : 'new jobs'} ·{' '}
          <strong className="text-foreground">{stats.pendingRows}</strong> rows pending ·{' '}
          <strong className="text-foreground">{stats.unavailableRows}</strong> rows unavailable
        </span>
      </div>

      {/* The admin Job Requests toolbar, reused: search, multi-select chips
          (job status, item status, customer, requested-date), sort, Expand all. */}
      <div className="overflow-hidden rounded-xl border border-border">
        <Toolbar
          placeholder="Search plants, jobs, customers…"
          query={query}
          onQuery={setQuery}
          chips={chips}
          hasFilters={hasFilters}
          onClear={clearAll}
          summary={`${shown.length} of ${requests.length} ${requests.length === 1 ? 'request' : 'requests'}`}
          controls={
            <>
              <select
                aria-label="Sort"
                value={sort}
                onChange={(e) => setSort(e.target.value as SortId)}
                className="h-[30px] cursor-pointer rounded-full border border-border bg-card px-2.5 text-[12px] font-semibold text-muted-foreground outline-none"
              >
                {SORTS.map((o) => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() =>
                  setExpanded(allShownExpanded ? new Set() : new Set(shown.map((r) => r.id)))
                }
                className="cursor-pointer rounded-full border border-border bg-card px-[11px] py-[5px] text-[12px] font-semibold text-muted-foreground"
              >
                {allShownExpanded ? 'Collapse all' : 'Expand all'}
              </button>
            </>
          }
        />
      </div>


      {error && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-[12.5px] text-destructive">
          {error}
        </p>
      )}

      {state === 'loading' && (
        <p className="py-10 text-center text-[13px] text-muted-foreground">Loading…</p>
      )}
      {state === 'ready' && shown.length === 0 && (
        <p className="py-10 text-center text-[13px] text-muted-foreground">
          {requests.length === 0
            ? 'No availability requests yet — new ones will appear here.'
            : 'Nothing matches these filters.'}
        </p>
      )}

      {shown.map((r) => (
        <RequestCard
          key={r.id}
          request={r}
          expanded={expanded.has(r.id)}
          onToggle={() =>
            setExpanded((current) => {
              const next = new Set(current)
              if (next.has(r.id)) next.delete(r.id)
              else next.add(r.id)
              return next
            })
          }
          onPatch={patchItem}
          onSave={save}
          saving={savingId === r.id}
        />
      ))}
    </PortalFrame>
  )
}
