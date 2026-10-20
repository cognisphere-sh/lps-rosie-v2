'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import { patchRow } from '@/components/workspace/editable'
import { useCoarsePointer, useLongPress } from '@/components/workspace/long-press'
import { useToast } from '@/components/workspace/frame'
import { money } from '@/lib/format'
import type { JobRequestRow } from '@/lib/rows'
import { cn } from '@/lib/utils'
import { errorCopy } from '@/lib/error-copy'

type Props = {
  requestId: number
  itemId: number
  selectedCandidateId: number | null | undefined
  name: string
  value: number | null
  touchTarget?: boolean
  onSaved: () => void
}

type Progress = { stage: 'save' | 'refresh'; draft: string; error?: string } | null

/** Only Job-line prices need settlement even when the refreshed value is unchanged. */
export function JobLinePrice(props: Props) {
  return <PriceEditor key={`${props.requestId}:${props.itemId}:${props.selectedCandidateId}`} {...props} />
}

function PriceEditor({ requestId, itemId, selectedCandidateId, name, value, touchTarget, onSaved }: Props) {
  const toast = useToast()
  const [confirmed, setConfirmed] = useState(value)
  const latestValue = useRef(value)
  const valueRevision = useRef(0)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [progress, setProgress] = useState<Progress>(null)
  const attempt = useRef(0)
  const editVersion = useRef(0)
  const mounted = useRef(true)
  const done = useRef(false)
  const unsettledEdit = useRef(false)
  const writes = useRef<Promise<void>>(Promise.resolve())
  const trigger = useRef<HTMLButtonElement>(null)
  const coarse = useCoarsePointer()
  const label = `Unit price for ${name}`
  useLayoutEffect(() => {
    if (!Object.is(latestValue.current, value)) {
      latestValue.current = value
      valueRevision.current++
    }
    setConfirmed(value)
  }, [value])
  useLayoutEffect(() => {
    mounted.current = true
    return () => { mounted.current = false; attempt.current++ }
  }, [])

  const restoreTrigger = () => requestAnimationFrame(() => {
    if (mounted.current && trigger.current?.isConnected && !trigger.current.closest('[inert]')) {
      trigger.current.focus({ preventScroll: true })
    }
  })
  const startEdit = () => {
    // A previous save may settle the underlying value, never this newer input.
    editVersion.current++
    setDraft(progress ? progress.draft : confirmed == null ? '' : String(confirmed))
    unsettledEdit.current = progress !== null
    done.current = false
    setEditing(true)
  }
  const hold = useLongPress(startEdit, coarse && !editing)

  async function save(next: string, refreshOnly = false) {
    const mine = ++attempt.current
    const edit = editVersion.current
    const current = () => mounted.current && mine === attempt.current
    let stage: 'save' | 'refresh' = refreshOnly ? 'refresh' : 'save'
    setDraft(next)
    setProgress({ stage, draft: next })
    try {
      if (!refreshOnly) {
        // Keep this cell's writes in order while allowing a newer draft to open.
        const write = writes.current.catch(() => {}).then(async () => {
          if (current()) await patchRow('job_request_items', itemId, 'unit_price', next)
        })
        writes.current = write
        await write
      }
      if (!current()) return
      stage = 'refresh'
      setProgress({ stage, draft: next })
      const beforeRefresh = valueRevision.current
      const response = await fetch(`/api/requests/${requestId}`, { cache: 'no-store' })
      const body = await response.json() as { request?: JobRequestRow; error?: string }
      if (!current()) return
      if (!response.ok || body.request?.id !== requestId) throw new Error(body.error || 'Could not refresh price')
      const item = body.request.items.find((row) => row.id === itemId)
      if (!item || item.selectedCandidateId !== selectedCandidateId) throw new Error('The line or selected candidate changed. Reopen its price to edit.')
      if (item.unitPrice !== null && (typeof item.unitPrice !== 'number' || !Number.isFinite(item.unitPrice))) throw new Error('Could not confirm refreshed price')
      // The read model is authoritative.
      // Clear the draft after a completed read even when NULL was also the old value.
      // A newer authoritative parent read must not be replaced by this older request.
      setConfirmed(valueRevision.current === beforeRefresh ? item.unitPrice : latestValue.current)
      if (edit === editVersion.current) setDraft('')
      setProgress(null)
      onSaved()
    } catch (cause) {
      if (!current()) return
      const error = errorCopy(cause, 'Could not update price')
      setProgress({ stage, draft: next, error })
      toast(error, 'error')
    }
  }

  const commit = (restoreFocus: boolean) => {
    if (done.current) return
    done.current = true
    const next = draft.trim()
    setEditing(false)
    const before = confirmed == null ? '' : String(confirmed)
    if (next !== before || unsettledEdit.current) void save(next)
    if (restoreFocus) restoreTrigger()
  }
  const cancel = () => {
    editVersion.current++
    done.current = true
    setEditing(false)
    setDraft('')
    restoreTrigger()
  }

  return <div className="min-w-0">
    {editing ? <input autoFocus type="number" step="any" aria-label={label} value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => commit(false)}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (event.key === 'Enter') { event.preventDefault(); commit(true) }
        else if (event.key === 'Tab') commit(false)
        else if (event.key === 'Escape') { event.preventDefault(); cancel() }
      }}
      className={cn('w-full min-w-0 rounded-md border border-primary bg-card px-1.5 py-0.5 text-center text-[13px] tabular-nums text-foreground outline-none', touchTarget && 'min-h-11')}
    /> : <button ref={trigger} type="button" data-cell-editor aria-label={label} title={label} {...hold}
      onClick={(event) => { event.stopPropagation(); if (!coarse || event.detail === 0) startEdit() }}
      className={cn('w-full min-w-0 cursor-text truncate rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-center text-[13px] tabular-nums text-foreground transition-colors duration-150 hover:border-border hover:bg-lps-tint', touchTarget && 'min-h-11 outline-none focus-visible:ring-2 focus-visible:ring-ring')}>
      {money(progress && !progress.error ? progress.draft : confirmed) || <span className="text-lps-dim">—</span>}
    </button>}
    {progress && !editing && <div className="break-words px-1 text-center text-[11px] leading-tight [overflow-wrap:anywhere]">
      {progress.error ? <div role="alert" className="text-destructive">
        <span>Draft: {progress.draft || 'blank'}. {progress.stage === 'save' ? 'Price not saved.' : 'Price not confirmed.'} {progress.error}</span>
        <button type="button" className={cn('mt-1 w-full rounded px-1 py-1 font-semibold underline hover:bg-muted', touchTarget && 'min-h-11')}
          onClick={(event) => { event.stopPropagation(); void save(progress.draft, progress.stage === 'refresh') }}>Retry price</button>
      </div> : <span role="status" className="text-muted-foreground">{progress.stage === 'save' ? 'Saving price…' : 'Refreshing price…'}</span>}
    </div>}
  </div>
}
