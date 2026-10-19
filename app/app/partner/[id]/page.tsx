'use client'

// The portal home: this supplier's **open** availability requests as one card
// per request. New, Processing and Completed are independently selectable work
// buckets; a fresh visit begins with New + Processing, the active work queue.
// A card is a link, not a disclosure: it opens the request's own page, where
// the lines are answered and submitted. **Closed requests are not on this page
// at all**:
// they live at ./closed, their own rail destination. The conversation is the docked chat sidebar (one thread per supplier),
// not part of any card. These pages are behind the session gate: a supplier
// signs in and sees their own company only — see app/lib/partner-auth.ts.

import { LayoutGrid, Layers, List } from 'lucide-react'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  PartnerFrame,
  partnerRequestName,
  type PartnerAlert,
} from '@/components/workspace/partner'
import {
  DEFAULT_REQUEST_BUCKETS,
  RequestBucketControls,
  RequestBucketList,
  requestBucketCounts,
  type RequestBucketId,
} from '@/components/workspace/partner-request-buckets'
import {
  ITEM_FILTERS,
  SupplierItemGroups,
  countItemFilters,
  type ItemFilterId,
} from '@/components/workspace/supplier-items'
import { SupplierStatusBoard } from '@/components/workspace/supplier-status-board'
import { arResponseTone, withLineChanges, type ARDetail, type SupplierItemLine } from '@/lib/availability'
import type { Tone } from '@/lib/job-requests'
import { cn } from '@/lib/utils'
import { usePartnerUpdates } from '@/lib/use-partner-updates'

/**
 * By item's tabs are answers, each in its answer's tone — the same colour the
 * line's status pill (and LPS's own job card) gives that answer.
 */
const itemAccent = (id: ItemFilterId): Tone | null =>
  id === 'all' || id === 'pending' ? null : arResponseTone(id)

/** One tab of the strip: label over count, boxed when selected. */
function Tab({
  label,
  count,
  accent,
  selected,
  onClick,
}: {
  label: string
  count: number
  accent: Tone | null
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        // Phones: a compact chip sized to its label, the row scrolling
        // sideways; from 900px, the fixed-width boxes the desktop strip uses.
        'flex min-w-[4.75rem] flex-none cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg border px-3 py-1.5 min-[900px]:w-[10.5rem] min-[900px]:max-w-[24vw] min-[900px]:min-w-[5.5rem] min-[900px]:flex-initial min-[900px]:py-2',
        selected ? 'border-lps-dim/60 bg-secondary/70' : 'border-transparent bg-transparent hover:bg-lps-tint',
      )}
    >
      <span className={cn('whitespace-nowrap text-[12px] font-medium', selected ? 'text-foreground' : 'text-muted-foreground')}>
        {label}
      </span>
      <span
        className={cn('text-[18px] font-semibold tabular-nums leading-tight', !accent && 'text-muted-foreground')}
        style={accent ? { color: `var(--lps-tone-${accent}-fg)` } : undefined}
      >
        {count}
      </span>
    </button>
  )
}

/**
 * The two ways the same workload is cut. **By request** is one row per job —
 * what that job wants. **By item** is one row per plant, across every request
 * that asked for it, which is the question the per-request list cannot answer.
 *
 * **By status** is the same lines as a board, one card per answer.
 *
 * By request has multi-select lifecycle buckets; By item has single-choice
 * answer tabs. By status has neither: the cards are the cut.
 */
const VIEWS = [
  { id: 'request', label: 'By request', Icon: List },
  { id: 'item', label: 'By item', Icon: Layers },
  { id: 'status', label: 'By status', Icon: LayoutGrid },
] as const
type ViewId = (typeof VIEWS)[number]['id']

export default function PartnerHomePage() {
  const params = useParams<{ id: string }>()
  const supplierId = Number.parseInt(params.id, 10)

  const [supplierName, setSupplierName] = useState<string | null>(null)
  const [requests, setRequests] = useState<ARDetail[]>([])
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading')
  const [requestLoadError, setRequestLoadError] = useState('')
  const requestLoadSequence = useRef(0)
  const requestLoadController = useRef<AbortController | null>(null)
  const [requestBuckets, setRequestBuckets] = useState<RequestBucketId[]>([...DEFAULT_REQUEST_BUCKETS])
  const [view, setView] = useState<ViewId>('request')
  const [itemFilter, setItemFilter] = useState<ItemFilterId>('all')
  const [itemLines, setItemLines] = useState<SupplierItemLine[] | null>(null)
  const itemLoadController = useRef<AbortController | null>(null)

  /**
   * The one read behind request rows, global counts and alert rows. Every new
   * read retires its predecessor, and the sequence check remains authoritative
   * even if a fetch implementation resolves after abort. A refresh failure
   * keeps the last coherent snapshot on screen and makes recovery explicit.
   */
  const loadRequests = useCallback(async (initial = false) => {
    const sequence = ++requestLoadSequence.current
    requestLoadController.current?.abort()
    const controller = new AbortController()
    requestLoadController.current = controller

    try {
      const res = await fetch(`/api/partner/${supplierId}`, { cache: 'no-store', signal: controller.signal })
      if (controller.signal.aborted || sequence !== requestLoadSequence.current) return false
      if (!res.ok) {
        if (initial) setState('missing')
        else setRequestLoadError('Could not refresh requests. The last loaded list is still shown.')
        return false
      }
      const body = (await res.json()) as { supplier: { name: string }; requests: ARDetail[] }
      if (controller.signal.aborted || sequence !== requestLoadSequence.current) return false
      setSupplierName(body.supplier.name)
      // Closed requests belong to the Closed page, not any work bucket here.
      setRequests(body.requests.filter((request) => request.status !== 'closed'))
      setRequestLoadError('')
      setState('ready')
      return true
    } catch {
      if (controller.signal.aborted || sequence !== requestLoadSequence.current) return false
      if (initial) setState('missing')
      else setRequestLoadError('Could not refresh requests. The last loaded list is still shown.')
      return false
    } finally {
      if (requestLoadController.current === controller) requestLoadController.current = null
    }
  }, [supplierId])

  useEffect(() => {
    setSupplierName(null)
    setRequests([])
    setRequestLoadError('')
    setState('loading')
    setRequestBuckets([...DEFAULT_REQUEST_BUCKETS])
    if (!Number.isInteger(supplierId)) {
      setState('missing')
      return
    }
    void loadRequests(true)
    return () => {
      requestLoadSequence.current += 1
      requestLoadController.current?.abort()
      requestLoadController.current = null
    }
  }, [supplierId, loadRequests])

  /**
   * The lines behind By item and By status — a second read over the same
   * workload, fetched only once one of those views is asked for. The page
   * opens on By request.
   */
  const loadItemLines = useCallback(async () => {
    itemLoadController.current?.abort()
    const controller = new AbortController()
    itemLoadController.current = controller
    const res = await fetch(`/api/partner/${supplierId}/items`, { cache: 'no-store', signal: controller.signal })
    if (!res.ok) return
    const body = await res.json() as { lines: SupplierItemLine[] }
    if (!controller.signal.aborted) setItemLines(body.lines)
  }, [supplierId])

  useEffect(() => {
    setItemLines(null)
    return () => { itemLoadController.current?.abort() }
  }, [supplierId])

  useEffect(() => {
    if (view === 'request' || !Number.isInteger(supplierId)) return
    void loadItemLines().catch(() => {})
  }, [view, supplierId, loadItemLines])

  const refreshAfterReply = useCallback(async () => {
    await Promise.all([
      loadRequests(),
      view !== 'request' ? loadItemLines().catch(() => {}) : Promise.resolve(),
    ])
  }, [loadRequests, view, loadItemLines])

  usePartnerUpdates(supplierId, refreshAfterReply)

  /**
   * One line's answer, from the By-item view. Each row there belongs to its
   * own request, so the line names the one to write to — otherwise identical
   * to what the request's own page does, because it is the same table.
   */
  const patchItemLine = useCallback(
    async (line: SupplierItemLine, changes: Record<string, string>) => {
      // Optimistic: the answer shows now; the re-read below settles it either way.
      setItemLines((current) => current?.map((l) => (l.arId === line.arId && l.id === line.id ? withLineChanges(l, changes) : l)) ?? current)
      const res = await fetch(`/api/partner/${supplierId}/requests/${line.arId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ itemId: line.id, changes }),
      })
      if (!res.ok) {
        await loadItemLines().catch(() => {})
        return
      }
      // Both lists are derived from the answer — the group's counts and
      // subtotal here, and the request's status and counts on the cards.
      await Promise.all([loadItemLines().catch(() => {}), loadRequests()])
    },
    [supplierId, loadItemLines, loadRequests],
  )

  /**
   * Group one line under a catalogue row, then re-read: the group it lands in
   * and the group it left are both derived from the mapping.
   */
  const mapItemLine = useCallback(
    async (line: SupplierItemLine, inventoryId: string) => {
      const res = await fetch(`/api/partner/${supplierId}/requests/${line.arId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ itemId: line.id, mappedInventoryId: inventoryId }),
      })
      if (res.ok) await loadItemLines().catch(() => {})
    },
    [supplierId, loadItemLines],
  )

  /** What the header bell lists: every request still waiting to be answered. */
  const alerts: PartnerAlert[] = useMemo(
    () =>
      requests
        .filter((r) => r.status === 'new')
        .map((r) => ({ id: r.id, label: partnerRequestName(r), at: Date.parse(r.createdAt) })),
    [requests],
  )

  // These remain global workload counts as buckets are toggled; filtering is
  // applied only to the rows below, never to the numbers in the controls.
  const counts = useMemo(() => requestBucketCounts(requests), [requests])
  const itemCounts = useMemo(() => countItemFilters(itemLines ?? []), [itemLines])

  if (state === 'missing') {
    return (
      <PartnerFrame
        supplierId={supplierId}
        supplierName={supplierName}
        tab="requests"
        title="Availability Requests"
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-auto p-3 pb-5 md:p-4">
          <p className="py-10 text-center text-[13px] text-muted-foreground">
            This portal link isn&apos;t active. Please check with your Local Plant Supply contact.
          </p>
        </div>
      </PartnerFrame>
    )
  }

  return (
    <PartnerFrame
      // Rosie may have written a chat-given answer into a request — the
      // cards' counts and status, and By item's groups, are derived from it.
      onAgentReply={refreshAfterReply}
      supplierId={supplierId}
      supplierName={supplierName}
      tab="requests"
      title="Availability Requests"
      hideHeaderOnDesktop
      alerts={alerts}
      onOpenAlert={(id) => { window.location.href = `/partner/${supplierId}/requests/${id}` }}
      toolbar={(rightActions) => (
        /* One dark strip pinned under the header. By request has short-lived,
           multi-select lifecycle buckets; By item keeps its single-choice
           answer tabs because that view is looking at plants. */
        /* By status has no controls, and on a phone no bell either — so no
           strip, rather than an empty box above the board. `min-w-0` lets the
           tab row scroll inside the strip instead of spilling past both edges
           of its centred parent, which left the first tabs unreachable. */
        <div className={cn('relative flex flex-none items-center justify-center px-3 pt-3 md:px-4', view === 'status' && 'max-[899px]:hidden')}>
          <div className="relative flex w-full items-center justify-center rounded-2xl bg-card p-1.5 min-[900px]:min-h-[4.75rem] min-[900px]:px-3 min-[900px]:py-2.5">
            <div className="flex min-w-0 max-w-full gap-2 overflow-x-auto [scrollbar-width:none] max-[899px]:w-full">
              {view === 'status'
                ? null
                : view === 'request'
                ? (
                    <RequestBucketControls
                      counts={counts}
                      selected={requestBuckets}
                      onChange={setRequestBuckets}
                    />
                  )
                : ITEM_FILTERS.map((f) => (
                    <Tab
                      key={f.id}
                      label={f.label}
                      count={itemCounts[f.id]}
                      accent={itemAccent(f.id)}
                      selected={itemFilter === f.id}
                      onClick={() => setItemFilter(f.id)}
                    />
                  ))}
            </div>
            {rightActions && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">{rightActions}</div>
            )}
          </div>
        </div>
      )}
    >
      {/* The frame hands its children a fixed, overflow-hidden box, so this is
          the scroll container — the same shape the admin Job Requests page
          builds inside the Shell. */}
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-3 pb-24 md:p-4 md:pb-24">
          {requestLoadError && (
            <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#9A661F] bg-[#FFF5E6] px-4 py-3 text-[13px] text-[#633B08] dark:border-[#D69A45] dark:bg-[#332512] dark:text-[#FFD18D]">
              <span>{requestLoadError}</span>
              <button
                type="button"
                onClick={() => void loadRequests()}
                className="min-h-11 cursor-pointer rounded-lg border border-current px-4 font-semibold"
              >
                Retry
              </button>
            </div>
          )}
          {view !== 'request' ? (
            itemLines == null ? (
              <div className="py-16 text-center text-[13px] text-muted-foreground">Loading…</div>
            ) : view === 'status' ? (
              <SupplierStatusBoard lines={itemLines} onPatch={patchItemLine} />
            ) : (
              <SupplierItemGroups
                lines={itemLines}
                filter={itemFilter}
                hrefFor={(line) => `/partner/${supplierId}/requests/${line.arId}`}
                onMap={mapItemLine}
                onPatch={patchItemLine}
              />
            )
          ) : (
            <>
              {state === 'ready' && (
                <RequestBucketList
                  requests={requests}
                  selected={requestBuckets}
                  supplierId={supplierId}
                />
              )}

              {state === 'loading' && (
                <div className="py-16 text-center text-[13px] text-muted-foreground">Loading…</div>
              )}
            </>
          )}
        </div>

        {/* The view switch floats at the bottom centre of the page column,
            over the list: By request is the rows glyph, By item the stacked
            layers, By status the grid. It is positioned against the column, not the list, so it
            sits in the same place however long the list is or wherever it
            has scrolled to. */}
        <div
          role="group"
          aria-label="View"
          className="absolute bottom-3 left-1/2 flex w-fit -translate-x-1/2 gap-1 rounded-xl border border-border bg-card p-1 shadow-[var(--lps-shadow)] min-[900px]:p-1.5"
        >
          {VIEWS.map((v) => {
            const Icon = v.Icon
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => setView(v.id)}
                aria-pressed={view === v.id}
                aria-label={v.label}
                title={v.label}
                className={cn(
                  'flex size-11 cursor-pointer items-center justify-center rounded-lg border-none min-[900px]:size-9',
                  view === v.id
                    ? 'bg-foreground text-background'
                    : 'bg-transparent text-muted-foreground hover:bg-lps-tint hover:text-foreground',
                )}
              >
                <Icon className="size-5" />
              </button>
            )
          })}
        </div>
      </div>
    </PartnerFrame>
  )
}
