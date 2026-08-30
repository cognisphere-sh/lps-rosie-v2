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

import { Link2, Printer } from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { ARLineTable } from '@/components/workspace/availability'
import { ChevronDown, ChevronLeft } from '@/components/workspace/icons'
import {
  PartnerFrame,
  partnerRequestName as requestName,
  type PartnerAlert,
} from '@/components/workspace/partner'
import {
  arStatusLabel,
  arSubtotal,
  type ARDetail,
  type ARItem,
} from '@/lib/availability'
import { money } from '@/lib/format'
import { redactPartnerRequestRefs } from '@/lib/partner-display'
import { cn } from '@/lib/utils'

/**
 * The page's accents (2026-08-30 design), one per answer. Fixed hexes with translucent fills so they read
 * on both themes — the same set the home list uses for its tabs.
 */
const ACCENT = {
  green: '#3DBB6A',
  blue: '#3B8BF5',
  orange: '#E08A3A',
  red: '#E5484D',
} as const

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
  const counts: Record<string, number> = {}
  for (const it of items) {
    if (it.status) counts[it.status] = (counts[it.status] ?? 0) + 1
  }
  const cells: { label: string; value: number; color: string }[] = [
    { label: 'Available', value: counts.available ?? 0, color: ACCENT.green },
    { label: 'Can Order', value: counts.can_order ?? 0, color: ACCENT.blue },
    { label: 'Diff Size/Qty', value: counts.diff_size_qty_sub ?? 0, color: ACCENT.orange },
    { label: 'Arriving Soon', value: counts.arriving_soon ?? 0, color: ACCENT.blue },
    { label: 'Unavailable', value: counts.unavailable ?? 0, color: ACCENT.red },
  ]
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
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/partner/${supplierId}`)
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
  const alerts: PartnerAlert[] = useMemo(
    () =>
      requests
        .filter((r) => r.status === 'new')
        .map((r) => ({ id: r.id, label: requestName(r), at: Date.parse(r.createdAt) })),
    [requests],
  )

  const patchItem = useCallback(
    async (itemId: number, changes: Record<string, string>) => {
      setError('')
      const res = await fetch(`/api/partner/${supplierId}/requests/${arId}`, {
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
    const res = await fetch(`/api/partner/${supplierId}/requests/${arId}/submit`, { method: 'POST' })
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
  const pending = request ? request.items.length - request.answeredCount : 0
  const copyLink = useCallback(() => {
    void navigator.clipboard?.writeText(window.location.href).then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    })
  }, [])
  const back = (rightActions: React.ReactNode = null) => (
    /* The back pill at the left; the request's own actions — copy its link,
       print it — as round icon buttons at the right, with the frame's bell. */
    <div className="flex flex-none items-center gap-2.5 px-3 py-3 md:px-4">
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
          <IconAction label={copied ? 'Link copied' : 'Copy link'} onClick={copyLink}>
            <Link2 className="size-4" />
          </IconAction>
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

  const editable = !!request && request.status !== 'closed'

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
      <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-3 pb-5 md:px-4">
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

            <SummaryStrip items={request.items} />

            <ARLineTable
              items={request.items}
              editable={editable}
              onPatch={patchItem}
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
            onClick={() => void submit()}
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
    </PartnerFrame>
  )
}
