'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  ChevronDown, ChevronLeft, ChevronRight, FileIcon, GlobeIcon, MailIcon,
  MapPinIcon, PencilIcon, PhoneIcon, UploadIcon,
} from '@/components/workspace/icons'
import { PlantHeaderRow, PlantRowLine, plantsWidth } from '@/components/workspace/plant-table'
import { PLANT_SEARCH_LABELS, SearchOverlay } from '@/components/workspace/search-loader'
import { Shell, useIsMobile, useToast } from '@/components/workspace/shell'
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

/** Profile fields are inert until the whole card enters deliberate edit mode. */
function ProfileField({
  label,
  display,
  value,
  editing,
  href,
  onChange,
}: {
  label: string
  display: string
  value: string
  editing: boolean
  href?: string
  onChange?: (next: string) => void
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-[10.5px] font-bold uppercase tracking-[.05em] text-lps-dim">{label}</span>
      {editing && onChange ? (
        <Input
          aria-label={label}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 text-[13px]"
        />
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
        <span title={display} className="truncate text-[13px]">
          {display}
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
  const [tab, setTab] = useState<Tab>('inventory')
  const [profileEditing, setProfileEditing] = useState(false)
  const [profileDetailsOpen, setProfileDetailsOpen] = useState(false)
  const [profileDraft, setProfileDraft] = useState<Record<string, string>>({})
  const [savingProfile, setSavingProfile] = useState(false)

  const [query, setQuery] = useState('')
  const debouncedQuery = useDebounced(query)
  const [plants, setPlants] = useState<PlantRow[]>([])
  const [loadingPlants, setLoadingPlants] = useState(true)
  // The loader covers the debounce window too, so it appears on the first
  // keystroke rather than 300ms later when the fetch actually fires.
  const searchingPlants = loadingPlants || query !== debouncedQuery
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

  const profileDirty = useMemo(
    () =>
      profileEditing &&
      !!supplier &&
      FIELDS.some((field) => {
        if (!field.column) return false
        const current = supplier.values[field.column]
        return (profileDraft[field.column] ?? '').trim() !== (current == null ? '' : String(current).trim())
      }),
    [profileDraft, profileEditing, supplier],
  )

  useEffect(() => {
    if (!profileDirty) return
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warnBeforeUnload)
    return () => window.removeEventListener('beforeunload', warnBeforeUnload)
  }, [profileDirty])

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

  const startProfileEdit = () => {
    if (!supplier) return
    setProfileDraft(
      Object.fromEntries(
        FIELDS.filter((field) => field.column).map((field) => {
          const value = supplier.values[field.column!]
          return [field.column!, value == null ? '' : String(value)]
        }),
      ),
    )
    setProfileDetailsOpen(true)
    setProfileEditing(true)
  }

  const cancelProfileEdit = () => {
    if (profileDirty && !window.confirm('Discard your unsaved supplier changes?')) return
    setProfileEditing(false)
    setProfileDraft({})
  }

  const saveProfile = async () => {
    if (!supplier || !profileDirty || savingProfile) return
    const changes = Object.fromEntries(
      FIELDS.filter((field) => {
        if (!field.column) return false
        const current = supplier.values[field.column]
        return (profileDraft[field.column] ?? '').trim() !== (current == null ? '' : String(current).trim())
      }).map((field) => [field.column!, profileDraft[field.column!] ?? '']),
    )

    setSavingProfile(true)
    const res = await fetch('/api/rows', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ table: 'suppliers', id: supplier.id, changes }),
    })
    setSavingProfile(false)
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      toast(body.error ?? 'Could not save supplier changes')
      return
    }

    const saved = Object.fromEntries(
      Object.entries(changes).map(([column, value]) => [column, value.trim() || null]),
    )
    setSupplier((current) =>
      current ? { ...current, values: { ...current.values, ...saved } } : current,
    )
    setProfileEditing(false)
    setProfileDraft({})
    toast(`${Object.keys(changes).length} supplier field${Object.keys(changes).length === 1 ? '' : 's'} updated`)
  }

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

  const quickPhone = values.phone || values.poc_phone
  const quickEmail = values.email || values.poc_email
  const detailsSummary = [
    [values.city, values.state].filter(Boolean).join(', '),
    values.item_count == null ? null : `${num(values.item_count)} items`,
    supplier && !supplier.ref.is_active ? 'Inactive' : null,
  ].filter(Boolean).join(' · ')
  const profileExpanded = !isMobile || profileDetailsOpen || profileEditing

  const tabs: [Tab, string][] = [
    ['inventory', `Inventory (${values.item_count == null ? plants.length : num(values.item_count)})`],
    ['comms', `Communications (${commsEntries.length})`],
    ['notes', 'Notes'],
    ['files', `Files (${sources.length})`],
  ]

  return (
    <Shell
      page="suppliers"
      title={String(values.name ?? 'Supplier')}
      subtitle={supplier && !profileEditing
        ? [values.category, !supplier.ref.is_active ? 'Inactive' : null].filter(Boolean).join(' · ')
        : supplier ? undefined : 'Loading…'}
      headerAction={supplier ? (profileEditing ? (
        <>
          <Button
            size="sm"
            disabled={!profileDirty || savingProfile}
            onClick={() => void saveProfile()}
          >
            {savingProfile ? 'Saving…' : 'Save'}
          </Button>
          <Button variant="outline" size="sm" disabled={savingProfile} onClick={cancelProfileEdit}>
            Cancel
          </Button>
        </>
      ) : (
        <Button
          variant="outline"
          size="icon-sm"
          onClick={startProfileEdit}
          aria-label="Edit supplier"
          title="Edit supplier"
        >
          <PencilIcon size={15} />
        </Button>
      )) : undefined}
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-auto">
        {/* Compact supplier profile: collapsed by default on mobile. */}
        <div className="border-b border-border bg-card">
          {!isMobile && (
            <div className="px-4 pt-4">
              <Link
                href="/suppliers"
                onClick={(event) => {
                  if (profileDirty && !window.confirm('Discard your unsaved supplier changes?')) {
                    event.preventDefault()
                  }
                }}
                className="text-[12px] text-muted-foreground hover:text-foreground"
              >
                ← All suppliers
              </Link>
            </div>
          )}

          {isMobile && (
            <div className="flex items-center gap-1.5 px-3 py-2">
              <button
                type="button"
                onClick={() => setProfileDetailsOpen((open) => !open)}
                aria-expanded={profileExpanded}
                className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1 py-1 text-left hover:bg-muted"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[12px] font-semibold">Supplier details</span>
                  <span className="block truncate text-[10.5px] text-muted-foreground">{detailsSummary}</span>
                </span>
                <ChevronDown size={14} className={cn('flex-none text-lps-dim', !profileExpanded && '-rotate-90')} />
              </button>

              <div className="flex flex-none items-center gap-1">
                {quickPhone && (
                  <a
                    href={`tel:${String(quickPhone).replace(/[^\d+]/g, '')}`}
                    aria-label={`Call ${String(quickPhone)}`}
                    title={`Call ${String(quickPhone)}`}
                    className="inline-flex size-8 items-center justify-center rounded-lg border border-border text-primary"
                  >
                    <PhoneIcon size={15} />
                  </a>
                )}
                {quickEmail && (
                  <a
                    href={`mailto:${String(quickEmail)}`}
                    aria-label={`Email ${String(quickEmail)}`}
                    title={`Email ${String(quickEmail)}`}
                    className="inline-flex size-8 items-center justify-center rounded-lg border border-border text-primary"
                  >
                    <MailIcon size={15} />
                  </a>
                )}
                {values.website && (
                  <a
                    href={websiteHref(String(values.website))}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Open supplier website"
                    title="Open supplier website"
                    className="inline-flex size-8 items-center justify-center rounded-lg border border-border text-primary"
                  >
                    <GlobeIcon size={15} />
                  </a>
                )}
                {mapHref && (
                  <a
                    href={mapHref}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Open supplier on map"
                    title="Open supplier on map"
                    className="inline-flex size-8 items-center justify-center rounded-lg border border-border text-primary"
                  >
                    <MapPinIcon size={15} />
                  </a>
                )}
              </div>
            </div>
          )}

          {profileExpanded && (
            <div className="flex flex-wrap items-start gap-4 p-4 pt-3">
              <div
                className="grid min-w-[250px] max-w-[760px] flex-1 gap-x-5 gap-y-2.5"
                style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(178px,1fr))' }}
              >
                {FIELDS.map((f) => (
                  <ProfileField
                    key={f.key}
                    label={f.label}
                    display={fieldValue(f.key)}
                    value={f.column ? profileDraft[f.column] ?? '' : ''}
                    editing={profileEditing && !!f.column}
                    href={
                      f.key === 'website' && values.website
                        ? websiteHref(String(values.website))
                        : undefined
                    }
                    onChange={
                      f.column
                        ? (next) => setProfileDraft((current) => ({ ...current, [f.column!]: next }))
                        : undefined
                    }
                  />
                ))}
              </div>

              {!isMobile && (
                <div className="flex min-w-[196px] flex-col gap-2">
                  <Button variant="outline" size="sm" asChild={!!mapHref} disabled={!mapHref} className="w-full">
                    {mapHref ? (
                      <a href={mapHref} target="_blank" rel="noreferrer">Open on map</a>
                    ) : (
                      <span>No coordinates</span>
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex flex-nowrap items-center justify-between gap-1 border-b border-border bg-card px-3 py-2.5 sm:justify-start sm:gap-1.5 sm:px-4">
          {tabs.map(([id_, label]) => (
            <button
              key={id_}
              type="button"
              onClick={() => setTab(id_)}
              className={cn(
                'shrink-0 cursor-pointer whitespace-nowrap rounded-full border px-2 py-1 text-[11.5px] font-semibold sm:px-3.5 sm:py-1.5 sm:text-[12.5px]',
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
                {searchingPlants
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

            <div className="relative flex min-h-0 flex-1 flex-col">
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
                          {String(p.values.size ?? '')}
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
                  {!searchingPlants && visiblePlants.length === 0 && (
                    <div className="px-5 py-11 text-center text-[12.5px] text-muted-foreground">
                      No plants match this search.
                    </div>
                  )}
                </div>
              )}
              <SearchOverlay show={searchingPlants} labels={PLANT_SEARCH_LABELS} />
            </div>
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
