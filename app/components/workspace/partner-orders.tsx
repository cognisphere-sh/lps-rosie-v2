'use client'

// The supplier order queue, with lifecycle filters and shared plant views.

import { useParams } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'

import { PartnerFrame, type PartnerAlert } from '@/components/workspace/partner'
import { OrderLineGroups, OrderStatusFilters, OrderViewControls, PartnerOrderCard, type OrderFilter, type OrderView } from '@/components/workspace/orders'
import { PartnerHistoryTabs } from './partner-history-tabs'
import { EmptyState } from './empty-state'
import type { Order } from '@/lib/orders'
import { redactPartnerRequestRefs } from '@/lib/partner-display'
import { usePartnerUpdates } from '@/lib/use-partner-updates'

export function PartnerOrdersView({ closed = false }: { closed?: boolean }) {
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
  const loadController = useRef<AbortController | null>(null)
  const [statuses, setStatuses] = useState<OrderFilter[]>(['new', 'processing'])
  const [view, setView] = useState<OrderView>('order')

  const loadOrders = useCallback(async () => {
    const version = ++revision.current
    loadController.current?.abort()
    const controller = new AbortController()
    loadController.current = controller
    try {
      const res = await fetch(`/api/partner/${supplierId}/orders`, { cache: 'no-store', signal: controller.signal })
      const body = await res.json() as { orders: Order[]; supplier: { name: string }; error?: string }
      if (!res.ok) throw new Error(body.error ?? 'Could not load orders')
      if (version !== revision.current) return
      setError(null)
      setOrders(body.orders)
      setSupplierName(body.supplier.name)
    } catch (error) { if (version === revision.current && !controller.signal.aborted) setError((error as Error).message) }
    finally { if (version === revision.current) setLoading(false) }
  }, [supplierId])

  useEffect(() => {
    setOrders([]); setSupplierName(null); setLoading(true); setError(null); setStatuses(['new', 'processing']); setView('order')
    void loadOrders()
    return () => {
      revision.current += 1
      loadController.current?.abort()
    }
  }, [loadOrders])

  const alertsController = useRef<AbortController | null>(null)
  const loadAlerts = useCallback(async () => {
    alertsController.current?.abort()
    const controller = new AbortController()
    alertsController.current = controller
    const res = await fetch(`/api/partner/${supplierId}`, { cache: 'no-store', signal: controller.signal })
    if (res.ok) {
      const body = (await res.json()) as {
        supplier: { name: string }
        requests: { id: number; status: string; jobName: string | null; createdAt: string }[]
      }
      if (controller.signal.aborted) return
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
  }, [supplierId])

  useEffect(() => {
    if (!Number.isInteger(supplierId)) return
    setAlerts([])
    void loadAlerts().catch(() => {})
    return () => { alertsController.current?.abort() }
  }, [supplierId, loadAlerts])

  const refresh = useCallback(async () => {
    await Promise.all([loadOrders(), loadAlerts().catch(() => {})])
  }, [loadOrders, loadAlerts])
  usePartnerUpdates(supplierId, refresh)

  const visibleOrders = orders.filter((order) => Boolean(order.closed || ['closed_won', 'closed_lost'].includes(order.status)) === closed)

  const shown = closed ? visibleOrders : visibleOrders.filter((order) => statuses.includes(order.status as OrderFilter))

  return (
    <PartnerFrame
      supplierId={supplierId}
      supplierName={supplierName}
      tab={closed ? "closed-orders" : "orders"}
      title={closed ? "Order/Request History" : "Orders"}
      // History keeps the desktop header and the closed requests page's plain
      // tab row, so its two tabs share one layout and switching never shifts it.
      hideHeaderOnDesktop={!closed}
      alerts={alerts}
      onAgentReply={loadOrders}
      onOpenAlert={(id) => { window.location.href = `/partner/${supplierId}/requests/${id}` }}
      // The Requests page's strip: buckets centred across the whole card, the
      // bell floating at its right. No Refresh button (2026-10-07) — the list
      // reloads on live updates, as Requests does.
      toolbar={closed ? <div className="p-3 md:p-4"><PartnerHistoryTabs supplierId={supplierId} selected="orders" /></div> : (rightActions) => <div className="relative flex flex-none items-center justify-center px-3 pt-3 md:px-4">
        <div className="relative flex w-full items-center justify-center rounded-2xl bg-card p-1.5 min-[900px]:min-h-[4.75rem] min-[900px]:px-3 min-[900px]:py-2.5">
          <div className="flex min-w-0 max-w-full gap-2 overflow-x-auto [scrollbar-width:none] max-[899px]:w-full">
            <OrderStatusFilters orders={visibleOrders} selected={statuses} onChange={setStatuses} />
          </div>
          {rightActions && <div className="absolute right-3 top-1/2 -translate-y-1/2">{rightActions}</div>}
        </div>
      </div>}
    >
      <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-3 pb-24 md:p-4 md:pb-24">
        {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-[13px] text-destructive"><span>{error}{orders.length > 0 && ' The last loaded orders are still shown.'}</span><button type="button" className="min-h-11 cursor-pointer rounded-lg border border-current px-4 font-semibold" onClick={() => void loadOrders()}>Retry</button></div>}
        {loading && <p className="py-16 text-center text-[13px] text-muted-foreground">Loading orders…</p>}
        {!loading && !error && visibleOrders.length === 0 && <EmptyState art={closed ? 'bloom' : 'seed'}
          title={closed ? "No closed orders" : "No orders yet"}
          hint={closed ? "Orders appear here when closed or when all their linked jobs are closed." : "New orders appear here once the customer confirms."} />}
        {!loading && !error && visibleOrders.length > 0 && shown.length === 0 && <div role="status"><EmptyState art="tag" title={statuses.length === 0 ? 'No order buckets selected' : 'Nothing in the selected buckets'} hint="Select one or more buckets to see those orders." /></div>}
        {view === 'order' ? shown.map((order) => <PartnerOrderCard key={order.id} order={order} supplierId={supplierId} />)
          : <OrderLineGroups orders={shown} groupBy={view} supplierId={supplierId} />}
      </div>
      <OrderViewControls value={view} onChange={setView} includeOrders floating />
      </div>
    </PartnerFrame>
  )
}
