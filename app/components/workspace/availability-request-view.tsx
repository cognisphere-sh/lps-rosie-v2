'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { PartnerDetailHeader, PartnerFulfillment } from './partner-detail-header'
import { ARLineTable } from './availability'
import { ARPrintSheet } from './ar-print-sheet'
import { SubmitReceived } from './submit-received'
import { SummaryStrip } from './partner-summary-strip'
import { toggleStatus } from './demand-summary'
import { partnerRequestName as requestName } from './partner'
import { arShownStatus, arStatusLabel, arSubtotal, type ARDetail } from '@/lib/availability'
import { redactPartnerRequestRefs } from '@/lib/partner-display'
import { cn } from '@/lib/utils'

/**
 * The request's header card: the name with its status, the schedules, then the
 * customer's contact and delivery address where the request shares them. The
 * supplier's page and the job page's AR tab draw the same card.
 */
export function ARRequestHeader({ request, name, status }: { request: ARDetail; name: string; status: ReactNode }) {
  return (
    <PartnerDetailHeader name={name} status={status}
      schedule={<div aria-label="Job schedules" className="flex flex-col gap-1.5">{(request.jobSchedules?.length ? request.jobSchedules : [{ fulfillmentMethod: null, expectedInstallDate: null }]).map((schedule, index) => <PartnerFulfillment key={index} job={(request.jobSchedules?.length ?? 0) > 1 ? `Job ${index + 1}` : undefined} method={schedule.fulfillmentMethod} date={schedule.expectedInstallDate} />)}</div>}
      contacts={request.shareCustomerDetails && (request.customer || request.shipping?.address) ? [{ customer: request.customer ?? null, address: [request.shipping?.address, request.shipping?.city, request.shipping?.state, request.shipping?.zip].filter(Boolean).join(', ') || null }] : []}
    />
  )
}

/** The request-wide note card under the lines; `children` is its field. */
export function ARRequestNote({ hint, children }: { hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 text-[13px] font-semibold">
      Note for this request
      {children}
      {hint && <span className="text-[11px] font-normal text-muted-foreground">{hint}</span>}
    </label>
  )
}

/** The wide, centered submit button with its explanation underneath. */
export function ARSubmitBar({ label, disabled, onSubmit, children, className }: {
  label: string
  disabled: boolean
  onSubmit: () => void
  /** The explanation under the button, if any. */
  children?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-none flex-col items-center gap-2 border-t border-border bg-card px-3 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] pl-[max(12px,env(safe-area-inset-left))] pr-[max(12px,env(safe-area-inset-right))] md:px-4 print:hidden', className)}>
      <button
        type="button"
        onClick={onSubmit}
        disabled={disabled}
        // The app's own primary — the same teal (per theme) as Mark as Ready.
        className="min-h-12 w-full min-w-0 max-w-sm cursor-pointer rounded-lg border-none bg-primary px-3 py-2 text-[16px] font-semibold text-primary-foreground hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50"
      >
        {label}
      </button>
      {children && <span className="max-w-prose text-center text-[12px] text-muted-foreground">{children}</span>}
    </div>
  )
}

/** The same request content and submit bar for authenticated and public views. */
export function AvailabilityRequestView({ request, loading, error, saving, onPatch, onSubmit }: {
  request: ARDetail | null
  loading: boolean
  error: string
  saving: boolean
  onPatch: (itemId: number, changes: Record<string, string>) => Promise<void>
  /** Resolves true once the answers were accepted, which plays the received acknowledgement. */
  onSubmit: (supplierNote: string) => Promise<boolean>
}) {
  const [supplierNote, setSupplierNote] = useState(request?.noteForSupplier ?? '')
  useEffect(() => { setSupplierNote(request?.noteForSupplier ?? '') }, [request?.id, request?.noteForSupplier])
  const [mobile, setMobile] = useState(false)
  // The count cells the lines are narrowed to; each click toggles one, none shows all.
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  useEffect(() => {
    if (!window.matchMedia) return
    const media = window.matchMedia('(max-width: 899px)')
    const update = () => setMobile(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  const editable = !!request && request.status !== 'closed'
  // Set after a successful Submit: shows the acknowledgement; true on a re-submit.
  const [received, setReceived] = useState<boolean | null>(null)
  const dismissReceived = useCallback(() => setReceived(null), [])
  // Submitting with lines still unanswered is allowed — some plants genuinely
  // have no answer yet — but the bar asks once, with the count, first. The
  // answer holds for a retry until the count changes or the submit lands.
  const pending = request ? request.items.length - request.answeredCount : 0
  const [confirmPending, setConfirmPending] = useState(false)
  useEffect(() => setConfirmPending(false), [pending])
  const submit = async () => {
    if (pending > 0 && !confirmPending) { setConfirmPending(true); return }
    const resubmit = !!request?.submittedAt
    if (await onSubmit(supplierNote)) {
      setConfirmPending(false)
      setReceived(resubmit)
    }
  }
  return (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-y-auto p-3 pb-5 pl-[max(12px,env(safe-area-inset-left))] pr-[max(12px,env(safe-area-inset-right))] md:px-4 [&>*]:shrink-0">
        {error && (
          <div role="alert" className="break-words rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-[13px] text-destructive">
            {error}
          </div>
        )}

        {loading && (
          <div className="py-16 text-center text-[13px] text-muted-foreground">Loading…</div>
        )}

        {request && (
          <>
            {/* The header card: a strip with the status, the name and the
                requested date, then the customer's contact, the delivery
                address and our note — each only where the request shares it. */}
            <ARRequestHeader request={request} name={request.jobName ? redactPartnerRequestRefs(request.jobName) : requestName(request)}
              status={<span className="inline-flex h-8 items-center rounded-full border border-border bg-card px-3.5 text-[13px] text-muted-foreground">{arStatusLabel(request.status)}</span>}
            />

            <ARPrintSheet request={request} name={requestName(request)} displayText={redactPartnerRequestRefs} />

            <SummaryStrip items={request.items} subtotal={arSubtotal(request.items)} activeStatuses={statusFilter}
            onToggleStatus={(value) => setStatusFilter((cur) => toggleStatus(cur, value))} />

            {editable && request.items.some((item) => item.unitPrice != null) && request.status === 'new' && (
              <p className="m-0 text-[13px] text-muted-foreground">
                Prices we already have on file are filled in — please correct any that have changed.
              </p>
            )}

            <ARLineTable
              items={statusFilter.length ? request.items.filter((item) => statusFilter.includes(arShownStatus(item) ?? '')) : request.items}
              editable={editable && !saving}
              onPatch={onPatch}
              displayText={redactPartnerRequestRefs}
              design="portal"
              mobileCards={mobile}
              drawerModal={mobile}
              centerStatus
            />

            <ARRequestNote hint={editable && 'Sent with your availability when you submit.'}>
              <textarea aria-label="Note for this request" value={supplierNote} maxLength={10000}
                readOnly={!editable} disabled={saving} rows={3}
                placeholder="Add any conditions or information that apply to the whole request…"
                className="w-full rounded-md border border-input bg-background p-2 text-[13px] font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onChange={(event) => setSupplierNote(event.target.value)} />
            </ARRequestNote>


            {!editable && (
              <p className="m-0 text-[12px] text-muted-foreground">
                This request is closed — the lines are read-only.
              </p>
            )}
          </>
        )}
      </div>

      {/* The submit bar is pinned under the list, the button wide: Submit, or
          Re-Submit once the request has been handed back before — including
          after we reopened it as New. */}
      {request && editable && (
        <ARSubmitBar onSubmit={() => void submit()} disabled={saving}
          label={saving ? 'Submitting…' : confirmPending ? 'Submit anyway' : request.submittedAt ? 'Re-Submit availability' : 'Submit availability'}>
          {confirmPending && (
            <span role="status" className="font-semibold text-foreground">
              {pending} {pending === 1 ? 'line still has' : 'lines still have'} no answer. Submit anyway, or answer {pending === 1 ? 'it' : 'them'} first.
            </span>
          )}
        </ARSubmitBar>
      )}
      {received !== null && <SubmitReceived resubmit={received} onDone={dismissReceived} />}
      </div>
  )
}
