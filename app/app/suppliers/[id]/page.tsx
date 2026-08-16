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
import { FilterControl } from '@/components/workspace/table-parts'
import { AVAILABILITY_SOURCE_TYPES, MASTER_COLS, PLANT_COLS, plantEditPatch, websiteHref, type ColumnDef } from '@/lib/columns'
import { PLANT_FILTERS, filterQuery } from '@/lib/server-filters'
import { formatDate, money, num } from '@/lib/format'
import type { Contact, PlantRow, SupplierLocation, SupplierRow, SupplierSource } from '@/lib/rows'
import { applyFilters, compareOptions, useTableConfig } from '@/lib/table-config'
import { useDebouncedSearch } from '@/lib/use-debounced'
import { cn } from '@/lib/utils'

type Tab = 'notes' | 'comms' | 'contacts' | 'inventory' | 'files' | 'locations'
const DIMENSION_FILTERS = [
  { key: 'h', label: 'Height (ft)' },
  { key: 'w', label: 'Width (in)' },
  { key: 'cal', label: 'Caliper (in)' },
] as const

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

  const [supplier, setSupplier] = useState<SupplierRow | null>(null)
  const [sources, setSources] = useState<SupplierSource[]>([])
  const [locations, setLocations] = useState<SupplierLocation[]>([])
  const [notFound, setNotFound] = useState(false)
  const [tab, setTab] = useState<Tab>('inventory')
  const [profileEditing, setProfileEditing] = useState(false)
  const [profileDetailsOpen, setProfileDetailsOpen] = useState(false)
  const [profileDraft, setProfileDraft] = useState<Record<string, string>>({})
  const [savingProfile, setSavingProfile] = useState(false)

  const [query, setQuery] = useState('')
  // Column filters are applied as SQL over the result, so the whole filter
  // state travels with the request instead of narrowing the page in place.
  const serverFilterQuery = useMemo(
    () => filterQuery('plant', PLANT_FILTERS, plantCfg.filters),
    [plantCfg.filters],
  )
  const {
    query: debouncedQuery, filters: debouncedFilterQuery, settled,
  } = useDebouncedSearch(query, serverFilterQuery)
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

  const [contacts, setContacts] = useState<Contact[]>([])
  const [editingContact, setEditingContact] = useState<number | null>(null)
  const [addingContact, setAddingContact] = useState(false)
  const [contactDraft, setContactDraft] = useState<Record<string, string>>({})
  const [savingContact, setSavingContact] = useState(false)

  const [noteDraft, setNoteDraft] = useState('')
  const [noteDirty, setNoteDirty] = useState(false)
  const [savingNote, setSavingNote] = useState(false)
  const [commsDraft, setCommsDraft] = useState('')
  const [commsChannel, setCommsChannel] = useState('email')
  const [savingComms, setSavingComms] = useState(false)

  useEffect(() => {
    const requested = new URL(window.location.href).searchParams.get('tab')
    if (
      requested === 'notes' || requested === 'comms' || requested === 'contacts' ||
      requested === 'inventory' || requested === 'files' || requested === 'locations'
    ) {
      setTab(requested)
    }
  }, [])

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
      .then((body: {
        supplier?: SupplierRow
        sources?: SupplierSource[]
        locations?: SupplierLocation[]
      } | null) => {
        if (!body?.supplier) return
        setSupplier(body.supplier)
        setSources(body.sources ?? [])
        setLocations(body.locations ?? [])
        setContacts(body.supplier.contacts ?? [])
        setNoteDraft((body.supplier.values.notes as string | null) ?? '')
        setNoteDirty(false)
      })
      .catch(() => setNotFound(true))
  }, [id])

  // A new search starts again at page 1. Reset while rendering, not in an
  // effect: an effect commits *after* the fetch effect below has already run
  // once against the outgoing page number, costing a request for a page of the
  // result set the search just replaced.
  const searchKey = `${debouncedQuery}\n${debouncedFilterQuery}`
  const [pagedFor, setPagedFor] = useState(searchKey)
  if (pagedFor !== searchKey) {
    setPagedFor(searchKey)
    setPage(1)
  }

  // Option lists for this tab, unnarrowed by the active filters. Keyed on the
  // search term only, so changing a filter never refetches them.
  useEffect(() => {
    let cancelled = false
    fetch(`/api/plants?facets=1&supplierId=${id}&q=${encodeURIComponent(debouncedQuery)}`)
      .then((r) => r.json())
      .then((body: { facets?: Record<string, string[]> }) => {
        if (!cancelled) setFacets(body.facets ?? {})
      })
      .catch(() => !cancelled && setFacets({}))
    return () => {
      cancelled = true
    }
  }, [id, debouncedQuery])

  useEffect(() => {
    if (!Number.isInteger(id)) return
    let cancelled = false
    setLoadingPlants(true)
    const filterSuffix = debouncedFilterQuery ? `&${debouncedFilterQuery}` : ''
    fetch(`/api/plants?supplierId=${id}&page=${page}&q=${encodeURIComponent(debouncedQuery)}${filterSuffix}`)
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
  }, [id, debouncedFilterQuery, debouncedQuery, page, plantsVersion])

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
  const removeSource = async (file: SupplierSource) => {
    const name = file.file_path.split('/').pop() || 'this file'
    if (!window.confirm(`Deactivate ${name}? Every plant still attributed to it is deactivated too.`)) {
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
    setSources((prev) => prev.filter((s) => s.id !== file.id))
    setPlantsVersion((v) => v + 1)
    toast(`File deactivated · ${retired} plant${retired === 1 ? '' : 's'} retired`)
  }

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

  // Every contact mutation re-reads the list rather than patching state: a
  // promotion changes `is_primary` on two rows at once and the order is
  // primary-first, so a local patch would have to reimplement both.
  const reloadContacts = useCallback(async () => {
    const res = await fetch(`/api/contacts?supplierId=${id}`)
    if (!res.ok) return
    const body = (await res.json()) as { contacts?: Contact[] }
    setContacts(body.contacts ?? [])
  }, [id])

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
    setSavingContact(false)
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      toast(body.error ?? failMessage)
      return false
    }
    await reloadContacts()
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
      { method: 'POST', body: JSON.stringify({ supplierId: id, fields: contactDraft }) },
      'Contact added',
      'Could not add contact',
    )
    if (!ok) return
    setAddingContact(false)
    setContactDraft({})
  }

  const makePrimary = (contactId: number) =>
    contactRequest(
      '/api/contacts',
      { method: 'PATCH', body: JSON.stringify({ id: contactId, supplierId: id, primary: true }) },
      'Primary contact updated',
      'Could not set primary contact',
    )

  // Removal takes the contact off *this* supplier. Where they also cover other
  // locations, say so — the rest of their links are untouched.
  const removeContact = (contact: Contact) => {
    const who = contact.name || contact.email || contact.phone || 'this contact'
    const elsewhere = contact.also_at.length
      ? ` They stay on ${contact.also_at.length} other location${contact.also_at.length > 1 ? 's' : ''}.`
      : ''
    if (!window.confirm(`Remove ${who} from this supplier?${elsewhere}`)) return
    void contactRequest(
      '/api/contacts',
      { method: 'DELETE', body: JSON.stringify({ id: contact.id, supplierId: id }) },
      'Contact removed',
      'Could not remove contact',
    )
  }

  // Filtering already happened in SQL; what is left here is view-local —
  // sorting, rows the user hid, and rows deleted in this session.
  const visiblePlants = useMemo(
    () =>
      applyFilters(
        plants.filter((p) => !hiddenPlants.includes(p.id) && !deleted.includes(p.id)),
        {},
        plantCfg.sort,
      ),
    [plants, hiddenPlants, deleted, plantCfg.sort],
  )

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

  const values = supplier?.values ?? {}
  const commsEntries = ((values.communication_notes as string | null) ?? '')
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter(Boolean)
    .reverse() // newest first for reading; the column itself stays append-order

  const fieldValue = (key: string) => {
    const v = values[key]
    if (key === 'updated' || key === 'created_at' || key === 'last_ingestion_date') return formatDate(v as string | null)
    if (key === 'item_count') return v == null ? '—' : num(v)
    return Array.isArray(v) ? v.join(', ') : v == null || v === '' ? '—' : String(v)
  }

  const mapHref =
    supplier?.ref.latitude != null && supplier?.ref.longitude != null
      ? `https://www.google.com/maps?q=${supplier.ref.latitude},${supplier.ref.longitude}`
      : null

  // Read from `contacts` state, not the row's primary_contact_* values — those
  // came with the initial fetch and go stale the moment the Contacts tab
  // promotes someone else. Fall back through the list so a supplier whose
  // primary has only an email still offers a call button from another contact.
  const primaryContact = contacts[0]
  const quickPhone = primaryContact?.phone || contacts.find((c) => c.phone)?.phone
  const quickEmail = primaryContact?.email || contacts.find((c) => c.email)?.email
  const detailsSummary = [
    [values.city, values.state].filter(Boolean).join(', '),
    values.item_count == null ? null : `${num(values.item_count)} items`,
    supplier && !supplier.ref.is_active ? 'Inactive' : null,
  ].filter(Boolean).join(' · ')
  const profileExpanded = !isMobile || profileDetailsOpen || profileEditing

  // A supplier with no siblings is its own head branch, which is the same
  // statement as "this company has one location" — there is no other farm to
  // show, so the tab is not offered at all.
  const tabs: [Tab, string][] = [
    ['inventory', `Inventory (${values.item_count == null ? plants.length : num(values.item_count)})`],
    ['contacts', `Contacts (${contacts.length})`],
    ...(locations.length > 0
      ? ([['locations', `Other farms (${locations.length})`]] as [Tab, string][])
      : []),
    ['comms', `Communications (${commsEntries.length})`],
    ['notes', 'Notes'],
    ['files', `Files (${sources.length})`],
  ]
  // `?tab=locations` on a single-site supplier asks for a tab that isn't there.
  const activeTab = tabs.some(([t]) => t === tab) ? tab : 'inventory'

  // Every location's head is in the group and `head_branch_id` never chains, so
  // when no sibling is flagged the supplier being viewed is itself the head.
  const isHeadOffice = locations.length > 0 && !locations.some((l) => l.is_head)

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
      ) : !isMobile ? (
        <Button
          variant="outline"
          size="icon-sm"
          onClick={startProfileEdit}
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
                      values[f.key] && (f.key === 'website' || f.key === 'hosted_availability_url')
                        ? websiteHref(String(values[f.key]))
                        : undefined
                    }
                    options={f.options}
                    onChange={
                      f.column
                        ? (next) => setProfileDraft((current) => ({ ...current, [f.column!]: next }))
                        : undefined
                    }
                  />
                ))}
              </div>

              {isMobile && !profileEditing && (
                <div className="flex w-full justify-end">
                  <Button
                    variant="outline"
                    size="icon-sm"
                    onClick={startProfileEdit}
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

        {activeTab === 'contacts' && (
          <div className="flex max-w-[760px] flex-col gap-2.5 p-4">
            <p className="text-[12px] text-muted-foreground">
              People at this supplier. The <strong>primary</strong> is the one the supplier tables
              and Daisy reach for by default — promote whoever actually answers about availability.
              Notes here describe the <em>person</em>; what was said to them belongs in
              Communications.
            </p>

            {addingContact ? (
              <div className="rounded-xl border border-primary bg-card p-[13px_14px]">
                <ContactForm
                  draft={contactDraft}
                  busy={savingContact}
                  saveLabel="Add contact"
                  onChange={(column, value) =>
                    setContactDraft((current) => ({ ...current, [column]: value }))
                  }
                  onSave={() => void addContact()}
                  onCancel={() => {
                    setAddingContact(false)
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
                  setAddingContact(true)
                }}
              >
                Add contact
              </Button>
            )}

            {contacts.length === 0 && !addingContact && (
              <p className="text-[12.5px] text-muted-foreground">
                No contacts on file for this supplier yet.
              </p>
            )}

            <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))' }}>
              {contacts.map((c) => (
                <ContactCard
                  key={c.id}
                  contact={c}
                  editing={editingContact === c.id}
                  draft={contactDraft}
                  busy={savingContact}
                  onChange={(column, value) =>
                    setContactDraft((current) => ({ ...current, [column]: value }))
                  }
                  onEdit={() => {
                    setAddingContact(false)
                    setContactDraft(contactDraftOf(c))
                    setEditingContact(c.id)
                  }}
                  onSave={() => void saveContact(c.id)}
                  onCancel={() => {
                    setEditingContact(null)
                    setContactDraft({})
                  }}
                  onMakePrimary={() => void makePrimary(c.id)}
                  onRemove={() => removeContact(c)}
                />
              ))}
            </div>
          </div>
        )}

        {activeTab === 'locations' && (
          <div className="flex max-w-[760px] flex-col gap-2.5 p-4">
            <p className="text-[12px] text-muted-foreground">
              The company&rsquo;s other sites. Each one is its own supplier with its own stock,
              prices and pickup, so a buyer picks a farm, not a company —{' '}
              {isHeadOffice
                ? 'this location is the head office, where the switchboard and company-level contacts sit.'
                : 'the head office is where the switchboard and company-level contacts sit.'}
            </p>

            <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))' }}>
              {locations.map((l) => (
                <Link
                  key={l.id}
                  href={`/suppliers/${l.id}`}
                  onClick={(event) => {
                    if (profileDirty && !window.confirm('Discard your unsaved supplier changes?')) {
                      event.preventDefault()
                    }
                  }}
                  className={cn(
                    'flex flex-col gap-1.5 rounded-xl border bg-card p-[13px_14px] hover:border-primary',
                    l.is_head ? 'border-primary' : 'border-border',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="min-w-0 text-[13.5px] font-bold">{l.name}</span>
                    {l.is_head && (
                      <span className="flex-none rounded-full bg-secondary px-2 py-0.5 text-[10.5px] font-semibold text-primary">
                        Head office
                      </span>
                    )}
                  </div>
                  {l.category && (
                    <div className="text-[11.5px] text-muted-foreground">{l.category}</div>
                  )}
                  <div className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
                    <MapPinIcon size={12} className="flex-none" />
                    <span className="truncate">
                      {[l.city, l.state].filter(Boolean).join(', ') || 'No city on file'}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'comms' && (
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

        {activeTab === 'inventory' && (
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
                  : `${visiblePlants.length} shown · ${query.trim() || Object.keys(plantCfg.filters).length > 0
                    ? `filtered page ${page}`
                    : `page ${page} of ${values.item_count == null ? '?' : Math.max(1, Math.ceil(Number(values.item_count) / 100))}`}`}
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
                        <div className="mt-1 text-[11.5px] text-muted-foreground">
                          {String(p.values.size ?? '')}
                        </div>
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
              ) : (
                <div className="relative min-h-0 flex-1 overflow-auto">
                  <div style={{ width: plantsWidth(plantCfg, true), minWidth: '100%' }}>
                    <div className="sticky top-0 z-30 flex items-stretch border-b border-border">
                      <PlantHeaderRow cfg={plantCfg} options={optionList} showDelete />
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

        {activeTab === 'files' && (
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
                <span className="whitespace-nowrap rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-semibold text-secondary-foreground">
                  Active
                </span>
                <button
                  type="button"
                  onClick={() => void removeSource(f)}
                  disabled={removingSource === f.id}
                  className="cursor-pointer whitespace-nowrap border-none bg-transparent p-0 text-[11.5px] font-semibold text-destructive underline disabled:opacity-50"
                >
                  {removingSource === f.id ? 'Deactivating…' : 'Deactivate'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Shell>
  )
}
