'use client'

import { useEffect, useState } from 'react'
import { PartnerDetailHeader, PartnerFulfillment } from './partner-detail-header'
import { ARLineTable } from './availability'
import { ARPrintSheet } from './ar-print-sheet'
import { SummaryStrip } from './partner-summary-strip'
import { partnerRequestName as requestName } from './partner'
import { arStatusLabel, arSubtotal, type ARDetail } from '@/lib/availability'
import { redactPartnerRequestRefs } from '@/lib/partner-display'

/** The same request content and submit bar for authenticated and public views. */
export function AvailabilityRequestView({ request, loading, error, saving, onPatch, onSubmit }: {
  request: ARDetail | null
  loading: boolean
  error: string
  saving: boolean
  onPatch: (itemId: number, changes: Record<string, string>) => Promise<void>
  onSubmit: (supplierNote: string) => Promise<void>
}) {
  const [supplierNote, setSupplierNote] = useState(request?.noteForSupplier ?? '')
  useEffect(() => { setSupplierNote(request?.noteForSupplier ?? '') }, [request?.id, request?.noteForSupplier])
  const [mobile, setMobile] = useState(false)
  useEffect(() => {
    if (!window.matchMedia) return
    const media = window.matchMedia('(max-width: 899px)')
    const update = () => setMobile(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  const editable = !!request && request.status !== 'closed'
  return (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-y-auto p-3 pb-5 pl-[max(12px,env(safe-area-inset-left))] pr-[max(12px,env(safe-area-inset-right))] md:px-4 [&>*]:shrink-0">
        {error && (
          <div role="alert" className="break-words rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-[13px] text-destructive">
            {error}
          </div>
        )}

        {loading && (
          <div className="py-16 text-center text-[12.5px] text-muted-foreground">Loading…</div>
        )}

        {request && (
          <>
            {/* The header card: a strip with the status, the name and the
                requested date, then the customer's contact, the delivery
                address and our note — each only where the request shares it. */}
            <PartnerDetailHeader name={request.jobName ? redactPartnerRequestRefs(request.jobName) : requestName(request)}
              status={<span className="inline-flex h-8 items-center rounded-full border border-border bg-card px-3.5 text-[13px] text-muted-foreground">{arStatusLabel(request.status)}</span>}
              schedule={<div aria-label="Job schedules" className="flex flex-wrap gap-3">{(request.jobSchedules?.length ? request.jobSchedules : [{ fulfillmentMethod: null, expectedInstallDate: null }]).map((schedule, index) => <div key={index} className="space-y-1">{(request.jobSchedules?.length ?? 0) > 1 && <span className="text-[11px] text-muted-foreground">Job {index + 1}</span>}<PartnerFulfillment method={schedule.fulfillmentMethod} date={schedule.expectedInstallDate} /></div>)}</div>}
              contacts={request.shareCustomerDetails && (request.customer || request.shipping?.address) ? [{ customer: request.customer ?? null, address: [request.shipping?.address, request.shipping?.city, request.shipping?.state, request.shipping?.zip].filter(Boolean).join(', ') || null }] : []}
            />

            <ARPrintSheet request={request} name={requestName(request)} displayText={redactPartnerRequestRefs} />

            <SummaryStrip items={request.items} subtotal={arSubtotal(request.items)} />

            <ARLineTable
              items={request.items}
              editable={editable}
              onPatch={onPatch}
              displayText={redactPartnerRequestRefs}
              design="portal"
              mobileCards={mobile}
              drawerModal={mobile}
            />

            <label className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 text-[13px] font-semibold">
              Note for this request
              <textarea aria-label="Note for this request" value={supplierNote} maxLength={10000}
                readOnly={!editable} disabled={saving} rows={3}
                placeholder="Add any conditions or information that apply to the whole request…"
                className="w-full rounded-md border border-input bg-background p-2 text-[13px] font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onChange={(event) => setSupplierNote(event.target.value)} />
              {editable && <span className="text-[11px] font-normal text-muted-foreground">Sent with your availability when you submit.</span>}
            </label>

            {editable && request.items.some((item) => item.unitPrice != null) && request.status === 'new' && (
              <p className="m-0 text-[11.5px] text-muted-foreground">
                Prices we already have on file are filled in — please correct any that have changed.
              </p>
            )}

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
          after we added a line and put it back at New. */}
      {request && editable && (
        <div className="flex flex-none items-center gap-3 border-t border-border bg-card px-3 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] pl-[max(12px,env(safe-area-inset-left))] pr-[max(12px,env(safe-area-inset-right))] md:px-4 print:hidden">
          <button
            type="button"
            onClick={() => void onSubmit(supplierNote)}
            disabled={saving}
            className="min-h-12 min-w-0 flex-1 cursor-pointer rounded-lg bg-primary px-3 py-2 text-[15px] font-semibold text-primary-foreground hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50 min-[900px]:max-w-sm"
          >
            {saving ? 'Submitting…' : request.submittedAt ? 'Re-Submit availability' : 'Submit availability'}
          </button>
          <span className="hidden text-[11.5px] text-muted-foreground min-[900px]:block">
            {request.submittedAt
              ? 'Re-submitting sends your updated answers to Local Plant Supply.'
              : 'Submitting sends your answers to Local Plant Supply — you can come back and refine them.'}
          </span>
        </div>
      )}
      </div>
  )
}
