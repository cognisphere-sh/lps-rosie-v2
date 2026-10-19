'use client'

import { ACTIVE_JOB_STATUSES } from '@/lib/job-requests'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { useJobUpdates } from '@/lib/use-job-updates'

import { CustomerChatButton } from '@/components/workspace/customer-chat-button'
import { EditableText, EditableTextarea, patchRow, type EditProps } from '@/components/workspace/editable'
import { ChevronDown, MailIcon, MapPinIcon, PhoneIcon } from '@/components/workspace/icons'
import { RequestBody, addressLine } from '@/components/workspace/job-request'
import { Shell } from '@/components/workspace/shell'
import { CUSTOMER_TYPES, customerThreadId } from '@/lib/customers'
import { formatWeekdayMonthDay, formatDate, money } from '@/lib/format'
import { requestRef, requestStatusLabel, requestStatusTone, toneStyle } from '@/lib/job-requests'
import type { CustomerRequest, CustomerRow, JobRequestRow } from '@/lib/rows'
import { cn } from '@/lib/utils'
import { errorCopy } from '@/lib/error-copy'
import { EmptyState } from '@/components/workspace/empty-state'

type Tab = 'requests' | 'orders'

function CustomerTypeField({ customer, onSaved }: { customer: CustomerRow; onSaved: () => void }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  // Optimistic: the picked type shows while saving and until the reload lands.
  const [pending, setPending] = useState<string | null>(null)
  useEffect(() => setPending(null), [customer.type])
  return (
    <div className="col-span-2 flex min-w-0 flex-col gap-1">
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-semibold uppercase tracking-[.05em] text-muted-foreground">Type</span>
        <select
          value={pending ?? customer.type ?? ''}
          disabled={saving}
          onChange={async (event) => {
            const next = event.target.value
            setSaving(true)
            setPending(next)
            setError('')
            try {
              await patchRow('customers', customer.id, 'type', next)
              onSaved()
            } catch (error) {
              setPending(null)
              setError((error as Error).message)
            } finally {
              setSaving(false)
            }
          }}
          className="h-11 w-full rounded-lg border border-input bg-card px-2 text-[13px] text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          <option value="">Not set</option>
          {CUSTOMER_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
        </select>
      </label>
      {error && <p role="alert" className="text-[12px] text-destructive">{error}</p>}
    </div>
  )
}

/** Statuses that mean a request is still live — what "active" counts. */
const ACTIVE_STATUSES: readonly string[] = ACTIVE_JOB_STATUSES

/** One labelled, editable field. */
function Field({
  label,
  ...props
}: EditProps & { label: string; value: string | number | null; placeholder?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-[11px] font-semibold uppercase tracking-[.05em] text-muted-foreground">
        {label}
      </span>
      {/* Pull the field's own border + padding (7px) back out so the value
          starts on the label's edge, editing or not. */}
      <div className="-mx-[7px]">
        <EditableText {...props} />
      </div>
    </div>
  )
}

/** One titled block on the page. */
function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-xl border border-lps-hair bg-card p-3">
      <h2 className="m-0 font-serif text-[18px] font-bold text-foreground">
        {label}
      </h2>
      {children}
    </div>
  )
}

/** "Active requests · 2" and its figure, as on a job card's summary panel. */
function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="whitespace-nowrap text-[12px] text-muted-foreground">{label}</span>
      <span className="whitespace-nowrap text-[20px] font-bold tabular-nums leading-none text-foreground">
        {value}
      </span>
    </div>
  )
}

/**
 * One of the customer's requests, as a line that opens.
 *
 * The rollup on the line comes with the customer; the request itself is
 * fetched only when the line is opened, and refetched whenever `version` moves
 * — an edit made inside it should be visible in what it is showing. Opened, it
 * draws the same body the Job Requests page draws, minus the line checkboxes:
 * this page has no bar to act on a selection.
 */
function RequestLine({
  request,
  version,
  onSaved,
}: {
  request: CustomerRequest
  version: number
  onSaved: () => void
}) {
  const tone = requestStatusTone(request.status)
  const [open, setOpen] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [full, setFull] = useState<JobRequestRow | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    let cancelled = false
    fetch(`/api/requests/${request.id}`)
      .then((r) => r.json())
      .then((d: { request?: JobRequestRow; error?: string }) => {
        if (cancelled) return
        if (d.error) {
          setError(d.error)
          return
        }
        setError('')
        setFull(d.request ?? null)
      })
      .catch((e) => {
        if (!cancelled) setError(errorCopy(e, 'Could not load this job'))
      })
    return () => {
      cancelled = true
    }
  }, [open, version, request.id])

  return (
    <div className="border-b border-lps-hair last:border-b-0">
      <div
        onClick={() => setOpen((v) => !v)}
        className="flex cursor-pointer flex-wrap items-center gap-x-2.5 gap-y-1 px-3 py-1.5 transition-colors duration-150 hover:bg-lps-tint max-md:min-h-11"
      >
        <button
          type="button"
          aria-expanded={open}
          aria-label={`${open ? 'Collapse' : 'Expand'} ${requestRef(request.id)}`}
          onClick={(e) => {
            e.stopPropagation()
            setOpen((v) => !v)
          }}
          className="flex size-5 flex-none cursor-pointer items-center justify-center rounded-md border-none bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ChevronDown size={14} className={cn('transition-transform duration-150 ease-lps', !open && '-rotate-90')} />
        </button>
        <span className="flex-none text-[13px] font-bold tracking-tight text-primary sm:min-w-14">
          {requestRef(request.id)}
        </span>
        <span className="flex flex-none sm:w-[88px]">
          <span
            className="whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold"
            style={toneStyle(tone)}
          >
            {requestStatusLabel(request.status)}
          </span>
        </span>
        <span className="text-[12px] text-muted-foreground">
          {request.itemCount} {request.itemCount === 1 ? 'line' : 'lines'}
        </span>
        <span className="ml-auto flex-none whitespace-nowrap text-[12px] font-semibold tabular-nums text-foreground">
          {money(request.lineTotal) || '$0.00'}
        </span>
        <span className="flex-none whitespace-nowrap text-[11px] text-lps-dim">
          {formatWeekdayMonthDay(request.createdAt)}
        </span>
      </div>

      {open && (
        <div className="overflow-hidden border-t border-lps-hair bg-card">
          {error && <div className="px-3 py-2 text-[12px] text-destructive">{error}</div>}
          {!error && !full && (
            <div className="px-3 py-3 text-[12px] text-muted-foreground">Loading…</div>
          )}
          {full && (
            <RequestBody
              request={full}
              version={version}
              detailsOpen={detailsOpen}
              onToggleDetails={() => setDetailsOpen((v) => !v)}
              emptyItemsCopy="No active line items are recorded for this customer request."
              onSaved={onSaved}
            />
          )}
        </div>
      )}
    </div>
  )
}

export default function CustomerPage() {
  const params = useParams<{ id: string }>()
  const id = Number.parseInt(params.id, 10)

  const [customer, setCustomer] = useState<CustomerRow | null>(null)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<Tab>('requests')
  /** Bumped after every write — what makes an open request refresh. */
  const [version, setVersion] = useState(0)
  const reload = useCallback(() => setVersion((n) => n + 1), [])
  useJobUpdates(reload, Number.isInteger(id))

  useEffect(() => {
    if (!Number.isInteger(id)) return
    let cancelled = false
    fetch(`/api/customers/${id}`)
      .then((r) => r.json())
      .then((d: { customer?: CustomerRow; error?: string }) => {
        if (cancelled) return
        if (d.error) {
          setError(d.error)
          return
        }
        setError('')
        setCustomer(d.customer ?? null)
      })
      .catch((e) => {
        if (!cancelled) setError(errorCopy(e, 'Could not load this customer'))
      })
    return () => {
      cancelled = true
    }
  }, [id, version])

  if ((error && !customer) || !Number.isInteger(id)) {
    return (
      <Shell page="customers" title="Customer">
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <p className="text-[14px] font-semibold">That customer does not exist.</p>
          <Link href="/customers" className="text-[13px] font-semibold text-primary underline">
            Back to all customers
          </Link>
        </div>
      </Shell>
    )
  }

  if (!customer) {
    return (
      <Shell page="customers" title="Customer">
        <div className="py-16 text-center text-[13px] text-muted-foreground">Loading…</div>
      </Shell>
    )
  }

  const edit = { table: 'customers', id: customer.id, onSaved: reload }
  const where = addressLine(customer.address)
  const active = customer.requests.filter((r) => ACTIVE_STATUSES.includes(r.status))
  const activeValue = active.reduce((sum, r) => sum + r.lineTotal, 0)
  const chatThreadId = customerThreadId(customer)

  const tabs: [Tab, string][] = [
    ['requests', `Requests (${customer.requests.length})`],
    ['orders', 'Orders'],
  ]

  return (
    <Shell
      page="customers"
      title={customer.name}
      headerAction={(
        <CustomerChatButton
          customerId={customer.id}
          avatar
          threadId={chatThreadId}
          label={customer.name}
          labelled
        />
      )}
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-auto">
        {/* The details card. Everything on the customer record, editable in
            place — this page is where a customer is corrected, so nothing here
            hides behind a second chevron the way the old card's drawer did. */}
        <div className="flex flex-col gap-3 border-b border-border bg-lps-tint p-4">
          <Link
            href="/customers"
            className="inline-flex min-h-11 min-w-11 w-fit items-center text-[12px] font-semibold text-primary no-underline hover:underline"
          >
            ← All customers
          </Link>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted-foreground">
            {customer.email && (
              <span className="inline-flex items-center gap-1">
                <MailIcon size={12} /> {customer.email}
              </span>
            )}
            {customer.phone && (
              <span className="inline-flex items-center gap-1">
                <PhoneIcon size={12} /> {customer.phone}
              </span>
            )}
            {where && (
              <span className="inline-flex items-center gap-1">
                <MapPinIcon size={12} /> {where}
              </span>
            )}
            {!customer.email && !customer.phone && !where && (
              <span className="italic text-lps-dim">No contact route on file</span>
            )}
            <span className="ml-auto whitespace-nowrap text-[11px] text-lps-dim">
              Added {formatDate(customer.createdAt)} · Updated {formatDate(customer.updatedAt)}
            </span>
          </div>

          {/* The same four figures the list shows as columns. Customer-wide order rollups are not connected here, so
              they read "—" rather than borrowing a request's number. */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-xl border border-border bg-card px-3.5 py-3 sm:grid-cols-4">
            <Figure label="Active requests" value={String(active.length)} />
            <Figure label="Active request value" value={money(activeValue) || '$0.00'} />
            <Figure label="Orders" value="—" />
            <Figure label="Total order value" value="—" />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="flex flex-col gap-2 rounded-xl border border-lps-hair bg-card p-3">
              <h2 className="m-0 font-serif text-[18px] font-bold text-foreground">
                Who they are
              </h2>
              <div className="grid grid-cols-2 gap-2">
                <Field {...edit} label="Name" column="name" value={customer.name} placeholder="name" />
                <Field {...edit} label="Company" column="company" value={customer.company} placeholder="—" />
                <CustomerTypeField customer={customer} onSaved={reload} />
                <Field {...edit} label="Email" column="email" value={customer.email} placeholder="—" />
                <Field {...edit} label="Phone" column="phone" value={customer.phone} placeholder="—" />
              </div>
            </div>
            <div className="flex flex-col gap-2 rounded-xl border border-lps-hair bg-card p-3">
              <h2 className="m-0 font-serif text-[18px] font-bold text-foreground">
                Address
              </h2>
              <Field {...edit} label="Street" column="address" value={customer.address.address} placeholder="street" />
              <div className="grid grid-cols-[minmax(0,1fr)_64px_84px] gap-2">
                <Field {...edit} label="City" column="city" value={customer.address.city} placeholder="city" />
                <Field {...edit} label="State" column="state" value={customer.address.state} placeholder="—" />
                <Field {...edit} label="ZIP" column="zip" value={customer.address.zip} placeholder="—" />
              </div>
            </div>
          </div>

          {/* Durable facts only. The contact log that used to sit beside this
              was dropped by migration 0073 — every contact is in the customer's
              Rosie conversation, which the header's button opens. */}
          <Block label="Notes — durable facts, edited in place">
            <div className="-mx-[9px]">
              <EditableTextarea
                {...edit}
                column="notes"
                value={customer.notes}
                placeholder="What is worth knowing about this customer?"
              />
            </div>
          </Block>
        </div>

        {/* Tabs */}
        <div className="flex flex-nowrap items-center gap-1.5 border-b border-border bg-card px-4 py-2.5">
          {tabs.map(([id_, label]) => (
            <button
              key={id_}
              type="button"
              onClick={() => setTab(id_)}
              className={cn(
                'shrink-0 cursor-pointer whitespace-nowrap rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors duration-150 ease-lps',
                tab === id_
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-foreground hover:bg-muted',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'requests' && (
          <div className="p-4">
            {customer.requests.length ? (
              <div className="flex flex-col overflow-hidden rounded-xl border border-lps-hair bg-card">
                {customer.requests.map((r) => (
                  <RequestLine key={r.id} request={r} version={version} onSaved={reload} />
                ))}
              </div>
            ) : (
              <EmptyState art="seed" title="No requests yet" hint="Rosie files them here as they come in." />
            )}
          </div>
        )}

        {tab === 'orders' && (
          <div className="flex flex-col items-center gap-2 py-14 text-center">
            <span className="text-[14px] font-semibold">Orders are available by job</span>
            <span className="max-w-[420px] text-[13px] text-muted-foreground">
              Open a job from Requests, then select its Orders tab to view or create supplier orders.
            </span>
          </div>
        )}
      </div>
    </Shell>
  )
}
