'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  ChevronDown, ChevronLeft, ChevronRight, FileIcon, GlobeIcon, MailIcon,
  MapPinIcon, PencilIcon, PhoneIcon, TrashIcon, UploadIcon,
} from '@/components/workspace/icons'
import { PlantHeaderRow, PlantRowLine, plantsWidth } from '@/components/workspace/plant-table'
import { PLANT_SEARCH_LABELS, SearchOverlay } from '@/components/workspace/search-loader'
import { Shell, useIsMobile, useToast } from '@/components/workspace/shell'
import { FilterControl, badgeFor } from '@/components/workspace/table-parts'
import { Badge } from '@/components/ui/badge'
import { AVAILABILITY_SOURCE_TYPES, PLANT_COLS, plantEditPatch, websiteHref, type ColumnDef } from '@/lib/columns'
import { PLANT_FILTERS, filterQuery } from '@/lib/server-filters'
import { PLANT_SORTS, clientOnlySort, sortQuery } from '@/lib/server-sort'
import { formatDate, money, num } from '@/lib/format'
import type {
  CellValue, Contact, PlantRow, SupplierProfile, SupplierRow, SupplierScopeLocation, SupplierSource,
} from '@/lib/rows'
import { applyFilters, compareOptions, useTableConfig } from '@/lib/table-config'
import { useDebouncedSearch } from '@/lib/use-debounced'
import { cn } from '@/lib/utils'

type Tab = 'notes' | 'comms' | 'contacts' | 'inventory' | 'files' | 'farms'
const DIMENSION_FILTERS = [
  { key: 'h', label: 'Height (ft)' },
  { key: 'w', label: 'Width (in)' },
  { key: 'cal', label: 'Caliper (in)' },
] as const

/** Width of the farm card beside the Inventory tab's rows, as on Plant search. */
const FARM_PANEL_W = 260

// `column` marks the field as editable in place and names the `suppliers`
// column it writes to. Derived values (item_count, updated) and `website`
// aren't editable — matching the design's own column definitions.
// No phone or email here: every way of reaching this supplier — the main line
// included — lives in `contacts` and is managed on the Contacts tab, since a
// supplier can have several.
// `options` swaps the text input for a dropdown; blank clears the column.
const FIELDS: { key: string; label: string; column?: string; options?: string[] }[] = [
  { key: 'website', label: 'Website' },
  { key: 'city', label: 'City', column: 'city' },
  { key: 'state', label: 'State', column: 'state' },
  {
    key: 'availability_source_type', label: 'Availability source',
    column: 'availability_source_type', options: AVAILABILITY_SOURCE_TYPES,
  },
  { key: 'availability_update_days', label: 'Update every (days)', column: 'availability_update_days' },
  { key: 'hosted_availability_url', label: 'Hosted availability', column: 'hosted_availability_url' },
  { key: 'item_count', label: 'Active items' },
  { key: 'last_ingestion_date', label: 'Last inventory ingestion' },
  { key: 'updated', label: 'Profile last updated' },
]

const EDITABLE_FIELDS = FIELDS.filter((field) => field.column)

/** Profile fields are inert until the whole card enters deliberate edit mode. */
function ProfileField({
  label,
  display,
  value,
  editing,
  href,
  options,
  onChange,
}: {
  label: string
  display: string
  value: string
  editing: boolean
  href?: string
  /** Present = edit through a dropdown of these values; blank clears. */
  options?: string[]
  onChange?: (next: string) => void
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-[10.5px] font-bold uppercase tracking-[.05em] text-lps-dim">{label}</span>
      {editing && onChange && options ? (
        <select
          aria-label={label}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 cursor-pointer rounded-md border border-input bg-background px-2 text-[13px] outline-none"
        >
          <option value="">—</option>
          {options.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      ) : editing && onChange ? (
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

/** How one field of a supplier row reads on screen. */
function fieldDisplay(row: SupplierRow, key: string, itemCount?: number | null): string {
  const value = key === 'item_count' && itemCount !== undefined ? itemCount : row.values[key]
  if (key === 'updated' || key === 'created_at' || key === 'last_ingestion_date') {
    return formatDate(value as string | null)
  }
  if (key === 'item_count') return value == null ? '—' : num(value)
  return Array.isArray(value) ? value.join(', ') : value == null || value === '' ? '—' : String(value)
}

/**
 * The whole `FIELDS` grid for one location — the profile header and every card
 * on the Farms tab are the same grid over a different row, so a farm's fields
 * are as editable as the head office's.
 */
function ProfileFieldGrid({
  row,
  editing,
  draft,
  itemCount,
  onChange,
}: {
  row: SupplierRow
  editing: boolean
  draft: Record<string, string>
  /** Overrides `item_count` where the figure spans a company rather than a row. */
  itemCount?: number | null
  onChange: (column: string, next: string) => void
}) {
  return (
    <div
      className="grid min-w-[250px] max-w-[760px] flex-1 gap-x-5 gap-y-2.5"
      style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(178px,1fr))' }}
    >
      {FIELDS.map((f) => (
        <ProfileField
          key={f.key}
          label={f.label}
          display={fieldDisplay(row, f.key, f.key === 'item_count' ? itemCount : undefined)}
          value={f.column ? draft[f.column] ?? '' : ''}
          editing={editing && !!f.column}
          href={
            row.values[f.key] && (f.key === 'website' || f.key === 'hosted_availability_url')
              ? websiteHref(String(row.values[f.key]))
              : undefined
          }
          options={f.options}
          onChange={f.column ? (next) => onChange(f.column!, next) : undefined}
        />
      ))}
    </div>
  )
}

// The editable fields of a `contacts` row, in card order. `name` is optional:
// plenty of real contacts are a shared inbox (`sales@…`) or an address whose
// owner we can't name, and a guessed name is worse than none. A contact just
// needs one of name / email / phone.
const CONTACT_FIELDS: { column: string; label: string; type?: string; optional?: boolean }[] = [
  { column: 'name', label: 'Name', optional: true },
  { column: 'title_department', label: 'Title / department', optional: true },
  { column: 'email', label: 'Email', type: 'email' },
  { column: 'phone', label: 'Phone', type: 'tel' },
  { column: 'notes', label: 'Notes', optional: true },
]

const contactDraftOf = (c: Contact): Record<string, string> =>
  Object.fromEntries(
    CONTACT_FIELDS.map((f) => [f.column, (c[f.column as keyof Contact] as string | null) ?? '']),
  )

/**
 * Which farm an entry belongs to.
 *
 * The profile is one page per company, so a contact, a file or a note only
 * means something alongside the location it sits at. Shown wherever the page's
 * scope is more than one farm; on a single-site supplier it would be noise.
 */
function LocationTag({ name, head }: { name: string; head: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex flex-none items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] font-semibold',
        head ? 'bg-secondary text-primary' : 'bg-muted text-muted-foreground',
      )}
    >
      <MapPinIcon size={10} />
      {name}
      {head && ' · head office'}
    </span>
  )
}

/** The add/edit form shared by a new contact and an existing card. */
function ContactForm({
  draft,
  busy,
  saveLabel,
  onChange,
  onSave,
  onCancel,
}: {
  draft: Record<string, string>
  busy: boolean
  saveLabel: string
  onChange: (column: string, value: string) => void
  onSave: () => void
  onCancel: () => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))' }}>
        {CONTACT_FIELDS.map((f) => (
          <label key={f.column} className="flex min-w-0 flex-col gap-0.5">
            <span className="text-[10.5px] font-bold uppercase tracking-[.05em] text-lps-dim">
              {f.label}
              {f.optional && <span className="font-normal normal-case tracking-normal"> · optional</span>}
            </span>
            <Input
              type={f.type}
              value={draft[f.column] ?? ''}
              onChange={(e) => onChange(f.column, e.target.value)}
              className="h-8 text-[13px]"
            />
          </label>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={busy} onClick={onSave}>
          {busy ? 'Saving…' : saveLabel}
        </Button>
        <Button variant="outline" size="sm" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
        <span className="text-[11px] text-muted-foreground">
          A name is optional — email or phone alone is enough.
        </span>
      </div>
    </div>
  )
}

function ContactCard({
  contact,
  location,
  editing,
  draft,
  busy,
  onChange,
  onEdit,
  onSave,
  onCancel,
  onMakePrimary,
  onRemove,
}: {
  contact: Contact
  /** The farm this link is at, where the page covers more than one. */
  location?: { name: string; head: boolean }
  editing: boolean
  draft: Record<string, string>
  busy: boolean
  onChange: (column: string, value: string) => void
  onEdit: () => void
  onSave: () => void
  onCancel: () => void
  onMakePrimary: () => void
  onRemove: () => void
}) {
  const who = contact.name || contact.email || contact.phone || 'Unnamed contact'

  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-xl border bg-card p-[13px_14px]',
        contact.is_primary ? 'border-primary' : 'border-border',
      )}
    >
      {editing ? (
        <ContactForm
          draft={draft}
          busy={busy}
          saveLabel="Save contact"
          onChange={onChange}
          onSave={onSave}
          onCancel={onCancel}
        />
      ) : (
        <>
          {location && (
            <div className="flex">
              <LocationTag name={location.name} head={location.head} />
            </div>
          )}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[13.5px] font-bold">{who}</span>
                {contact.is_primary && (
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[10.5px] font-semibold text-primary">
                    Primary
                  </span>
                )}
              </div>
              {contact.title_department && (
                <div className="text-[11.5px] text-muted-foreground">{contact.title_department}</div>
              )}
            </div>
            <div className="flex flex-none items-center gap-1">
              <button
                type="button"
                onClick={onEdit}
                aria-label={`Edit ${who}`}
                title="Edit contact"
                className="inline-flex size-[26px] cursor-pointer items-center justify-center rounded-[7px] border-none bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <PencilIcon size={13} />
              </button>
              <button
                type="button"
                onClick={onRemove}
                aria-label={`Remove ${who}`}
                title="Remove contact"
                className="inline-flex size-[26px] cursor-pointer items-center justify-center rounded-[7px] border-none bg-transparent text-muted-foreground hover:bg-lps-warn-bg hover:text-[#C24C2E]"
              >
                <TrashIcon size={13} />
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            {contact.email && (
              <a
                href={`mailto:${contact.email}`}
                className="flex items-center gap-1.5 truncate text-[12.5px] text-primary hover:underline"
              >
                <MailIcon size={12} className="flex-none" />
                <span className="truncate">{contact.email}</span>
              </a>
            )}
            {contact.phone && (
              <a
                href={`tel:${contact.phone.replace(/[^\d+]/g, '')}`}
                className="flex items-center gap-1.5 truncate text-[12.5px] text-primary hover:underline"
              >
                <PhoneIcon size={12} className="flex-none" />
                <span className="truncate">{contact.phone}</span>
              </a>
            )}
            {!contact.email && !contact.phone && (
              <span className="text-[12px] italic text-lps-dim">No email or phone on file</span>
            )}
          </div>

          {contact.notes && (
            <p className="m-0 whitespace-pre-wrap text-[12px] leading-relaxed text-muted-foreground">
              {contact.notes}
            </p>
          )}

          {contact.also_at.length > 0 && (
            <p className="m-0 text-[11.5px] leading-relaxed text-muted-foreground">
              Also covers{' '}
              {contact.also_at.map((l, i) => (
                <span key={l.supplier_id}>
                  {i > 0 && ', '}
                  <a href={`/suppliers/${l.supplier_id}?tab=contacts`} className="text-primary hover:underline">
                    {l.supplier_name}
                  </a>
                </span>
              ))}
              . Edits here change them there too.
            </p>
          )}

          {!contact.is_primary && (
            <button
              type="button"
              onClick={onMakePrimary}
              disabled={busy}
              className="cursor-pointer self-start border-none bg-transparent p-0 text-[11.5px] font-semibold text-primary underline disabled:opacity-50"
            >
              Make primary
            </button>
          )}
        </>
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

  const [profile, setProfile] = useState<SupplierProfile | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [tab, setTab] = useState<Tab>('inventory')
  const [profileDetailsOpen, setProfileDetailsOpen] = useState(false)

  // Which location's `FIELDS` are in edit mode — the profile header edits the
  // page's own location, the Farms tab edits any of the company's. One state
  // for both, because they are the same grid over the same columns.
  const [editingId, setEditingId] = useState<number | null>(null)
  const [fieldDraft, setFieldDraft] = useState<Record<string, string>>({})
  const [savingFields, setSavingFields] = useState(false)

  const [query, setQuery] = useState('')
  // Column filters and the header sort are both applied as SQL over the result,
  // so the whole state travels with the request instead of narrowing or
  // reordering the page in place. A supplier can carry thousands of rows, so
  // "cheapest first" has to mean cheapest of theirs, not of these hundred.
  const serverQuery = useMemo(
    () =>
      [filterQuery('plant', PLANT_FILTERS, plantCfg.filters), sortQuery(PLANT_SORTS, plantCfg.sort)]
        .filter(Boolean)
        .join('&'),
    [plantCfg.filters, plantCfg.sort],
  )
  const {
    query: debouncedQuery, filters: debouncedServerQuery, settled,
  } = useDebouncedSearch(query, serverQuery)
  const [plants, setPlants] = useState<PlantRow[]>([])
  const [facets, setFacets] = useState<Record<string, string[]>>({})
  const [loadingPlants, setLoadingPlants] = useState(true)
  // The loader covers the debounce window too, so it appears on the first
  // keystroke rather than 300ms later when the fetch actually fires.
  const searchingPlants = loadingPlants || !settled
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [hiddenPlants, setHiddenPlants] = useState<string[]>([])
  const [deleted, setDeleted] = useState<string[]>([])

  // Bumped when a file is retired, so the Inventory tab refetches instead of
  // going on showing rows that deactivation just took with it.
  const [plantsVersion, setPlantsVersion] = useState(0)
  const [removingSource, setRemovingSource] = useState<string | null>(null)

  const [editingContact, setEditingContact] = useState<number | null>(null)
  /** The farm a new contact is being added at; null = the add form is closed. */
  const [addingContactAt, setAddingContactAt] = useState<number | null>(null)
  const [contactDraft, setContactDraft] = useState<Record<string, string>>({})
  const [savingContact, setSavingContact] = useState(false)

  const [noteDrafts, setNoteDrafts] = useState<Record<number, string>>({})
  const [savingNote, setSavingNote] = useState<number | null>(null)
  const [commsDraft, setCommsDraft] = useState('')
  const [commsChannel, setCommsChannel] = useState('email')
  /** Which farm the log entry is about; a contact is always with a location. */
  const [commsTarget, setCommsTarget] = useState<number | null>(null)
  const [savingComms, setSavingComms] = useState(false)

  const locations = useMemo(() => profile?.locations ?? [], [profile])
  // Every location of the company on a company page, this farm alone on a farm
  // page. `subject` is the one the header profile describes.
  const subject = useMemo(
    () => locations.find((l) => l.row.id === profile?.subjectId) ?? locations[0] ?? null,
    [locations, profile?.subjectId],
  )
  const multi = locations.length > 1
  const scopeKey = locations.map((l) => l.row.id).join(',')
  const nameOf = useCallback(
    (supplierId: number) =>
      String(locations.find((l) => l.row.id === supplierId)?.row.values.name ?? ''),
    [locations],
  )
  // The Inventory tab and its tab label count the whole scope, not one farm.
  const scopeItemCount = locations.reduce((n, l) => n + Number(l.row.values.item_count ?? 0), 0)

  useEffect(() => {
    const requested = new URL(window.location.href).searchParams.get('tab')
    if (
      requested === 'notes' || requested === 'comms' || requested === 'contacts' ||
      requested === 'inventory' || requested === 'files' || requested === 'farms'
    ) {
      setTab(requested)
    }
  }, [])

  const editingRow = useMemo(
    () => locations.find((l) => l.row.id === editingId)?.row ?? null,
    [editingId, locations],
  )
  const fieldsDirty = useMemo(
    () =>
      !!editingRow &&
      EDITABLE_FIELDS.some((field) => {
        const current = editingRow.values[field.column!]
        return (fieldDraft[field.column!] ?? '').trim() !== (current == null ? '' : String(current).trim())
      }),
    [editingRow, fieldDraft],
  )

  useEffect(() => {
    if (!fieldsDirty) return
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warnBeforeUnload)
    return () => window.removeEventListener('beforeunload', warnBeforeUnload)
  }, [fieldsDirty])

  // One request for the whole profile. A contact promotion or removal changes
  // rows this page did not ask about — `is_primary` moves between two links —
  // so every mutation re-reads it rather than reimplementing the rules here.
  const loadProfile = useCallback(async () => {
    if (!Number.isInteger(id)) return
    const res = await fetch(`/api/suppliers/${id}`)
    if (res.status === 404) {
      setNotFound(true)
      return
    }
    if (!res.ok) return
    const body = (await res.json()) as SupplierProfile
    setProfile(body)
    setNoteDrafts(
      Object.fromEntries(body.locations.map((l) => [l.row.id, (l.row.values.notes as string | null) ?? ''])),
    )
  }, [id])

  useEffect(() => {
    void loadProfile().catch(() => setNotFound(true))
  }, [loadProfile])

  // A new search, filter or sort starts again at page 1 — page 3 of one
  // ordering means nothing under another. Reset while rendering, not in an
  // effect: an effect commits *after* the fetch effect below has already run
  // once against the outgoing page number, costing a request for a page of the
  // result set the search just replaced.
  const searchKey = `${debouncedQuery}\n${debouncedServerQuery}`
  const [pagedFor, setPagedFor] = useState(searchKey)
  if (pagedFor !== searchKey) {
    setPagedFor(searchKey)
    setPage(1)
  }

  // Option lists for this tab, unnarrowed by the active filters. Keyed on the
  // search term only, so changing a filter never refetches them.
  useEffect(() => {
    if (!scopeKey) return
    let cancelled = false
    fetch(`/api/plants?facets=1&supplierId=${scopeKey}&q=${encodeURIComponent(debouncedQuery)}`)
      .then((r) => r.json())
      .then((body: { facets?: Record<string, string[]> }) => {
        if (!cancelled) setFacets(body.facets ?? {})
      })
      .catch(() => !cancelled && setFacets({}))
    return () => {
      cancelled = true
    }
  }, [scopeKey, debouncedQuery])

  useEffect(() => {
    if (!scopeKey) return
    let cancelled = false
    setLoadingPlants(true)
    const filterSuffix = debouncedServerQuery ? `&${debouncedServerQuery}` : ''
    fetch(`/api/plants?supplierId=${scopeKey}&page=${page}&q=${encodeURIComponent(debouncedQuery)}${filterSuffix}`)
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
  }, [scopeKey, debouncedServerQuery, debouncedQuery, page, plantsVersion])

  /** Apply a saved change to one location's row without refetching the page. */
  const patchLocation = useCallback((supplierId: number, values: Record<string, CellValue>) => {
    setProfile((current) =>
      current
        ? {
            ...current,
            locations: current.locations.map((location) =>
              location.row.id === supplierId
                ? { ...location, row: { ...location.row, values: { ...location.row.values, ...values } } }
                : location,
            ),
          }
        : current,
    )
  }, [])

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
        prev.map((p) =>
          p.id === row.id
            ? {
                ...p,
                values: { ...p.values, ...plantEditPatch(p.values, col, next) },
              }
            : p,
        ),
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

  // Retiring a file retires the plants still attributed to it — the database
  // cascades, the file is their provenance, and leaving them behind would only
  // orphan them. The count comes back from the server because only it knows how
  // many rows still point at this drop rather than a later one.
  const removeSource = async (location: SupplierScopeLocation, file: SupplierSource) => {
    const name = file.file_path.split('/').pop() || 'this file'
    const where = multi ? ` at ${String(location.row.values.name ?? '')}` : ''
    if (!window.confirm(`Deactivate ${name}${where}? Every plant still attributed to it is deactivated too.`)) {
      return
    }
    setRemovingSource(file.id)
    const res = await fetch('/api/rows', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ table: 'inventory_sources', id: file.id }),
    })
    setRemovingSource(null)
    const body = (await res.json().catch(() => ({}))) as { error?: string; retired?: number }
    if (!res.ok) {
      toast(body.error ?? 'Could not deactivate file')
      return
    }
    const retired = body.retired ?? 0
    setProfile((current) =>
      current
        ? {
            ...current,
            locations: current.locations.map((entry) =>
              entry.row.id === location.row.id
                ? { ...entry, sources: entry.sources.filter((s) => s.id !== file.id) }
                : entry,
            ),
          }
        : current,
    )
    setPlantsVersion((v) => v + 1)
    toast(`File deactivated · ${retired} plant${retired === 1 ? '' : 's'} retired`)
  }

  const startFieldEdit = (row: SupplierRow) => {
    setFieldDraft(
      Object.fromEntries(
        EDITABLE_FIELDS.map((field) => {
          const value = row.values[field.column!]
          return [field.column!, value == null ? '' : String(value)]
        }),
      ),
    )
    setProfileDetailsOpen(true)
    setEditingId(row.id)
  }

  const cancelFieldEdit = () => {
    if (fieldsDirty && !window.confirm('Discard your unsaved supplier changes?')) return
    setEditingId(null)
    setFieldDraft({})
  }

  const saveFields = async () => {
    if (!editingRow || !fieldsDirty || savingFields) return
    const changes = Object.fromEntries(
      EDITABLE_FIELDS.filter((field) => {
        const current = editingRow.values[field.column!]
        return (fieldDraft[field.column!] ?? '').trim() !== (current == null ? '' : String(current).trim())
      }).map((field) => [field.column!, fieldDraft[field.column!] ?? '']),
    )

    setSavingFields(true)
    const res = await fetch('/api/rows', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ table: 'suppliers', id: editingRow.id, changes }),
    })
    setSavingFields(false)
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      toast(body.error ?? 'Could not save supplier changes')
      return
    }

    patchLocation(
      editingRow.id,
      Object.fromEntries(Object.entries(changes).map(([column, value]) => [column, value.trim() || null])),
    )
    setEditingId(null)
    setFieldDraft({})
    toast(`${Object.keys(changes).length} supplier field${Object.keys(changes).length === 1 ? '' : 's'} updated`)
  }

  // `notes` holds durable profile facts, so it is edited in place — replaced,
  // not appended to. One editor per location: a quirk is true of a farm, not of
  // the company that owns it.
  const saveNote = async (supplierId: number) => {
    const draft = noteDrafts[supplierId] ?? ''
    setSavingNote(supplierId)
    const res = await fetch('/api/rows', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ table: 'suppliers', id: supplierId, column: 'notes', value: draft }),
    })
    setSavingNote(null)
    if (!res.ok) {
      toast('Could not save notes')
      return
    }
    patchLocation(supplierId, { notes: draft || null })
    toast('Notes saved')
  }

  // `communication_notes` is an append-only contact log — one timestamped entry
  // per contact, never a rewrite. Same shape the agents write (see
  // docs/supabase-schema.md), so both sides stay readable to each other.
  const logContact = async () => {
    const text = commsDraft.trim()
    const target = commsTarget ?? subject?.row.id
    const row = locations.find((l) => l.row.id === target)?.row
    if (!text || !row) return
    setSavingComms(true)

    const now = new Date()
    const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    const entry = `[${stamp}] ${commsChannel} · logged in app\n${text}`
    const existing = (row.values.communication_notes as string | null) ?? ''
    const next = existing ? `${existing}\n\n${entry}` : entry

    const res = await fetch('/api/rows', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        table: 'suppliers', id: row.id, column: 'communication_notes', value: next,
      }),
    })
    setSavingComms(false)
    if (!res.ok) {
      toast('Could not log contact')
      return
    }
    patchLocation(row.id, { communication_notes: next })
    setCommsDraft('')
    toast('Contact logged')
  }

  const contactRequest = async (
    input: RequestInfo,
    init: RequestInit,
    okMessage: string,
    failMessage: string,
  ): Promise<boolean> => {
    setSavingContact(true)
    const res = await fetch(input, {
      ...init,
      headers: { 'content-type': 'application/json', ...init.headers },
    })
    if (!res.ok) {
      setSavingContact(false)
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      toast(body.error ?? failMessage)
      return false
    }
    await loadProfile()
    setSavingContact(false)
    toast(okMessage)
    return true
  }

  const saveContact = async (contactId: number) => {
    const ok = await contactRequest(
      '/api/rows',
      {
        method: 'PATCH',
        body: JSON.stringify({ table: 'contacts', id: contactId, changes: contactDraft }),
      },
      'Contact updated',
      'Could not save contact',
    )
    if (!ok) return
    setEditingContact(null)
    setContactDraft({})
  }

  const addContact = async () => {
    const ok = await contactRequest(
      '/api/contacts',
      { method: 'POST', body: JSON.stringify({ supplierId: addingContactAt, fields: contactDraft }) },
      'Contact added',
      'Could not add contact',
    )
    if (!ok) return
    setAddingContactAt(null)
    setContactDraft({})
  }

  const makePrimary = (supplierId: number, contactId: number) =>
    contactRequest(
      '/api/contacts',
      { method: 'PATCH', body: JSON.stringify({ id: contactId, supplierId, primary: true }) },
      'Primary contact updated',
      'Could not set primary contact',
    )

  // Removal takes the contact off *this* location. Where they also cover other
  // locations, say so — the rest of their links are untouched.
  const removeContact = (supplierId: number, contact: Contact) => {
    const who = contact.name || contact.email || contact.phone || 'this contact'
    const elsewhere = contact.also_at.length
      ? ` They stay on ${contact.also_at.length} other location${contact.also_at.length > 1 ? 's' : ''}.`
      : ''
    if (!window.confirm(`Remove ${who} from ${nameOf(supplierId) || 'this supplier'}?${elsewhere}`)) return
    void contactRequest(
      '/api/contacts',
      { method: 'DELETE', body: JSON.stringify({ id: contact.id, supplierId }) },
      'Contact removed',
      'Could not remove contact',
    )
  }

  // Filtering and sorting already happened in SQL; what is left here is
  // view-local — rows the user hid, rows deleted in this session, and the
  // columns SQL cannot order (Size, Source, Ingested; see PLANT_SORTS).
  const visiblePlants = useMemo(
    () =>
      applyFilters(
        plants.filter((p) => !hiddenPlants.includes(p.id) && !deleted.includes(p.id)),
        {},
        clientOnlySort(plantCfg.sort, PLANT_SORTS),
      ),
    [plants, hiddenPlants, deleted, plantCfg.sort],
  )

  // Inventory is per farm, so a company page shows it per farm — a card beside
  // its rows, the same shape Plant search uses. Farms with nothing on this page
  // are left out rather than shown empty.
  const plantsByFarm = useMemo(() => {
    const byFarm = new Map<number, PlantRow[]>()
    for (const plant of visiblePlants) {
      if (plant.supplierId == null) continue
      byFarm.set(plant.supplierId, [...(byFarm.get(plant.supplierId) ?? []), plant])
    }
    return locations
      .filter((location) => byFarm.has(location.row.id))
      .map((location) => ({ location, plants: byFarm.get(location.row.id)! }))
  }, [visiblePlants, locations])

  const optionList = useCallback(
    (key: string) => [...(facets[key] ?? [])].sort(compareOptions(key)),
    [facets],
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

  const values = subject?.row.values ?? {}
  /** Every log entry across the scope, newest first, each tagged with its farm. */
  const commsEntries = locations
    .flatMap((location) =>
      ((location.row.values.communication_notes as string | null) ?? '')
        .split(/\n{2,}/)
        .map((s) => s.trim())
        .filter(Boolean)
        .map((body, index) => ({ body, location, index })),
    )
    // Entries open with `[YYYY-MM-DD HH:MM …]`, so the stamp sorts as text.
    // Unstamped ones have no position to claim and fall to the end.
    .sort(
      (a, b) =>
        (b.body.match(/^\[([^\]]+)\]/)?.[1] ?? '').localeCompare(a.body.match(/^\[([^\]]+)\]/)?.[1] ?? '') ||
        b.index - a.index,
    )
  const fileCount = locations.reduce((n, location) => n + location.sources.length, 0)
  const contactCount = locations.reduce((n, location) => n + location.row.contacts.length, 0)

  const mapHref =
    subject?.row.ref.latitude != null && subject?.row.ref.longitude != null
      ? `https://www.google.com/maps?q=${subject.row.ref.latitude},${subject.row.ref.longitude}`
      : null

  // Read from the location rows, not the search row's primary_contact_* values:
  // the Contacts tab can promote someone else, and this has to follow. Fall
  // back through the list so a supplier whose primary has only an email still
  // offers a call button from another contact.
  const scopeContacts = locations.flatMap((location) => location.row.contacts)
  const quickPhone = scopeContacts.find((c) => c.phone)?.phone
  const quickEmail = scopeContacts.find((c) => c.email)?.email
  const detailsSummary = [
    [values.city, values.state].filter(Boolean).join(', '),
    `${num(scopeItemCount)} items`,
    multi ? `${locations.length} farms` : null,
    subject && !subject.row.ref.is_active ? 'Inactive' : null,
  ].filter(Boolean).join(' · ')
  const profileExpanded = !isMobile || profileDetailsOpen || editingId != null
  const editingHeader = editingId != null && editingId === subject?.row.id

  // A single-site supplier is its own head branch, so there is no other farm to
  // show and the tab is not offered at all.
  const tabs: [Tab, string][] = [
    ['inventory', `Inventory (${num(scopeItemCount)})`],
    ['contacts', `Contacts (${contactCount})`],
    ...(multi ? ([['farms', `Farms (${locations.length})`]] as [Tab, string][]) : []),
    ['comms', `Communications (${commsEntries.length})`],
    ['notes', 'Notes'],
    ['files', `Files (${fileCount})`],
  ]
  // `?tab=farms` on a single-site supplier asks for a tab that isn't there.
  const activeTab = tabs.some(([t]) => t === tab) ? tab : 'inventory'

  /** Guard every navigation away from an open editor with unsaved changes. */
  const confirmLeave = (event: { preventDefault: () => void }) => {
    if (fieldsDirty && !window.confirm('Discard your unsaved supplier changes?')) {
      event.preventDefault()
    }
  }

  const farmCard = (location: SupplierScopeLocation, matches: number) => (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex items-start gap-1.5">
        <Link
          href={`/suppliers/${location.row.id}`}
          onClick={confirmLeave}
          className="min-w-0 flex-1 text-[13.5px] font-bold text-primary hover:underline"
        >
          {String(location.row.values.name ?? '')}
        </Link>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {location.is_head && (
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[10.5px] font-semibold text-primary">
            Head office
          </span>
        )}
        {location.row.values.category && (
          <Badge variant={badgeFor(String(location.row.values.category)) as 'default' | 'secondary' | 'outline'}>
            {String(location.row.values.category)}
          </Badge>
        )}
        <span className="whitespace-nowrap rounded-full bg-muted px-2 py-0.5 text-[10.5px] font-semibold text-muted-foreground">
          {matches} row{matches === 1 ? '' : 's'}
        </span>
      </div>
      <span className="truncate text-[11.5px] text-muted-foreground">
        {[location.row.values.city, location.row.values.state].filter(Boolean).join(', ') || 'No city on file'}
      </span>
      <span className="text-[11.5px] text-muted-foreground">
        {num(location.row.values.item_count)} active items
      </span>
    </div>
  )

  return (
    <Shell
      page="suppliers"
      title={String(values.name ?? 'Supplier')}
      subtitle={subject && !editingHeader
        ? [
            values.category,
            multi ? `${locations.length} farms` : null,
            !subject.row.ref.is_active ? 'Inactive' : null,
          ].filter(Boolean).join(' · ')
        : subject ? undefined : 'Loading…'}
      headerAction={subject ? (editingHeader ? (
        <>
          <Button
            size="sm"
            disabled={!fieldsDirty || savingFields}
            onClick={() => void saveFields()}
          >
            {savingFields ? 'Saving…' : 'Save'}
          </Button>
          <Button variant="outline" size="sm" disabled={savingFields} onClick={cancelFieldEdit}>
            Cancel
          </Button>
        </>
      ) : !isMobile ? (
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => startFieldEdit(subject.row)}
          aria-label="Edit supplier"
          title="Edit supplier"
        >
          <PencilIcon size={15} />
        </Button>
      ) : undefined) : undefined}
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-auto">
        {/* Compact supplier profile: collapsed by default on mobile. */}
        <div className="border-b border-border bg-card">
          {!isMobile && (
            <div className="flex flex-wrap items-center gap-3 px-4 pt-4">
              <Link
                href="/suppliers"
                onClick={confirmLeave}
                className="text-[12px] text-muted-foreground hover:text-foreground"
              >
                ← All suppliers
              </Link>
              {/* A farm's own page. Its company is where the whole picture is. */}
              {profile && subject && profile.company.id !== subject.row.id && (
                <Link
                  href={`/suppliers/${profile.company.id}`}
                  onClick={confirmLeave}
                  className="text-[12px] font-semibold text-primary hover:underline"
                >
                  One farm of {profile.company.name} · open the company →
                </Link>
              )}
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

          {profileExpanded && subject && (
            <div className="flex flex-wrap items-start gap-4 p-4 pt-3">
              <ProfileFieldGrid
                row={subject.row}
                editing={editingHeader}
                draft={fieldDraft}
                // The head office holds no stock of its own; the figure a
                // company page reports is the company's.
                itemCount={multi ? scopeItemCount : undefined}
                onChange={(column, next) => setFieldDraft((current) => ({ ...current, [column]: next }))}
              />

              {isMobile && !editingHeader && (
                <div className="flex w-full justify-end">
                  <Button
                    variant="outline"
                    size="icon-sm"
                    onClick={() => startFieldEdit(subject.row)}
                    aria-label="Edit supplier"
                    title="Edit supplier"
                  >
                    <PencilIcon size={15} />
                  </Button>
                </div>
              )}

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
                activeTab === id_ ? 'border-primary bg-secondary text-primary' : 'border-border bg-card text-foreground',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {activeTab === 'notes' && (
          <div className="flex max-w-[720px] flex-col gap-4 p-4">
            <p className="text-[12px] text-muted-foreground">
              What stays <em>true about</em> {multi ? 'each farm' : 'this supplier'} — quirks, preferences,
              ordering constraints, price-list format. Anything the schema has no column for. Edited in
              place; for contact history use the Communications tab.
            </p>
            {locations.map((location) => {
              const draft = noteDrafts[location.row.id] ?? ''
              const saved = (location.row.values.notes as string | null) ?? ''
              const dirty = draft !== saved
              return (
                <div key={location.row.id} className="flex flex-col gap-2">
                  {multi && (
                    <div className="flex">
                      <LocationTag name={String(location.row.values.name ?? '')} head={location.is_head} />
                    </div>
                  )}
                  <textarea
                    aria-label={`Notes for ${String(location.row.values.name ?? '')}`}
                    value={draft}
                    onChange={(e) =>
                      setNoteDrafts((current) => ({ ...current, [location.row.id]: e.target.value }))
                    }
                    placeholder="e.g. Won't quote under 10 units. Prices exclude freight. Sends XLSX with two header rows."
                    rows={multi ? 5 : 10}
                    className="w-full resize-y rounded-xl border border-input bg-background p-3 text-[12.5px] leading-relaxed outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => void saveNote(location.row.id)}
                      disabled={savingNote === location.row.id || !dirty}
                    >
                      {savingNote === location.row.id ? 'Saving…' : 'Save notes'}
                    </Button>
                    {dirty && (
                      <button
                        type="button"
                        onClick={() =>
                          setNoteDrafts((current) => ({ ...current, [location.row.id]: saved }))
                        }
                        className="cursor-pointer border-none bg-transparent text-[12px] text-muted-foreground underline"
                      >
                        Discard changes
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {activeTab === 'contacts' && (
          <div className="flex max-w-[760px] flex-col gap-2.5 p-4">
            <p className="text-[12px] text-muted-foreground">
              People at {multi ? 'this company' : 'this supplier'}. The <strong>primary</strong> is the one
              the supplier tables and Daisy reach for by default — promote whoever actually answers about
              availability. Notes here describe the <em>person</em>; what was said to them belongs in
              Communications.{multi && ' A contact is linked to one farm, and the tag says which.'}
            </p>

            {addingContactAt != null ? (
              <div className="flex flex-col gap-2 rounded-xl border border-primary bg-card p-[13px_14px]">
                {multi && (
                  <label className="flex flex-col gap-0.5">
                    <span className="text-[10.5px] font-bold uppercase tracking-[.05em] text-lps-dim">
                      Farm
                    </span>
                    <select
                      value={addingContactAt}
                      onChange={(e) => setAddingContactAt(Number(e.target.value))}
                      className="h-8 cursor-pointer rounded-md border border-input bg-background px-2 text-[13px] outline-none"
                    >
                      {locations.map((location) => (
                        <option key={location.row.id} value={location.row.id}>
                          {String(location.row.values.name ?? '')}
                          {location.is_head ? ' · head office' : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <ContactForm
                  draft={contactDraft}
                  busy={savingContact}
                  saveLabel="Add contact"
                  onChange={(column, value) =>
                    setContactDraft((current) => ({ ...current, [column]: value }))
                  }
                  onSave={() => void addContact()}
                  onCancel={() => {
                    setAddingContactAt(null)
                    setContactDraft({})
                  }}
                />
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="self-start"
                onClick={() => {
                  setEditingContact(null)
                  setContactDraft({})
                  setAddingContactAt(subject?.row.id ?? null)
                }}
              >
                Add contact
              </Button>
            )}

            {contactCount === 0 && addingContactAt == null && (
              <p className="text-[12.5px] text-muted-foreground">
                No contacts on file for {multi ? 'any of these farms' : 'this supplier'} yet.
              </p>
            )}

            <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))' }}>
              {locations.flatMap((location) =>
                location.row.contacts.map((c) => (
                  <ContactCard
                    key={`${location.row.id}:${c.id}`}
                    contact={c}
                    location={
                      multi
                        ? { name: String(location.row.values.name ?? ''), head: location.is_head }
                        : undefined
                    }
                    editing={editingContact === c.id}
                    draft={contactDraft}
                    busy={savingContact}
                    onChange={(column, value) =>
                      setContactDraft((current) => ({ ...current, [column]: value }))
                    }
                    onEdit={() => {
                      setAddingContactAt(null)
                      setContactDraft(contactDraftOf(c))
                      setEditingContact(c.id)
                    }}
                    onSave={() => void saveContact(c.id)}
                    onCancel={() => {
                      setEditingContact(null)
                      setContactDraft({})
                    }}
                    onMakePrimary={() => void makePrimary(location.row.id, c.id)}
                    onRemove={() => removeContact(location.row.id, c)}
                  />
                )),
              )}
            </div>
          </div>
        )}

        {activeTab === 'farms' && (
          <div className="flex max-w-[900px] flex-col gap-2.5 p-4">
            <p className="text-[12px] text-muted-foreground">
              Every site this company operates. Each one is its own supplier row with its own stock,
              prices and pickup, so a buyer picks a farm, not a company — the head office is where the
              switchboard and company-level contacts sit. Fields here are the farm&rsquo;s own; edit them
              in place, or open a farm for its own page.
            </p>

            {locations.map((location) => {
              const editing = editingId === location.row.id
              return (
                <div
                  key={location.row.id}
                  className={cn(
                    'flex flex-col gap-2.5 rounded-xl border bg-card p-[13px_14px]',
                    location.is_head ? 'border-primary' : 'border-border',
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                      <Link
                        href={`/suppliers/${location.row.id}`}
                        onClick={confirmLeave}
                        className="text-[13.5px] font-bold text-primary hover:underline"
                      >
                        {String(location.row.values.name ?? '')}
                      </Link>
                      {location.is_head && (
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-[10.5px] font-semibold text-primary">
                          Head office
                        </span>
                      )}
                      {location.row.values.category && (
                        <Badge variant={badgeFor(String(location.row.values.category)) as 'default' | 'secondary' | 'outline'}>
                          {String(location.row.values.category)}
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-none items-center gap-1.5">
                      {editing ? (
                        <>
                          <Button size="sm" disabled={!fieldsDirty || savingFields} onClick={() => void saveFields()}>
                            {savingFields ? 'Saving…' : 'Save'}
                          </Button>
                          <Button variant="outline" size="sm" disabled={savingFields} onClick={cancelFieldEdit}>
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="outline"
                          size="icon-sm"
                          onClick={() => startFieldEdit(location.row)}
                          aria-label={`Edit ${String(location.row.values.name ?? '')}`}
                          title="Edit this farm"
                        >
                          <PencilIcon size={14} />
                        </Button>
                      )}
                    </div>
                  </div>
                  <ProfileFieldGrid
                    row={location.row}
                    editing={editing}
                    draft={fieldDraft}
                    onChange={(column, next) => setFieldDraft((current) => ({ ...current, [column]: next }))}
                  />
                </div>
              )
            })}
          </div>
        )}

        {activeTab === 'comms' && (
          <div className="flex max-w-[720px] flex-col gap-2.5 p-4">
            <p className="text-[12px] text-muted-foreground">
              Every contact with {multi ? 'any farm of this company' : 'this supplier'}, newest first.
              Append-only — entries are never rewritten. Daisy logs here automatically whenever she emails
              or is emailed by them.
            </p>

            <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3">
              {multi && (
                <label className="flex flex-col gap-0.5">
                  <span className="text-[10.5px] font-bold uppercase tracking-[.05em] text-lps-dim">Farm</span>
                  <select
                    value={commsTarget ?? subject?.row.id ?? ''}
                    onChange={(e) => setCommsTarget(Number(e.target.value))}
                    className="h-8 cursor-pointer rounded-md border border-input bg-background px-2 text-[13px] outline-none"
                  >
                    {locations.map((location) => (
                      <option key={location.row.id} value={location.row.id}>
                        {String(location.row.values.name ?? '')}
                        {location.is_head ? ' · head office' : ''}
                      </option>
                    ))}
                  </select>
                </label>
              )}
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
                No contact logged with {multi ? 'any of these farms' : 'this supplier'} yet.
              </p>
            )}
            {commsEntries.map(({ body, location, index }) => {
              const [head, ...rest] = body.split('\n')
              const isHeader = head.startsWith('[')
              return (
                <div
                  key={`${location.row.id}:${index}`}
                  className="flex flex-col gap-1.5 rounded-xl border border-lps-hair bg-lps-bubble p-[11px_13px]"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {multi && (
                      <LocationTag name={String(location.row.values.name ?? '')} head={location.is_head} />
                    )}
                    {isHeader && (
                      <span className="font-mono text-[11px] font-semibold text-muted-foreground">
                        {head}
                      </span>
                    )}
                  </div>
                  <p className="m-0 whitespace-pre-wrap text-[12.5px] leading-relaxed">
                    {isHeader ? rest.join('\n') : body}
                  </p>
                </div>
              )
            })}
          </div>
        )}

        {activeTab === 'inventory' && (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card p-[12px_16px]">
              <div className="w-[300px] max-w-full">
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={multi ? "Search this company's list…" : "Search this supplier's list…"}
                  className="h-9"
                />
              </div>
              {isMobile && (
                <div className="grid w-full grid-cols-3 gap-2">
                  {DIMENSION_FILTERS.map(({ key, label }) => {
                    const col = PLANT_COLS.find((candidate) => candidate.key === key)!
                    return (
                      <div key={key} className="flex min-w-0 flex-col gap-1">
                        <span className="text-[10px] font-bold uppercase tracking-[.04em] text-muted-foreground">
                          {label}
                        </span>
                        <FilterControl
                          col={col}
                          value={plantCfg.filters[key]}
                          options={[]}
                          small
                          onFilter={(value) => plantCfg.setColFilter(key, value)}
                        />
                      </div>
                    )
                  })}
                </div>
              )}
              <span className="text-[12px] text-muted-foreground">
                {searchingPlants
                  ? 'Searching…'
                  : `${visiblePlants.length} shown${multi ? ` from ${plantsByFarm.length} farm${plantsByFarm.length === 1 ? '' : 's'}` : ''} · ${query.trim() || Object.keys(plantCfg.filters).length > 0
                    ? `filtered page ${page}`
                    : `page ${page} of ${Math.max(1, Math.ceil(scopeItemCount / 100))}`}`}
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
                  {plantsByFarm.map(({ location, plants: farmPlants }) => (
                    <div key={location.row.id} className="flex flex-col">
                      {multi && (
                        <div className="flex items-center gap-2 border-b border-lps-hair bg-lps-tint px-3 py-2">
                          <LocationTag name={String(location.row.values.name ?? '')} head={location.is_head} />
                          <span className="text-[11px] text-muted-foreground">
                            {farmPlants.length} row{farmPlants.length === 1 ? '' : 's'}
                          </span>
                        </div>
                      )}
                      {farmPlants.map((p) => (
                        <div key={p.id} className="flex items-start gap-3 border-b border-lps-hair p-3">
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[13px] font-semibold">{String(p.values.name ?? '')}</div>
                            {(p.values.size || p.values.cal) && (
                              <div className="mt-1 flex flex-wrap gap-x-2 text-[11.5px] text-muted-foreground">
                                {p.values.size && <span>{String(p.values.size)}</span>}
                                {p.values.cal && (
                                  <span><span className="text-lps-dim">Cal </span>{String(p.values.cal)}</span>
                                )}
                              </div>
                            )}
                            <div className="mt-0.5 text-[10.5px] text-lps-dim">
                              Ingested {formatDate(p.values.ingestion_date as string | null) || '—'}
                            </div>
                          </div>
                          <div className="flex-none text-right">
                            <div className={cn('text-[14px] tabular-nums', p.values.price == null ? 'text-[11px] italic text-lps-dim' : 'font-bold')}>
                              {p.values.price == null ? 'Price unavailable' : money(p.values.price)}
                            </div>
                            <div className="text-[11px] text-muted-foreground tabular-nums">
                              {p.values.qty == null ? '—' : `${num(p.values.qty)} avail`}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="relative min-h-0 flex-1 overflow-auto">
                  {/* Farm card on the left, its rows beside it — the same shape
                      Plant search uses, because inventory is per farm. */}
                  <div
                    style={{
                      width: (multi ? FARM_PANEL_W : 0) + plantsWidth(plantCfg, true),
                      minWidth: '100%',
                    }}
                  >
                    <div className="sticky top-0 z-30 flex items-stretch border-b border-border">
                      {multi && (
                        <div
                          className="flex flex-none items-start border-r border-border bg-lps-headrow p-[8px_10px]"
                          style={{ width: FARM_PANEL_W, minWidth: FARM_PANEL_W }}
                        >
                          <span className="text-[11px] font-bold uppercase tracking-[.05em] text-muted-foreground">
                            Farm
                          </span>
                        </div>
                      )}
                      <PlantHeaderRow cfg={plantCfg} options={optionList} showDelete />
                    </div>
                    {plantsByFarm.map(({ location, plants: farmPlants }) => (
                      <div key={location.row.id} className="flex items-stretch border-b border-border bg-card">
                        {multi && (
                          <div
                            className="sticky left-0 z-[14] flex flex-none flex-col border-r border-border bg-card p-[11px_14px]"
                            style={{ width: FARM_PANEL_W, minWidth: FARM_PANEL_W }}
                          >
                            {farmCard(location, farmPlants.length)}
                          </div>
                        )}
                        <div className="flex min-w-0 flex-1 flex-col">
                          {farmPlants.map((p) => (
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
                      </div>
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

        {activeTab === 'files' && (
          <div className="flex max-w-[720px] flex-col gap-2.5 p-4">
            <div
              title="Uploads happen through the agents, not this app"
              className="flex cursor-not-allowed items-center justify-center gap-2.5 rounded-2xl border border-dashed border-lps-edge bg-card p-5 text-[12.5px] font-semibold text-muted-foreground opacity-70"
            >
              <UploadIcon size={16} />
              Availability lists and price sheets are ingested by Daisy
            </div>
            {fileCount === 0 && (
              <p className="text-[12.5px] text-muted-foreground">No price lists ingested yet.</p>
            )}
            {locations.flatMap((location) =>
              location.sources.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card p-[12px_14px] hover:border-primary"
                >
                  <a
                    href={f.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex min-w-0 flex-1 items-center gap-3"
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
                  </a>
                  {multi && (
                    <LocationTag name={String(location.row.values.name ?? '')} head={location.is_head} />
                  )}
                  <button
                    type="button"
                    onClick={() => void removeSource(location, f)}
                    disabled={removingSource === f.id}
                    className="cursor-pointer whitespace-nowrap border-none bg-transparent p-0 text-[11.5px] font-semibold text-destructive underline disabled:opacity-50"
                  >
                    {removingSource === f.id ? 'Deactivating…' : 'Deactivate'}
                  </button>
                </div>
              )),
            )}
          </div>
        )}
      </div>
    </Shell>
  )
}
