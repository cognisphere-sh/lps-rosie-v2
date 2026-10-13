'use client'
import { useEffect, useState } from 'react'
import type { Order } from '@/lib/orders'

export function OrderSharing({ order, closed, onChanged }: { order: Order; closed: boolean; onChanged?: () => void | Promise<void> }) {
  const [token, setToken] = useState(order.publicToken ?? null)
  useEffect(() => setToken(order.publicToken ?? null), [order.publicToken])
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const url = (value: string) => `${window.location.origin}/public/orders/${value}`
  async function copy(value: string) {
    try { await navigator.clipboard.writeText(url(value)); setNotice('Link copied') }
    catch { setNotice('Could not copy automatically. Select and copy the URL below.') }
  }
  async function publish(isPublic: boolean) {
    setBusy(true); setError(''); setNotice('')
    // Optimistic for Make private only: a public link needs the server's token.
    const before = token
    if (!isPublic) setToken(null)
    try {
      const response = await fetch(`/api/orders/${order.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isPublic }) })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? 'Could not update sharing')
      setToken(body.publicToken)
      if (body.publicToken) await copy(body.publicToken)
      else setNotice('Order is private. Previous link revoked.')
      await onChanged?.()
    } catch (e) {
      if (!isPublic) setToken(before)
      setError((e as Error).message)
    } finally { setBusy(false) }
  }
  const button = 'min-h-9 rounded-md border border-border bg-card px-3 text-xs font-semibold disabled:opacity-50'
  return <div className="space-y-2 print:hidden">
    <button type="button" className={button} aria-expanded={open} onClick={() => setOpen(!open)}>Share public link</button>
    {open && <section aria-label="Order sharing" className="space-y-2 rounded-lg border border-border p-3">
      <p className="text-xs text-muted-foreground">{closed ? 'This order is closed and cannot be made public.' : 'Anyone with this link can view supplier-facing order details, including customer contacts and delivery addresses, until it closes or is made private.'}</p>
      {token && !closed && <>
        <input aria-label="Public order URL" readOnly value={url(token)} onFocus={e => e.target.select()} className="w-full rounded border p-2 text-xs" />
        <button type="button" className={button} disabled={busy} onClick={() => void copy(token)}>Copy public link</button>
      </>}
      <button type="button" className={button} disabled={busy || (closed && !token)} onClick={() => void publish(!token)}>{busy ? 'Saving…' : token ? 'Make private' : 'Make public'}</button>
      {notice && <p role="status" className="text-xs">{notice}</p>}
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    </section>}
  </div>
}
