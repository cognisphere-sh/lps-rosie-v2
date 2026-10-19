'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Printer } from 'lucide-react'

import { ARPrintSheet } from '@/components/workspace/ar-print-sheet'
import { ARSharing } from '@/components/workspace/ar-sharing'
import { ARRequestNote, ARSubmitBar } from '@/components/workspace/availability-request-view'
import { AnswerCell, ARLineTable, ARStatusPill } from '@/components/workspace/availability'
import { toggleStatus } from '@/components/workspace/demand-summary'
import { SummaryStrip } from '@/components/workspace/partner-summary-strip'
import { availabilityRequestStatusChanged } from '@/lib/chat-bus'
import { arShownStatus, arSubtotal, availabilityRecordName, withLineChanges, type ARDetail } from '@/lib/availability'
import { formatWeekdayMonthDay } from '@/lib/format'
import { requestRef } from '@/lib/job-requests'
import { useJobUpdates } from '@/lib/use-job-updates'
import { cn } from '@/lib/utils'

type WriteOperation =
  | { kind: 'line'; itemId: number; fields: string[]; body: Record<string, unknown> }
  | { kind: 'note'; body: Record<string, unknown> }
  | { kind: 'share'; body: Record<string, unknown> }
  | { kind: 'status'; body: Record<string, unknown> }
  | { kind: 'submit'; body: Record<string, unknown> }

function abortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

export type AREditor = ReturnType<typeof useAREditor>

/** The 899/900 breakpoint the AR table switches to cards at. */
export function useARNarrow(): boolean {
  const [narrow, setNarrow] = useState(false)
  useEffect(() => {
    if (!window.matchMedia) return
    const media = window.matchMedia('(max-width: 899px)')
    const update = () => setNarrow(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  return narrow
}

/**
 * One availability request's admin editing state — its load, live refresh and
 * the serialized write queue. One mount edits one AR: callers key the
 * component that owns it by the AR (and the drawer by its open session), so a
 * new AR starts clean and unmounting aborts every pending read and write.
 */
export function useAREditor(id: number) {
  const [ar, setArState] = useState<ARDetail | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveNotice, setSaveNotice] = useState('')

  const alive = useRef(false)
  const arRef = useRef<ARDetail | null>(null)
  const controllers = useRef(new Set<AbortController>())
  const loadController = useRef<AbortController | null>(null)
  const lineControllers = useRef(new Map<string, AbortController>())
  const statusController = useRef<AbortController | null>(null)
  const submitController = useRef<AbortController | null>(null)
  const loadSequence = useRef(0)
  const lineSequences = useRef(new Map<string, number>())
  const statusSequence = useRef(0)
  const submitSequence = useRef(0)
  const writeTail = useRef<Promise<void>>(Promise.resolve())
  const submitToken = useRef<symbol | null>(null)

  const setAr = useCallback((next: ARDetail | null) => {
    arRef.current = next
    setArState(next)
  }, [])

  const load = useCallback(async (background = false) => {
    const sequence = ++loadSequence.current
    loadController.current?.abort()
    const controller = new AbortController()
    loadController.current = controller
    controllers.current.add(controller)
    if (alive.current) {
      if (!background) setAr(null)
      setError('')
    }
    try {
      const response = await fetch(`/api/availability-requests/${id}`, {
        cache: 'no-store',
        signal: controller.signal,
      })
      if (!response.ok) {
        if (response.status === 404 && alive.current && sequence === loadSequence.current && !controller.signal.aborted) setAr(null)
        throw new Error(`AR-${id} not found`)
      }
      const body = (await response.json()) as { request: ARDetail }
      if (!alive.current || sequence !== loadSequence.current || controller.signal.aborted) return
      setAr(body.request)
    } catch (caught) {
      if (abortError(caught)) return
      if (!alive.current || sequence !== loadSequence.current || controller.signal.aborted) return
      setError((caught as Error).message)
    } finally {
      controllers.current.delete(controller)
      if (loadController.current === controller) loadController.current = null
    }
  }, [id, setAr])

  useEffect(() => {
    alive.current = true
    void load()
    const owned = controllers.current
    return () => {
      alive.current = false
      for (const controller of owned) controller.abort()
      owned.clear()
      submitToken.current = null
    }
  }, [load])

  useJobUpdates(async () => {
    if (!alive.current) return
    await writeTail.current
    if (alive.current) await load(true)
  })

  const enqueueWrite = useCallback((operation: WriteOperation): Promise<boolean> => {
    if (!alive.current) return Promise.resolve(false)
    // Read before the caller's optimistic copy is applied, so a status change
    // the write confirms is still announced.
    const beforeStatus = arRef.current?.status
    const beforeSubmittedAt = arRef.current?.submittedAt
    // A pre-write background read must not overwrite the confirmed write.
    loadSequence.current++
    loadController.current?.abort()
    setError('')
    setSaveNotice('')

    let sequence: number
    let controller: AbortController
    // Moving between fields must preserve each queued edit. Only a newer edit
    // to the same fields supersedes an earlier one.
    // The request's note and customer-sharing flag queue like more line fields.
    const keyed = operation.kind === 'line' || operation.kind === 'note' || operation.kind === 'share'
    const lineKey = operation.kind === 'line' ? `${operation.itemId}:${[...operation.fields].sort().join(',')}` : operation.kind
    if (keyed) {
      sequence = (lineSequences.current.get(lineKey) ?? 0) + 1
      lineSequences.current.set(lineKey, sequence)
      lineControllers.current.get(lineKey)?.abort()
      controller = new AbortController()
      lineControllers.current.set(lineKey, controller)
    } else if (operation.kind === 'status') {
      sequence = ++statusSequence.current
      statusController.current?.abort()
      controller = new AbortController()
      statusController.current = controller
    } else {
      sequence = ++submitSequence.current
      submitController.current?.abort()
      controller = new AbortController()
      submitController.current = controller
    }
    controllers.current.add(controller)

    const latest = () => {
      if (!alive.current || controller.signal.aborted) return false
      if (keyed) return lineSequences.current.get(lineKey) === sequence
      if (operation.kind === 'status') return statusSequence.current === sequence
      return submitSequence.current === sequence
    }

    const release = () => {
      controllers.current.delete(controller)
      if (keyed && lineControllers.current.get(lineKey) === controller) {
        lineControllers.current.delete(lineKey)
      } else if (operation.kind === 'status' && statusController.current === controller) {
        statusController.current = null
      } else if (operation.kind === 'submit' && submitController.current === controller) {
        submitController.current = null
      }
    }

    const execute = async (): Promise<boolean> => {
      if (!latest()) {
        release()
        return false
      }
      try {
        const response = await fetch(`/api/availability-requests/${id}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(operation.body),
          signal: controller.signal,
        })
        if (!latest()) return false
        if (!response.ok) {
          const failed = (await response.json().catch(() => ({}))) as { error?: string }
          if (!latest()) return false
          setError(failed.error ?? 'Could not save')
        }

        const refreshed = await fetch(`/api/availability-requests/${id}`, {
          cache: 'no-store',
          signal: controller.signal,
        })
        if (!refreshed.ok) {
          if (refreshed.status === 404 && latest()) setAr(null)
          throw new Error(`AR-${id} not found`)
        }
        const body = (await refreshed.json()) as { request: ARDetail }
        if (!latest()) return false
        setAr(body.request)
        if (response.ok && (body.request.status !== beforeStatus || body.request.submittedAt !== beforeSubmittedAt)) {
          availabilityRequestStatusChanged({ arId: id, status: body.request.status, submittedAt: body.request.submittedAt })
        }
        return response.ok
      } catch (caught) {
        if (abortError(caught) || !latest()) return false
        setError(operation.kind === 'submit' ? 'Could not submit request' : 'Could not save')
        return false
      } finally {
        release()
      }
    }

    const result = writeTail.current.then(execute, execute)
    writeTail.current = result.then(() => undefined, () => undefined)
    return result
  }, [id, setAr])

  // Optimistic throughout: each write shows at once, and the confirmed read
  // that follows it — success or failure — settles what is really saved.
  const applyLocal = useCallback((update: (current: ARDetail) => ARDetail) => {
    if (alive.current && arRef.current) setAr(update(arRef.current))
  }, [setAr])
  const applyLine = useCallback((itemId: number, changes: Record<string, string>) => applyLocal((current) => ({
    ...current,
    items: current.items.map((item) => (item.id === itemId ? withLineChanges(item, changes) : item)),
  })), [applyLocal])

  const patchLine = useCallback(async (itemId: number, changes: Record<string, string>) => {
    const saved = enqueueWrite({ kind: 'line', itemId, fields: Object.keys(changes), body: { itemId, changes } })
    applyLine(itemId, changes)
    await saved
  }, [applyLine, enqueueWrite])

  const patchDetails = useCallback(async (itemId: number, details: Record<string, string>) => {
    const saved = enqueueWrite({ kind: 'line', itemId, fields: Object.keys(details), body: { itemId, details } })
    applyLine(itemId, details)
    await saved
  }, [applyLine, enqueueWrite])

  const submit = useCallback(async () => {
    if (submitToken.current || !alive.current) return
    const token = Symbol('submit')
    submitToken.current = token
    setSaving(true)
    try {
      const draft = arRef.current?.status === 'draft'
      const saved = await enqueueWrite({ kind: 'submit', body: { status: draft ? 'new' : 'submitted' } })
      if (saved && alive.current && submitToken.current === token) setSaveNotice(draft ? 'Request published.' : 'Request submitted.')
    } finally {
      if (submitToken.current === token) {
        submitToken.current = null
        if (alive.current) setSaving(false)
      }
    }
  }, [enqueueWrite])

  const setStatus = useCallback((status: string) => {
    void enqueueWrite({ kind: 'status', body: { status } })
    applyLocal((current) => ({ ...current, status }))
  }, [applyLocal, enqueueWrite])
  const setNote = useCallback((note: string) => {
    void enqueueWrite({ kind: 'note', body: { noteForSupplier: note.trim() } })
    applyLocal((current) => ({ ...current, noteForSupplier: note.trim() || null }))
  }, [applyLocal, enqueueWrite])
  const setShareCustomerDetails = useCallback((share: boolean) => {
    void enqueueWrite({ kind: 'share', body: { shareCustomerDetails: share } })
    applyLocal((current) => ({ ...current, shareCustomerDetails: share }))
  }, [applyLocal, enqueueWrite])
  const setPublicToken = useCallback((publicToken: string | null) => {
    if (alive.current && arRef.current) setAr({ ...arRef.current, publicToken })
  }, [setAr])

  return {
    id, ar, error, saving, saveNotice,
    retry: () => void load(), patchLine, patchDetails, submit, setStatus, setNote, setShareCustomerDetails, setPublicToken,
  }
}

/**
 * The request itself: status, sharing, the request-wide note and its lines.
 * `portal` draws the supplier portal's table with its summary strip — the
 * focused Job's presentation; the default is the compact admin table.
 */
export function AREditorBody({ editor, portal = false, mobile, drawerModal = false, summaryCard = true }: {
  editor: AREditor
  portal?: boolean
  mobile: boolean
  /** Inside the drawer's modal host, where menus must portal to stay interactive. */
  drawerModal?: boolean
  /** The supplier/job card. Off on the job page's AR tab, which draws the supplier page's header and note cards instead. */
  summaryCard?: boolean
}) {
  // The count cells the lines are narrowed to; each click toggles one, none shows all.
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const { ar, error } = editor
  const statusRow = ar && (
    <div className="flex min-w-0 flex-wrap items-center gap-2.5">
      <ARStatusPill status={ar.status} onChange={editor.setStatus} touch={mobile} />
      {ar.shareCustomerDetails && (
        <span className="rounded-full border border-border px-1.5 py-px text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          customer shared
        </span>
      )}
      {/* Share is the request's own control, so it sits with its status. */}
      {ar.status !== 'draft' && (
        <span className="ml-auto">
          <ARSharing id={ar.id} token={ar.publicToken ?? null} closed={ar.status === 'closed'}
            onChange={editor.setPublicToken} align="right" />
        </span>
      )}
    </div>
  )
  // The job page's AR tab draws the supplier's own page (2026-10-07): the
  // answer strip, line table and note card, under one row of Status, Share,
  // whether the supplier sees the customer, and Print — the job card above
  // already names the job, contact and delivery, so the AR's header card is
  // left out. Plant details and the request note are edited in place.
  const tabHeader = ar && (
    <div data-ar-tab-header className="flex min-w-0 flex-wrap items-center justify-between gap-1.5 min-[900px]:gap-2">
      <ARStatusPill status={ar.status} onChange={editor.setStatus} touch={mobile} />
      <div className="flex flex-none items-center gap-1.5">
        {ar.status !== 'draft' && <ARSharing id={ar.id} token={ar.publicToken ?? null} closed={ar.status === 'closed'}
          onChange={editor.setPublicToken} align="right" compact />}
        <label title="Share the customer's details with the supplier"
          className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-[13px] font-semibold has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60">
          <input type="checkbox" checked={ar.shareCustomerDetails} disabled={ar.status === 'closed'}
            onChange={(event) => editor.setShareCustomerDetails(event.target.checked)}
            aria-label="Share customer details with the supplier" className="size-4 accent-[var(--primary)]" />
          Share customer info
        </label>
        <button type="button" onClick={() => window.print()} aria-label="Print" title="Print"
          className="inline-flex size-11 flex-none cursor-pointer items-center justify-center rounded-lg border border-border bg-card text-foreground hover:bg-lps-tint">
          <Printer className="size-4" aria-hidden="true" />
        </button>
      </div>
      <ARPrintSheet request={ar} name={ar.jobName ?? (ar.jobRequestId != null ? requestRef(ar.jobRequestId) : availabilityRecordName(ar))} />
    </div>
  )
  return (
    <>
      {error && (
        <div role="alert" className="flex flex-wrap items-center gap-2 rounded-lg border border-destructive/35 bg-destructive/5 px-3 py-2 text-[13px] text-destructive">
          <span>{error}</span>
          {!ar && (
            <button
              type="button"
              onClick={editor.retry}
              className="min-h-11 cursor-pointer rounded-full border border-destructive/40 px-4 font-bold min-[900px]:min-h-8"
            >
              Retry
            </button>
          )}
        </div>
      )}
      {!ar && !error && (
        <p role="status" className="m-0 text-[13px] text-muted-foreground">Loading availability request…</p>
      )}

      {ar && (
        <>
          {summaryCard ? (
            <section aria-label="Request summary" className="min-w-0 rounded-xl border border-border bg-card px-3.5 py-3">
              {statusRow}
              <dl className="m-0 mt-3 grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 text-[12px]">
                <dt className="font-bold text-muted-foreground">Supplier</dt>
                <dd className="m-0 break-words font-bold text-foreground">{ar.supplierName}</dd>
                <dt className="font-bold text-muted-foreground">Job</dt>
                <dd className="m-0 break-words text-foreground">{ar.jobName ?? (ar.jobRequestId != null ? requestRef(ar.jobRequestId) : 'Archived source job')}</dd>
                {ar.submittedAt && (
                  <>
                    <dt className="font-bold text-muted-foreground">Submitted</dt>
                    <dd className="m-0 text-foreground">{formatWeekdayMonthDay(ar.submittedAt)}</dd>
                  </>
                )}
              </dl>
            </section>
          ) : tabHeader}
          {ar.status === 'draft' && <p role="status" className="m-0 text-sm font-semibold text-muted-foreground">Draft — hidden from supplier. Publish when ready.</p>}
          {!summaryCard ? null : ar.status !== 'closed' ? (
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-bold uppercase tracking-[.05em] text-lps-dim">Note for supplier</span>
              <AnswerCell
                value={ar.noteForSupplier ?? ''}
                editable
                placeholder="Note for the supplier on this request…"
                display={ar.noteForSupplier ?? ''}
                onCommit={editor.setNote}
                ariaLabel="Note for supplier"
                multiline
                touch={mobile}
              />
            </label>
          ) : ar.noteForSupplier && (
            <p className="m-0 break-words rounded-lg border border-lps-hair bg-lps-bubble px-2.5 py-2 text-[13px] leading-5 text-foreground">
              <span className="mr-1.5 text-[11px] font-bold uppercase tracking-[.05em] text-lps-dim">
                Note for supplier
              </span>
              {ar.noteForSupplier}
            </p>
          )}
          {/* The portal drawing's answer strip carries the subtotal the
              drawing drops, with the admin's inline edits on top. */}
          {portal && <SummaryStrip items={ar.items} subtotal={arSubtotal(ar.items)} activeStatuses={statusFilter}
            onToggleStatus={(value) => setStatusFilter((cur) => toggleStatus(cur, value))} />}
          <ARLineTable
            design={portal ? 'portal' : 'default'}
            items={statusFilter.length ? ar.items.filter((item) => statusFilter.includes(arShownStatus(item) ?? '')) : ar.items}
            editable={ar.status !== 'closed'}
            onPatch={editor.patchLine}
            onPatchDetails={editor.patchDetails}
            mobileCards={mobile}
            drawerModal={drawerModal}
            centerStatus={!summaryCard}
          />
          {!summaryCard && (
            <ARRequestNote>
              {ar.status !== 'closed' ? (
                <AnswerCell value={ar.noteForSupplier ?? ''} editable multiline touch={mobile}
                  placeholder="Add any conditions or information that apply to the whole request…"
                  display={ar.noteForSupplier ?? ''} onCommit={editor.setNote} ariaLabel="Note for this request" />
              ) : (
                <p className="m-0 whitespace-pre-wrap break-words text-[13px] font-normal">{ar.noteForSupplier || '—'}</p>
              )}
            </ARRequestNote>
          )}
          {ar.status === 'closed' && (
            <p className="m-0 text-[12px] text-muted-foreground">
              This request is {ar.status}. Reopen it from the status pill to edit plant details and answers, then {ar.submittedAt ? 'Submit again' : 'Submit request'}.
            </p>
          )}
        </>
      )}
    </>
  )
}

/**
 * Publish / Submit with its save notice. Nothing for a closed (read-only)
 * request. `portal` draws the supplier page's wide, centered submit bar —
 * the button alone, as there.
 */
export function AREditorFooter({ editor, className, portal = false, ...data }: {
  editor: AREditor
  className?: string
  portal?: boolean
} & Record<`data-${string}`, string>) {
  const { ar, saving, saveNotice } = editor
  if (!ar || ar.status === 'closed') return null
  if (portal) return (
    <ARSubmitBar onSubmit={() => void editor.submit()} disabled={saving} className={className}
      label={saving ? ar.status === 'draft' ? 'Publishing…' : 'Submitting…' : ar.status === 'draft' ? 'Publish' : ar.submittedAt ? 'Submit again' : 'Submit request'} />
  )
  return (
    <footer {...data} className={cn('flex flex-col gap-1.5 min-[900px]:flex-row min-[900px]:items-center', className)}>
      <button
        type="button"
        onClick={() => void editor.submit()}
        disabled={saving}
        className="min-h-11 w-full cursor-pointer whitespace-nowrap rounded-full bg-primary px-6 py-2 text-[13px] font-bold text-primary-foreground shadow-sm transition-[opacity,transform,scale] duration-100 ease-lps enabled:active:scale-[.97] disabled:cursor-not-allowed disabled:opacity-50 min-[900px]:min-h-0 min-[900px]:w-auto min-[900px]:flex-none"
      >
        {saving ? ar.status === 'draft' ? 'Publishing…' : 'Submitting…' : ar.status === 'draft' ? 'Publish' : ar.submittedAt ? 'Submit again' : 'Submit request'}
      </button>
      <div className="min-w-0 text-[12px] text-muted-foreground">
        <span>{ar.status === 'draft' ? 'Changes save privately. Publishing makes this request visible to the supplier.' : 'Changes save as you make them and keep the request\'s status. Submitting dates the whole request.'}</span>
        <span role="status" aria-live="polite" className="ml-1 font-bold text-foreground">{saveNotice}</span>
      </div>
    </footer>
  )
}
