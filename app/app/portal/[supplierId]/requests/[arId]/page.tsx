'use client'

// One availability request, on its own page — what the home list's cards open
// since 2026-08-26, replacing the card that expanded in place. Everything the
// supplier needs to answer it is here: our note, who it is for where that is
// shared, the answer summary, the line editor, and the Submit button that
// hands the answers back to Local Plant Supply.
//
// It loads the same payload the home list does (`GET /api/portal/:id`, lines
// embedded) rather than the single-request route: one fetch feeds the request,
// the supplier's name and the header bell, which is on every portal page.

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { ARLineTable, ARResponseSummary, ARStatusPill } from '@/components/workspace/availability'
import { ChevronLeft } from '@/components/workspace/icons'
import { useIsMobile } from '@/components/workspace/shell'
import {
  PortalFrame,
  portalRequestName as requestName,
  type PortalAlert,
} from '@/components/workspace/portal'
import { type ARDetail } from '@/lib/availability'
import { formatDate } from '@/lib/format'
import { redactPortalRequestRefs } from '@/lib/portal-display'

export default function PortalRequestPage() {
  const params = useParams<{ supplierId: string; arId: string }>()
  const supplierId = Number.parseInt(params.supplierId, 10)
  const arId = Number.parseInt(params.arId, 10)
  // The frame draws no header on mobile, and this is the one portal page a
  // highlighted tab does not identify — so the name rides in the toolbar there.
  const isMobile = useIsMobile()

  const [supplierName, setSupplierName] = useState<string | null>(null)
  const [requests, setRequests] = useState<ARDetail[]>([])
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/portal/${supplierId}`)
    if (!res.ok) {
      setState('missing')
      return
    }
    const body = (await res.json()) as { supplier: { name: string }; requests: ARDetail[] }
    setSupplierName(body.supplier.name)
    setRequests(body.requests)
    setState('ready')
  }, [supplierId])

  useEffect(() => {
    if (!Number.isInteger(supplierId) || !Number.isInteger(arId)) {
      setState('missing')
      return
    }
    void load().catch(() => setState('missing'))
  }, [supplierId, arId, load])

  const request = useMemo(() => requests.find((r) => r.id === arId) ?? null, [requests, arId])

  /** The header bell is on every portal page, so it lists the same unanswered requests. */
  const alerts: PortalAlert[] = useMemo(
    () =>
      requests
        .filter((r) => r.status === 'new')
        .map((r) => ({ id: r.id, label: requestName(r), at: Date.parse(r.createdAt) })),
    [requests],
  )

  const patchItem = useCallback(
    async (itemId: number, changes: Record<string, string>) => {
      setError('')
      const res = await fetch(`/api/portal/${supplierId}/requests/${arId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ itemId, changes }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        setError(body.error ?? 'Could not save')
      }
      await load()
    },
    [supplierId, arId, load],
  )

  const submit = useCallback(async () => {
    setSaving(true)
    setError('')
    const res = await fetch(`/api/portal/${supplierId}/requests/${arId}/submit`, { method: 'POST' })
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      setError(body.error ?? 'Could not submit')
    }
    await load()
    setSaving(false)
  }, [supplierId, arId, load])

  // A closed request was reached from the Closed page and belongs to it, so
  // both the back link and the rail's highlight follow it there.
  const isClosed = request?.status === 'closed'
  const back = (
    <div className="flex flex-none flex-wrap items-center gap-2.5 border-b border-border bg-card px-3 py-2.5 md:px-4">
      <Link
        href={isClosed ? `/portal/${supplierId}/closed` : `/portal/${supplierId}`}
        className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-[12px] font-semibold text-muted-foreground no-underline hover:bg-muted hover:text-foreground"
      >
        <span className="flex size-3.5"><ChevronLeft /></span>
        {isClosed ? 'Closed requests' : 'All requests'}
      </Link>
      {request && (
        <>
          <ARStatusPill status={request.status} />
          <span className="ml-auto whitespace-nowrap text-[11px] text-lps-dim">
            Requested {formatDate(request.createdAt)}
            {request.submittedAt && ` · Submitted ${formatDate(request.submittedAt)}`}
          </span>
          {isMobile && (
            <span className="w-full min-w-0 truncate font-serif text-[17px] font-semibold text-foreground">
              {requestName(request)}
            </span>
          )}
        </>
      )}
    </div>
  )

  if (state === 'missing' || (state === 'ready' && !request)) {
    return (
      <PortalFrame
        supplierId={supplierId}
        supplierName={supplierName}
        tab="requests"
        title="Availability request"
        toolbar={back}
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-auto p-3 pb-5 md:p-4">
          <p className="py-10 text-center text-[13px] text-muted-foreground">
            This request isn&apos;t available. Please check with your Local Plant Supply contact.
          </p>
        </div>
      </PortalFrame>
    )
  }

  const editable = !!request && request.status !== 'closed'
  const pending = request ? request.items.length - request.answeredCount : 0

  return (
    <PortalFrame
      supplierId={supplierId}
      supplierName={supplierName}
      tab={isClosed ? 'closed' : 'requests'}
      title={request ? requestName(request) : 'Availability request'}
      subtitle={
        request
          ? `${request.items.length} ${request.items.length === 1 ? 'line' : 'lines'} · ${pending} pending`
          : undefined
      }
      alerts={alerts}
      onOpenAlert={(id) => { window.location.href = `/portal/${supplierId}/requests/${id}` }}
      toolbar={back}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-auto p-3 pb-5 md:p-4">
        {error && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-[13px] text-destructive">
            {error}
          </div>
        )}

        {state === 'loading' && (
          <div className="py-16 text-center text-[12.5px] text-muted-foreground">Loading…</div>
        )}

        {request && (
          <>
            {request.lpsNotes && (
              <div className="flex min-w-0 flex-col gap-0.5 rounded-xl border border-lps-hair bg-lps-bubble p-3">
                <span className="text-[10.5px] font-bold uppercase tracking-[.05em] text-lps-dim">
                  Note from Local Plant Supply
                </span>
                <span className="whitespace-pre-wrap text-[12.5px] text-foreground">
                  {redactPortalRequestRefs(request.lpsNotes)}
                </span>
              </div>
            )}

            {(request.customer || request.shipping?.address) && (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {request.customer && (
                  <div className="flex min-w-0 flex-col gap-0.5 rounded-xl border border-lps-hair bg-card p-3">
                    <span className="text-[10.5px] font-bold uppercase tracking-[.05em] text-lps-dim">Customer</span>
                    <span className="text-[12.5px] text-foreground">
                      {[request.customer.company, request.customer.name].filter(Boolean).join(' · ')}
                    </span>
                    {(request.customer.phone || request.customer.email) && (
                      <span className="text-[11.5px] text-muted-foreground">
                        {[request.customer.phone, request.customer.email].filter(Boolean).join(' · ')}
                      </span>
                    )}
                  </div>
                )}
                {request.shipping?.address && (
                  <div className="flex min-w-0 flex-col gap-0.5 rounded-xl border border-lps-hair bg-card p-3">
                    <span className="text-[10.5px] font-bold uppercase tracking-[.05em] text-lps-dim">Delivery</span>
                    <span className="text-[12.5px] text-foreground">
                      {[
                        request.shipping.address,
                        [request.shipping.city, request.shipping.state].filter(Boolean).join(', '),
                        request.shipping.zip,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </div>
                )}
              </div>
            )}

            <ARResponseSummary items={request.items} answeredCount={request.answeredCount} />

            <ARLineTable
              items={request.items}
              editable={editable}
              onPatch={patchItem}
              displayText={redactPortalRequestRefs}
            />

            {editable && request.items.some((item) => item.unitPrice != null) && request.status === 'new' && (
              <p className="m-0 text-[11.5px] text-muted-foreground">
                Prices we already have on file are filled in — please correct any that have changed.
              </p>
            )}

            {editable ? (
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => void submit()}
                  disabled={saving}
                  className="cursor-pointer rounded-full bg-primary px-6 py-2 text-[12.5px] font-bold text-primary-foreground shadow-sm disabled:opacity-50"
                >
                  {/* Re-Submit once the request has been handed back before —
                      including after we added a line and put it back at New. */}
                  {saving ? 'Submitting…' : request.submittedAt ? 'Re-Submit' : 'Submit'}
                </button>
                <span className="text-[11.5px] text-muted-foreground">
                  {request.submittedAt
                    ? 'Re-submitting sends your updated answers to Local Plant Supply.'
                    : 'Submitting sends your answers to Local Plant Supply — you can come back and refine them.'}
                </span>
              </div>
            ) : (
              <p className="m-0 text-[12px] text-muted-foreground">
                This request is closed — the lines are read-only.
              </p>
            )}
          </>
        )}
      </div>
    </PortalFrame>
  )
}
