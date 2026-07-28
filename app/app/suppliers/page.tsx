'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { EyeOffIcon } from '@/components/workspace/icons'
import { Shell, useIsMobile, useToast } from '@/components/workspace/shell'
import { Cell, ColumnHead, ColumnPicker, badgeFor } from '@/components/workspace/table-parts'
import { Toolbar } from '@/components/workspace/toolbar'
import { Badge } from '@/components/ui/badge'
import { SUPPLIER_COLS, type ColumnDef } from '@/lib/columns'
import { formatDate } from '@/lib/format'
import type { SupplierRow } from '@/lib/rows'
import { applyFilters, optionsFor, useTableConfig } from '@/lib/table-config'
import { useDebounced } from '@/lib/use-debounced'

const ACTIONS_W = 16 + 26

export default function SuppliersPage() {
  const router = useRouter()
  const isMobile = useIsMobile()
  const toast = useToast()
  const cfg = useTableConfig('suppliers')

  const [query, setQuery] = useState('')
  const debouncedQuery = useDebounced(query)
  const [rows, setRows] = useState<SupplierRow[]>([])
  const [loading, setLoading] = useState(true)
  const [cat, setCat] = useState('all')
  const [region, setRegion] = useState('all')
  const [hiddenRows, setHiddenRows] = useState<number[]>([])

  // Debounced search → search_suppliers RPC. Stale responses are dropped so a
  // slow early query can't overwrite the results of a later one.
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/suppliers?q=${encodeURIComponent(debouncedQuery)}`)
      .then((r) => r.json())
      .then((body: { rows?: SupplierRow[] }) => {
        if (cancelled) return
        setRows(body.rows ?? [])
        setLoading(false)
      })
      .catch(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [debouncedQuery])

  // Second pass: "# Items" needs one COUNT per supplier, so it arrives after
  // the table has already rendered rather than holding it up.
  useEffect(() => {
    const ids = rows.map((r) => r.id)
    if (!ids.length || rows.every((r) => r.values.item_count != null)) return
    let cancelled = false
    fetch(`/api/suppliers?counts=1&ids=${ids.join(',')}`)
      .then((r) => r.json())
      .then((body: { counts?: Record<string, number> }) => {
        if (cancelled || !body.counts) return
        setRows((prev) =>
          prev.map((r) => ({ ...r, values: { ...r.values, item_count: body.counts![r.id] ?? 0 } })),
        )
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [rows])

  const saveCell = useCallback(
    async (row: SupplierRow, col: ColumnDef, next: string) => {
      if (!col.writes) return
      const res = await fetch('/api/rows', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ table: col.writes.table, id: row.id, column: col.writes.column, value: next }),
      })
      if (!res.ok) {
        toast(`Could not save ${col.label}`)
        return
      }
      setRows((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, values: { ...r.values, [col.key]: next || null } } : r)),
      )
      toast(`${col.label} updated`)
    },
    [toast],
  )

  const visibleRows = useMemo(() => {
    let out = rows.filter((r) => !hiddenRows.includes(r.id))
    if (cat !== 'all') out = out.filter((r) => r.values.category === cat)
    if (region !== 'all') out = out.filter((r) => r.values.state === region)
    return applyFilters(out, cfg.filters, cfg.sort)
  }, [rows, hiddenRows, cat, region, cfg.filters, cfg.sort])

  const hasFilters =
    Object.keys(cfg.filters).length > 0 || !!query || cat !== 'all' || region !== 'all'

  const toolbar = (
    <Toolbar
      placeholder="Search name, PoC, email, city…"
      query={query}
      onQuery={setQuery}
      chips={[
        { label: 'Category', value: cat, options: optionsFor(rows, 'category'), onChange: setCat, allLabel: 'All categories' },
        { label: 'State', value: region, options: optionsFor(rows, 'state'), onChange: setRegion, allLabel: 'All states' },
      ]}
      hasFilters={hasFilters}
      onClear={() => {
        setQuery('')
        setCat('all')
        setRegion('all')
        cfg.clearFilters()
      }}
      summary={loading ? 'Searching…' : `Showing ${visibleRows.length} of ${rows.length} suppliers`}
    />
  )

  const tableWidth = ACTIONS_W + cfg.visible.reduce((n, c) => n + cfg.widthOf(c), 0)

  return (
    <Shell page="suppliers" title="Suppliers" subtitle="Growers, nurseries and wholesalers" toolbar={toolbar}>
      {isMobile ? (
        <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-auto p-3 pb-5">
          {visibleRows.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => router.push(`/suppliers/${row.id}`)}
              className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3.5 text-left"
            >
              <div className="flex items-start justify-between gap-2.5">
                <div className="min-w-0">
                  <div className="text-[14.5px] font-bold leading-tight">{String(row.values.name ?? '')}</div>
                  <div className="text-[11.5px] text-muted-foreground">
                    {[row.values.city, row.values.state].filter(Boolean).join(', ') || 'No address on file'}
                  </div>
                </div>
                <div className="flex flex-none flex-col items-end gap-[3px] text-right">
                  <div className="text-[15px] font-bold tabular-nums">
                    {row.values.item_count == null ? '—' : Number(row.values.item_count).toLocaleString('en-US')}
                  </div>
                  <div className="text-[11px] text-muted-foreground">items</div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {row.values.category && (
                  <Badge variant={badgeFor(String(row.values.category)) as 'default' | 'secondary' | 'outline'}>
                    {String(row.values.category)}
                  </Badge>
                )}
                {row.values.poc_name && (
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
                    {String(row.values.poc_name)}
                  </span>
                )}
              </div>
              <span className="text-[12.5px] font-semibold text-primary">Open supplier →</span>
            </button>
          ))}
          {!loading && visibleRows.length === 0 && (
            <div className="p-12 text-center text-[13px] text-muted-foreground">Nothing matches these filters.</div>
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
                        options={optionsFor(rows, col.key)}
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
                      cols={SUPPLIER_COLS}
                      hidden={cfg.config.hidden}
                      onToggle={cfg.toggleColumn}
                    />
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  <tr key={row.id} className="lps-row bg-card transition-colors hover:bg-muted">
                    {cfg.visible.map((col) => (
                      <td
                        key={col.key}
                        className="relative border-b border-lps-hair p-[5px_4px] align-middle"
                        style={{ width: cfg.widthOf(col), minWidth: cfg.widthOf(col), textAlign: col.align ?? 'left' }}
                      >
                        <Cell
                          col={col}
                          rowId={row.id}
                          links={col.kind === 'list' ? row.sourceLinks : undefined}
                          value={
                            col.key === 'created_at' || col.key === 'updated'
                              ? formatDate(row.values[col.key] as string | null)
                              : row.values[col.key] ?? null
                          }
                          onOpen={col.kind === 'link' ? () => router.push(`/suppliers/${row.id}`) : undefined}
                          onSave={col.edit ? (next) => saveCell(row, col, next) : undefined}
                        />
                      </td>
                    ))}
                    <td
                      className="sticky right-0 z-10 border-b border-l border-lps-hair bg-card p-[4px_6px]"
                      style={{ width: ACTIONS_W, minWidth: ACTIONS_W }}
                    >
                      <div className="flex items-center">
                        <button
                          type="button"
                          onClick={() => setHiddenRows((prev) => [...prev, row.id])}
                          title="Hide row until refresh"
                          aria-label="Hide row"
                          className="inline-flex size-[26px] cursor-pointer items-center justify-center rounded-[7px] border-none bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          <EyeOffIcon size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {!loading && visibleRows.length === 0 && (
              <div className="flex flex-col items-center gap-2 px-5 py-14 text-center">
                <span className="text-[14px] font-semibold">Nothing matches these filters</span>
                <span className="text-[12.5px] text-muted-foreground">
                  Clear a column filter, or search a common name — search is typo-tolerant.
                </span>
              </div>
            )}
          </div>

          {hiddenRows.length > 0 && (
            <div className="flex flex-none items-center gap-2.5 border-t border-border bg-lps-tint px-3 py-[7px] text-[11.5px] text-muted-foreground">
              <span>{hiddenRows.length} row{hiddenRows.length === 1 ? '' : 's'} hidden</span>
              <button
                type="button"
                onClick={() => setHiddenRows([])}
                className="cursor-pointer border-none bg-transparent text-[11.5px] font-semibold text-primary underline"
              >
                Restore
              </button>
            </div>
          )}
        </div>
      )}
    </Shell>
  )
}
