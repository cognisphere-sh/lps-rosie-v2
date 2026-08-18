'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  AppendNote, EditableText, EditableTextarea, type EditProps,
} from '@/components/workspace/editable'
import { ChevronDown, ChevronRight, MailIcon, MapPinIcon, PhoneIcon } from '@/components/workspace/icons'
import { Shell } from '@/components/workspace/shell'
import { Toolbar, type Chip } from '@/components/workspace/toolbar'
import { formatDate, money } from '@/lib/format'
import { requestRef, requestStatusLabel, requestStatusTone, toneStyle } from '@/lib/job-requests'
import { shortStamp } from '@/lib/notes'
import type { CustomerFacets, CustomerRequest, CustomerRow, JobAddress } from '@/lib/rows'
import { useDebouncedSearch } from '@/lib/use-debounced'
import { cn } from '@/lib/utils'

const EMPTY_FACETS: CustomerFacets = { state: [] }

/** "1240 SE Ankeny St · Portland, OR · 97214" for the collapsed card. */
const addressLine = (a: JobAddress) =>
  [a.address, [a.city, a.state].filter(Boolean).join(', '), a.zip].filter(Boolean).join(' · ')

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

/** One titled block in the expanded card. */
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

/** One of the customer's requests, as a line in their card. */
function RequestLine({ request }: { request: CustomerRequest }) {
  const tone = requestStatusTone(request.status)
  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 border-b border-lps-hair py-1.5 last:border-b-0">
      <span className="flex-none text-[12.5px] font-bold tracking-tight text-primary">
        {requestRef(request.id)}
      </span>
      <span
        className="flex-none whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold"
        style={toneStyle(tone)}
      >
        {requestStatusLabel(request.status)}
      </span>
      {request.needsAttention && (
        <span className="flex-none whitespace-nowrap rounded-full bg-lps-warn-bg px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-lps-warn-fg">
          Needs input
        </span>
      )}
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
  )
}

function CustomerCard({
  customer,
  expanded,
  onToggle,
  onSaved,
}: {
  customer: CustomerRow
  expanded: boolean
  onToggle: () => void
  onSaved: () => void
}) {
  const edit = { table: 'customers', id: customer.id, onSaved }
  const where = addressLine(customer.address)
  const latest = customer.comms.length ? customer.comms[customer.comms.length - 1] : null

  return (
    <div className="flex-none overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md">
      <div onClick={onToggle} className="flex cursor-pointer flex-col gap-2 px-3.5 py-3 hover:bg-lps-tint">
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            aria-expanded={expanded}
            aria-label={`${expanded ? 'Collapse' : 'Expand'} ${customer.name}`}
            onClick={(e) => {
              e.stopPropagation()
              onToggle()
            }}
            className="flex size-5 flex-none cursor-pointer items-center justify-center rounded-md border-none bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
          <span className="text-[13.5px] font-semibold text-foreground">{customer.name}</span>
          {customer.company && (
            <span className="whitespace-nowrap rounded-full bg-secondary px-2 py-0.5 text-[11.5px] font-semibold text-primary">
              {customer.company}
            </span>
          )}
          <span className="ml-auto whitespace-nowrap text-[11px] text-lps-dim">
            Added {formatDate(customer.createdAt)}
          </span>
        </div>

        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2 pl-[30px]">
          <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 text-[11.5px] text-muted-foreground">
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
          </span>
          <div className="flex flex-col items-end gap-px">
            <span className="whitespace-nowrap text-[16px] font-bold tabular-nums leading-tight text-foreground">
              {money(customer.lineTotal) || '$0.00'}
            </span>
            <span className="whitespace-nowrap text-[10.5px] font-semibold uppercase tracking-[.05em] text-muted-foreground">
              {customer.requests.length} {customer.requests.length === 1 ? 'request' : 'requests'}
              {customer.openCount > 0 && ` · ${customer.openCount} open`}
            </span>
          </div>
        </div>

        {/* The last thing anyone logged, on one line — enough to tell a customer
            waiting on a reply from one who simply exists. */}
        {latest && (
          <div
            className="flex min-w-0 items-baseline gap-2 border-t border-lps-hair pl-[30px] pt-2"
            title={latest.text}
          >
            <span className="min-w-0 truncate text-[11.5px] text-muted-foreground">
              {latest.text}
            </span>
            {latest.stamp && (
              <span className="ml-auto flex-none whitespace-nowrap text-[10.5px] text-lps-dim">
                {shortStamp(latest.stamp)}
              </span>
            )}
          </div>
        )}
      </div>

      {expanded && (
        <div className="flex flex-col gap-3 border-t border-border bg-lps-tint px-3.5 py-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="flex flex-col gap-2 rounded-xl border border-lps-hair bg-card p-3">
              <span className="text-[10.5px] font-bold uppercase tracking-[.05em] text-muted-foreground">
                Who they are
              </span>
              <div className="grid grid-cols-2 gap-2">
                <Field {...edit} label="Name" column="name" value={customer.name} placeholder="name" />
                <Field {...edit} label="Company" column="company" value={customer.company} placeholder="—" />
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

          <div className="grid gap-3 lg:grid-cols-2">
            <Block label="Notes — durable facts, edited in place">
              <EditableTextarea
                {...edit}
                column="notes"
                value={customer.notes}
                placeholder="What is worth knowing about this customer?"
              />
            </Block>
            <Block label="Contact log — append only">
              {customer.comms.length ? (
                <div className="flex max-h-[240px] flex-col gap-1.5 overflow-auto">
                  {customer.comms.map((entry, i) => (
                    <div key={i} className="flex flex-col gap-1 rounded-xl bg-lps-bubble p-2.5">
                      {entry.stamp && (
                        <span className="text-[10.5px] text-muted-foreground">{entry.stamp}</span>
                      )}
                      <p className="m-0 whitespace-pre-wrap text-[12.5px] leading-relaxed text-foreground">
                        {entry.text}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <span className="px-1 text-[12px] text-lps-dim">Nothing logged yet.</span>
              )}
              <AppendNote
                table="customers"
                id={customer.id}
                column="communication_notes"
                onSaved={onSaved}
                placeholder="Who reached out, and what was said?"
              />
            </Block>
          </div>

          <Block label={`Job requests — ${customer.requests.length} active`}>
            {customer.requests.length ? (
              <div className="flex flex-col">
                {customer.requests.map((r) => (
                  <RequestLine key={r.id} request={r} />
                ))}
              </div>
            ) : (
              <span className="px-1 text-[12px] text-lps-dim">
                No active requests. Rosie files them as they come in.
              </span>
            )}
          </Block>
        </div>
      )}
    </div>
  )
}

export default function CustomersPage() {
  const [query, setQuery] = useState('')
  const [state, setState] = useState('all')
  const [withRequests, setWithRequests] = useState(false)
  const [page, setPage] = useState(1)

  const [customers, setCustomers] = useState<CustomerRow[]>([])
  const [total, setTotal] = useState(0)
  const [pageCount, setPageCount] = useState(1)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [facets, setFacets] = useState<CustomerFacets>(EMPTY_FACETS)
  const [summary, setSummary] = useState({ customers: 0, withRequests: 0 })
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  /** Bumped after a write, to refetch the page and everything derived from it. */
  const [reloads, setReloads] = useState(0)
  const reload = useCallback(() => setReloads((n) => n + 1), [])

  const serverQuery = useMemo(() => {
    const p = new URLSearchParams()
    if (state !== 'all') p.set('state', state)
    if (withRequests) p.set('requests', '1')
    return p.toString()
  }, [state, withRequests])

  const { query: debounced, filters: debouncedFilters, settled } = useDebouncedSearch(query, serverQuery)

  // Reset to page 1 during render when the result set changes underneath, so a
  // stale page never costs a second request — the pattern the other lists use.
  const searchKey = `${debounced}|${debouncedFilters}`
  const [lastKey, setLastKey] = useState(searchKey)
  if (searchKey !== lastKey) {
    setLastKey(searchKey)
    setPage(1)
  }

  useEffect(() => {
    let cancelled = false
    fetch('/api/customers?facets=1')
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || d.error) return
        setFacets(d.facets ?? EMPTY_FACETS)
        setSummary(d.summary ?? { customers: 0, withRequests: 0 })
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [reloads])

  useEffect(() => {
    let cancelled = false
    setBusy(true)
    const params = new URLSearchParams(debouncedFilters)
    params.set('q', debounced)
    params.set('page', String(page))
    fetch(`/api/customers?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return
        if (d.error) {
          setError(d.error)
          setCustomers([])
          return
        }
        setError('')
        setCustomers(d.customers ?? [])
        setTotal(d.total ?? 0)
        setPageCount(d.pageCount ?? 1)
      })
      .catch((e) => {
        if (!cancelled) setError(String(e))
      })
      .finally(() => {
        if (!cancelled) setBusy(false)
      })
    return () => {
      cancelled = true
    }
  }, [debounced, debouncedFilters, page, reloads])

  const toggle = useCallback((id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const allExpanded = customers.length > 0 && customers.every((c) => expanded.has(c.id))

  const chips: Chip[] = [
    { label: 'State', value: state, options: facets.state, onChange: setState, allLabel: 'All states' },
  ]

  const hasFilters = state !== 'all' || withRequests || query !== ''
  const clearAll = () => {
    setQuery('')
    setState('all')
    setWithRequests(false)
  }

  return (
    <Shell
      page="customers"
      title="Customers"
      subtitle={`${summary.customers} ${summary.customers === 1 ? 'customer' : 'customers'} · ${summary.withRequests} with active requests`}
      toolbar={
        <Toolbar
          placeholder="Search name, company, email, phone…"
          query={query}
          onQuery={setQuery}
          chips={chips}
          hasFilters={hasFilters}
          onClear={clearAll}
          summary={`${total} ${total === 1 ? 'customer' : 'customers'}`}
          pagination={{ page, pageCount, onPage: setPage, busy }}
          controls={
            <>
              <button
                type="button"
                onClick={() => setWithRequests((v) => !v)}
                className={cn(
                  'cursor-pointer rounded-full border px-[11px] py-[5px] text-[12px] font-semibold',
                  withRequests
                    ? 'border-primary bg-secondary text-primary'
                    : 'border-border bg-card text-muted-foreground',
                )}
              >
                With requests · {summary.withRequests}
              </button>
              <button
                type="button"
                onClick={() =>
                  setExpanded(allExpanded ? new Set() : new Set(customers.map((c) => c.id)))
                }
                className="cursor-pointer rounded-full border border-border bg-card px-[11px] py-[5px] text-[12px] font-semibold text-muted-foreground"
              >
                {allExpanded ? 'Collapse all' : 'Expand all'}
              </button>
            </>
          }
        />
      }
    >
      {/* The Shell hands its children a fixed, overflow-hidden box, so this is
          the scroll container — see the same note on Job Requests. */}
      <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-auto p-3 pb-5 md:p-4">
        {error && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-[13px] text-destructive">
            {error}
          </div>
        )}
        {!error && !busy && customers.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <span className="text-[14px] font-semibold text-foreground">
              {hasFilters ? 'No customers match these filters' : 'No customers yet'}
            </span>
            <span className="max-w-[420px] text-[12.5px] text-muted-foreground">
              {hasFilters
                ? 'Try clearing the state or search filters.'
                : 'Customers are created by Rosie during intake, which matches on email, then phone, then name and company — so a request never quietly produces a second copy of someone already on file.'}
            </span>
          </div>
        )}
        {customers.map((customer) => (
          <CustomerCard
            key={customer.id}
            customer={customer}
            expanded={expanded.has(customer.id)}
            onToggle={() => toggle(customer.id)}
            onSaved={reload}
          />
        ))}
        {(busy || !settled) && customers.length === 0 && (
          <div className="py-16 text-center text-[12.5px] text-muted-foreground">Loading…</div>
        )}
      </div>
    </Shell>
  )
}
