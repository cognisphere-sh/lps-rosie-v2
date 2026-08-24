'use client'

// The Orders tab — drawn, and drawn empty on purpose: there are no order
// tables yet (migration 0055 defers them; a closed_won job request is the hook
// they will be created from). The tab exists so the portal's shape is the
// final one; filling it is the order-tables work, not a portal change.

import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'

import { PortalFrame, type PortalAlert } from '@/components/workspace/portal'

export default function PortalOrdersPage() {
  const params = useParams<{ supplierId: string }>()
  const supplierId = Number.parseInt(params.supplierId, 10)
  const [supplierName, setSupplierName] = useState<string | null>(null)
  // The header bell is on every portal page, so this tab loads the same
  // unanswered-request list the Requests tab shows.
  const [alerts, setAlerts] = useState<PortalAlert[]>([])

  useEffect(() => {
    if (!Number.isInteger(supplierId)) return
    void (async () => {
      const res = await fetch(`/api/portal/${supplierId}`)
      if (res.ok) {
        const body = (await res.json()) as {
          supplier: { name: string }
          requests: { id: number; status: string; jobName: string | null; createdAt: string }[]
        }
        setSupplierName(body.supplier.name)
        setAlerts(
          body.requests
            .filter((request) => request.status === 'new')
            .map((request) => ({
              id: request.id,
              ref: `AR-${request.id}`,
              label: request.jobName || `AR-${request.id}`,
              at: Date.parse(request.createdAt),
            })),
        )
      }
    })().catch(() => {})
  }, [supplierId])

  return (
    <PortalFrame
      supplierId={supplierId}
      supplierName={supplierName}
      tab="orders"
      title="Orders"
      alerts={alerts}
      onOpenAlert={() => { window.location.href = `/portal/${supplierId}` }}
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-auto p-3 pb-5 md:p-4">
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <span className="text-[14px] font-semibold text-foreground">No orders yet</span>
          <span className="text-[12.5px] text-muted-foreground">
            Confirmed orders will appear here.
          </span>
        </div>
      </div>
    </PortalFrame>
  )
}
