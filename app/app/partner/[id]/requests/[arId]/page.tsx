'use client'

// One availability request, on its own page — what the home list's cards open
// since 2026-08-26, replacing the card that expanded in place. Everything the
// supplier needs to answer it is here: our note, who it is for where that is
// shared, the answer summary, the line editor, and the Submit button that
// hands the answers back to Local Plant Supply.
//
// It loads the same payload the home list does (`GET /api/partner/:id`, lines
// embedded) rather than the single-request route: one fetch feeds the request,
// the supplier's name and the header bell, which is on every portal page.

import { Printer } from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { AvailabilityRequestView } from '@/components/workspace/availability-request-view'
import { ARSharing } from '@/components/workspace/ar-sharing'
import { ChevronLeft } from '@/components/workspace/icons'
import {
  PartnerFrame,
  partnerRequestName as requestName,
  type PartnerAlert,
} from '@/components/workspace/partner'
import { withLineChanges, type ARDetail } from '@/lib/availability'
import { usePartnerUpdates } from '@/lib/use-partner-updates'

/** A round outlined icon button — the toolbar's right-hand actions. */
function IconAction({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex size-9 cursor-pointer items-center justify-center rounded-lg border border-border bg-card text-foreground hover:bg-lps-tint"
    >
      {children}
    </button>
  )
}

export default function PartnerRequestPage() {
  const params = useParams<{ id: string; arId: string }>()
  const supplierId = Number.parseInt(params.id, 10)
  const arId = Number.parseInt(params.arId, 10)
  const [supplierName, setSupplierName] = useState<string | null>(null)
  const [requests, setRequests] = useState<ARDetail[]>([])
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const answerTail = useRef<Promise<void>>(Promise.resolve())
  const [optimisticSubmission, setOptimisticSubmission] = useState<{
    supplierId: number; arId: number; submittedAt: string
  } | null>(null)
  const submission = useRef<typeof optimisticSubmission>(null)

  const loadController = useRef<AbortController | null>(null)
  const load = useCallback(async () => {
    loadController.current?.abort()
    const controller = new AbortController()
    loadController.current = controller
    try {
      const res = await fetch(`/api/partner/${supplierId}`, { cache: 'no-store', signal: controller.signal })
      if (controller.signal.aborted) return
      if (!res.ok) {
        setState(current => [401, 403, 404].includes(res.status) || current === 'loading' ? 'missing' : current)
        return
      }
      const body = (await res.json()) as { supplier: { name: string }; requests: ARDetail[] }
      if (controller.signal.aborted) return
      setSupplierName(body.supplier.name)
      setRequests(body.requests)
      setState('ready')
    } catch (error) {
      if (controller.signal.aborted) return
      setState(current => current === 'loading' ? 'missing' : current)
      throw error
    }
  }, [supplierId])

  useEffect(() => {
    submission.current = null
    setOptimisticSubmission(null)
    setSaving(false)
    setError('')
    if (!Number.isInteger(supplierId) || !Number.isInteger(arId)) {
      setState('missing')
      return
    }
    setState('loading')
    setRequests([])
    setSupplierName(null)
    void load().catch(() => {})
    return () => { submission.current = null; loadController.current?.abort() }
  }, [supplierId, arId, load])

  usePartnerUpdates(supplierId, load)

  // Keep pending submission visible even if Realtime reads an older snapshot.
  // The saved rows stay intact underneath, so rejection restores the latest data.
  const visibleRequests = useMemo(() => requests.map(row =>
    optimisticSubmission?.supplierId === supplierId && optimisticSubmission.arId === row.id && row.status !== 'closed'
      ? { ...row, status: 'submitted', submittedAt: optimisticSubmission.submittedAt }
      : row,
  ), [requests, optimisticSubmission, supplierId])
  const request = useMemo(() => visibleRequests.find((r) => r.id === arId) ?? null, [visibleRequests, arId])

  /** The header bell is on every portal page, so it lists the same unanswered requests. */
  const alerts: PartnerAlert[] = useMemo(
    () =>
      visibleRequests
        .filter((r) => r.status === 'new')
        .map((r) => ({ id: r.id, label: requestName(r), at: Date.parse(r.createdAt) })),
    [visibleRequests],
  )

  const patchItem = useCallback(
    async (itemId: number, changes: Record<string, string>) => {
      // Optimistic: the answer shows now; the read after the write (or after
      // its failure, below) settles what is saved.
      setRequests(current => current.map(row => row.id === arId
        ? { ...row, items: row.items.map(item => item.id === itemId ? withLineChanges(item, changes) : item) }
        : row))
      const operation = answerTail.current.catch(() => {}).then(async () => {
        setError('')
        const res = await fetch(`/api/partner/${supplierId}/requests/${arId}`, {
          method: 'PATCH', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ itemId, changes }),
        })
        if (!res.ok) {
          const body = await res.json().catch(() => ({})) as { error?: string }
          throw new Error(body.error ?? 'Could not save')
        }
        await load()
      })
      answerTail.current = operation
      try { await operation } catch (error) {
        setError((error as Error).message)
        void load().catch(() => {})
      }
    },
    [supplierId, arId, load],
  )

  const submit = useCallback(async (supplierNote: string) => {
    if (submission.current) return false
    const operation = { supplierId, arId, submittedAt: new Date().toISOString() }
    submission.current = operation
    setOptimisticSubmission(operation)
    setSaving(true)
    setError('')
    try {
      // Finish queued line saves before submitting the note and response.
      await answerTail.current
      if (submission.current !== operation) return false
      const res = await fetch(`/api/partner/${supplierId}/requests/${arId}/submit`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ supplierNote }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error ?? 'Could not submit')
      }
      if (submission.current !== operation) return false
      // The POST succeeded: commit the acknowledged state immediately. Abort
      // older reads before reconciling; reload failures cannot undo submission.
      loadController.current?.abort()
      setRequests(current => current.map(row => row.id === arId
        ? { ...row, status: 'submitted', submittedAt: operation.submittedAt, noteForSupplier: supplierNote }
        : row))
      setOptimisticSubmission(null)
      void load().catch(() => {})
      return true
    } catch (error) {
      if (submission.current === operation) {
        setOptimisticSubmission(null)
        setError((error as Error).message)
      }
      return false
    } finally {
      if (submission.current === operation) { submission.current = null; setSaving(false) }
    }
  }, [supplierId, arId, load])

  // A closed request was reached from the Closed page and belongs to it, so
  // both the back link and the rail's highlight follow it there.
  const isClosed = request?.status === 'closed'
  const pending = request ? request.items.length - request.answeredCount : 0
  const back = (rightActions: React.ReactNode = null) => (
    /* Request navigation, sharing, printing, and the frame's bell. */
    <div className="flex flex-none items-center gap-2.5 px-3 py-3 md:px-4">
      {/* One row on every width: the back button is an icon, named for where it goes. */}
      <Link
        href={isClosed ? `/partner/${supplierId}/closed` : `/partner/${supplierId}`}
        aria-label={isClosed ? 'Closed requests' : 'Customer Requests'}
        title={isClosed ? 'Closed requests' : 'Customer Requests'}
        className="inline-flex size-11 flex-none items-center justify-center rounded-full border border-border bg-card text-foreground no-underline hover:bg-lps-tint"
      >
        <span className="flex size-4"><ChevronLeft /></span>
      </Link>
      {request && (
        <span className="min-w-0 truncate text-[11px] text-muted-foreground">
          {request.items.length} {request.items.length === 1 ? 'line' : 'lines'} · {pending} pending
        </span>
      )}
      {request && (
        <div className="ml-auto flex flex-none items-center gap-2.5 print:hidden">
          <ARSharing align="right" key={request.id} id={request.id} token={request.publicToken ?? null} closed={isClosed}
            endpoint={`/api/partner/${supplierId}/requests/${request.id}`}
            onChange={publicToken => setRequests(current => current.map(row => row.id === request.id ? { ...row, publicToken } : row))} />
          <IconAction label="Print" onClick={() => window.print()}>
            <Printer className="size-4" />
          </IconAction>
          {rightActions}
        </div>
      )}
    </div>
  )

  if (state === 'missing' || (state === 'ready' && !request)) {
    return (
      <PartnerFrame
        supplierId={supplierId}
        supplierName={supplierName}
        tab="requests"
        title="Availability request"
        toolbar={back()}
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-auto p-3 pb-5 md:p-4">
          <p className="py-10 text-center text-[13px] text-muted-foreground">
            This request isn&apos;t available. Please check with your Local Plant Supply contact.
          </p>
        </div>
      </PartnerFrame>
    )
  }

  return (
    <PartnerFrame
      // Rosie may have written a chat-given answer into this request.
      onAgentReply={load}
      supplierId={supplierId}
      supplierName={supplierName}
      tab={isClosed ? 'closed' : 'requests'}
      title={request ? requestName(request) : 'Availability request'}
      // The header card's strip carries the name; a desktop header above the
      // toolbar would say it twice. The bell rides in the toolbar's actions.
      hideHeaderOnDesktop
      alerts={alerts}
      onOpenAlert={(id) => { window.location.href = `/partner/${supplierId}/requests/${id}` }}
      toolbar={(rightActions) => back(rightActions)}
    >
      <AvailabilityRequestView key={`${supplierId}/${arId}`} request={request} loading={state === 'loading'} error={error}
        saving={saving} onPatch={patchItem} onSubmit={submit} />
    </PartnerFrame>
  )
}
