'use client'

// The portal home: this supplier's **open** availability requests as one card
// per request, grouped by the four tabs the work actually moves through — All,
// New, Processing, Completed. A card is a link, not a disclosure: it opens the
// request's own page, where the lines are answered and submitted. There are no
// filters here on purpose (2026-08-26) — the tab is the whole selection, and a
// supplier's list is short enough that search and chips cost more than they
// find. **Closed requests are not on this page at all**, not even under All:
// they live at ./closed, their own rail destination. The conversation is the docked chat sidebar (one thread per supplier),
// not part of any card. These pages are behind the session gate: a supplier
// signs in and sees their own company only — see app/lib/partner-auth.ts.

import { LayoutGrid, Layers, List } from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { ChevronDown } from '@/components/workspace/icons'
import {
  PartnerFrame,
  partnerRequestName,
  type PartnerAlert,
} from '@/components/workspace/partner'
import {
  ITEM_FILTERS,
  SupplierItemGroups,
  countItemFilters,
  type ItemFilterId,
} from '@/components/workspace/supplier-items'
import { SupplierStatusBoard } from '@/components/workspace/supplier-status-board'
import { arSubtotal, arStatusLabel, type ARDetail, type SupplierItemLine } from '@/lib/availability'
import { money } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * The four groups the list is cut into. `All` is every **open** request —
 * closing is ours, not theirs, and a closed request is finished work rather
 * than a fourth thing to triage, so it is off this page entirely.
 */
const TABS = [
  { id: 'all', label: 'All', status: null },
  { id: 'new', label: 'New', status: 'new' },
  { id: 'processing', label: 'Processing', status: 'processing' },
  { id: 'submitted', label: 'Completed', status: 'submitted' },
] as const
type TabId = (typeof TABS)[number]['id']

/**
 * The page's own accents (2026-08-30 design): the list is read by colour
 * before it is read by text, so each status owns one. Blue is New, orange is
 * Completed; Processing is quiet. Fixed hexes with translucent fills so they
 * read on both themes.
 */
const ACCENT = {
  blue: '#3B8BF5',
  orange: '#E08A3A',
  green: '#3DBB6A',
  purple: '#8F7CF6',
  red: '#E5484D',
} as const
type Accent = keyof typeof ACCENT
const TAB_ACCENT: Record<TabId, Accent | null> = { all: null, new: 'blue', processing: null, submitted: 'orange' }
/** By item's tabs are answers, each in its own accent. */
const ITEM_ACCENT: Record<ItemFilterId, Accent | null> = {
  all: null,
  available: 'green',
  can_order: 'blue',
  arriving_soon: 'blue',
  diff_size_qty_sub: 'purple',
  unavailable: 'red',
}

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
  accent: Accent | null
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'flex w-[10.5rem] max-w-[24vw] min-w-[5.5rem] cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg border px-3 py-2',
        selected ? 'border-lps-dim/60 bg-secondary/70' : 'border-transparent bg-transparent hover:bg-lps-tint',
      )}
    >
      <span className={cn('whitespace-nowrap text-[12px] font-medium', selected ? 'text-foreground' : 'text-muted-foreground')}>
        {label}
      </span>
      <span
        className={cn('text-[18px] font-semibold tabular-nums leading-tight', !accent && 'text-muted-foreground')}
        style={accent ? { color: ACCENT[accent] } : undefined}
      >
        {count}
      </span>
    </button>
  )
}

/** A bordered pill in one accent — the status mark on a row. */
function AccentPill({
  accent,
  className,
  children,
}: {
  accent: Accent | null
  className?: string
  children: React.ReactNode
}) {
  const c = accent ? ACCENT[accent] : undefined
  return (
    <span
      className={cn(
        'inline-flex h-7 items-center justify-center gap-1 whitespace-nowrap rounded-full border px-3 text-[12.5px] font-medium',
        !accent && 'border-border bg-secondary/60 text-muted-foreground',
        className,
      )}
      style={
        c
          ? {
              color: c,
              borderColor: `color-mix(in srgb, ${c} 45%, transparent)`,
              background: `color-mix(in srgb, ${c} 14%, transparent)`,
            }
          : undefined
      }
    >
      {children}
    </span>
  )
}

/**
 * One open request as a row: status on the left, name over our note to the
 * supplier in the middle, the amount on the right. New rows carry the blue edge.
 */
function RequestRow({ request, href }: { request: ARDetail; href: string }) {
  const isNew = request.status === 'new'
  const total = arSubtotal(request.items)
  const note = request.lpsNotes?.trim()
  return (
    <Link
      href={href}
      className="flex flex-none items-center gap-4 rounded-xl border bg-card px-5 py-4 no-underline transition-colors hover:bg-lps-tint"
      style={isNew ? { borderColor: `color-mix(in srgb, ${ACCENT.blue} 55%, var(--border))` } : undefined}
    >
      <AccentPill accent={isNew ? 'blue' : null} className="w-[8.5rem] flex-none">
        {request.status === 'submitted' ? 'Completed' : arStatusLabel(request.status)}
        {!isNew && <ChevronDown className="size-3.5 opacity-80" />}
      </AccentPill>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate text-[16px] font-semibold leading-tight text-foreground">
          {partnerRequestName(request)}
        </span>
        {note && (
          <span className="truncate text-[13px] text-muted-foreground" title={note}>
            {note}
          </span>
        )}
      </div>

      <span className="w-[6.5rem] flex-none text-right text-[15px] font-semibold tabular-nums text-foreground">
        {total == null ? '—' : money(total)}
      </span>
    </Link>
  )
}

/**
 * The two ways the same workload is cut. **By request** is one row per job —
 * what that job wants. **By item** is one row per plant, across every request
 * that asked for it, which is the question the per-request list cannot answer.
 *
 * **By status** is the same lines as a board, one card per answer.
 *
 * By request and By item each have their own tabs — a request's lifecycle
 * status, a line's answer. By status has none: the cards are the cut.
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
  const [tab, setTab] = useState<TabId>('all')
  const [view, setView] = useState<ViewId>('request')
  const [itemFilter, setItemFilter] = useState<ItemFilterId>('all')
  const [itemLines, setItemLines] = useState<SupplierItemLine[] | null>(null)

  const load = useCallback(async () => {
    const res = await fetch(`/api/partner/${supplierId}`)
    if (!res.ok) {
      setState('missing')
      return
    }
    const body = (await res.json()) as { supplier: { name: string }; requests: ARDetail[] }
    setSupplierName(body.supplier.name)
    // Closed requests belong to the Closed page — dropping them here is what
    // keeps them out of All as well as out of the three status tabs.
    setRequests(body.requests.filter((r) => r.status !== 'closed'))
    setState('ready')
  }, [supplierId])

  useEffect(() => {
    if (!Number.isInteger(supplierId)) {
      setState('missing')
      return
    }
    void load().catch(() => setState('missing'))
  }, [supplierId, load])

  /**
   * The lines behind By item and By status — a second read over the same
   * workload, fetched only once one of those views is asked for. The page
   * opens on By request.
   */
  const loadItemLines = useCallback(async () => {
    const res = await fetch(`/api/partner/${supplierId}/items`, { cache: 'no-store' })
    if (res.ok) setItemLines(((await res.json()) as { lines: SupplierItemLine[] }).lines)
  }, [supplierId])

  useEffect(() => {
    if (view === 'request' || !Number.isInteger(supplierId)) return
    void loadItemLines().catch(() => {})
  }, [view, supplierId, loadItemLines])

  const refreshAfterReply = useCallback(() => {
    void load().catch(() => {})
    if (view !== 'request') void loadItemLines().catch(() => {})
  }, [load, view, loadItemLines])

  /**
   * One line's answer, from the By-item view. Each row there belongs to its
   * own request, so the line names the one to write to — otherwise identical
   * to what the request's own page does, because it is the same table.
   */
  const patchItemLine = useCallback(
    async (line: SupplierItemLine, changes: Record<string, string>) => {
      const res = await fetch(`/api/partner/${supplierId}/requests/${line.arId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ itemId: line.id, changes }),
      })
      if (!res.ok) return
      // Both lists are derived from the answer — the group's counts and
      // subtotal here, and the request's status and counts on the cards.
      await Promise.all([loadItemLines().catch(() => {}), load().catch(() => {})])
    },
    [supplierId, loadItemLines, load],
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

  const counts = useMemo(() => {
    const by: Record<TabId, number> = { all: requests.length, new: 0, processing: 0, submitted: 0 }
    for (const r of requests) {
      if (r.status === 'new') by.new += 1
      else if (r.status === 'processing') by.processing += 1
      else if (r.status === 'submitted') by.submitted += 1
    }
    return by
  }, [requests])

  const itemCounts = useMemo(() => countItemFilters(itemLines ?? []), [itemLines])

  const shown = useMemo(() => {
    const status = TABS.find((t) => t.id === tab)?.status
    return requests.filter((r) => (status ? r.status === status : true))
  }, [requests, tab])

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
        /* One dark strip pinned under the header, the tabs centred in it —
           label over count, the selected one boxed, the count in the tab's
           own accent. By request cuts by the request's status; By item cuts
           by the line's answer, because that view is looking at plants. */
        <div className="relative flex flex-none items-center justify-center px-3 pt-3 md:px-4">
          <div className="relative flex min-h-[4.75rem] w-full items-center justify-center rounded-2xl bg-card px-3 py-2.5">
            <div className="flex gap-2 overflow-x-auto">
              {view === 'status'
                ? null
                : view === 'request'
                ? TABS.map((t) => (
                    <Tab
                      key={t.id}
                      label={t.label}
                      count={counts[t.id]}
                      accent={TAB_ACCENT[t.id]}
                      selected={tab === t.id}
                      onClick={() => setTab(t.id)}
                    />
                  ))
                : ITEM_FILTERS.map((f) => (
                    <Tab
                      key={f.id}
                      label={f.label}
                      count={itemCounts[f.id]}
                      accent={ITEM_ACCENT[f.id]}
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
          {view !== 'request' ? (
            itemLines == null ? (
              <div className="py-16 text-center text-[12.5px] text-muted-foreground">Loading…</div>
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
              {state === 'ready' && shown.length === 0 && (
                <div className="flex flex-col items-center gap-2 py-16 text-center">
                  <span className="text-[14px] font-semibold text-foreground">
                    {requests.length ? 'Nothing in this tab' : 'No availability requests yet'}
                  </span>
                  <span className="text-[12.5px] text-muted-foreground">
                    {requests.length
                      ? 'Try All to see every request.'
                      : 'Requests appear here as Local Plant Supply sends them.'}
                  </span>
                </div>
              )}

              {shown.map((r) => (
                <RequestRow key={r.id} request={r} href={`/partner/${supplierId}/requests/${r.id}`} />
              ))}

              {state === 'loading' && (
                <div className="py-16 text-center text-[12.5px] text-muted-foreground">Loading…</div>
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
          className="absolute bottom-3 left-1/2 flex w-fit -translate-x-1/2 gap-1 rounded-xl border border-border bg-card p-1.5 shadow-lg"
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
                  'flex size-9 cursor-pointer items-center justify-center rounded-lg border-none',
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
