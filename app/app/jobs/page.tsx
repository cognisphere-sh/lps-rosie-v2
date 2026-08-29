'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, MessageSquare, RefreshCw } from 'lucide-react'

import { RequestBody, StatusPill } from '@/components/workspace/job-request'
import { JobsViewSwitch, Shell } from '@/components/workspace/shell'
import { openChat } from '@/lib/chat-bus'
import { subscribeEvents } from '@/lib/chat-events'
import {
  canonicalJobThread, hasFocusedIntakeEvidence, jobInboxEventAction, jobInboxLayout,
  mergeJobInbox, orderJobInbox, parseJobSelection, patchJobInbox,
  type JobInboxRow, type JobThreadPatch,
} from '@/lib/job-inbox'
import { ACTIVE_JOB_STATUSES, REQUEST_STATUS_OPTIONS, requestRef, requestStatusLabel, requestStatusTone } from '@/lib/job-requests'
import type { JobRequestRow } from '@/lib/rows'
import { cn } from '@/lib/utils'

const RESYNC_MS = 60_000
const LIST_SCROLL = 'lps.jobs.scroll.v1'
const LIST_ORIGIN = 'lps.jobs.origin.v1'
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

function fmt(at: number) {
  if (!at) return 'No dated activity'
  return new Date(at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
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
      if (!response.ok || !body.request) throw new Error(body.error ?? 'Saved details unavailable')
      setRequest(body.request); setError('')
    } catch (cause) {
      if (mine === generation.current) setError((cause as Error).message)
    } finally {
      if (mine === generation.current) setLoading(false)
    }
  }, [id])
  useEffect(() => {
    void refresh()
    const timer = setInterval(() => void refresh(), 15_000)
    const focus = () => void refresh()
    window.addEventListener('focus', focus)
    const off = subscribeEvents('/api/chat/events', (value) => {
      const event = value as { type?: string; agent?: string; threadId?: string }
      if (event.type === 'thread' && event.agent === 'rosie' && event.threadId === canonicalJobThread(id)) void refresh()
    })
    return () => { clearInterval(timer); window.removeEventListener('focus', focus); off(); generation.current++ }
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
  const selection = useMemo(() => parseJobSelection(params.getAll('jr')), [params])
  const intakeRequested = params.getAll('intake').length === 1 && params.get('intake') === '1'
  const [jobs, setJobs] = useState<JobInboxRow[]>([])
  const ordered = useMemo(() => orderJobInbox(jobs), [jobs])
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState('')
  const [detail, setDetail] = useState<JobRequestRow | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [version, setVersion] = useState(0)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const rowsRef = useRef(new Map<number, HTMLButtonElement>())
  const fetchGeneration = useRef(0)
  const rowRevisions = useRef(new Map<number, number>())
  const jobsRef = useRef<JobInboxRow[]>([])
  const detailGeneration = useRef(0)
  const pushedSelection = useRef<number | null>(null)

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
    const timer = setInterval(() => void refreshList(), RESYNC_MS)
    const focus = () => void refreshList()
    window.addEventListener('focus', focus)
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
    }, () => void refreshList())
    return () => { clearInterval(timer); window.removeEventListener('focus', focus); off(); fetchGeneration.current++ }
  }, [refreshList])

  // Desktop-only bare auto-selection occurs after the real media query hydrates.
  useEffect(() => {
    if (breakpoint === false && selection.kind === 'bare' && !loading && ordered[0]) {
      router.replace(`/jobs?jr=${ordered[0].id}`, { scroll: false })
    }
  }, [breakpoint, loading, ordered, router, selection.kind])

  const selectedInList = selection.kind === 'valid' && ordered.some((row) => row.id === selection.id)
  const loadDetail = useCallback(async (id: number) => {
    const mine = ++detailGeneration.current
    const controller = new AbortController()
    setDetailLoading(true); setDetailError(''); setDetail(null)
    try {
      const response = await fetch(`/api/requests/${id}`, { cache: 'no-store', signal: controller.signal })
      const body = await response.json() as { request?: JobRequestRow; error?: string }
      if (!response.ok || !body.request) throw new Error(response.status === 404 ? 'This job is unavailable.' : body.error ?? 'Could not load this job')
      if (!(ACTIVE_JOB_STATUSES as readonly string[]).includes(body.request.status)) {
        if (mine === detailGeneration.current) setJobs((current) => {
          const next = current.filter((row) => row.id !== id)
          jobsRef.current = next
          return next
        })
        void refreshList()
        throw new Error('This job is closed or no longer active.')
      }
      if (mine === detailGeneration.current) setDetail(body.request)
    } catch (cause) {
      if (mine === detailGeneration.current && (cause as Error).name !== 'AbortError') setDetailError((cause as Error).message)
    } finally { if (mine === detailGeneration.current) setDetailLoading(false) }
    return () => controller.abort()
  }, [refreshList])
  useEffect(() => {
    if (!selectedInList || selection.kind !== 'valid') { setDetail(null); setDetailError(''); return }
    void loadDetail(selection.id)
  }, [loadDetail, selectedInList, selection])

  useEffect(() => {
    if (selection.kind !== 'bare' || breakpoint !== true) return
    const scroll = Number(sessionStorage.getItem(LIST_SCROLL) ?? 0)
    if (listRef.current) listRef.current.scrollTop = scroll
    const id = Number(sessionStorage.getItem(LIST_ORIGIN) ?? 0)
    requestAnimationFrame(() => rowsRef.current.get(id)?.focus({ preventScroll: true }))
  }, [breakpoint, selection.kind])

  const pick = (id: number) => {
    if (listRef.current) sessionStorage.setItem(LIST_SCROLL, String(listRef.current.scrollTop))
    sessionStorage.setItem(LIST_ORIGIN, String(id))
    pushedSelection.current = id
    router.push(`/jobs?jr=${id}`, { scroll: false })
  }
  const backToList = () => {
    if (selection.kind === 'valid' && pushedSelection.current === selection.id) router.back()
    else router.replace('/jobs', { scroll: false })
  }

  const marker = useMemo(() => {
    if (selection.kind !== 'valid' || typeof window === 'undefined') return null
    try { return JSON.parse(sessionStorage.getItem(INTAKE) ?? 'null') as { id?: number; returnUrl?: string } | null } catch { return null }
  }, [selection])
  const focused = intakeRequested && selection.kind === 'valid' && hasFocusedIntakeEvidence(selection.id, marker)
  useEffect(() => {
    if (!intakeRequested && selection.kind === 'valid' && selectedInList && marker?.id === selection.id) {
      sessionStorage.removeItem(INTAKE)
    }
  }, [intakeRequested, marker?.id, selectedInList, selection])
  const exitIntake = () => {
    if (selection.kind !== 'valid') return
    // Exit is presentation-only: keep the same-tab marker so a pre-record
    // identity can honestly offer Resume/Open Rosie instead of disappearing.
    router.replace(`/jobs?jr=${selection.id}`, { scroll: false })
  }

  const switcher = <JobsViewSwitch active="inbox" />
  if (focused && selection.kind === 'valid') {
    return <Shell page="requests" title={`JR-${selection.id} · New request with Rosie`} hideHeaderOnMobile toolbar={undefined}
      focusedIntake={{ id: selection.id, onExit: exitIntake, savedPanel: <IntakeSaved id={selection.id} /> }}>
      <div />
    </Shell>
  }

  const pendingMarker = selection.kind === 'valid' && marker?.id === selection.id && !selectedInList
  const unavailable = selection.kind === 'invalid' || (selection.kind === 'valid' && !loading && !selectedInList && !pendingMarker)
  return (
    <Shell page="requests" title="Jobs" hideHeaderOnMobile toolbar={switcher}>
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <section aria-label="Active job inbox" className={cn('w-full flex-none border-r border-border bg-card min-[900px]:w-[292px]', breakpoint === true && selection.kind !== 'bare' && 'hidden')}>
          <div className="border-b border-border px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Active jobs</div>
          <div ref={listRef} className="h-[calc(100%-37px)] overflow-y-auto p-2">
            {listError && <div role="alert" className="rounded-lg border border-destructive/40 p-3 text-[12px] text-destructive">{listError}<button className="mt-2 flex min-h-11 items-center gap-2 font-semibold underline" onClick={() => void refreshList()}><RefreshCw size={14}/>Retry</button></div>}
            {loading && !ordered.length && <div role="status" className="p-4 text-[12px] text-muted-foreground">Loading active jobs…</div>}
            {!loading && !listError && !ordered.length && <div className="p-4 text-[12px] text-muted-foreground"><p className="font-semibold text-foreground">No active jobs</p><p>Start a new request with Rosie, or review completed work in All jobs.</p><Link className="font-semibold text-primary underline" href="/requests">All jobs</Link></div>}
            {ordered.map((row) => <button key={row.id} ref={(el) => { if (el) rowsRef.current.set(row.id, el); else rowsRef.current.delete(row.id) }} type="button" onClick={() => pick(row.id)} aria-current={selection.kind === 'valid' && selection.id === row.id ? 'page' : undefined} className={cn('mb-1 min-h-11 w-full rounded-xl border border-transparent px-3 py-2 text-left outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring', selection.kind === 'valid' && selection.id === row.id && 'border-border bg-muted')}>
              <span className="flex items-center gap-2"><span className="font-bold text-primary">{requestRef(row.id)}</span><span className="truncate text-[12.5px] font-semibold">{row.name || row.customer || 'Unnamed job'}</span>{row.unread && <span className="ml-auto rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-bold text-primary-foreground">New web chat</span>}</span>
              <span className="mt-1 flex items-center gap-2 text-[10.5px] text-muted-foreground"><span>{requestStatusLabel(row.status)}</span><span aria-hidden>·</span><span className="truncate">{row.preview}</span></span>
              <span className="mt-1 block text-[10px] text-lps-dim">{fmt(row.activityAt)}{row.unread ? ' · Unread in team web chat' : ''}</span>
            </button>)}
          </div>
        </section>
        <main aria-label="Selected job" className={cn('min-w-0 flex-1 overflow-y-auto bg-background', breakpoint === true && selection.kind === 'bare' && 'hidden')}>
          {breakpoint === true && <button type="button" onClick={backToList} className="flex min-h-11 items-center gap-2 px-3 text-[12px] font-semibold text-primary"><ArrowLeft size={16}/>Back to active jobs</button>}
          {selection.kind === 'bare' && breakpoint === false && <div role="status" className="p-8 text-center text-muted-foreground">Choose an active job.</div>}
          {unavailable && <div className="mx-auto max-w-md p-8 text-center"><h2 className="text-lg font-bold">Job unavailable</h2><p className="text-sm text-muted-foreground">This link is invalid, closed, deleted, or not in the active inbox. Another job was not selected for you.</p><div className="flex justify-center gap-3"><button className="min-h-11 font-semibold text-primary underline" onClick={() => router.replace('/jobs')}>Active jobs</button><Link className="flex min-h-11 items-center font-semibold text-primary underline" href="/requests">All jobs</Link></div></div>}
          {detailLoading && <div role="status" className="p-8 text-center text-muted-foreground">Loading job details…</div>}
          {detailError && <div role="alert" className="p-8 text-center text-destructive">{detailError}<button className="mx-auto mt-2 flex min-h-11 items-center font-semibold underline" onClick={() => selection.kind === 'valid' && void loadDetail(selection.id)}>Retry</button></div>}
          {detail && <div className="m-3 overflow-hidden rounded-xl border border-border bg-card">
            <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
              <span className="font-bold text-primary">{requestRef(detail.id)}</span><span className="min-w-0 flex-1 truncate font-semibold">{detail.name || detail.customer?.company || detail.customer?.name || 'Unnamed job'}</span>
              <StatusPill table="job_requests" id={detail.id} column="status" value={detail.status} label={requestStatusLabel(detail.status)} tone={requestStatusTone(detail.status)} options={REQUEST_STATUS_OPTIONS} onSaved={() => { setVersion((n) => n + 1); void loadDetail(detail.id); void refreshList() }}/>
              <button type="button" onClick={() => openChat({ agentId: 'rosie', threadId: canonicalJobThread(detail.id), label: detail.name || requestRef(detail.id) })} className="flex min-h-11 items-center gap-2 rounded-full px-3 text-[12px] font-semibold text-primary"><Image src="/rosie.png" alt="" width={22} height={22} className="rounded-full"/>Chat with Rosie<MessageSquare size={14}/></button>
            </div>
            <RequestBody request={detail} version={version} detailsOpen={detailsOpen} onToggleDetails={() => setDetailsOpen((v) => !v)} emptyItemsCopy="No active line items have been saved for this job yet." onSaved={() => { setVersion((n) => n + 1); void loadDetail(detail.id); void refreshList() }}/>
          </div>}
          {pendingMarker && selection.kind === 'valid' && <div className="p-8 text-center"><h2 className="font-bold">{requestRef(selection.id)} intake is pending</h2><p className="text-sm text-muted-foreground">Nothing is in the active job record yet. The reserved identity is kept; exiting never deletes it.</p><div className="flex flex-wrap justify-center gap-3"><button className="min-h-11 font-semibold text-primary underline" onClick={() => router.replace(`/jobs?jr=${selection.id}&intake=1`)}>Resume intake</button><button className="min-h-11 font-semibold text-primary underline" onClick={() => openChat({ agentId: 'rosie', threadId: canonicalJobThread(selection.id), label: requestRef(selection.id) })}>Open Rosie</button><button className="min-h-11 font-semibold text-primary underline" onClick={() => { sessionStorage.removeItem(INTAKE); router.replace(marker?.returnUrl?.startsWith('/jobs') ? marker.returnUrl : '/jobs') }}>Active jobs</button></div></div>}
        </main>
      </div>
    </Shell>
  )
}

export default function JobsPage() {
  return <Suspense fallback={<div className="p-8">Loading jobs…</div>}><JobsWorkspace /></Suspense>
}
