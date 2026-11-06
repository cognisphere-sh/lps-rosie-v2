'use client'

import { useParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  PartnerFrame,
  PartnerRequestCard,
  partnerRequestName,
  type PartnerAlert,
} from '@/components/workspace/partner'
import { PartnerHistoryTabs } from '@/components/workspace/partner-history-tabs'
import { type ARDetail } from '@/lib/availability'
import { usePartnerUpdates } from '@/lib/use-partner-updates'
import { EmptyState } from '@/components/workspace/empty-state'

export default function PartnerClosedPage() {
  const params = useParams<{ id: string }>()
  const supplierId = Number.parseInt(params.id, 10)

  const [supplierName, setSupplierName] = useState<string | null>(null)
  const [requests, setRequests] = useState<ARDetail[]>([])
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading')

  const loadController = useRef<AbortController | null>(null)
  const load = useCallback(async () => {
    loadController.current?.abort()
    const controller = new AbortController()
    loadController.current = controller
    try {
      const res = await fetch(`/api/partner/${supplierId}`, { cache: 'no-store', signal: controller.signal })
      if (controller.signal.aborted) return
      if (!res.ok) {
        setState(current => [401, 403, 404].includes(res.status) || current === 'loading' ? 'missing' : current)
        return
      }
      const body = (await res.json()) as { supplier: { name: string }; requests: ARDetail[] }
      if (controller.signal.aborted) return
      setSupplierName(body.supplier.name)
      setRequests(body.requests)
      setState('ready')
    } catch (error) {
      if (controller.signal.aborted) return
      setState(current => current === 'loading' ? 'missing' : current)
      throw error
    }
  }, [supplierId])

  useEffect(() => {
    if (!Number.isInteger(supplierId)) {
      setState('missing')
      return
    }
    setState('loading')
    setRequests([])
    setSupplierName(null)
    void load().catch(() => {})
    return () => { loadController.current?.abort() }
  }, [supplierId, load])

  usePartnerUpdates(supplierId, load)

  const closed = useMemo(() => requests.filter((r) => r.status === 'closed'), [requests])

  /** The bell is on every portal page, and still lists the unanswered ones. */
  const alerts: PartnerAlert[] = useMemo(
    () =>
      requests
        .filter((r) => r.status === 'new')
        .map((r) => ({ id: r.id, label: partnerRequestName(r), at: Date.parse(r.createdAt) })),
    [requests],
  )

  return (
    <PartnerFrame
      supplierId={supplierId}
      supplierName={supplierName}
      tab="closed"
      title="Order/Request History"
      toolbar={<div className="p-3 md:p-4"><PartnerHistoryTabs supplierId={supplierId} selected="requests" /></div>}
      alerts={alerts}
      onOpenAlert={(id) => { window.location.href = `/partner/${supplierId}/requests/${id}` }}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-3 pb-5 md:p-4">
        {state === 'ready' && (
          <p className="m-0 text-[12px] text-muted-foreground">
            {closed.length} {closed.length === 1 ? 'request' : 'requests'}
          </p>
        )}

        {state === 'missing' && (
          <p className="py-10 text-center text-[13px] text-muted-foreground">
            This portal link isn&apos;t active. Please check with Chris.
          </p>
        )}

        {state === 'ready' && closed.length === 0 && (
          <EmptyState
            art="bloom"
            className="py-16"
            title="No closed requests"
            hint="A request moves here once Chris is done with it."
          />
        )}

        {closed.map((r) => (
          <PartnerRequestCard
            key={r.id}
            request={r}
            href={`/partner/${supplierId}/requests/${r.id}`}
          />
        ))}

        {state === 'loading' && (
          <div className="py-16 text-center text-[13px] text-muted-foreground">Loading…</div>
        )}
      </div>
    </PartnerFrame>
  )
}
