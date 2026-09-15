'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { arResponseLabel } from '@/lib/availability'
import { money, num } from '@/lib/format'
import { isApsSupplier, ORDER_ITEM_STATUS_LABELS, ORDER_STATUS_META, orderSubtotal, type FulfillmentMethod, type Order, type OrderCandidate } from '@/lib/orders'

const field = 'h-9 rounded-md border border-input bg-background px-2 text-[12px] outline-none focus-visible:border-ring'
const button = 'inline-flex min-h-9 items-center justify-center rounded-md border border-border px-3 text-[12px] font-semibold hover:bg-muted disabled:opacity-50'
const primary = 'inline-flex min-h-9 items-center justify-center rounded-md bg-primary px-3 text-[12px] font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50'

/** The same supplier-facing order lines on both sides; job allocations are admin only. */
export function OrderCard({ order, supplierId, onChanged }: { order: Order; supplierId?: number; onChanged: () => void | Promise<void> }) {
  const [fulfillmentDate, setFulfillmentDate] = useState(order.fulfillmentDate ?? '')
  const [confirmationDate, setConfirmationDate] = useState(order.confirmationDate ?? new Date().toISOString().slice(0, 10))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const closed = order.status === 'closed_won' || order.status === 'closed_lost'
  const endpoint = supplierId == null ? `/api/orders/${order.id}` : `/api/partner/${supplierId}/orders/${order.id}`

  useEffect(() => {
    setFulfillmentDate(order.fulfillmentDate ?? '')
    setConfirmationDate(order.confirmationDate ?? new Date().toISOString().slice(0, 10))
  }, [order.fulfillmentDate, order.confirmationDate])

  async function write(body: object) {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(endpoint, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      const result = await res.json() as { error?: string }
      if (!res.ok) throw new Error(result.error ?? 'Could not update order')
      await onChanged()
    } catch (error) { setError((error as Error).message) }
    finally { setBusy(false) }
  }

  return <article className="rounded-lg border border-border bg-card p-3">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-[14px] font-bold">Order O-{order.id}</h3>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold">{ORDER_STATUS_META[order.status]?.label ?? order.status}</span>
        {supplierId == null && <span className="text-[12px] text-muted-foreground">{order.supplierName}</span>}
      </div>
      <span className="text-[13px] font-semibold">{money(orderSubtotal(order)) || 'Awaiting prices'}</span>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full text-left text-[12px]">
        <thead className="border-b border-border text-[11px] text-muted-foreground"><tr><th className="py-2 pr-3">Plant / size</th><th className="px-2 py-2 text-right">Quantity</th><th className="px-2 py-2">Status</th><th className="px-2 py-2 text-right">Unit price</th><th className="py-2 pl-2 text-right">Total</th></tr></thead>
        <tbody>{order.items.map((item) => <tr key={item.id} className="border-b border-border/50 last:border-0">
          <td className="py-2 pr-3"><span className="font-medium">{item.name}</span>{item.size && <span className="ml-1.5 text-muted-foreground">{item.size}</span>}
            {item.allocations?.map((allocation) => <div key={allocation.jobRequestItemId} className="mt-0.5 text-[11px] text-muted-foreground">JR-{allocation.jobRequestId}{allocation.jobName ? ` · ${allocation.jobName}` : ''} · {num(allocation.quantity)}</div>)}
            {item.notes && <p className="mt-0.5 text-[11px] text-muted-foreground">{item.notes}</p>}
          </td>
          <td className="px-2 py-2 text-right">{num(item.quantity)}</td><td className="whitespace-nowrap px-2 py-2">{ORDER_ITEM_STATUS_LABELS[item.status] ?? item.status}</td><td className="px-2 py-2 text-right">{money(item.unitPrice) || '—'}</td><td className="py-2 pl-2 text-right">{money(item.total) || '—'}</td>
        </tr>)}</tbody>
      </table>
    </div>
    {order.notes && <p className="mt-2 whitespace-pre-wrap text-[12px] text-muted-foreground">{order.notes}</p>}
    <div className="mt-3 flex flex-wrap items-end gap-3">
      <div className="flex min-h-9 items-center text-[12px] font-medium">{order.fulfillmentMethod === 'pickup' ? 'Pickup' : order.fulfillmentMethod === 'delivery' ? 'Delivery' : 'Pickup / delivery to be arranged'}</div>
      <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">Pickup/delivery date
        <input aria-label={`Pickup/delivery date for O-${order.id}`} type="date" className={field} value={fulfillmentDate} disabled={busy || closed} onChange={(event) => setFulfillmentDate(event.target.value)} />
      </label>
      {order.status === 'committed' ? <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">Confirmation date
        <input aria-label={`Confirmation date for O-${order.id}`} type="date" className={field} value={confirmationDate} disabled={busy} onChange={(event) => setConfirmationDate(event.target.value)} />
      </label> : <span className="pb-2 text-[12px] text-muted-foreground">Confirmation date: {order.confirmationDate ?? '—'}</span>}
      {!closed && fulfillmentDate !== (order.fulfillmentDate ?? '') && <button className={button} disabled={busy} onClick={() => void write({ fulfillmentDate: fulfillmentDate || null })}>Save date</button>}
      {order.status === 'committed' && <button className={primary} disabled={busy || !confirmationDate} onClick={() => void write({ status: 'confirmed', confirmationDate, fulfillmentDate: fulfillmentDate || null })}>{supplierId == null ? 'Record supplier confirmation' : 'Confirm order'}</button>}
      {supplierId == null && !closed && <div className="ml-auto flex flex-wrap gap-2">
        <button className={button} disabled={busy} onClick={() => void write({ status: 'closed_won' })}>Close Won</button>
        <button className={button} disabled={busy} onClick={() => void write({ status: 'closed_lost' })}>Close Lost</button>
      </div>}
    </div>
    {error && <p role="alert" className="mt-2 text-[12px] text-destructive">{error}</p>}
  </article>
}

interface JobChoice { id: number; name: string | null; fulfillment_method?: FulfillmentMethod | null }
interface OrdersPayload { orders: Order[]; candidates: OrderCandidate[]; jobs: JobChoice[]; error?: string }
const allocationKey = (candidateId: number, jobItemId: number) => `${candidateId}:${jobItemId}`

/** Create one supplier order from all or part of one or several customer jobs. */
export function JobOrders({ jobRequestId, onChanged, version = 0 }: { jobRequestId: number; onChanged?: () => void; version?: number }) {
  const [data, setData] = useState<OrdersPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [open, setOpen] = useState(false)
  const [extraJobs, setExtraJobs] = useState<number[]>([])
  const [supplierId, setSupplierId] = useState<number | null>(null)
  const [quantities, setQuantities] = useState<Record<string, string>>({})
  const [confirmed, setConfirmed] = useState(false)
  const [method, setMethod] = useState<FulfillmentMethod | ''>('')
  const [date, setDate] = useState('')
  const [notes, setNotes] = useState('')
  const [createdId, setCreatedId] = useState<number | null>(null)
  const revision = useRef(0)
  const initializedJob = useRef<number | null>(null)
  const extra = extraJobs.join(',')

  const load = useCallback(async () => {
    const version = ++revision.current
    setLoading(true)
    try {
      const res = await fetch(`/api/orders?job=${jobRequestId}${extra ? `&jobs=${extra}` : ''}`, { cache: 'no-store' })
      const body = await res.json() as OrdersPayload
      if (!res.ok) throw new Error(body.error ?? 'Could not load orders')
      if (version !== revision.current) return
      setData(body)
      setError(null)
      setSupplierId((current) => body.candidates.some((candidate) => candidate.supplierId === current) ? current
        : body.candidates.find((candidate) => isApsSupplier(candidate.supplierName))?.supplierId ?? body.candidates[0]?.supplierId ?? null)
      if (initializedJob.current !== jobRequestId) {
        setMethod(body.jobs.find((job) => job.id === jobRequestId)?.fulfillment_method ?? '')
        initializedJob.current = jobRequestId
      }
    } catch (error) { if (version === revision.current) setError((error as Error).message) }
    finally { if (version === revision.current) setLoading(false) }
  }, [jobRequestId, extra])

  useEffect(() => { void load(); return () => { revision.current += 1 } }, [load, version])
  useEffect(() => { setQuantities({}); setConfirmed(false); setExtraJobs([]); setCreatedId(null) }, [jobRequestId])

  const candidates = (data?.candidates ?? []).filter((candidate) => candidate.supplierId === supplierId)
  const suppliers = [...new Map((data?.candidates ?? []).map((candidate) => [candidate.supplierId, candidate.supplierName])).entries()]
  const selectedItems = candidates.flatMap((candidate) => {
    const allocations = candidate.allocations.flatMap((allocation) => {
      const value = quantities[allocationKey(candidate.availabilityRequestItemId, allocation.jobRequestItemId)]
      return value !== undefined ? [{ jobRequestItemId: allocation.jobRequestItemId, quantity: Number(value) }] : []
    })
    return allocations.length ? [{ availabilityRequestItemId: candidate.availabilityRequestItemId, allocations }] : []
  })
  const invalidQuantity = candidates.some((candidate) => {
    const values = candidate.allocations.map((allocation) => ({ allocation, raw: quantities[allocationKey(candidate.availabilityRequestItemId, allocation.jobRequestItemId)] })).filter(({ raw }) => raw !== undefined)
    return values.some(({ allocation, raw }) => !Number.isFinite(Number(raw)) || Number(raw) <= 0 || Number(raw) > allocation.remainingQuantity)
      || values.reduce((sum, { raw }) => sum + Number(raw), 0) > candidate.remainingQuantity
  })

  async function create() {
    setCreating(true); setError(null)
    try {
      const res = await fetch('/api/orders', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ supplierId, customerConfirmed: confirmed, fulfillmentMethod: method || null, fulfillmentDate: date || null, notes: notes || null, items: selectedItems }) })
      const body = await res.json() as { id: number; error?: string }
      if (!res.ok) throw new Error(body.error ?? 'Could not create order')
      setCreatedId(body.id); setQuantities({}); setConfirmed(false); setOpen(false); setNotes('')
      await load(); onChanged?.()
    } catch (error) { setError((error as Error).message) }
    finally { setCreating(false) }
  }

  async function changed() { await load(); onChanged?.() }

  return <section className="flex flex-col gap-3 p-3" aria-label="Job orders">
    <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-[12px] text-muted-foreground">{data?.orders.length ?? 0} orders · Combine jobs or split quantities into separate supplier orders.</p><button className={button} onClick={() => setOpen(!open)}>{open ? 'Cancel new order' : 'Create order'}</button></div>
    {error && <p role="alert" className="text-[12px] text-destructive">{error}</p>}
    {createdId && <p role="status" className="text-[12px] font-medium">Order O-{createdId} created. It is ready for supplier confirmation in the Orders tab.</p>}
    {open && <form className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3" onSubmit={(event) => { event.preventDefault(); void create() }}>
      <h3 className="text-[13px] font-bold">Create supplier order</h3>
      <div className="flex flex-wrap items-center gap-2"><span className="text-[12px]">JR-{jobRequestId}</span>
        {extraJobs.map((id) => <button key={id} type="button" className={button} onClick={() => { setExtraJobs(extraJobs.filter((job) => job !== id)); setConfirmed(false) }}>JR-{id} · Remove</button>)}
        <select aria-label="Add another job to this order" className={`${field} max-w-full`} value="" onChange={(event) => { if (event.target.value) setExtraJobs([...extraJobs, Number(event.target.value)]); setConfirmed(false) }}>
          <option value="">Add another job…</option>{data?.jobs.filter((job) => job.id !== jobRequestId && !extraJobs.includes(job.id)).map((job) => <option key={job.id} value={job.id}>JR-{job.id}{job.name ? ` · ${job.name}` : ''}</option>)}
        </select>
      </div>
      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">Supplier<select className={field} value={supplierId ?? ''} onChange={(event) => { setSupplierId(Number(event.target.value)); setConfirmed(false) }}><option value="" disabled>Select supplier</option>{suppliers.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
        <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">Pickup / delivery<select className={field} value={method} onChange={(event) => setMethod(event.target.value as FulfillmentMethod | '')}><option value="">To be arranged</option><option value="pickup">Pickup</option><option value="delivery">Delivery</option></select></label>
        <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">Pickup/delivery date<input type="date" className={field} value={date} onChange={(event) => setDate(event.target.value)} /></label>
      </div>
      {loading ? <p className="text-[12px] text-muted-foreground">Loading available quantities…</p> : candidates.length === 0 ? <p className="text-[12px] text-muted-foreground">No remaining supplier responses to order. Generate a quote and complete availability first.</p> : <div className="flex flex-col divide-y divide-border">
        {candidates.map((candidate) => <div key={candidate.availabilityRequestItemId} className="py-2">
          <div className="flex flex-wrap gap-x-2 text-[12px]"><span className="font-semibold">{candidate.name}</span><span>{candidate.size}</span><span className="text-muted-foreground">AR-{candidate.availabilityRequestId} · {arResponseLabel(candidate.status)} · {num(candidate.remainingQuantity)} remaining · {money(candidate.unitPrice) || 'Price pending'}</span></div>
          {candidate.allocations.map((allocation) => {
            const key = allocationKey(candidate.availabilityRequestItemId, allocation.jobRequestItemId)
            const checked = quantities[key] !== undefined
            const label = `Select ${candidate.name} for JR-${allocation.jobRequestId}`
            return <div key={key} className="mt-2 flex flex-wrap items-center gap-2 text-[12px]">
              <label className="flex min-h-9 items-center gap-2"><input type="checkbox" aria-label={label} checked={checked} onChange={(event) => {
                setQuantities((current) => {
                  const next = { ...current }
                  if (event.target.checked) {
                    const other = candidate.allocations.reduce((sum, otherAllocation) => sum + Number(current[allocationKey(candidate.availabilityRequestItemId, otherAllocation.jobRequestItemId)] ?? 0), 0)
                    next[key] = String(Math.max(0, Math.min(allocation.remainingQuantity, candidate.remainingQuantity - other)))
                  } else delete next[key]
                  return next
                }); setConfirmed(false)
              }} />JR-{allocation.jobRequestId}{allocation.jobName ? ` · ${allocation.jobName}` : ''}</label>
              <input aria-label={`Order quantity for ${candidate.name}, JR-${allocation.jobRequestId}`} type="number" min="0.001" step="any" max={allocation.remainingQuantity} disabled={!checked} className={`${field} w-24`} value={checked ? quantities[key] : ''} onChange={(event) => { setQuantities({ ...quantities, [key]: event.target.value }); setConfirmed(false) }} />
              <span className="text-[11px] text-muted-foreground">of {num(allocation.remainingQuantity)}</span>
            </div>
          })}
        </div>)}
      </div>}
      {invalidQuantity && <p role="alert" className="text-[12px] text-destructive">Enter positive quantities within the job and supplier quantities remaining.</p>}
      <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">Note to supplier<textarea className="min-h-16 rounded-md border border-input bg-background p-2 text-[12px]" value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
      <label className="flex items-start gap-2 text-[12px]"><input className="mt-0.5" type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />Customer has confirmed the selected quantities for every included job.</label>
      <div className="flex justify-end"><button type="submit" className={primary} disabled={creating || loading || !confirmed || !selectedItems.length || invalidQuantity}>{creating ? 'Creating…' : 'Create committed order'}</button></div>
    </form>}
    {loading && !data && <p className="py-6 text-center text-[12px] text-muted-foreground">Loading orders…</p>}
    {!loading && data?.orders.length === 0 && !open && <p className="py-6 text-center text-[12px] text-muted-foreground">No orders yet. Create an order once the customer confirms.</p>}
    {data?.orders.map((order) => <OrderCard key={order.id} order={order} onChanged={changed} />)}
  </section>
}
