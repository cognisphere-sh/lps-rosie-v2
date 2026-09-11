'use client'

import { ACTIVE_JOB_STATUSES } from '@/lib/job-requests'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { useJobUpdates } from '@/lib/use-job-updates'

import { AgentChatButton } from '@/components/workspace/agent-chat-button'
import { EditableText, EditableTextarea, patchRow, type EditProps } from '@/components/workspace/editable'
import { ChevronDown, ChevronRight, MailIcon, MapPinIcon, PhoneIcon } from '@/components/workspace/icons'
import { RequestBody, addressLine } from '@/components/workspace/job-request'
import { Shell } from '@/components/workspace/shell'
import { CUSTOMER_TYPES, customerThreadId } from '@/lib/customers'
import { formatDate, money } from '@/lib/format'
import { requestRef, requestStatusLabel, requestStatusTone, toneStyle } from '@/lib/job-requests'
import type { CustomerRequest, CustomerRow, JobRequestRow } from '@/lib/rows'
import { cn } from '@/lib/utils'

type Tab = 'requests' | 'orders'

function CustomerTypeField({ customer, onSaved }: { customer: CustomerRow; onSaved: () => void }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  return (
    <div className="col-span-2 flex min-w-0 flex-col gap-1">
      <label className="flex flex-col gap-1">
        <span className="text-[10px] font-semibold uppercase tracking-[.05em] text-muted-foreground">Type</span>
        <select
          value={customer.type ?? ''}
          disabled={saving}
          onChange={async (event) => {
            const next = event.target.value
            setSaving(true)
            setError('')
            try {
              await patchRow('customers', customer.id, 'type', next)
              onSaved()
            } catch (error) {
              setError((error as Error).message)
            } finally {
              setSaving(false)
            }
          }}
          className="h-11 w-full rounded-lg border border-input bg-card px-2 text-[13px] text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
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
      <span className="text-[10px] font-semibold uppercase tracking-[.05em] text-muted-foreground">
        {label}
      </span>
      <EditableText {...props} />
    </div>
  )
}

/** One titled block on the page. */
function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-xl border border-lps-hair bg-card p-3">
      <span className="text-[10.5px] font-bold uppercase tracking-[.05em] text-muted-foreground">
        {label}
      </span>
      {children}
    </div>
  )
}

/** "Active requests · 2" and its figure, as on a job card's summary panel. */
function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-[120px] flex-col gap-1">
      <span className="whitespace-nowrap text-[11.5px] text-muted-foreground">{label}</span>
      <span className="whitespace-nowrap text-[19px] font-bold tabular-nums leading-none text-foreground">
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
        if (!cancelled) setError(String(e))
      })
    return () => {
      cancelled = true
    }
  }, [open, version, request.id])

  return (
    <div className="border-b border-lps-hair last:border-b-0">
      <div
        onClick={() => setOpen((v) => !v)}
        className="flex cursor-pointer flex-wrap items-center gap-x-2.5 gap-y-1 py-1.5 hover:bg-lps-tint"
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
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        <span className="flex-none text-[12.5px] font-bold tracking-tight text-primary">
          {requestRef(request.id)}
        </span>
        <span
          className="flex-none whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold"
          style={toneStyle(tone)}
        >
          {requestStatusLabel(request.status)}
        </span>
        <span className="text-[11.5px] text-muted-foreground">
          {request.itemCount} {request.itemCount === 1 ? 'line' : 'lines'}
        </span>
        <span className="ml-auto flex-none whitespace-nowrap text-[12px] font-semibold tabular-nums text-foreground">
          {money(request.lineTotal) || '$0.00'}
        </span>
        <span className="flex-none whitespace-nowrap text-[10.5px] text-lps-dim">
          {formatDate(request.createdAt)}
        </span>
      </div>

      {open && (
        <div className="mb-2 overflow-hidden rounded-xl border border-border bg-card">
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
        if (!cancelled) setError(String(e))
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
        <div className="py-16 text-center text-[12.5px] text-muted-foreground">Loading…</div>
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
      headerAction={chatThreadId ? (
        <AgentChatButton
          agentId="rosie"
          threadId={chatThreadId}
          label={customer.name}
          subject={customer.name}
          labelled
        />
      ) : undefined}
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

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-muted-foreground">
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

          {/* The same four figures the list shows as columns. Orders have no
              source yet — order tables are deferred by migration 0055 — so
              they read "—" rather than borrowing a request's number. */}
          <div className="flex flex-wrap gap-x-10 gap-y-3 rounded-xl border border-border bg-card px-3.5 py-3">
            <Figure label="Active requests" value={String(active.length)} />
            <Figure label="Active request value" value={money(activeValue) || '$0.00'} />
            <Figure label="Orders" value="—" />
            <Figure label="Total order value" value="—" />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="flex flex-col gap-2 rounded-xl border border-lps-hair bg-card p-3">
              <span className="text-[10.5px] font-bold uppercase tracking-[.05em] text-muted-foreground">
                Who they are
              </span>
              <div className="grid grid-cols-2 gap-2">
                <Field {...edit} label="Name" column="name" value={customer.name} placeholder="name" />
                <Field {...edit} label="Company" column="company" value={customer.company} placeholder="—" />
                <CustomerTypeField customer={customer} onSaved={reload} />
                <Field {...edit} label="Email" column="email" value={customer.email} placeholder="—" />
                <Field {...edit} label="Phone" column="phone" value={customer.phone} placeholder="—" />
              </div>
            </div>
            <div className="flex flex-col gap-2 rounded-xl border border-lps-hair bg-card p-3">
              <span className="text-[10.5px] font-bold uppercase tracking-[.05em] text-muted-foreground">
                Address
              </span>
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
            <EditableTextarea
              {...edit}
              column="notes"
              value={customer.notes}
              placeholder="What is worth knowing about this customer?"
            />
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
                'shrink-0 cursor-pointer whitespace-nowrap rounded-full border px-3.5 py-1.5 text-[12.5px] font-semibold',
                tab === id_
                  ? 'border-primary bg-secondary text-primary'
                  : 'border-border bg-card text-foreground',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'requests' && (
          <div className="p-4">
            {customer.requests.length ? (
              <div className="flex flex-col rounded-xl border border-lps-hair bg-card px-3 py-1">
                {customer.requests.map((r) => (
                  <RequestLine key={r.id} request={r} version={version} onSaved={reload} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 py-14 text-center">
                <span className="text-[14px] font-semibold">No requests yet</span>
                <span className="text-[12.5px] text-muted-foreground">
                  Rosie files them here as they come in.
                </span>
              </div>
            )}
          </div>
        )}

        {tab === 'orders' && (
          <div className="flex flex-col items-center gap-2 py-14 text-center">
            <span className="text-[14px] font-semibold">Orders aren&rsquo;t tracked yet</span>
            <span className="max-w-[420px] text-[12.5px] text-muted-foreground">
              There are no order tables in the database — migration 0055 defers them, with a won
              request as the hook they will be created from. This tab fills in when they land.
            </span>
          </div>
        )}
      </div>
    </Shell>
  )
}
