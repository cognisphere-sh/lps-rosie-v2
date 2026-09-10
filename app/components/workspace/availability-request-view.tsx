'use client'

import { ARLineTable } from './availability'
import { ARPrintSheet } from './ar-print-sheet'
import { ChevronDown } from './icons'
import { partnerRequestName as requestName } from './partner'
import { AR_RESPONSE_OPTIONS, arResponseTone, arStatusLabel, arSubtotal, type ARDetail, type ARItem } from '@/lib/availability'
import { toneDot } from '@/lib/job-requests'
import { money } from '@/lib/format'
import { redactPartnerRequestRefs } from '@/lib/partner-display'
import { cn } from '@/lib/utils'

/** "Friday | 08/29/2026" — the header strip's date. */
function formatStripDate(value: string) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return (
    <>
      {d.toLocaleDateString('en-US', { weekday: 'long' })} <span className="text-lps-dim">|</span>{' '}
      {d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}
    </>
  )
}

/** A small caps label over a value — the header card's blocks. */
function Field({ label, align = 'left', children }: { label: string; align?: 'left' | 'right'; children: React.ReactNode }) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1', align === 'right' && 'items-end text-right')}>
      <span className="text-[10.5px] font-medium text-lps-dim">{label}</span>
      <div className="text-[13px] text-foreground">{children}</div>
    </div>
  )
}

/**
 * The answer strip: one cell per answer with its count in that answer's
 * accent, then the line count and the subtotal. A zero is drawn as a dash in the same accent rather than dropped.
 */
function SummaryStrip({ items }: { items: ARItem[] }) {
  const cells = AR_RESPONSE_OPTIONS.map((o) => ({
    label: o.label,
    value: items.filter((item) => (item.status ?? '') === o.value).length,
    color: toneDot(arResponseTone(o.value || null)),
  }))
  const subtotal = arSubtotal(items)
  return (
    <div className="rounded-2xl border border-border bg-card px-4 py-5 md:px-6 md:py-6">
      <div className="grid grid-cols-4 items-end gap-x-2 gap-y-4 md:grid-cols-8">
        {cells.map((c) => (
          <div key={c.label} className="flex flex-col items-center gap-2">
            <span className="truncate text-[11px] text-muted-foreground md:text-[12.5px]">{c.label}</span>
            <span className="text-[17px] font-semibold tabular-nums leading-none" style={{ color: c.color }}>
              {c.value || '-'}
            </span>
          </div>
        ))}
        <div className="flex flex-col items-center gap-2">
          <span className="truncate text-[11px] text-muted-foreground md:text-[12.5px]">Total Items</span>
          <span className="text-[17px] font-semibold tabular-nums leading-none text-foreground">{items.length}</span>
        </div>
        <div className="flex flex-col items-center gap-2 lg:items-end">
          <span className="text-[10.5px] text-lps-dim">Subtotal</span>
          <span className="text-[20px] font-semibold tabular-nums leading-none text-foreground">
            {subtotal == null ? '—' : money(subtotal)}
          </span>
        </div>
      </div>
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
  onSubmit: () => Promise<void>
}) {
  const editable = !!request && request.status !== 'closed'
  return (
      <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-3 pb-5 md:px-4">
        {error && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-[13px] text-destructive">
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
            <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-3">
              <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl bg-secondary/60 px-3 py-2.5">
                <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-card px-3.5 text-[13px] text-muted-foreground">
                  {request.status === 'submitted' ? 'Completed' : arStatusLabel(request.status)}
                  <ChevronDown className="size-3.5" />
                </span>
                <span className="min-w-0 truncate text-center text-[18px] font-semibold text-foreground">
                  {requestName(request)}
                </span>
                <span className="text-[17px] font-semibold text-foreground">
                  {formatStripDate(request.createdAt)}
                </span>
              </div>

              {(request.customer || request.shipping?.address || request.lpsNotes) && (
                <div className="grid grid-cols-1 gap-x-6 gap-y-4 px-2 pb-1 sm:grid-cols-[1fr_auto]">
                  {request.customer ? (
                    <Field label="Contact">
                      <span className="flex flex-wrap gap-x-4 gap-y-0.5">
                        <span>{[request.customer.company, request.customer.name].filter(Boolean).join(' · ')}</span>
                        {request.customer.phone && <span>{request.customer.phone}</span>}
                        {request.customer.email && <span>{request.customer.email}</span>}
                      </span>
                    </Field>
                  ) : (
                    <span />
                  )}
                  {request.shipping?.address && (
                    <div className="flex flex-col items-end text-right text-[13px] text-foreground">
                      <span>{request.shipping.address}</span>
                      <span>
                        {[request.shipping.city, [request.shipping.state, request.shipping.zip].filter(Boolean).join(', ')]
                          .filter(Boolean)
                          .join(' ')}
                      </span>
                    </div>
                  )}
                  {request.lpsNotes && (
                    <div className="sm:col-span-2">
                      <Field label="Delivery instructions" align="right">
                        <span className="whitespace-pre-wrap font-semibold">{redactPartnerRequestRefs(request.lpsNotes)}</span>
                      </Field>
                    </div>
                  )}
                </div>
              )}
            </div>

            <ARPrintSheet request={request} name={requestName(request)} displayText={redactPartnerRequestRefs} />

            <SummaryStrip items={request.items} />

            <ARLineTable
              items={request.items}
              editable={editable}
              onPatch={onPatch}
              displayText={redactPartnerRequestRefs}
              design="portal"
            />

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
        <div className="flex flex-none items-center gap-3 border-t border-border bg-card px-3 py-3 md:px-4 print:hidden">
          <button
            type="button"
            onClick={() => void onSubmit()}
            disabled={saving}
            className="h-12 flex-1 cursor-pointer rounded-lg border border-border bg-secondary/60 text-[17px] font-medium uppercase tracking-[.04em] text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-50 sm:max-w-sm"
          >
            {saving ? 'Submitting…' : request.submittedAt ? 'Re-Submit availability' : 'Submit availability'}
          </button>
          <span className="hidden text-[11.5px] text-muted-foreground sm:block">
            {request.submittedAt
              ? 'Re-submitting sends your updated answers to Local Plant Supply.'
              : 'Submitting sends your answers to Local Plant Supply — you can come back and refine them.'}
          </span>
        </div>
      )}
      </div>
  )
}
