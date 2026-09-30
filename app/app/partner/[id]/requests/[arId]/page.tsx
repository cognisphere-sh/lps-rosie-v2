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
import type { ARDetail } from '@/lib/availability'
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
    if (!Number.isInteger(supplierId) || !Number.isInteger(arId)) {
      setState('missing')
      return
    }
    setState('loading')
    setRequests([])
    setSupplierName(null)
    void load().catch(() => {})
    return () => { loadController.current?.abort() }
  }, [supplierId, arId, load])

  usePartnerUpdates(supplierId, load)

  const request = useMemo(() => requests.find((r) => r.id === arId) ?? null, [requests, arId])

  /** The header bell is on every portal page, so it lists the same unanswered requests. */
  const alerts: PartnerAlert[] = useMemo(
    () =>
      requests
        .filter((r) => r.status === 'new')
        .map((r) => ({ id: r.id, label: requestName(r), at: Date.parse(r.createdAt) })),
    [requests],
  )

  const patchItem = useCallback(
    async (itemId: number, changes: Record<string, string>) => {
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
      try { await operation } catch (error) { setError((error as Error).message) }
    },
    [supplierId, arId, load],
  )

  const submit = useCallback(async (supplierNote: string) => {
    setSaving(true)
    setError('')
    try {
      // Finish queued line saves before submitting the note and response.
      await answerTail.current
      const res = await fetch(`/api/partner/${supplierId}/requests/${arId}/submit`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ supplierNote }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error ?? 'Could not submit')
      }
      await load()
      return true
    } catch (error) { setError((error as Error).message); return false }
    finally { setSaving(false) }
  }, [supplierId, arId, load])

  // A closed request was reached from the Closed page and belongs to it, so
  // both the back link and the rail's highlight follow it there.
  const isClosed = request?.status === 'closed'
  const pending = request ? request.items.length - request.answeredCount : 0
  const back = (rightActions: React.ReactNode = null) => (
    /* Request navigation, sharing, printing, and the frame's bell. */
    <div className="flex flex-none flex-wrap items-center gap-2.5 px-3 py-3 md:px-4">
      <Link
        href={isClosed ? `/partner/${supplierId}/closed` : `/partner/${supplierId}`}
        className="inline-flex min-h-11 min-w-11 items-center gap-1 rounded-full border border-border bg-card px-3.5 text-[12.5px] font-semibold text-foreground no-underline hover:bg-lps-tint"
      >
        <span className="flex size-3.5"><ChevronLeft /></span>
        {isClosed ? 'Closed requests' : 'Customer Requests'}
      </Link>
      {request && (
        <span className="whitespace-nowrap text-[11px] text-muted-foreground">
          {request.items.length} {request.items.length === 1 ? 'line' : 'lines'} · {pending} pending
        </span>
      )}
      {request && (
        <div className="ml-auto flex items-center gap-2.5 print:hidden">
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
      <AvailabilityRequestView request={request} loading={state === 'loading'} error={error}
        saving={saving} onPatch={patchItem} onSubmit={submit} />
    </PartnerFrame>
  )
}
