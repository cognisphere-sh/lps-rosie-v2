'use client'

import { useEffect, useState } from 'react'
import { patchRow } from '@/components/workspace/editable'
import { formatMonthDay } from '@/lib/format'
import type { JobRequestRow } from '@/lib/rows'
import { cn } from '@/lib/utils'

const dateTagClass = 'inline-flex items-center whitespace-nowrap rounded-full bg-secondary px-2.5 py-0.5 text-[11.5px] font-semibold text-foreground'

function EditableEdd({ request, onSaved }: { request: Pick<JobRequestRow, 'id' | 'expectedInstallDate'>; onSaved: (id: number) => void }) {
  const [date, setDate] = useState(request.expectedInstallDate ?? '')
  const [editing, setEditing] = useState(false)
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
    <span className={cn(dateTagClass, 'relative hover:bg-muted focus-within:ring-2 focus-within:ring-ring', !date && 'border-2 border-primary')}>
      {!editing && (formatMonthDay(date, '/') || '—')}
      <input type="date" aria-label="Edit EDD" value={date} disabled={busy}
        className={editing
          ? 'min-w-0 bg-transparent text-inherit outline-none disabled:cursor-wait'
          : 'absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-wait'}
        onFocus={() => setEditing(true)}
        onBlur={() => setEditing(false)}
        onKeyDown={(event) => { if (event.key === 'Escape' || event.key === 'Enter') event.currentTarget.blur() }}
        onClick={(event) => { setEditing(true); try { event.currentTarget.showPicker?.() } catch { /* The visible input supports typing a date. */ } }}
        onChange={(event) => { void save(event.currentTarget.value) }} />
    </span>
    {error && <span role="alert" className="block whitespace-normal text-destructive">{error}</span>}
  </>
}

export function EditableFulfillment({ request, onSaved }: { request: Pick<JobRequestRow, 'id' | 'fulfillmentMethod'>; onSaved: (id: number) => void }) {
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
      await patchRow('job_requests', request.id, 'fulfillment_method', next)
      onSaved(request.id)
    } catch (error) {
      setMethod(previous)
      setError((error as Error).message)
    } finally { setBusy(false) }
  }

  return <>
    <span className={cn('relative inline-flex items-center whitespace-nowrap rounded-full border border-lps-edge bg-card px-2 py-0.5 text-[10.5px] font-semibold text-primary hover:bg-secondary focus-within:ring-2 focus-within:ring-ring', !method && 'border-2 border-primary')}>
      <span aria-hidden="true">{method === 'pickup' ? 'Pickup' : method === 'delivery' ? 'Delivery' : '-'}</span>
      <select aria-label="Pickup or delivery" value={method} disabled={busy}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-wait"
        onChange={(event) => { void save(event.target.value) }}>
        <option value="">-</option>
        <option value="pickup">Pickup</option>
        <option value="delivery">Delivery</option>
      </select>
    </span>
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
    ['EDD', formatMonthDay(request.expectedInstallDate, '/') || '—'],
    ['Fulfillment', request.fulfillmentMethod === 'pickup' ? 'Pickup' : request.fulfillmentMethod === 'delivery' ? 'Delivery' : '—'],
  ]

  return (
    <dl data-job-metadata className={cn('m-0 grid min-w-0 grid-cols-[max-content_max-content] items-center gap-x-2 gap-y-1 text-[11px]', className)}>
      {fields.filter(([label]) => showFulfillment || label !== 'Fulfillment').map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="sr-only">{label}</dt>
          <dd className="m-0 whitespace-nowrap font-semibold tabular-nums text-foreground">
            {label === 'EDD' && onDateSaved ? <EditableEdd key={request.id} request={request} onSaved={onDateSaved} />
              : label === 'Fulfillment' && onDateSaved ? <EditableFulfillment key={request.id} request={request} onSaved={onDateSaved} />
              : label === 'EDD' ? <span className={cn(dateTagClass, !request.expectedInstallDate && 'border-2 border-primary')}>{value}</span>
              : value}
          </dd>
        </div>
      ))}
    </dl>
  )
}
