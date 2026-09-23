'use client'
import { useEffect, useState } from 'react'
import type { Order } from '@/lib/orders'
import { OrderCard } from './orders'

export function PublicOrder({ token }: { token: string }) {
  const [order, setOrder] = useState<Order | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    const refresh = async () => {
      try {
        const response = await fetch(`/api/public/orders/${token}`, { cache: 'no-store' })
        const body = await response.json()
        if (!response.ok) throw new Error(body.error ?? 'Could not load this order')
        if (active) { setOrder(body.order); setError('') }
      } catch (e) { if (active) { setOrder(null); setError((e as Error).message) } }
    }
    setOrder(null); setError('')
    void refresh()
    const timer = window.setInterval(() => void refresh(), 30000)
    window.addEventListener('focus', refresh)
    return () => { active = false; window.clearInterval(timer); window.removeEventListener('focus', refresh) }
  }, [token])
  return <main className="mx-auto flex min-h-dvh max-w-5xl flex-col">
    <header className="border-b border-border p-4"><h1 className="text-lg font-semibold">Local Plant Supply · Order</h1><p className="text-sm text-muted-foreground">Shared order · Read-only</p></header>
    {error ? <p role="alert" className="p-4">{error}</p> : order ? <OrderCard order={order} supplierId={order.supplierId} /> : <p role="status" className="p-4">Loading order…</p>}
  </main>
}
