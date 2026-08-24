'use client'

import { useEffect, useState } from 'react'

import { ARLineTable, ARStatusPill } from '@/components/workspace/availability'
import { CloseIcon } from '@/components/workspace/icons'
import { onOpenAvailabilityRequest } from '@/lib/chat-bus'
import type { ARDetail } from '@/lib/availability'
import { formatDate } from '@/lib/format'
import { requestRef } from '@/lib/job-requests'

/**
 * One availability request in a right-hand drawer, openable from anywhere —
 * a job-request card's AR links, or an `[…](ar:<id>)` button in the chat
 * panel. Mounted once by the Shell; `openAvailabilityRequest(id)` opens it.
 */
export function AvailabilityRequestDrawer() {
  const [arId, setArId] = useState<number | null>(null)
  const [ar, setAr] = useState<ARDetail | null>(null)
  const [error, setError] = useState('')

  useEffect(() => onOpenAvailabilityRequest(setArId), [])

  useEffect(() => {
    if (arId == null) {
      setAr(null)
      setError('')
      return
    }
    let cancelled = false
    setAr(null)
    fetch(`/api/availability-requests/${arId}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`AR-${arId} not found`)
        const body = (await res.json()) as { request: ARDetail }
        if (!cancelled) setAr(body.request)
      })
      .catch((e) => !cancelled && setError((e as Error).message))
    return () => {
      cancelled = true
    }
  }, [arId])

  useEffect(() => {
    if (arId == null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setArId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [arId])

  if (arId == null) return null

  return (
    <div
      className="fixed inset-0 z-[85] flex justify-end bg-black/30"
      onClick={() => setArId(null)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-[640px] flex-col gap-2.5 overflow-y-auto border-l border-border bg-background p-4 shadow-[var(--lps-shadow)]"
      >
        <div className="flex items-center gap-2">
          <span className="text-[14px] font-bold text-foreground">
            Availability request AR-{arId}
          </span>
          <button
            type="button"
            onClick={() => setArId(null)}
            aria-label="Close"
            className="ml-auto flex size-7 cursor-pointer items-center justify-center rounded-full border-none bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <CloseIcon size={14} />
          </button>
        </div>

        {error && <p className="text-[12.5px] text-destructive">{error}</p>}
        {!ar && !error && (
          <p className="text-[12.5px] text-muted-foreground">Loading…</p>
        )}

        {ar && (
          <>
            <div className="flex flex-wrap items-center gap-2.5 rounded-xl border border-border bg-card px-3.5 py-3">
              <ARStatusPill status={ar.status} />
              <span className="text-[14px] font-bold text-foreground">
                {ar.jobName ?? requestRef(ar.jobRequestId)}
              </span>
              <span className="text-[12px] text-muted-foreground">{ar.supplierName}</span>
              {ar.shareCustomerDetails && (
                <span className="rounded-full border border-border px-1.5 py-px text-[9.5px] font-bold uppercase tracking-wide text-muted-foreground">
                  customer shared
                </span>
              )}
              <span className="text-[11px] text-lps-dim">
                Sent {formatDate(ar.createdAt)}
                {ar.submittedAt && ` · Submitted ${formatDate(ar.submittedAt)}`}
              </span>
              <a
                href={`/portal/${ar.supplierId}/requests/${ar.id}`}
                target="_blank"
                rel="noreferrer"
                className="ml-auto text-[11.5px] font-semibold text-primary underline"
                title="The request as the supplier sees it"
              >
                Portal view
              </a>
            </div>
            {ar.lpsNotes && (
              <p className="m-0 rounded-lg border border-lps-hair bg-lps-bubble px-2.5 py-2 text-[12.5px] text-foreground">
                <span className="mr-1.5 text-[10.5px] font-bold uppercase tracking-[.05em] text-lps-dim">
                  Note to supplier
                </span>
                {ar.lpsNotes}
              </p>
            )}
            <ARLineTable items={ar.items} editable={false} />
          </>
        )}
      </div>
    </div>
  )
}
