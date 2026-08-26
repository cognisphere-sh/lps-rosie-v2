'use client'

// Closed requests — their own rail destination since 2026-08-26, and the only
// place they appear. A closed request is finished work: it is not a fifth tab
// on the requests page, because a tab is something you triage between and this
// is something you look up. No tabs and no filters here either; the page is
// one list, newest first.
//
// The cards are the requests page's own (`PortalRequestCard`) and still open
// the request, which reads as closed and read-only when it gets there.

import { useParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  PortalFrame,
  PortalRequestCard,
  portalRequestName,
  type PortalAlert,
} from '@/components/workspace/portal'
import { type ARDetail } from '@/lib/availability'

export default function PortalClosedPage() {
  const params = useParams<{ supplierId: string }>()
  const supplierId = Number.parseInt(params.supplierId, 10)

  const [supplierName, setSupplierName] = useState<string | null>(null)
  const [requests, setRequests] = useState<ARDetail[]>([])
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading')

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

  const closed = useMemo(() => requests.filter((r) => r.status === 'closed'), [requests])

  /** The bell is on every portal page, and still lists the unanswered ones. */
  const alerts: PortalAlert[] = useMemo(
    () =>
      requests
        .filter((r) => r.status === 'new')
        .map((r) => ({ id: r.id, label: portalRequestName(r), at: Date.parse(r.createdAt) })),
    [requests],
  )

  return (
    <PortalFrame
      supplierId={supplierId}
      supplierName={supplierName}
      tab="closed"
      title="Closed Requests"
      subtitle={
        state === 'ready'
          ? `${closed.length} ${closed.length === 1 ? 'request' : 'requests'}`
          : undefined
      }
      alerts={alerts}
      onOpenAlert={(id) => { window.location.href = `/portal/${supplierId}/requests/${id}` }}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-auto p-3 pb-5 md:p-4">
        {state === 'missing' && (
          <p className="py-10 text-center text-[13px] text-muted-foreground">
            This portal link isn&apos;t active. Please check with your Local Plant Supply contact.
          </p>
        )}

        {state === 'ready' && closed.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <span className="text-[14px] font-semibold text-foreground">No closed requests</span>
            <span className="text-[12.5px] text-muted-foreground">
              A request moves here once Local Plant Supply is done with it.
            </span>
          </div>
        )}

        {closed.map((r) => (
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
