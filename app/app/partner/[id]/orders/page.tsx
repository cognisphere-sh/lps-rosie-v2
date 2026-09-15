'use client'

// Customer-committed orders, scoped to the signed-in supplier.

import { useParams } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'

import { PartnerFrame, type PartnerAlert } from '@/components/workspace/partner'
import { OrderCard } from '@/components/workspace/orders'
import type { Order } from '@/lib/orders'
import { redactPartnerRequestRefs } from '@/lib/partner-display'

export default function PartnerOrdersPage() {
  const params = useParams<{ id: string }>()
  const supplierId = Number.parseInt(params.id, 10)
  const [supplierName, setSupplierName] = useState<string | null>(null)
  // The header bell is on every portal page, so this tab loads the same
  // unanswered-request list the Requests tab shows.
  const [alerts, setAlerts] = useState<PartnerAlert[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const revision = useRef(0)

  const loadOrders = useCallback(async () => {
    const version = ++revision.current
    setError(null)
    try {
      const res = await fetch(`/api/partner/${supplierId}/orders`, { cache: 'no-store' })
      const body = await res.json() as { orders: Order[]; supplier: { name: string }; error?: string }
      if (!res.ok) throw new Error(body.error ?? 'Could not load orders')
      if (version !== revision.current) return
      setOrders(body.orders)
      setSupplierName(body.supplier.name)
    } catch (error) { if (version === revision.current) setError((error as Error).message) }
    finally { if (version === revision.current) setLoading(false) }
  }, [supplierId])

  useEffect(() => {
    void loadOrders()
    const refresh = () => { if (document.visibilityState === 'visible') void loadOrders() }
    const timer = window.setInterval(refresh, 30000)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      revision.current += 1
      window.clearInterval(timer)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [loadOrders])

  useEffect(() => {
    if (!Number.isInteger(supplierId)) return
    void (async () => {
      const res = await fetch(`/api/partner/${supplierId}`)
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
              label: request.jobName ? redactPartnerRequestRefs(request.jobName) : 'Availability request',
              at: Date.parse(request.createdAt),
            })),
        )
      }
    })().catch(() => {})
  }, [supplierId])

  return (
    <PartnerFrame
      supplierId={supplierId}
      supplierName={supplierName}
      tab="orders"
      title="Orders"
      alerts={alerts}
      onOpenAlert={() => { window.location.href = `/partner/${supplierId}` }}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-3 pb-5 md:p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[12px] text-muted-foreground">Review customer orders and confirm them when ready.</p>
          <button className="min-h-9 rounded-md border border-border px-3 text-[12px] font-semibold hover:bg-muted" onClick={() => void loadOrders()}>Refresh</button>
        </div>
        {error && <p role="alert" className="text-[12px] text-destructive">{error}</p>}
        {loading && <p className="py-12 text-center text-[12px] text-muted-foreground">Loading orders…</p>}
        {!loading && !error && orders.length === 0 && <div className="flex flex-col items-center gap-2 py-16 text-center">
          <span className="text-[14px] font-semibold text-foreground">No orders yet</span>
          <span className="text-[12.5px] text-muted-foreground">Orders appear here once the customer commits.</span>
        </div>}
        {orders.map((order) => <OrderCard key={order.id} order={order} supplierId={supplierId} onChanged={loadOrders} />)}
      </div>
    </PartnerFrame>
  )
}
