'use client'

import {
  useCallback, useEffect, useRef, useState, type KeyboardEvent,
} from 'react'

import { ARSharing } from '@/components/workspace/ar-sharing'
import { ARJobSchedules } from '@/components/workspace/ar-job-schedules'
import { ARLineTable, ARStatusPill } from '@/components/workspace/availability'
import {
  BodyModalPortal,
  firstModalFocusTarget,
  validModalFocusTarget,
} from '@/components/workspace/body-modal-portal'
import { CloseIcon } from '@/components/workspace/icons'
import {
  availabilityRequestStatusChanged,
  onOpenAvailabilityRequest,
} from '@/lib/chat-bus'
import type { ARDetail } from '@/lib/availability'
import { formatMonthDay } from '@/lib/format'
import { requestRef } from '@/lib/job-requests'
import { useJobUpdates } from '@/lib/use-job-updates'

interface DrawerSession {
  id: number
  generation: number
}

type WriteOperation =
  | { kind: 'line'; itemId: number; fields: string[]; body: Record<string, unknown> }
  | { kind: 'status'; body: Record<string, unknown> }
  | { kind: 'submit'; body: Record<string, unknown> }

function abortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

function useDrawerMobile(): boolean {
  const [mobile, setMobile] = useState(false)
  useEffect(() => {
    if (!window.matchMedia) return
    const media = window.matchMedia('(max-width: 899px)')
    const update = () => setMobile(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  return mobile
}

/**
 * One availability request in a right-hand drawer, openable from anywhere —
 * a job-request card's AR links, or an `[…](ar:<id>)` button in the chat
 * panel. Mounted once by the Shell; `openAvailabilityRequest(id)` opens it.
 *
 * Editable, unlike the supplier profile's read-only copy: suppliers answer by
 * phone and email as often as through the portal, so the admin enters those
 * answers here on their behalf, corrects the requested plant details, and moves
 * the request's own status. A closed request is read-only — reopen it first.
 */
export function AvailabilityRequestDrawer() {
  const [session, setSession] = useState<DrawerSession | null>(null)
  const [ar, setArState] = useState<ARDetail | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveNotice, setSaveNotice] = useState('')
  const [viewport, setViewport] = useState<{ top: number; height: number } | null>(null)
  const mobile = useDrawerMobile()

  const sessionRef = useRef<DrawerSession | null>(null)
  const arRef = useRef<ARDetail | null>(null)
  const generation = useRef(0)
  const panel = useRef<HTMLDivElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  const returnFocus = useRef<HTMLElement | null>(null)
  const focusFrame = useRef<number | null>(null)
  const returnFocusFrame = useRef<number | null>(null)
  const focusGeneration = useRef(0)
  const priorMobile = useRef<boolean | null>(null)

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

  const isCurrent = useCallback((target: DrawerSession) => {
    const current = sessionRef.current
    return current?.id === target.id && current.generation === target.generation
  }, [])

  const cancelFocusFrame = useCallback(() => {
    if (focusFrame.current != null) cancelAnimationFrame(focusFrame.current)
    focusFrame.current = null
  }, [])

  const cancelReturnFocusFrame = useCallback(() => {
    if (returnFocusFrame.current != null) cancelAnimationFrame(returnFocusFrame.current)
    returnFocusFrame.current = null
  }, [])

  const abortOperations = useCallback(() => {
    for (const controller of controllers.current) controller.abort()
    controllers.current.clear()
    loadController.current = null
    lineControllers.current.clear()
    statusController.current = null
    submitController.current = null
    submitToken.current = null
    writeTail.current = Promise.resolve()
  }, [])

  const scheduleOutsideFocus = useCallback((preferred: HTMLElement | null, closingHost: HTMLElement | null) => {
    cancelReturnFocusFrame()
    const attempt = (remaining: number) => {
      returnFocusFrame.current = requestAnimationFrame(() => {
        returnFocusFrame.current = null
        if (validModalFocusTarget(preferred)) {
          preferred.focus()
          return
        }
        // A close event can run before React commits the portal cleanup. Do not
        // choose a fallback while every candidate is still intentionally inert.
        if (closingHost?.isConnected && remaining > 0) {
          attempt(remaining - 1)
          return
        }
        firstModalFocusTarget(document.body, closingHost)?.focus()
      })
    }
    attempt(3)
  }, [cancelReturnFocusFrame])

  const close = useCallback(() => {
    const current = sessionRef.current
    if (!current) return
    const closingHost = document.querySelector<HTMLElement>('[data-ar-drawer-host]')
    const preferred = returnFocus.current
    generation.current += 1
    sessionRef.current = null
    abortOperations()
    setSession(null)
    setAr(null)
    setError('')
    setSaveNotice('')
    setSaving(false)
    scheduleOutsideFocus(preferred, closingHost)
  }, [abortOperations, scheduleOutsideFocus, setAr])

  useEffect(() => onOpenAvailabilityRequest((id) => {
    cancelFocusFrame()
    cancelReturnFocusFrame()
    const prior = sessionRef.current
    if (!prior) {
      const active = document.activeElement instanceof HTMLElement ? document.activeElement : null
      if (!active?.closest('[data-ar-drawer-host]')) returnFocus.current = active
    }
    generation.current += 1
    const next = { id, generation: generation.current }
    abortOperations()
    sessionRef.current = next
    setSession(next)
    setAr(null)
    setError('')
    setSaveNotice('')
    setSaving(false)
    focusGeneration.current = 0
  }), [abortOperations, cancelFocusFrame, cancelReturnFocusFrame, setAr])

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => setViewport({ top: vv.offsetTop, height: vv.height })
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])

  const load = useCallback(async (target: DrawerSession, background = false) => {
    const sequence = ++loadSequence.current
    loadController.current?.abort()
    const controller = new AbortController()
    loadController.current = controller
    controllers.current.add(controller)
    if (isCurrent(target)) {
      if (!background) setAr(null)
      setError('')
    }
    try {
      const response = await fetch(`/api/availability-requests/${target.id}`, {
        cache: 'no-store',
        signal: controller.signal,
      })
      if (!response.ok) throw new Error(`AR-${target.id} not found`)
      const body = (await response.json()) as { request: ARDetail }
      if (!isCurrent(target) || sequence !== loadSequence.current || controller.signal.aborted) return
      setAr(body.request)
    } catch (caught) {
      if (abortError(caught)) return
      if (!isCurrent(target) || sequence !== loadSequence.current || controller.signal.aborted) return
      setError((caught as Error).message)
    } finally {
      controllers.current.delete(controller)
      if (loadController.current === controller) loadController.current = null
    }
  }, [isCurrent, setAr])

  useEffect(() => {
    if (!session) return
    void load(session)
  }, [load, session])

  useJobUpdates(async () => {
    const target = sessionRef.current
    if (!target) return
    await writeTail.current
    if (isCurrent(target)) await load(target, true)
  }, session !== null)

  useEffect(() => {
    if (!session) return
    cancelFocusFrame()
    focusFrame.current = requestAnimationFrame(() => {
      focusFrame.current = null
      if (!isCurrent(session) || focusGeneration.current === session.generation) return
      if (validModalFocusTarget(closeButton.current)) {
        focusGeneration.current = session.generation
        closeButton.current.focus()
      }
    })
  }, [cancelFocusFrame, isCurrent, session, ar])

  useEffect(() => {
    const changed = priorMobile.current != null && priorMobile.current !== mobile
    priorMobile.current = mobile
    if (!session || !changed) return
    cancelFocusFrame()
    focusFrame.current = requestAnimationFrame(() => {
      focusFrame.current = null
      if (isCurrent(session) && validModalFocusTarget(closeButton.current)) closeButton.current.focus()
    })
  }, [cancelFocusFrame, isCurrent, mobile, session])

  useEffect(() => () => {
    const closingHost = document.querySelector<HTMLElement>('[data-ar-drawer-host]')
    const preferred = returnFocus.current
    const wasOpen = sessionRef.current != null || closingHost != null
    generation.current += 1
    sessionRef.current = null
    abortOperations()
    if (wasOpen) scheduleOutsideFocus(preferred, closingHost)
  }, [abortOperations, scheduleOutsideFocus])

  const enqueueWrite = useCallback((operation: WriteOperation): Promise<boolean> => {
    const target = sessionRef.current
    if (!target) return Promise.resolve(false)
    // A pre-write background read must not overwrite the confirmed write.
    loadSequence.current++
    loadController.current?.abort()
    setError('')
    setSaveNotice('')

    let sequence: number
    let controller: AbortController
    // Moving between fields must preserve each queued edit. Only a newer edit
    // to the same fields supersedes an earlier one.
    const lineKey = operation.kind === 'line' ? `${operation.itemId}:${[...operation.fields].sort().join(',')}` : ''
    if (operation.kind === 'line') {
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
      if (!isCurrent(target) || controller.signal.aborted) return false
      if (operation.kind === 'line') return lineSequences.current.get(lineKey) === sequence
      if (operation.kind === 'status') return statusSequence.current === sequence
      return submitSequence.current === sequence
    }

    const release = () => {
      controllers.current.delete(controller)
      if (operation.kind === 'line' && lineControllers.current.get(lineKey) === controller) {
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
      const beforeStatus = arRef.current?.status
      const beforeSubmittedAt = arRef.current?.submittedAt
      try {
        const response = await fetch(`/api/availability-requests/${target.id}`, {
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

        const refreshed = await fetch(`/api/availability-requests/${target.id}`, {
          cache: 'no-store',
          signal: controller.signal,
        })
        if (!refreshed.ok) throw new Error(`AR-${target.id} not found`)
        const body = (await refreshed.json()) as { request: ARDetail }
        if (!latest()) return false
        setAr(body.request)
        if (response.ok && (body.request.status !== beforeStatus || body.request.submittedAt !== beforeSubmittedAt)) {
          availabilityRequestStatusChanged({ arId: target.id, status: body.request.status, submittedAt: body.request.submittedAt })
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
  }, [isCurrent, setAr])

  const patchLine = useCallback(async (itemId: number, changes: Record<string, string>) => {
    await enqueueWrite({ kind: 'line', itemId, fields: Object.keys(changes), body: { itemId, changes } })
  }, [enqueueWrite])

  const patchDetails = useCallback(async (itemId: number, details: Record<string, string>) => {
    await enqueueWrite({ kind: 'line', itemId, fields: Object.keys(details), body: { itemId, details } })
  }, [enqueueWrite])

  const submit = useCallback(async () => {
    if (submitToken.current || !sessionRef.current) return
    const target = sessionRef.current
    const token = Symbol('submit')
    submitToken.current = token
    setSaving(true)
    try {
      const saved = await enqueueWrite({ kind: 'submit', body: { status: 'submitted' } })
      if (saved && isCurrent(target) && submitToken.current === token) setSaveNotice('Request submitted.')
    } finally {
      if (submitToken.current === token) {
        submitToken.current = null
        if (isCurrent(target)) setSaving(false)
      }
    }
  }, [enqueueWrite, isCurrent])

  const keepFocusInside = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      close()
      return
    }
    if (event.key !== 'Tab') return
    const controls = Array.from(panel.current?.querySelectorAll<HTMLElement>(
      'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
    ) ?? []).filter(validModalFocusTarget)
    if (controls.length === 0) {
      event.preventDefault()
      panel.current?.focus()
      return
    }
    const first = controls[0]
    const last = controls[controls.length - 1]
    if (event.shiftKey && (document.activeElement === first || !panel.current?.contains(document.activeElement))) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && (document.activeElement === last || !panel.current?.contains(document.activeElement))) {
      event.preventDefault()
      first.focus()
    }
  }

  if (!session) return null
  const arId = session.id

  return (
    <BodyModalPortal hostAttribute="data-ar-drawer-host">
      <div
        data-ar-drawer-backdrop
        className="fixed inset-x-0 top-0 z-[85] flex justify-end bg-black/30"
        style={{ top: viewport?.top ?? 0, height: viewport?.height ?? '100dvh' }}
        onClick={close}
      >
        <div
          ref={panel}
          role="dialog"
          aria-modal="true"
          aria-labelledby="availability-request-drawer-title"
          data-ar-generation={session.generation}
          tabIndex={-1}
          onKeyDown={keepFocusInside}
          onClick={(event) => event.stopPropagation()}
          className="flex h-full w-full max-w-[640px] flex-col overflow-hidden border-l border-border bg-background shadow-[var(--lps-shadow)] min-[900px]:overflow-y-auto"
        >
          <header className="flex flex-none items-start gap-2 border-b border-border bg-background pb-2 pl-[max(12px,env(safe-area-inset-left))] pr-[max(12px,env(safe-area-inset-right))] pt-[max(12px,env(safe-area-inset-top))] min-[900px]:border-b-0 min-[900px]:px-4 min-[900px]:pb-0 min-[900px]:pt-4">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
              <h2 id="availability-request-drawer-title" className="m-0 min-w-0 break-words text-[14px] font-bold text-foreground">
                Availability request AR-{arId}
              </h2>
              {ar && (
                <>
                  <span className="whitespace-nowrap text-[11px] text-muted-foreground">
                    Created on <span className="font-semibold tabular-nums text-foreground">{formatMonthDay(ar.createdAt) || '—'}</span>
                  </span>
                  <ARJobSchedules schedules={ar.jobSchedules} showJobNames />
                </>
              )}
            </div>
            <button
              ref={closeButton}
              type="button"
              onClick={close}
              aria-label={`Close availability request AR-${arId}`}
              className="ml-auto flex size-11 flex-none cursor-pointer items-center justify-center rounded-full border-none bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground min-[900px]:size-7"
            >
              <CloseIcon size={14} />
            </button>
          </header>

          <div
            data-ar-drawer-scroller
            className="min-h-0 flex-1 space-y-2.5 overflow-y-auto py-3 pl-[max(12px,env(safe-area-inset-left))] pr-[max(12px,env(safe-area-inset-right))] min-[900px]:flex-none min-[900px]:overflow-visible min-[900px]:px-4 min-[900px]:pb-2 min-[900px]:pt-2.5"
          >
            {error && (
              <div role="alert" className="flex flex-wrap items-center gap-2 rounded-lg border border-destructive/35 bg-destructive/5 px-3 py-2 text-[12.5px] text-destructive">
                <span>{error}</span>
                {!ar && (
                  <button
                    type="button"
                    onClick={() => void load(session)}
                    className="min-h-11 cursor-pointer rounded-full border border-destructive/40 px-4 font-bold min-[900px]:min-h-8"
                  >
                    Retry
                  </button>
                )}
              </div>
            )}
            {!ar && !error && (
              <p role="status" className="m-0 text-[12.5px] text-muted-foreground">Loading availability request…</p>
            )}

            {ar && (
              <>
                <section aria-label="Request summary" className="min-w-0 rounded-xl border border-border bg-card px-3.5 py-3">
                  <div className="flex min-w-0 flex-wrap items-center gap-2.5">
                    <ARStatusPill
                      status={ar.status}
                      onChange={(status) => void enqueueWrite({ kind: 'status', body: { status } })}
                      touch={mobile}
                    />
                    {ar.shareCustomerDetails && (
                      <span className="rounded-full border border-border px-1.5 py-px text-[9.5px] font-bold uppercase tracking-wide text-muted-foreground">
                        customer shared
                      </span>
                    )}
                  </div>
                  <dl className="m-0 mt-3 grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 text-[12px]">
                    <dt className="font-bold text-muted-foreground">Supplier</dt>
                    <dd className="m-0 break-words font-bold text-foreground">{ar.supplierName}</dd>
                    <dt className="font-bold text-muted-foreground">Job</dt>
                    <dd className="m-0 break-words text-foreground">{ar.jobName ?? (ar.jobRequestId != null ? requestRef(ar.jobRequestId) : 'Archived source job')}</dd>
                    {ar.submittedAt && (
                      <>
                        <dt className="font-bold text-muted-foreground">Submitted</dt>
                        <dd className="m-0 text-foreground">{formatMonthDay(ar.submittedAt)}</dd>
                      </>
                    )}
                  </dl>
                </section>
                <ARSharing key={session.generation} id={ar.id} token={ar.publicToken ?? null} closed={(ar.status === 'closed' || ar.status === 'hidden')}
                  onChange={(publicToken) => {
                    if (isCurrent(session) && arRef.current) setAr({ ...arRef.current, publicToken })
                  }} />
                {ar.supplierNotes && <div className="rounded-lg border border-border bg-card p-3 text-[12px]">
                  <div className="font-semibold">Supplier note</div>
                  <p className="mt-1 whitespace-pre-wrap">{ar.supplierNotes}</p>
                </div>}
                {ar.lpsNotes && (
                  <p className="m-0 break-words rounded-lg border border-lps-hair bg-lps-bubble px-2.5 py-2 text-[12.5px] leading-5 text-foreground">
                    <span className="mr-1.5 text-[10.5px] font-bold uppercase tracking-[.05em] text-lps-dim">
                      Note to supplier
                    </span>
                    {ar.lpsNotes}
                  </p>
                )}
                <ARLineTable
                  items={ar.items}
                  editable={ar.status !== 'closed' && ar.status !== 'hidden'}
                  onPatch={patchLine}
                  onPatchDetails={patchDetails}
                  mobileCards={mobile}
                  drawerModal
                />
                {(ar.status === 'closed' || ar.status === 'hidden') && (
                  <p className="m-0 text-[11.5px] text-muted-foreground">
                    This request is {ar.status}. Reopen it from the status pill to edit plant details and answers, then {ar.submittedAt ? 'Submit again' : 'Submit request'}.
                  </p>
                )}
              </>
            )}
          </div>

          {ar && ar.status !== 'closed' && ar.status !== 'hidden' && (
            <footer
              data-ar-drawer-footer
              className="flex flex-none flex-col gap-1.5 border-t border-border bg-background pl-[max(12px,env(safe-area-inset-left))] pr-[max(12px,env(safe-area-inset-right))] pt-2.5 pb-[max(12px,env(safe-area-inset-bottom))] min-[900px]:mx-4 min-[900px]:mb-4 min-[900px]:flex-row min-[900px]:items-center min-[900px]:border-t-0 min-[900px]:p-0"
            >
              <button
                type="button"
                onClick={() => void submit()}
                disabled={saving}
                className="min-h-11 w-full cursor-pointer rounded-full bg-primary px-6 py-2 text-[12.5px] font-bold text-primary-foreground shadow-sm disabled:cursor-not-allowed disabled:opacity-50 min-[900px]:min-h-0 min-[900px]:w-auto"
              >
                {saving ? 'Submitting…' : ar.submittedAt ? 'Submit again' : 'Submit request'}
              </button>
              <div className="min-w-0 text-[11.5px] text-muted-foreground">
                <span>Changes save as you make them. Submitting dates the whole request.</span>
                <span role="status" aria-live="polite" className="ml-1 font-bold text-foreground">{saveNotice}</span>
              </div>
            </footer>
          )}
        </div>
      </div>
    </BodyModalPortal>
  )
}
