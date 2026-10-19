'use client'

import { useEffect, useRef, useState } from 'react'
import { datePickerProps, patchRow } from '@/components/workspace/editable'
import { useCoarsePointer, useLongPress } from '@/components/workspace/long-press'
import { formatWeekdayMonthDay } from '@/lib/format'
import type { JobRequestRow } from '@/lib/rows'
import { cn } from '@/lib/utils'

const dateTagClass = 'inline-flex items-center whitespace-nowrap rounded-full bg-secondary px-2.5 py-0.5 text-[12px] font-semibold text-foreground'

function EditableEdd({ request, onSaved, tapToEdit = false }: { request: Pick<JobRequestRow, 'id' | 'expectedInstallDate'>; onSaved: (id: number) => void; tapToEdit?: boolean }) {
  const [date, setDate] = useState(request.expectedInstallDate ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  // Touch normally needs a hold so scrolling past never edits; `tapToEdit` opts a tap in.
  const coarse = useCoarsePointer() && !tapToEdit
  const field = useRef<HTMLInputElement>(null)
  // Touch: a tap may start a scroll, so only a hold opens the calendar.
  const hold = useLongPress(() => {}, coarse, () => { try { field.current?.showPicker?.() } catch { field.current?.focus() } })
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
    <span {...hold} className={cn(dateTagClass, 'relative transition-colors duration-150 hover:bg-muted focus-within:ring-2 focus-within:ring-ring', !date && 'border border-dashed border-primary bg-card text-primary')}>
      {/* Always Day, MM/DD: the native input stays an invisible overlay whose
          tap opens the calendar, never the raw mm/dd/yyyy field. */}
      {formatWeekdayMonthDay(date) || 'Set date'}
      <input ref={field} type="date" aria-label="Edit EDD" value={date} disabled={busy}
        className={cn('absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-wait', coarse && 'pointer-events-none')}
        {...datePickerProps({
          onKeyDown: (event) => { if (event.key === 'Escape' || event.key === 'Enter') event.currentTarget.blur() },
          onChange: (event) => { void save(event.currentTarget.value) },
        })} />
    </span>
    {error && <span role="alert" className="block whitespace-normal text-destructive">{error}</span>}
  </>
}

export function EditableFulfillment({ request, onSaved, tapToEdit = false }: { request: Pick<JobRequestRow, 'id' | 'fulfillmentMethod'>; onSaved: (id: number) => void; tapToEdit?: boolean }) {
  const [method, setMethod] = useState(request.fulfillmentMethod ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  // Touch normally needs a hold so scrolling past never edits; `tapToEdit` opts a tap in.
  const coarse = useCoarsePointer() && !tapToEdit
  const field = useRef<HTMLSelectElement>(null)
  const hold = useLongPress(() => {}, coarse, () => { try { field.current?.showPicker?.() } catch { field.current?.focus() } })
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
    <span {...hold} className={cn('relative inline-flex items-center whitespace-nowrap rounded-full border border-lps-edge bg-card px-2 py-0.5 text-[11px] font-semibold text-primary transition-colors duration-150 hover:bg-secondary focus-within:ring-2 focus-within:ring-ring', !method && 'border-dashed border-primary')}>
      <span aria-hidden="true">{method === 'pickup' ? 'Pickup' : method === 'delivery' ? 'Delivery' : 'Set mode'}</span>
      <select ref={field} aria-label="Pickup or delivery" value={method} disabled={busy}
        className={cn('absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-wait', coarse && 'pointer-events-none')}
        onChange={(event) => { void save(event.target.value) }}>
        <option value="">-</option>
        <option value="pickup">Pickup</option>
        <option value="delivery">Delivery</option>
      </select>
    </span>
    {error && <span role="alert" className="block whitespace-normal text-destructive">{error}</span>}
  </>
}

export function JobMetadata({ request, className, onDateSaved, showFulfillment = true, tapToEdit = false }: {
  request: Pick<JobRequestRow, 'id' | 'expectedInstallDate' | 'fulfillmentMethod'>
  className?: string
  onDateSaved?: (id: number) => void
  showFulfillment?: boolean
  tapToEdit?: boolean
}) {
  const fields = [
    ['EDD', formatWeekdayMonthDay(request.expectedInstallDate) || '—'],
    ['Fulfillment', request.fulfillmentMethod === 'pickup' ? 'Pickup' : request.fulfillmentMethod === 'delivery' ? 'Delivery' : '—'],
  ]

  return (
    <dl data-job-metadata className={cn('m-0 grid min-w-0 grid-cols-[max-content_max-content] items-center gap-x-2 gap-y-1 text-[11px]', className)}>
      {fields.filter(([label]) => showFulfillment || label !== 'Fulfillment').map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="sr-only">{label}</dt>
          <dd className="m-0 whitespace-nowrap font-semibold tabular-nums text-foreground">
            {label === 'EDD' && onDateSaved ? <EditableEdd key={request.id} request={request} onSaved={onDateSaved} tapToEdit={tapToEdit} />
              : label === 'Fulfillment' && onDateSaved ? <EditableFulfillment key={request.id} request={request} onSaved={onDateSaved} tapToEdit={tapToEdit} />
              : label === 'EDD' ? <span className={cn(dateTagClass, !request.expectedInstallDate && 'border-2 border-primary')}>{value}</span>
              : value}
          </dd>
        </div>
      ))}
    </dl>
  )
}
