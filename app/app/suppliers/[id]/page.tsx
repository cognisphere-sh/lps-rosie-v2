'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  CheckIcon, ChevronLeft, ChevronRight, CloseIcon, FileIcon, PencilIcon, UploadIcon,
} from '@/components/workspace/icons'
import { PlantHeaderRow, PlantRowLine, plantsWidth } from '@/components/workspace/plant-table'
import { Shell, useIsMobile, useToast } from '@/components/workspace/shell'
import { badgeFor } from '@/components/workspace/table-parts'
import { MASTER_COLS, websiteHref, type ColumnDef } from '@/lib/columns'
import { formatDate, money, num } from '@/lib/format'
import type { PlantRow, SupplierRow, SupplierSource } from '@/lib/rows'
import { applyFilters, optionsFor, useTableConfig } from '@/lib/table-config'
import { useDebounced } from '@/lib/use-debounced'
import { cn } from '@/lib/utils'

type Tab = 'notes' | 'comms' | 'inventory' | 'files'

// `column` marks the field as editable in place and names the `suppliers`
// column it writes to. Derived values (item_count, updated) and `website`
// aren't editable — matching the design's own column definitions.
const FIELDS: { key: string; label: string; column?: string }[] = [
  { key: 'poc_name', label: 'Point of contact', column: 'poc_name' },
  { key: 'poc_phone', label: 'PoC phone', column: 'poc_phone' },
  { key: 'poc_email', label: 'PoC email', column: 'poc_email' },
  { key: 'phone', label: 'Phone', column: 'phone' },
  { key: 'email', label: 'Email', column: 'email' },
  { key: 'website', label: 'Website' },
  { key: 'city', label: 'City', column: 'city' },
  { key: 'state', label: 'State', column: 'state' },
  { key: 'item_count', label: 'Active items' },
  { key: 'updated', label: 'Last updated' },
]

/** One field in the profile header, editable in place when it has a column. */
function EditableField({
  label,
  display,
  raw,
  editable,
  href,
  onSave,
}: {
  label: string
  display: string
  raw: string
  editable: boolean
  href?: string
  onSave: (next: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)

  const commit = async () => {
    if (busy) return
    setBusy(true)
    try {
      await onSave(draft)
      setEditing(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="lps-row flex min-w-0 flex-col gap-0.5">
      <span className="text-[10.5px] font-bold uppercase tracking-[.05em] text-lps-dim">{label}</span>
      {editing ? (
        <div className="flex items-center gap-1 rounded-lg bg-background p-0.5 outline outline-2 -outline-offset-2 outline-primary">
          <input
            autoFocus
            value={draft}
            disabled={busy}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void commit()
              if (e.key === 'Escape') setEditing(false)
            }}
            className="h-6 min-w-0 flex-1 border-none bg-transparent px-1 text-[13px] text-foreground outline-none"
          />
          <button
            type="button"
            onClick={() => void commit()}
            aria-label="Save"
            className="inline-flex size-5 cursor-pointer items-center justify-center rounded border-none bg-transparent text-primary hover:bg-secondary"
          >
            <CheckIcon size={11} />
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            aria-label="Cancel"
            className="inline-flex size-5 cursor-pointer items-center justify-center rounded border-none bg-transparent text-muted-foreground hover:bg-lps-warn-bg hover:text-[#C24C2E]"
          >
            <CloseIcon size={11} />
          </button>
        </div>
      ) : href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          title={display}
          className="truncate text-[13px] text-primary hover:underline"
        >
          {display}
        </a>
      ) : (
        <span
          onClick={
            editable
              ? () => {
                  setDraft(raw)
                  setEditing(true)
                }
              : undefined
          }
          title={display}
          className={cn(
            'flex items-center gap-1 truncate text-[13px]',
            editable && 'cursor-text rounded px-0.5 hover:bg-muted',
          )}
        >
          <span className="truncate">{display}</span>
          {editable && (
            <span className="lps-pencil inline-flex flex-none text-lps-dim opacity-0 transition-opacity">
              <PencilIcon size={11} />
            </span>
          )}
        </span>
      )}
    </div>
  )
}

export default function SupplierProfilePage() {
  const params = useParams<{ id: string }>()
  const id = Number.parseInt(params.id, 10)
  const isMobile = useIsMobile()
  const toast = useToast()
  const plantCfg = useTableConfig('plants')

  const [supplier, setSupplier] = useState<SupplierRow | null>(null)
  const [sources, setSources] = useState<SupplierSource[]>([])
  const [notFound, setNotFound] = useState(false)
  const [tab, setTab] = useState<Tab>('notes')

  const [query, setQuery] = useState('')
  const debouncedQuery = useDebounced(query)
  const [plants, setPlants] = useState<PlantRow[]>([])
  const [loadingPlants, setLoadingPlants] = useState(true)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [hiddenPlants, setHiddenPlants] = useState<string[]>([])
  const [deleted, setDeleted] = useState<string[]>([])

  const [noteDraft, setNoteDraft] = useState('')
  const [noteDirty, setNoteDirty] = useState(false)
  const [savingNote, setSavingNote] = useState(false)
  const [commsDraft, setCommsDraft] = useState('')
  const [commsChannel, setCommsChannel] = useState('email')
  const [savingComms, setSavingComms] = useState(false)

  useEffect(() => {
    if (!Number.isInteger(id)) return
    fetch(`/api/suppliers/${id}`)
      .then(async (r) => {
        if (r.status === 404) {
          setNotFound(true)
          return null
        }
        return r.json()
      })
      .then((body: { supplier?: SupplierRow; sources?: SupplierSource[] } | null) => {
        if (!body?.supplier) return
        setSupplier(body.supplier)
        setSources(body.sources ?? [])
        setNoteDraft((body.supplier.values.notes as string | null) ?? '')
        setNoteDirty(false)
      })
      .catch(() => setNotFound(true))
  }, [id])

  // A new search starts again at page 1.
  useEffect(() => setPage(1), [debouncedQuery])

  useEffect(() => {
    if (!Number.isInteger(id)) return
    let cancelled = false
    setLoadingPlants(true)
    fetch(`/api/plants?supplierId=${id}&page=${page}&q=${encodeURIComponent(debouncedQuery)}`)
      .then((r) => r.json())
      .then((body: { plants?: PlantRow[]; hasMore?: boolean }) => {
        if (cancelled) return
        setPlants(body.plants ?? [])
        setHasMore(!!body.hasMore)
        setLoadingPlants(false)
      })
      .catch(() => !cancelled && setLoadingPlants(false))
    return () => {
      cancelled = true
    }
  }, [id, debouncedQuery, page])

  const savePlant = useCallback(
    async (row: PlantRow, col: ColumnDef, next: string) => {
      if (!col.writes) return
      const res = await fetch('/api/rows', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ table: col.writes.table, id: row.id, column: col.writes.column, value: next }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        toast(body.error ?? `Could not save ${col.label}`)
        return
      }
      setPlants((prev) =>
        prev.map((p) => (p.id === row.id ? { ...p, values: { ...p.values, [col.key]: next || null } } : p)),
      )
      toast(`${col.label} updated`)
    },
    [toast],
  )

  const deletePlant = useCallback(
    async (row: PlantRow) => {
      const res = await fetch('/api/rows', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ table: 'inventory', id: row.id }),
      })
      if (!res.ok) {
        toast('Could not delete plant')
        return
      }
      setDeleted((prev) => [...prev, row.id])
      toast('Plant deactivated')
    },
    [toast],
  )

  const saveField = useCallback(
    async (column: string, label: string, next: string) => {
      if (!supplier) return
      const res = await fetch('/api/rows', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ table: 'suppliers', id: supplier.id, column, value: next }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        toast(body.error ?? `Could not save ${label}`)
        return
      }
      setSupplier({ ...supplier, values: { ...supplier.values, [column]: next || null } })
      toast(`${label} updated`)
    },
    [supplier, toast],
  )

  // `notes` holds durable profile facts, so it is edited in place — replaced,
  // not appended to.
  const saveNote = async () => {
    if (!supplier) return
    setSavingNote(true)
    const res = await fetch('/api/rows', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ table: 'suppliers', id: supplier.id, column: 'notes', value: noteDraft }),
    })
    setSavingNote(false)
    if (!res.ok) {
      toast('Could not save notes')
      return
    }
    setSupplier({ ...supplier, values: { ...supplier.values, notes: noteDraft || null } })
    setNoteDirty(false)
    toast('Notes saved')
  }

  // `communication_notes` is an append-only contact log — one timestamped entry
  // per contact, never a rewrite. Same shape the agents write (see
  // docs/supabase-schema.md), so both sides stay readable to each other.
  const logContact = async () => {
    const text = commsDraft.trim()
    if (!text || !supplier) return
    setSavingComms(true)

    const now = new Date()
    const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    const entry = `[${stamp}] ${commsChannel} · logged in app\n${text}`
    const existing = (supplier.values.communication_notes as string | null) ?? ''
    const next = existing ? `${existing}\n\n${entry}` : entry

    const res = await fetch('/api/rows', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        table: 'suppliers', id: supplier.id, column: 'communication_notes', value: next,
      }),
    })
    setSavingComms(false)
    if (!res.ok) {
      toast('Could not log contact')
      return
    }
    setSupplier({ ...supplier, values: { ...supplier.values, communication_notes: next } })
    setCommsDraft('')
    toast('Contact logged')
  }

  const visiblePlants = useMemo(
    () =>
      applyFilters(
        plants.filter((p) => !hiddenPlants.includes(p.id) && !deleted.includes(p.id)),
        plantCfg.filters,
        plantCfg.sort,
      ),
    [plants, hiddenPlants, deleted, plantCfg.filters, plantCfg.sort],
  )

  if (notFound) {
    return (
      <Shell page="suppliers" title="Supplier" subtitle="Not found">
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <p className="text-[14px] font-semibold">That supplier does not exist.</p>
          <Link href="/suppliers" className="text-[13px] font-semibold text-primary underline">
            Back to all suppliers
          </Link>
        </div>
      </Shell>
    )
  }

  const values = supplier?.values ?? {}
  const commsEntries = ((values.communication_notes as string | null) ?? '')
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter(Boolean)
    .reverse() // newest first for reading; the column itself stays append-order

  const fieldValue = (key: string) => {
    const v = values[key]
    if (key === 'updated' || key === 'created_at') return formatDate(v as string | null)
    if (key === 'item_count') return v == null ? '—' : num(v)
    return Array.isArray(v) ? v.join(', ') : v == null || v === '' ? '—' : String(v)
  }

  const mapHref =
    supplier?.ref.latitude != null && supplier?.ref.longitude != null
      ? `https://www.google.com/maps?q=${supplier.ref.latitude},${supplier.ref.longitude}`
      : null

  const tabs: [Tab, string][] = [
    ['notes', 'Notes'],
    ['comms', `Communications (${commsEntries.length})`],
    ['inventory', `Inventory (${values.item_count == null ? plants.length : num(values.item_count)})`],
    ['files', `Files (${sources.length})`],
  ]

  return (
    <Shell page="suppliers" title={String(values.name ?? 'Supplier')} subtitle={supplier ? 'Supplier profile' : 'Loading…'}>
      <div className="flex min-h-0 flex-1 flex-col overflow-auto">
        {/* Header */}
        <div className="flex flex-wrap items-start gap-4 border-b border-border bg-card p-4">
          <div className="flex min-w-[250px] flex-1 flex-col gap-2.5">
            <Link
              href="/suppliers"
              className="flex items-center gap-1.5 self-start text-[12px] text-muted-foreground hover:text-foreground"
            >
              ← All suppliers
            </Link>
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="m-0 font-serif text-[24px] font-semibold tracking-[-.01em]">
                {String(values.name ?? '')}
              </h2>
              {values.category && (
                <Badge variant={badgeFor(String(values.category)) as 'default' | 'secondary' | 'outline'}>
                  {String(values.category)}
                </Badge>
              )}
              {supplier && !supplier.ref.is_active && <Badge variant="destructive">Inactive</Badge>}
            </div>

            <div className="grid max-w-[760px] gap-x-5 gap-y-2.5" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(178px,1fr))' }}>
              {FIELDS.map((f) => (
                <EditableField
                  key={f.key}
                  label={f.label}
                  display={fieldValue(f.key)}
                  raw={values[f.key] == null ? '' : String(values[f.key])}
                  editable={!!f.column && !!supplier}
                  href={
                    f.key === 'website' && values.website
                      ? websiteHref(String(values.website))
                      : undefined
                  }
                  onSave={(next) => saveField(f.column!, f.label, next)}
                />
              ))}
            </div>
          </div>

          <div className="flex min-w-[196px] flex-col gap-2">
            <Button variant="outline" size="sm" asChild={!!mapHref} disabled={!mapHref} className="w-full">
              {mapHref ? (
                <a href={mapHref} target="_blank" rel="noreferrer">Open on map</a>
              ) : (
                <span>No coordinates</span>
              )}
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 border-b border-border bg-card px-4 py-2.5">
          {tabs.map(([id_, label]) => (
            <button
              key={id_}
              type="button"
              onClick={() => setTab(id_)}
              className={cn(
                'cursor-pointer rounded-full border px-3.5 py-1.5 text-[12.5px] font-semibold',
                tab === id_ ? 'border-primary bg-secondary text-primary' : 'border-border bg-card text-foreground',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'notes' && (
          <div className="flex max-w-[720px] flex-col gap-2.5 p-4">
            <p className="text-[12px] text-muted-foreground">
              What stays <em>true about</em> this supplier — quirks, preferences, ordering
              constraints, price-list format. Anything the schema has no column for. Edited in
              place; for contact history use the Communications tab.
            </p>
            <textarea
              value={noteDraft}
              onChange={(e) => {
                setNoteDraft(e.target.value)
                setNoteDirty(true)
              }}
              placeholder="e.g. Won't quote under 10 units. Prices exclude freight. Sends XLSX with two header rows."
              rows={10}
              className="w-full resize-y rounded-xl border border-input bg-background p-3 text-[12.5px] leading-relaxed outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => void saveNote()} disabled={savingNote || !noteDirty}>
                {savingNote ? 'Saving…' : 'Save notes'}
              </Button>
              {noteDirty && (
                <button
                  type="button"
                  onClick={() => {
                    setNoteDraft((values.notes as string | null) ?? '')
                    setNoteDirty(false)
                  }}
                  className="cursor-pointer border-none bg-transparent text-[12px] text-muted-foreground underline"
                >
                  Discard changes
                </button>
              )}
            </div>
          </div>
        )}

        {tab === 'comms' && (
          <div className="flex max-w-[720px] flex-col gap-2.5 p-4">
            <p className="text-[12px] text-muted-foreground">
              Every contact with this supplier, newest first. Append-only — entries are never
              rewritten. Daisy logs here automatically whenever she emails or is emailed by them.
            </p>

            <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3">
              <div className="flex flex-wrap items-center gap-1.5">
                {['email', 'phone', 'telegram', 'in person'].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCommsChannel(c)}
                    className={cn(
                      'cursor-pointer rounded-full border px-2.5 py-1 text-[11.5px] font-semibold',
                      commsChannel === c
                        ? 'border-primary bg-secondary text-primary'
                        : 'border-border bg-card text-muted-foreground',
                    )}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <textarea
                value={commsDraft}
                onChange={(e) => setCommsDraft(e.target.value)}
                placeholder="What was said, and why — e.g. Asked for the July availability list; theirs is 3 weeks old and the 15G Live Oak price looked stale."
                rows={3}
                className="w-full resize-y rounded-lg border border-input bg-background p-2.5 text-[12.5px] leading-relaxed outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              />
              <Button
                size="sm"
                className="self-start"
                onClick={() => void logContact()}
                disabled={savingComms || !commsDraft.trim()}
              >
                {savingComms ? 'Logging…' : 'Log contact'}
              </Button>
            </div>

            {commsEntries.length === 0 && (
              <p className="text-[12.5px] text-muted-foreground">
                No contact logged with this supplier yet.
              </p>
            )}
            {commsEntries.map((body, i) => {
              const [head, ...rest] = body.split('\n')
              const isHeader = head.startsWith('[')
              return (
                <div
                  key={i}
                  className="flex flex-col gap-1.5 rounded-xl border border-lps-hair bg-lps-bubble p-[11px_13px]"
                >
                  {isHeader && (
                    <span className="font-mono text-[11px] font-semibold text-muted-foreground">
                      {head}
                    </span>
                  )}
                  <p className="m-0 whitespace-pre-wrap text-[12.5px] leading-relaxed">
                    {isHeader ? rest.join('\n') : body}
                  </p>
                </div>
              )
            })}
          </div>
        )}

        {tab === 'inventory' && (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card p-[12px_16px]">
              <div className="w-[300px] max-w-full">
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search this supplier's list…"
                  className="h-9"
                />
              </div>
              <span className="text-[12px] text-muted-foreground">
                {loadingPlants
                  ? 'Searching…'
                  : `${visiblePlants.length} shown · page ${page} of ${values.item_count == null ? '?' : Math.max(1, Math.ceil(Number(values.item_count) / 100))}`}
              </span>
              <div className="ml-auto flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1 || loadingPlants}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft size={14} />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!hasMore || loadingPlants}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                  <ChevronRight size={14} />
                </Button>
              </div>
            </div>

            {isMobile ? (
              <div className="flex flex-col">
                {visiblePlants.map((p) => (
                  <div key={p.id} className="flex items-start gap-3 border-b border-lps-hair p-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-semibold">{String(p.values.name ?? '')}</div>
                      {p.values.other && (
                        <div className="truncate text-[11px] text-muted-foreground">{String(p.values.other)}</div>
                      )}
                      <div className="mt-1 text-[11.5px] text-muted-foreground">
                        {[p.values.size, p.values.cat].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                    <div className="flex-none text-right">
                      <div className="text-[14px] font-bold tabular-nums">{money(p.values.price)}</div>
                      <div className="text-[11px] text-muted-foreground tabular-nums">
                        {p.values.qty == null ? '—' : `${num(p.values.qty)} avail`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="relative min-h-0 flex-1 overflow-auto">
                <div style={{ width: plantsWidth(plantCfg, true), minWidth: '100%' }}>
                  <div className="sticky top-0 z-30 flex items-stretch border-b border-border">
                    <PlantHeaderRow cfg={plantCfg} options={(key) => optionsFor(plants, key)} showDelete />
                  </div>
                  {visiblePlants.map((p) => (
                    <PlantRowLine
                      key={p.id}
                      row={p}
                      cfg={plantCfg}
                      onHide={() => setHiddenPlants((prev) => [...prev, p.id])}
                      onDelete={() => void deletePlant(p)}
                      onEdit={(col, next) => savePlant(p, col, next)}
                    />
                  ))}
                </div>
                {!loadingPlants && visiblePlants.length === 0 && (
                  <div className="px-5 py-11 text-center text-[12.5px] text-muted-foreground">
                    No plants match this search.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {tab === 'files' && (
          <div className="flex max-w-[720px] flex-col gap-2.5 p-4">
            <div
              title="Uploads happen through the agents, not this app"
              className="flex cursor-not-allowed items-center justify-center gap-2.5 rounded-2xl border border-dashed border-lps-edge bg-card p-5 text-[12.5px] font-semibold text-muted-foreground opacity-70"
            >
              <UploadIcon size={16} />
              Availability lists and price sheets are ingested by Daisy
            </div>
            {sources.length === 0 && (
              <p className="text-[12.5px] text-muted-foreground">No price lists ingested yet.</p>
            )}
            {sources.map((f) => (
              <a
                key={f.id}
                href={f.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-[12px_14px] hover:border-primary"
              >
                <span className="inline-flex size-8 flex-none items-center justify-center rounded-[9px] bg-secondary text-secondary-foreground">
                  <FileIcon size={15} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-semibold">{f.file_path.split('/').pop()}</div>
                  <div className="text-[11px] text-muted-foreground">
                    Ingested {formatDate(f.created_at)}
                    {f.notes ? ` · ${f.notes}` : ''}
                  </div>
                </div>
                <span className="whitespace-nowrap rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-semibold text-secondary-foreground">
                  Active
                </span>
              </a>
            ))}
          </div>
        )}
      </div>
    </Shell>
  )
}
