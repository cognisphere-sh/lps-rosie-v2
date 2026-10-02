'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'

import { FocusedJobRecord } from '@/components/workspace/focused-job-record'
import { focusConnectedJobNameTrigger } from '@/components/workspace/focused-job-header'
import { FocusedJobsRailLayout, FocusedJobsRailRow, FocusedJobsRailSearch } from '@/components/workspace/focused-jobs-rail'
import { JobsTopActions, Shell } from '@/components/workspace/shell'
import { withAvailabilityRequestStatus } from '@/lib/availability'
import { onAvailabilityRequestStatusChanged, openChat } from '@/lib/chat-bus'
import { subscribeEvents } from '@/lib/chat-events'
import {
  canonicalJobThread, hasFocusedIntakeEvidence, jobInboxEventAction, jobInboxLayout,
  jobInboxNavigationAction, jobInboxRowAriaLabel,
  mergeJobInbox, orderJobInbox, parseJobSelection, patchJobInbox, shouldRestoreJobInbox,
  type JobInboxRow, type JobThreadPatch,
} from '@/lib/job-inbox'
import { requestRef, requestStatusLabel } from '@/lib/job-requests'
import { searchJobInbox } from '@/lib/job-inbox-search'
import type { JobRequestRow } from '@/lib/rows'
import { useJobUpdates } from '@/lib/use-job-updates'

const LIST_SCROLL = 'lps.jobs.scroll.v1'
const LIST_ORIGIN = 'lps.jobs.origin.v1'
const LIST_ORIGIN_ID = 'lps.jobs.origin-id.v1'
const INTAKE = 'lps.jobs.intake.v1'

function useBreakpoint(): boolean | null {
  const [mobile, setMobile] = useState<boolean | null>(null)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 899px)')
    const sync = () => setMobile(jobInboxLayout(window.innerWidth) === 'mobile')
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])
  return mobile
}

function IntakeSaved({ id }: { id: number }) {
  const [request, setRequest] = useState<JobRequestRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const generation = useRef(0)
  const refresh = useCallback(async () => {
    const mine = ++generation.current
    try {
      const response = await fetch(`/api/requests/${id}`, { cache: 'no-store' })
      if (mine !== generation.current) return
      if (response.status === 404) {
        setRequest(null); setError(''); return
      }
      const body = await response.json() as { request?: JobRequestRow; error?: string }
      if (mine !== generation.current) return
      if (!response.ok || !body.request) throw new Error(body.error ?? 'Saved details unavailable')
      setRequest(body.request); setError('')
    } catch (cause) {
      if (mine === generation.current) setError((cause as Error).message)
    } finally {
      if (mine === generation.current) setLoading(false)
    }
  }, [id])
  useJobUpdates(refresh)
  useEffect(() => {
    void refresh()
    const off = subscribeEvents('/api/chat/events', (value) => {
      const event = value as { type?: string; agent?: string; threadId?: string }
      if (event.type === 'thread' && event.agent === 'rosie' && event.threadId === canonicalJobThread(id)) void refresh()
    })
    return () => { off(); generation.current++ }
  }, [id, refresh])
  return (
    <aside aria-live="polite" className="border-t border-border bg-card p-3 text-[12px] min-[900px]:w-72 min-[900px]:border-l min-[900px]:border-t-0">
      <div className="font-bold">Saved so far</div>
      {loading && <p className="text-muted-foreground">Checking the job record…</p>}
      {!loading && !request && !error && <p className="text-muted-foreground">Nothing has been saved to the job record yet. Chat remains available.</p>}
      {request && <div className="mt-2 space-y-1 text-muted-foreground">
        <p className="m-0 font-semibold text-foreground">{request.name || requestRef(id)}</p>
        <p className="m-0">{request.customer?.company || request.customer?.name || 'Customer not saved yet'}</p>
        <p className="m-0">{requestStatusLabel(request.status)} · {request.itemCount} active {request.itemCount === 1 ? 'line' : 'lines'}</p>
        <p className="m-0">Only record-backed details appear here.</p>
      </div>}
      {error && <div role="alert" className="mt-2 text-destructive">Saved details unavailable. Chat still works. <button className="underline" onClick={() => void refresh()}>Retry</button></div>}
    </aside>
  )
}

function JobsWorkspace() {
  const router = useRouter()
  const params = useSearchParams()
  const breakpoint = useBreakpoint()
  const [jobActionsTarget, setJobActionsTarget] = useState<HTMLDivElement | null>(null)
  const selection = useMemo(() => parseJobSelection(params.getAll('jr')), [params])
  const intakeRequested = params.getAll('intake').length === 1 && params.get('intake') === '1'
  const [jobs, setJobs] = useState<JobInboxRow[]>([])
  const ordered = useMemo(() => orderJobInbox(jobs), [jobs])
  const [jobSearch, setJobSearch] = useState('')
  const matchingJobs = useMemo(() => searchJobInbox(ordered, jobSearch), [ordered, jobSearch])
  const [loading, setLoading] = useState(true)
  const [listReady, setListReady] = useState(false)
  const [listError, setListError] = useState('')
  const [detail, setDetail] = useState<JobRequestRow | null>(null)
  const [detailError, setDetailError] = useState('')
  const [detailResolvedId, setDetailResolvedId] = useState<number | null>(null)
  const [version, setVersion] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  const workRef = useRef<HTMLElement>(null)
  const rowsRef = useRef(new Map<number, HTMLButtonElement>())
  const fetchGeneration = useRef(0)
  const rowRevisions = useRef(new Map<number, number>())
  const jobsRef = useRef<JobInboxRow[]>([])
  const detailGeneration = useRef(0)
  const enteredFromLanding = useRef(false)
  const pendingListRestore = useRef(false)
  const previousSelection = useRef(selection.kind)
  const pendingWorkFocus = useRef<number | null>(null)
  const pendingNameFocus = useRef<number | null>(null)

  useEffect(() => { jobsRef.current = jobs }, [jobs])

  const refreshList = useCallback(async () => {
    const mine = ++fetchGeneration.current
    const baseline = new Map(rowRevisions.current)
    setListError('')
    try {
      const response = await fetch('/api/job-inbox', { cache: 'no-store' })
      const body = await response.json() as { jobs?: JobInboxRow[]; error?: string }
      if (mine !== fetchGeneration.current) return
      if (!response.ok) throw new Error(body.error ?? 'Could not load active jobs')
      setListReady(true)
      setJobs((current) => {
        const ids = new Set([...current, ...(body.jobs ?? [])].map((row) => row.id))
        const changed = new Set([...ids].filter((id) => (rowRevisions.current.get(id) ?? 0) !== (baseline.get(id) ?? 0)))
        const next = mergeJobInbox(current, body.jobs ?? [], changed)
        jobsRef.current = next
        return next
      })
    } catch (cause) {
      if (mine === fetchGeneration.current) setListError((cause as Error).message)
    } finally {
      if (mine === fetchGeneration.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshList()
    const off = subscribeEvents('/api/chat/events', (value) => {
      const event = value as JobThreadPatch & { type?: string }
      if (event.type !== 'thread') return
      const action = jobInboxEventAction(jobsRef.current, event)
      if (action === 'ignore') return
      if (action === 'verify-refresh') { void refreshList(); return }
      const match = /^jr-([1-9]\d*)$/.exec(event.threadId)
      if (!match) return
      const id = Number(match[1])
      rowRevisions.current.set(id, (rowRevisions.current.get(id) ?? 0) + 1)
      // Update the classification baseline synchronously so a reopen event
      // arriving in the same task after close is treated as unknown/verify.
      jobsRef.current = patchJobInbox(jobsRef.current, event)
      setJobs((current) => {
        const next = patchJobInbox(current, event)
        jobsRef.current = next
        return next
      })
      if (action === 'remove-and-refresh') void refreshList()
    })
    return () => { off(); fetchGeneration.current++ }
  }, [refreshList])

  const loadDetail = useCallback(async (id: number, background = false) => {
    const mine = ++detailGeneration.current
    setDetailError('')
    if (!background) { setDetail(null); setDetailResolvedId(null) }
    try {
      const response = await fetch(`/api/requests/${id}`, { cache: 'no-store' })
      const body = await response.json() as { request?: JobRequestRow; error?: string }
      if (mine !== detailGeneration.current) return
      if (response.status === 404) {
        if (mine === detailGeneration.current) {
          setDetail(null)
          setDetailError('')
          setDetailResolvedId(id)
          setJobs((current) => {
            const next = current.filter((row) => row.id !== id)
            jobsRef.current = next
            return next
          })
        }
        void refreshList()
        return
      }
      if (!response.ok || !body.request) throw new Error(body.error ?? 'Could not load this job')
      if (mine === detailGeneration.current) {
        setDetail(body.request)
        setDetailResolvedId(id)
        if (background) setVersion((n) => n + 1)
      }
    } catch (cause) {
      if (mine === detailGeneration.current && (cause as Error).name !== 'AbortError') {
        setDetailError((cause as Error).message)
        setDetailResolvedId(id)
      }
    }
  }, [refreshList])

  useJobUpdates(async () => {
    await Promise.all([
      refreshList(),
      selection.kind === 'valid' ? loadDetail(selection.id, true) : undefined,
    ])
  }, selection.kind === 'valid')

  const savedJobName = useCallback((id: number) => {
    pendingNameFocus.current = id
    void Promise.all([loadDetail(id, true), refreshList()]).then(() => {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (pendingNameFocus.current !== id) return
        if (selection.kind !== 'valid' || selection.id !== id) return
        if (!focusConnectedJobNameTrigger(workRef.current, id)) return
        pendingNameFocus.current = null
      }))
    })
  }, [loadDetail, refreshList, selection])

  useEffect(() => {
    if (selection.kind !== 'valid') {
      pendingNameFocus.current = null
      setDetail(null); setDetailError(''); setDetailResolvedId(null)
      return
    }
    if (pendingNameFocus.current != null && pendingNameFocus.current !== selection.id) {
      pendingNameFocus.current = null
    }
    void loadDetail(selection.id)
    return () => { detailGeneration.current++ }
  }, [loadDetail, selection])
  // The drawer has already re-read the one AR it wrote; patch that status
  // into the open job instead of refetching it.
  useEffect(
    () => onAvailabilityRequestStatusChanged(({ arId, status, submittedAt }) => {
      setDetail((current) => {
        if (!current) return current
        const supplierLinks = withAvailabilityRequestStatus(current.supplierLinks, arId, status, submittedAt)
        return supplierLinks === current.supplierLinks ? current : { ...current, supplierLinks }
      })
    }),
    [],
  )

  useEffect(() => {
    const previous = previousSelection.current
    previousSelection.current = selection.kind
    if (!shouldRestoreJobInbox(
      previous,
      selection.kind,
      pendingListRestore.current,
      enteredFromLanding.current,
    )) return
    pendingListRestore.current = false
    enteredFromLanding.current = false
    const scroll = Number(sessionStorage.getItem(LIST_SCROLL) ?? 0)
    if (listRef.current) listRef.current.scrollTop = scroll
    const origin = sessionStorage.getItem(LIST_ORIGIN)
    requestAnimationFrame(() => {
      const target = origin === 'new'
        ? document.getElementById('jobs-new-trigger')
        : rowsRef.current.get(Number(origin ?? 0))
      target?.focus({ preventScroll: true })
      target?.scrollIntoView({ block: 'nearest' })
    })
  }, [selection.kind])

  useEffect(() => {
    if (selection.kind !== 'valid' || pendingWorkFocus.current !== selection.id) return
    pendingWorkFocus.current = null
    requestAnimationFrame(() => workRef.current?.focus({ preventScroll: true }))
  }, [selection])

  const saveListPosition = () => {
    if (listRef.current) sessionStorage.setItem(LIST_SCROLL, String(listRef.current.scrollTop))
  }
  const pick = (id: number) => {
    saveListPosition()
    sessionStorage.setItem(LIST_ORIGIN, String(id))
    sessionStorage.removeItem(LIST_ORIGIN_ID)
    pendingWorkFocus.current = id
    const action = jobInboxNavigationAction(selection.kind)
    if (action === 'push') {
      enteredFromLanding.current = true
      router.push(`/jobs?jr=${id}`, { scroll: false })
    } else {
      // This is a query-only switch within the mounted Jobs page. Update the
      // URL immediately so rapid rail clicks cannot leave an older router
      // transition selected. Next syncs useSearchParams from the History API.
      window.history.replaceState(null, '', `/jobs?jr=${id}`)
    }
  }
  const backToList = () => {
    if (selection.kind === 'valid') {
      const newOrigin = sessionStorage.getItem(LIST_ORIGIN) === 'new'
        && Number(sessionStorage.getItem(LIST_ORIGIN_ID)) === selection.id
      if (!newOrigin) {
        sessionStorage.setItem(LIST_ORIGIN, String(selection.id))
        sessionStorage.removeItem(LIST_ORIGIN_ID)
      }
    }
    pendingListRestore.current = true
    router.replace('/requests', { scroll: false })
  }

  const marker = useMemo(() => {
    if (selection.kind !== 'valid' || typeof window === 'undefined') return null
    try { return JSON.parse(sessionStorage.getItem(INTAKE) ?? 'null') as { id?: number; returnUrl?: string } | null } catch { return null }
  }, [selection])
  const focused = intakeRequested && selection.kind === 'valid' && hasFocusedIntakeEvidence(selection.id, marker)
  useEffect(() => {
    if (!intakeRequested && selection.kind === 'valid' && detail?.id === selection.id && marker?.id === selection.id) {
      sessionStorage.removeItem(INTAKE)
    }
  }, [detail?.id, intakeRequested, marker?.id, selection])
  const exitIntake = () => {
    if (selection.kind !== 'valid') return
    // Exit is presentation-only: keep the same-tab marker so a pre-record
    // identity can honestly offer Resume/Open Rosie instead of disappearing.
    router.replace(`/jobs?jr=${selection.id}`, { scroll: false })
  }

  useEffect(() => {
    if (selection.kind === 'bare') router.replace('/requests')
  }, [router, selection.kind])

  if (selection.kind === 'bare') {
    return <div role="status" className="p-8 text-center text-muted-foreground">Opening all jobs…</div>
  }

  if (focused && selection.kind === 'valid') {
    return <Shell page="requests" title={`JR-${selection.id} · New request with Rosie`} hideHeaderOnMobile toolbar={undefined}
      focusedIntake={{ id: selection.id, onExit: exitIntake, savedPanel: <IntakeSaved id={selection.id} /> }}>
      <div />
    </Shell>
  }

  const pendingMarker = selection.kind === 'valid' && marker?.id === selection.id && detailResolvedId === selection.id && !detail
  const membership = selection.kind === 'invalid'
    ? 'unavailable'
    : detailResolvedId !== selection.id
      ? 'loading'
      : detail
        ? 'listed'
        : detailError
          ? 'error'
          : pendingMarker
            ? 'pending'
            : 'unavailable'
  const focusedDesktop = breakpoint === false
  return (
    <Shell
      page="requests"
      title="Jobs"
      hideHeaderOnMobile
      hideHeaderOnDesktop
      focusedJobsDesktop
      focusedJob={selection.kind === 'valid' ? {
        id: selection.id,
        name: detail?.id === selection.id ? detail.name : jobs.find((job) => job.id === selection.id)?.name ?? null,
      } : undefined}
      replaceNewJobEntry
    >
      <FocusedJobsRailLayout
        desktop={focusedDesktop}
        mobile={breakpoint === true}
        onBack={backToList}
        rail={<>
          <FocusedJobsRailSearch value={jobSearch} onChange={(value) => {
            setJobSearch(value)
            if (listRef.current) listRef.current.scrollTop = 0
          }} matches={matchingJobs.length} loading={loading} />
          <div ref={listRef} onScroll={saveListPosition} className="min-h-0 flex-1 overflow-y-auto p-2">
            {listError && <div role="alert" className="rounded-lg border border-destructive/40 p-3 text-[12px] text-destructive">{listError}<button className="mt-2 flex min-h-11 items-center gap-2 font-semibold underline" onClick={() => void refreshList()}><RefreshCw size={14}/>Retry</button></div>}
            {loading && !ordered.length && <div role="status" className="p-4 text-[12px] text-muted-foreground">Loading active jobs…</div>}
            {listReady && !listError && !matchingJobs.length && (jobSearch.trim()
              ? <div className="p-4 text-[12px] text-muted-foreground"><p className="font-semibold text-foreground">No matching active jobs</p><p>Try another name, plant or note.</p></div>
              : <div className="p-4 text-[12px] text-muted-foreground"><p className="font-semibold text-foreground">No active jobs</p><p>Start a new request with Rosie, or review completed work in All jobs.</p><Link className="font-semibold text-primary underline" href="/requests">All jobs</Link></div>)}
            {matchingJobs.map((row) => {
              return (
                <FocusedJobsRailRow
                  key={row.id}
                  row={row}
                  selected={selection.kind === 'valid' && selection.id === row.id}
                  statusLabel={requestStatusLabel(row.status)}
                  ariaLabel={jobInboxRowAriaLabel(row, requestStatusLabel(row.status))}
                  buttonRef={(element) => {
                    if (element) rowsRef.current.set(row.id, element)
                    else rowsRef.current.delete(row.id)
                  }}
                  onSelect={() => pick(row.id)}
                />
              )
            })}
          </div>
        </>}
      >
        <main ref={workRef} tabIndex={-1} aria-label="Selected job" className="min-w-0 flex-1 overflow-y-auto bg-background outline-none">
          {focusedDesktop && <div className="sticky top-0 z-10 border-b border-border bg-card px-3 py-1"><JobsTopActions><div ref={setJobActionsTarget} className="contents" /></JobsTopActions></div>}
          {membership === 'loading' && <div role="status" className="p-8 text-center text-muted-foreground">Checking this job…</div>}
          {membership === 'listed' && detailError && <div role="alert" className="p-3 text-sm text-destructive">Could not update this job. Showing the last saved data.<button className="ml-2 underline" onClick={() => selection.kind === 'valid' && void loadDetail(selection.id, true)}>Retry</button></div>}
          {membership === 'error' && <div role="alert" className="p-8 text-center text-destructive">Could not load this job.<button className="mx-auto mt-2 flex min-h-11 items-center gap-2 font-semibold underline" onClick={() => selection.kind === 'valid' && void loadDetail(selection.id)}><RefreshCw size={14}/>Retry</button></div>}
          {membership === 'unavailable' && <div className="mx-auto max-w-md p-8 text-center"><h2 className="text-lg font-bold">Job unavailable</h2><p className="text-sm text-muted-foreground">This link is invalid or the job was deleted. Another job was not selected for you.</p><Link className="mx-auto flex min-h-11 w-fit items-center font-semibold text-primary underline" href="/requests">All jobs</Link></div>}
          {membership === 'listed' && detail && (
            <FocusedJobRecord
              key={detail.id}
              request={detail}
              actionsTarget={focusedDesktop ? jobActionsTarget : null}
              mobile={breakpoint === true}
              version={version}
              onSaved={() => {
                // Keep the record, open sections and other drafts mounted while
                // reconciling saved values and server-calculated totals.
                void loadDetail(detail.id, true)
                void refreshList()
              }}
              onNameSaved={savedJobName}
              onDeleted={backToList}
            />
          )}
          {membership === 'pending' && selection.kind === 'valid' && <div className="p-8 text-center"><h2 className="font-bold">New job request · {requestRef(selection.id)}</h2><p className="text-sm text-muted-foreground">Tell Rosie about the job. Saved details will appear here.</p><div className="flex flex-wrap justify-center gap-3"><button className="min-h-11 font-semibold text-primary underline" onClick={() => openChat({ agentId: 'rosie', threadId: canonicalJobThread(selection.id), label: requestRef(selection.id) })}>Open Rosie</button><button className="min-h-11 font-semibold text-primary underline" onClick={() => { sessionStorage.removeItem(INTAKE); router.replace(marker?.returnUrl?.startsWith('/requests') ? marker.returnUrl : '/requests') }}>All jobs</button></div></div>}
        </main>
      </FocusedJobsRailLayout>
    </Shell>
  )
}

export default function JobsPage() {
  return <Suspense fallback={<div className="p-8">Loading jobs…</div>}><JobsWorkspace /></Suspense>
}
