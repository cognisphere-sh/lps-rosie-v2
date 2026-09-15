'use client'

import { useEffect, useState } from 'react'
import { patchRow } from '@/components/workspace/editable'
import { formatMonthDay } from '@/lib/format'
import type { JobRequestRow } from '@/lib/rows'
import { cn } from '@/lib/utils'

function EditableEdd({ request, onSaved }: { request: Pick<JobRequestRow, 'id' | 'expectedInstallDate'>; onSaved: (id: number) => void }) {
  const [date, setDate] = useState(request.expectedInstallDate ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { setDate(request.expectedInstallDate ?? '') }, [request.id, request.expectedInstallDate])

  async function save(next: string) {
    if (next === date || busy) return
    const previous = date
    setDate(next)
    setBusy(true)
    setError('')
    try {
      await patchRow('job_requests', request.id, 'expected_install_date', next)
      onSaved(request.id)
    } catch (error) {
      setDate(previous)
      setError((error as Error).message)
    } finally { setBusy(false) }
  }

  return <>
    <span className="relative inline-flex min-h-8 items-center rounded hover:bg-muted focus-within:ring-2 focus-within:ring-ring">
      {formatMonthDay(date) || '—'}
      <input type="date" aria-label="Edit EDD" value={date} disabled={busy}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-wait"
        onClick={(event) => { try { event.currentTarget.showPicker?.() } catch { /* The native date input remains available. */ } }}
        onChange={(event) => { void save(event.currentTarget.value) }} />
    </span>
    {error && <span role="alert" className="block whitespace-normal text-destructive">{error}</span>}
  </>
}

function EditableFulfillment({ request, onSaved }: { request: Pick<JobRequestRow, 'id' | 'fulfillmentMethod'>; onSaved: (id: number) => void }) {
  const [method, setMethod] = useState(request.fulfillmentMethod ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { setMethod(request.fulfillmentMethod ?? '') }, [request.id, request.fulfillmentMethod])

  async function save(next: string) {
    if (next === method || busy) return
    const previous = method
    setMethod(next)
    setBusy(true)
    setError('')
    try {
      await patchRow('job_requests', request.id, 'fulfillment_method', next || null)
      onSaved(request.id)
    } catch (error) {
      setMethod(previous)
      setError((error as Error).message)
    } finally { setBusy(false) }
  }

  return <>
    <select aria-label="Pickup or delivery" value={method} disabled={busy}
      className="min-h-8 rounded border border-border bg-card px-1.5 text-[11px] font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait"
      onChange={(event) => { void save(event.target.value) }}>
      <option value="">Pickup/Delivery</option>
      <option value="pickup">Pickup</option>
      <option value="delivery">Delivery</option>
    </select>
    {error && <span role="alert" className="block whitespace-normal text-destructive">{error}</span>}
  </>
}

export function JobMetadata({ request, className, onDateSaved, showFulfillment = true }: {
  request: Pick<JobRequestRow, 'id' | 'expectedInstallDate' | 'fulfillmentMethod'>
  className?: string
  onDateSaved?: (id: number) => void
  showFulfillment?: boolean
}) {
  const fields = [
    ['EDD', formatMonthDay(request.expectedInstallDate) || '—'],
    ['Fulfillment', request.fulfillmentMethod === 'pickup' ? 'Pickup' : request.fulfillmentMethod === 'delivery' ? 'Delivery' : '—'],
  ]

  return (
    <dl data-job-metadata className={cn('m-0 grid min-w-0 grid-cols-[max-content_max-content] items-center gap-x-2 gap-y-1 text-[11px]', className)}>
      {fields.filter(([label]) => showFulfillment || label !== 'Fulfillment').map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="whitespace-nowrap text-muted-foreground">{label}</dt>
          <dd className="m-0 whitespace-nowrap font-semibold tabular-nums text-foreground">
            {label === 'EDD' && onDateSaved ? <EditableEdd key={request.id} request={request} onSaved={onDateSaved} />
              : label === 'Fulfillment' && onDateSaved ? <EditableFulfillment key={request.id} request={request} onSaved={onDateSaved} />
              : value}
          </dd>
        </div>
      ))}
    </dl>
  )
}
