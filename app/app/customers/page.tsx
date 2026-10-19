'use client'

import { ACTIVE_JOB_STATUSES } from '@/lib/job-requests'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { CustomerChatButton } from '@/components/workspace/customer-chat-button'
import { patchRow } from '@/components/workspace/editable'
import { Shell, useIsMobile, useToast } from '@/components/workspace/shell'
import { Cell, ColumnHead, ColumnPicker } from '@/components/workspace/table-parts'
import { Toolbar, type Chip } from '@/components/workspace/toolbar'
import { CUSTOMER_COLS, type ColumnDef } from '@/lib/columns'
import { customerThreadId } from '@/lib/customers'
import { formatDate, money } from '@/lib/format'
import type { CellValue, CustomerFacets, CustomerRow } from '@/lib/rows'
import { applyFilters, compareOptions, optionsFor, useTableConfig } from '@/lib/table-config'
import { useDebouncedSearch } from '@/lib/use-debounced'
import { errorCopy } from '@/lib/error-copy'

const EMPTY_FACETS: CustomerFacets = { state: [] }

/** Holds the column picker, and each row's Rosie button. */
const ACTIONS_W = 16 + 26

/** Statuses that mean a request is still live — what "active" counts. */
const ACTIVE_STATUSES: readonly string[] = ACTIVE_JOB_STATUSES

/** One table row, as the shared `Cell` wants it: an id and a bag of values. */
interface Row {
  id: number
  /** Their stored Rosie thread, for the row's chat button. Never a column. */
  threadId: string | null
  name: string
  values: Record<string, CellValue>
}

/**
 * A customer as a row.
 *
 * The two request figures are summed here rather than server-side: the rollup
 * that comes with a customer already lists every active request with its own
 * total, so the browser has everything it needs and the API keeps one shape.
 * The two order figures are an em dash on purpose — order tables are deferred
 * (migration 0055), so the columns exist and say nothing rather than quietly
 * showing a request figure under an order's name.
 */
function toRow(c: CustomerRow): Row {
  const active = c.requests.filter((r) => ACTIVE_STATUSES.includes(r.status))
  return {
    id: c.id,
    threadId: customerThreadId(c),
    name: c.name,
    values: {
      name: c.name,
      company: c.company,
      type: c.type,
      email: c.email,
      phone: c.phone,
      active_requests: active.length,
      active_request_value: active.reduce((sum, r) => sum + r.lineTotal, 0),
      order_count: '—',
      order_value: '—',
      address: c.address.address,
      city: c.address.city,
      state: c.address.state,
      zip: c.address.zip,
      notes: c.notes,
      created_at: c.createdAt,
      updated: c.updatedAt,
    },
  }
}

export default function CustomersPage() {
  const router = useRouter()
  const isMobile = useIsMobile()
  const toast = useToast()
  const cfg = useTableConfig('customers')

  const [query, setQuery] = useState('')
  const [state, setState] = useState<string[]>([])
  const [withRequests, setWithRequests] = useState(false)
  const [page, setPage] = useState(1)

  const [customers, setCustomers] = useState<CustomerRow[]>([])
  const [total, setTotal] = useState(0)
  const [pageCount, setPageCount] = useState(1)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [facets, setFacets] = useState<CustomerFacets>(EMPTY_FACETS)
  const [summary, setSummary] = useState({ customers: 0, withRequests: 0 })
  const [reloads, setReloads] = useState(0)
  const reload = useCallback(() => setReloads((n) => n + 1), [])

  const serverQuery = useMemo(() => {
    const p = new URLSearchParams()
    if (state.length) p.set('state', state.join(','))
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
        if (!cancelled) setError(errorCopy(e, 'Could not load customers'))
      })
      .finally(() => {
        if (!cancelled) setBusy(false)
      })
    return () => {
      cancelled = true
    }
  }, [debounced, debouncedFilters, page, reloads])

  const rows = useMemo(() => customers.map(toRow), [customers])

  // The column header's sort and filters run over the page in view, not over
  // the whole table: two of the columns are summed in the browser and have no
  // database column to order on. The search box, the State chip and the
  // active-requests toggle are the filters that reach the server.
  const visible = useMemo(
    () => applyFilters(rows, cfg.filters, cfg.sort),
    [rows, cfg.filters, cfg.sort],
  )

  const saveCell = useCallback(
    async (row: Row, col: ColumnDef, next: string) => {
      if (!col.writes) return
      // Optimistic: show the value now, put the customer back if refused.
      const before = customers.find((c) => c.id === row.id)
      const key = col.key
      const value = next || null
      setCustomers((prev) =>
        prev.map((c) =>
          c.id !== row.id
            ? c
            : key === 'address' || key === 'city' || key === 'state' || key === 'zip'
              ? { ...c, address: { ...c.address, [key]: value } }
              : { ...c, [key]: value },
        ),
      )
      try {
        await patchRow(col.writes.table, row.id, col.writes.column, next)
      } catch (e) {
        if (before) setCustomers((prev) => prev.map((c) => (c.id === row.id ? before : c)))
        toast(errorCopy(e, `Could not save ${col.label}`), 'error')
        return
      }
      // Refetch rather than patching in place: `name` and the address parts are
      // plain columns, but the page is ordered by name on the server.
      reload()
      toast(`${col.label} updated`)
    },
    [customers, toast, reload],
  )

  const optionList = useCallback(
    (key: string) =>
      (key === 'state' ? [...facets.state] : optionsFor(rows, key)).sort(compareOptions(key)),
    [facets.state, rows],
  )

  const chips: Chip[] = [
    { label: 'State', values: state, options: facets.state, onChange: setState, allLabel: 'All states' },
  ]

  const hasFilters =
    state.length > 0 || withRequests || query !== '' || Object.keys(cfg.filters).length > 0
  const clearAll = () => {
    setQuery('')
    setState([])
    setWithRequests(false)
    cfg.clearFilters()
  }

  const cellValue = (row: Row, col: ColumnDef): CellValue =>
    col.key === 'created_at' || col.key === 'updated'
      ? formatDate(row.values[col.key] as string | null)
      : row.values[col.key] ?? null

  const tableWidth = ACTIONS_W + cfg.visible.reduce((n, c) => n + cfg.widthOf(c), 0)

  return (
    <Shell
      page="customers"
      title="Customers"
      hideHeaderOnMobile
      hideHeaderOnDesktop
      toolbar={(rightActions) => (
        <Toolbar
          rightActions={rightActions}
          placeholder="Search name, company, email, phone…"
          query={query}
          onQuery={setQuery}
          chips={chips}
          hasFilters={hasFilters}
          onClear={clearAll}
          summary={
            busy || !settled ? 'Searching…' : `${total} ${total === 1 ? 'customer' : 'customers'}`
          }
          pagination={{ page, pageCount, onPage: setPage, busy }}
          controls={
            <button
              type="button"
              onClick={() => setWithRequests((v) => !v)}
              className={
                withRequests
                  ? 'cursor-pointer rounded-full border border-primary bg-secondary px-[11px] py-[5px] text-[12px] font-semibold text-primary transition-colors duration-150 ease-lps'
                  : 'cursor-pointer rounded-full border border-border bg-card px-[11px] py-[5px] text-[12px] font-semibold text-muted-foreground transition-colors duration-150 ease-lps'
              }
            >
              With requests · {summary.withRequests}
            </button>
          }
        />
      )}
    >
      {error && (
        <div className="mx-4 mt-3 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-[13px] text-destructive">
          {error}
        </div>
      )}

      {isMobile ? (
        // A table does not fit a phone, so each customer is a card that opens
        // their page — the same trade the Suppliers list makes.
        <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-auto p-3 pb-5">
          {visible.map((row) => (
            // The card opens the customer; the avatar opens their Rosie
            // conversation. It sits outside the card's button rather than
            // inside it — a button within a button is not a button.
            <div
              key={row.id}
              className="relative flex-none rounded-xl border border-border bg-card"
            >
              <button
                type="button"
                onClick={() => router.push(`/customers/${row.id}`)}
                className="flex w-full cursor-pointer flex-col gap-2 p-3.5 text-left"
              >
                <div className="flex items-start justify-between gap-2.5">
                  <div className="min-w-0">
                    <div className="text-[14px] font-bold leading-tight">
                      {String(row.values.name ?? '')}
                    </div>
                    <div className="text-[12px] text-muted-foreground">
                      {String(row.values.company ?? '') ||
                        [row.values.city, row.values.state].filter(Boolean).join(', ') ||
                        'No company or address on file'}
                    </div>
                    <div className="text-[12px] text-muted-foreground">
                      Type: {String(row.values.type ?? 'Not set')}
                    </div>
                  </div>
                  <div className="flex flex-none flex-col items-end gap-[3px] text-right">
                    <div className="text-[16px] font-bold tabular-nums">
                      {money(row.values.active_request_value) || '$0.00'}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {Number(row.values.active_requests ?? 0)} active
                    </div>
                  </div>
                </div>
                <span className="text-[13px] font-semibold text-primary">Open customer →</span>
              </button>
              {(
                <div className="absolute bottom-3 right-3.5">
                  <CustomerChatButton
                    customerId={row.id}
                    avatar
                    threadId={row.threadId}
                    label={row.name}
                  />
                </div>
              )}
            </div>
          ))}
          {!busy && visible.length === 0 && (
            <div className="p-12 text-center text-[13px] text-muted-foreground">
              Nothing matches these filters.
            </div>
          )}
        </div>
      ) : (
        <div className="mx-4 mb-4 mt-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card">
          <div className="relative min-h-0 flex-1 overflow-auto">
            <table
              className="border-separate"
              style={{ width: tableWidth, borderSpacing: 0, tableLayout: 'fixed' }}
            >
              <thead>
                <tr>
                  {cfg.visible.map((col) => (
                    <th
                      key={col.key}
                      className="sticky top-0 z-20 border-b border-border bg-lps-headrow p-[8px_10px] align-top"
                      style={{ width: cfg.widthOf(col), minWidth: cfg.widthOf(col) }}
                    >
                      <ColumnHead
                        col={col}
                        width={cfg.widthOf(col)}
                        sort={cfg.sort}
                        filters={cfg.filters}
                        options={optionList(col.key)}
                        onSort={() => cfg.cycleSort(col.key)}
                        onFilter={(v) => cfg.setColFilter(col.key, v)}
                        onResize={(w) => cfg.resizeColumn(col.key, w)}
                        onMove={(from) => cfg.moveColumn(from, col.key)}
                      />
                    </th>
                  ))}
                  <th
                    className="sticky right-0 top-0 z-[22] border-b border-l border-border bg-lps-headrow p-1.5 align-top"
                    style={{ width: ACTIONS_W, minWidth: ACTIONS_W }}
                  >
                    <ColumnPicker
                      title="Columns"
                      cols={CUSTOMER_COLS}
                      hidden={cfg.config.hidden}
                      onToggle={cfg.toggleColumn}
                    />
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr key={row.id} className="lps-row h-[48px] bg-card transition-colors hover:bg-muted">
                    {cfg.visible.map((col) => (
                      <td
                        key={col.key}
                        className="relative border-b border-lps-hair p-[5px_4px] align-middle"
                        style={{
                          width: cfg.widthOf(col),
                          minWidth: cfg.widthOf(col),
                          textAlign: col.align ?? 'left',
                        }}
                      >
                        <Cell
                          col={col}
                          rowId={row.id}
                          value={cellValue(row, col)}
                          onOpen={
                            col.kind === 'link' ? () => router.push(`/customers/${row.id}`) : undefined
                          }
                          onSave={col.edit ? (next) => saveCell(row, col, next) : undefined}
                        />
                      </td>
                    ))}
                    <td
                      className="sticky right-0 z-10 border-b border-l border-lps-hair bg-card p-[4px_6px]"
                      style={{ width: ACTIONS_W, minWidth: ACTIONS_W }}
                    >
                      {(
                        <CustomerChatButton
                          customerId={row.id}
                          avatar
                          threadId={row.threadId}
                          label={row.name}
                          size={22}
                          className="mx-auto"
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {!busy && visible.length === 0 && (
              <div className="flex flex-col items-center gap-2 px-5 py-14 text-center">
                <span className="text-[14px] font-semibold">Nothing matches these filters</span>
                <span className="text-[13px] text-muted-foreground">
                  Clear a column filter, or search a name, company, email or phone number.
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </Shell>
  )
}
