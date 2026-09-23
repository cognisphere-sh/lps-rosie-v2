'use client'

import Link from 'next/link'
import { Printer, RefreshCw } from 'lucide-react'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'

import { ChevronLeft } from '@/components/workspace/icons'
import { OrderCard } from '@/components/workspace/orders'
import { PartnerFrame, type PartnerAlert } from '@/components/workspace/partner'
import { orderRecordName, type Order } from '@/lib/orders'
import { redactPartnerRequestRefs } from '@/lib/partner-display'

export default function PartnerOrderPage() {
  const params = useParams<{ id: string; orderId: string }>()
  const supplierId = Number.parseInt(params.id, 10)
  const orderId = Number.parseInt(params.orderId, 10)
  const [order, setOrder] = useState<Order | null>(null)
  const [canEdit, setCanEdit] = useState(false)
  const [canEditFulfillmentMethod, setCanEditFulfillmentMethod] = useState(false)
  const [alerts, setAlerts] = useState<PartnerAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const revision = useRef(0)
  const loadController = useRef<AbortController | null>(null)

  const load = useCallback(async () => {
    const version = ++revision.current
    loadController.current?.abort()
    const controller = new AbortController()
    loadController.current = controller
    try {
      const res = await fetch(`/api/partner/${supplierId}/orders/${orderId}`, { cache: 'no-store', signal: controller.signal })
      const body = await res.json() as { order: Order; canEdit: boolean; canEditFulfillmentMethod?: boolean; error?: string }
      if (version !== revision.current) return
      if (!res.ok) {
        if (res.status === 401 || res.status === 403 || res.status === 404) { setOrder(null); setCanEdit(false); setCanEditFulfillmentMethod(false) }
        throw new Error(body.error ?? 'Could not load this order')
      }
      setOrder(body.order)
      setCanEdit(body.canEdit === true)
      setCanEditFulfillmentMethod(body.canEditFulfillmentMethod === true)
      setError(null)
    } catch (error) {
      if (version === revision.current && !controller.signal.aborted) setError((error as Error).message)
    } finally { if (version === revision.current) setLoading(false) }
  }, [supplierId, orderId])

  useEffect(() => {
    setOrder(null); setCanEdit(false); setCanEditFulfillmentMethod(false); setLoading(true); setError(null)
    void load()
    const refresh = () => { if (document.visibilityState === 'visible') void load() }
    const timer = window.setInterval(refresh, 30000)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      revision.current += 1
      loadController.current?.abort()
      window.clearInterval(timer)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [load])

  useEffect(() => {
    let alive = true
    setAlerts([])
    void (async () => {
      const res = await fetch(`/api/partner/${supplierId}`, { cache: 'no-store' })
      if (!res.ok) return
      const body = await res.json() as { requests: { id: number; status: string; jobName: string | null; createdAt: string }[] }
      if (!alive) return
      setAlerts(body.requests.filter((request) => request.status === 'new').map((request) => ({ id: request.id, label: request.jobName ? redactPartnerRequestRefs(request.jobName) : 'Availability request', at: Date.parse(request.createdAt) })))
    })().catch(() => {})
    return () => { alive = false }
  }, [supplierId])

  const closed = Boolean(order?.closed || order?.status === 'closed_won' || order?.status === 'closed_lost')

  return <PartnerFrame supplierId={supplierId} supplierName={order?.supplierName ?? null} tab={closed ? 'closed-orders' : 'orders'} title={order ? `Order ${orderRecordName(order)}` : 'Order'} hideHeaderOnDesktop
    alerts={alerts} onAgentReply={load} onOpenAlert={(id) => { window.location.href = `/partner/${supplierId}/requests/${id}` }}
    toolbar={(rightActions) => <div className="flex flex-wrap items-center gap-2.5 px-3 py-3 md:px-4">
      <Link href={`/partner/${supplierId}/${closed ? 'closed-orders' : 'orders'}`} className="inline-flex min-h-11 items-center gap-1 rounded-full border border-border bg-card px-3.5 text-[12.5px] font-semibold text-foreground no-underline hover:bg-lps-tint"><span className="flex size-3.5"><ChevronLeft /></span>{closed ? 'Closed Orders' : 'Orders'}</Link>
      {order && <span className="whitespace-nowrap text-[11px] text-muted-foreground">{order.items.length} {order.items.length === 1 ? 'line' : 'lines'}</span>}
      <div className="ml-auto flex items-center gap-2.5 print:hidden"><button type="button" aria-label="Refresh" title="Refresh" className="flex size-9 items-center justify-center rounded-lg border border-border bg-card hover:bg-lps-tint" onClick={() => void load()}><RefreshCw className="size-4" /></button>{order && <button type="button" aria-label="Print" title="Print" className="flex size-9 items-center justify-center rounded-lg border border-border bg-card hover:bg-lps-tint" onClick={() => window.print()}><Printer className="size-4" /></button>}{rightActions}</div>
    </div>}>
      {loading && <p className="py-12 text-center text-[12px] text-muted-foreground">Loading order…</p>}
      {error && <p role="alert" className="mx-3 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-[13px] text-destructive">{error}{order && ' The last loaded order is still shown.'}</p>}
      {order && <OrderCard key={order.id} order={order} supplierId={supplierId} canEdit={canEdit} canEditFulfillmentMethod={canEditFulfillmentMethod} onChanged={load} />}
  </PartnerFrame>
}
