'use client'

// The portal home: this supplier's **open** availability requests as one card
// per request, grouped by the four tabs the work actually moves through — All,
// New, Processing, Submitted. A card is a link, not a disclosure: it opens the
// request's own page, where the lines are answered and submitted. There are no
// filters here on purpose (2026-08-26) — the tab is the whole selection, and a
// supplier's list is short enough that search and chips cost more than they
// find. **Closed requests are not on this page at all**, not even under All:
// they live at ./closed, their own rail destination. The conversation is the docked chat sidebar (one thread per supplier),
// not part of any card. See app/api/portal/[supplierId]/route.ts for the auth
// caveat — these pages are outside the session gate until supplier auth lands.

import { useParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  PortalFrame,
  PortalRequestCard,
  portalRequestName,
  type PortalAlert,
} from '@/components/workspace/portal'
import { arStatusTone, type ARDetail } from '@/lib/availability'
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
  { id: 'submitted', label: 'Submitted', status: 'submitted' },
] as const
type TabId = (typeof TABS)[number]['id']

export default function PortalHomePage() {
  const params = useParams<{ supplierId: string }>()
  const supplierId = Number.parseInt(params.supplierId, 10)

  const [supplierName, setSupplierName] = useState<string | null>(null)
  const [requests, setRequests] = useState<ARDetail[]>([])
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading')
  const [tab, setTab] = useState<TabId>('all')

  const load = useCallback(async () => {
    const res = await fetch(`/api/portal/${supplierId}`)
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

  /** The header's overall stats, over everything — the tab doesn't change them. */
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

  /** What the header bell lists: every request still waiting to be answered. */
  const alerts: PortalAlert[] = useMemo(
    () =>
      requests
        .filter((r) => r.status === 'new')
        .map((r) => ({ id: r.id, label: portalRequestName(r), at: Date.parse(r.createdAt) })),
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

  const shown = useMemo(() => {
    const status = TABS.find((t) => t.id === tab)?.status
    return requests.filter((r) => (status ? r.status === status : true))
  }, [requests, tab])

  if (state === 'missing') {
    return (
      <PortalFrame
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
      </PortalFrame>
    )
  }

  return (
    <PortalFrame
      supplierId={supplierId}
      supplierName={supplierName}
      tab="requests"
      title="Availability Requests"
      // The header's running total, over everything — the tab doesn't change it.
      subtitle={`${stats.newJobs} ${stats.newJobs === 1 ? 'new job' : 'new jobs'} · ${stats.pendingRows} rows pending · ${stats.unavailableRows} rows unavailable`}
      alerts={alerts}
      onOpenAlert={(id) => { window.location.href = `/portal/${supplierId}/requests/${id}` }}
      toolbar={
        /* The tabs sit where the toolbar used to, pinned under the header: one
           segmented control, label over count, the count in the tab's own tone
           so the list can be triaged without reading it. */
        <div className="flex-none border-b border-border bg-card px-3 py-2.5 md:px-4">
          <div className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-secondary/45 p-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                aria-pressed={tab === t.id}
                className={cn(
                  'flex min-w-[92px] flex-1 cursor-pointer flex-col items-center gap-0.5 rounded-lg border px-3 py-1.5',
                  tab === t.id
                    ? 'border-border bg-card shadow-sm'
                    : 'border-transparent bg-transparent hover:bg-lps-tint',
                )}
              >
                <span className="text-[11px] font-semibold text-muted-foreground">{t.label}</span>
                <span
                  className="text-[15px] font-bold tabular-nums"
                  style={{ color: t.status ? `var(--lps-tone-${arStatusTone(t.status)}-fg)` : undefined }}
                >
                  {counts[t.id]}
                </span>
              </button>
            ))}
          </div>
        </div>
      }
    >
      {/* The frame hands its children a fixed, overflow-hidden box, so this is
          the scroll container — the same shape the admin Job Requests page
          builds inside the Shell. */}
      <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-auto p-3 pb-5 md:p-4">
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
          <PortalRequestCard
            key={r.id}
            request={r}
            href={`/portal/${supplierId}/requests/${r.id}`}
          />
        ))}

        {state === 'loading' && (
          <div className="py-16 text-center text-[12.5px] text-muted-foreground">Loading…</div>
        )}
      </div>
    </PortalFrame>
  )
}
