'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { CloseIcon, ChevronLeft, ChevronRight, PencilIcon, TrashIcon } from '@/components/workspace/icons'
import { PHOTO_SEARCH_LABELS, SearchOverlay } from '@/components/workspace/search-loader'
import { Shell, useToast } from '@/components/workspace/shell'
import { MultiFilter } from '@/components/workspace/table-parts'
import { Toolbar } from '@/components/workspace/toolbar'
import { composePlantName } from '@/lib/columns'
import { formatDate } from '@/lib/format'
import type { PhotoCard, PhotoFacets } from '@/lib/rows'
import { PHOTO_FILTERS, filterQuery } from '@/lib/server-filters'
import { compareOptions } from '@/lib/table-config'
import { useDebouncedSearch } from '@/lib/use-debounced'

const EMPTY_FACETS: PhotoFacets = { size: [], tag: [], cultivar: [], supplier: [] }

/**
 * Dropdown labels for suppliers.
 *
 * A company that operates at several sites is several `suppliers` rows sharing
 * one name, so a bare name would be an ambiguous option *and* a duplicate React
 * key. Only the names that actually repeat get their location appended.
 */
function supplierLabels(suppliers: PhotoFacets['supplier']): Map<string, number> {
  const seen = new Map<string, number>()
  for (const s of suppliers) seen.set(s.name, (seen.get(s.name) ?? 0) + 1)

  const labels = new Map<string, number>()
  for (const s of suppliers) {
    const where = [s.city, s.state].filter(Boolean).join(', ')
    const label = (seen.get(s.name) ?? 0) > 1 && where ? `${s.name} — ${where}` : s.name
    labels.set(label, s.id)
  }
  return labels
}

/** The lines the card and the detail sheet both show under the plant name. */
function specLine(photo: PhotoCard): string {
  return [photo.size, photo.height && `H ${photo.height}`, photo.width && `W ${photo.width}`,
    photo.caliper && `Cal ${photo.caliper}`]
    .filter(Boolean)
    .join(' · ')
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null
  return (
    <div className="flex gap-2 text-[12.5px]">
      <span className="w-[86px] flex-none text-lps-dim">{label}</span>
      <span className="min-w-0 flex-1 text-muted-foreground">{value}</span>
    </div>
  )
}

/**
 * The editable fields, in the order the panel shows them.
 *
 * Every `column` here is in `WRITABLE.plant_photos`, checked again server-side —
 * this list decides the form, not what may be written. Absent on purpose:
 * `name` and the `*_key` columns (derived by trigger), and `supplier_id` /
 * `captured_at` / `source`, which are cataloguing decisions rather than
 * corrections.
 */
const PHOTO_FIELDS = [
  { column: 'common_name', label: 'Common', of: (p: PhotoCard) => p.commonName },
  { column: 'botanical_name', label: 'Botanical', of: (p: PhotoCard) => p.botanicalName },
  { column: 'cultivar_variety_trade_name', label: 'Cultivar', of: (p: PhotoCard) => p.cultivar },
  { column: 'size', label: 'Size', of: (p: PhotoCard) => p.size },
  { column: 'height', label: 'Height', of: (p: PhotoCard) => p.height },
  { column: 'width', label: 'Width', of: (p: PhotoCard) => p.width },
  { column: 'caliper', label: 'Caliper', of: (p: PhotoCard) => p.caliper },
  { column: 'tags', label: 'Tags', of: (p: PhotoCard) => p.tags.join(', '), hint: 'comma separated' },
  { column: 'caption', label: 'Caption', of: (p: PhotoCard) => p.caption, multiline: true },
  { column: 'notes', label: 'Notes', of: (p: PhotoCard) => p.notes, multiline: true },
] as const

const draftOf = (photo: PhotoCard): Record<string, string> =>
  Object.fromEntries(PHOTO_FIELDS.map((f) => [f.column, f.of(photo) ?? '']))

/**
 * The saved values, applied to the card without refetching a page to learn
 * them.
 *
 * Two of these mirror database triggers rather than reading the result back:
 * `name` is composed from the three parts, and `tags` are lowercased, trimmed,
 * deduped and sorted. Both rules are one line here and one line in
 * `trg_plant_photos_derive_identity`; keep them in step.
 */
function photoEditPatch(photo: PhotoCard, draft: Record<string, string>): PhotoCard {
  const text = (column: string) => draft[column].trim() || null
  const tags = [
    ...new Set(draft.tags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean)),
  ].sort()
  const commonName = text('common_name')
  const botanicalName = text('botanical_name')
  const cultivar = text('cultivar_variety_trade_name')
  return {
    ...photo,
    commonName,
    botanicalName,
    cultivar,
    name: composePlantName([commonName, botanicalName, cultivar]) || photo.name,
    size: text('size'),
    height: text('height'),
    width: text('width'),
    caliper: text('caliper'),
    tags,
    caption: text('caption'),
    notes: text('notes'),
  }
}

/**
 * Full-size view of one photo with everything the catalogue knows about it.
 *
 * Rendered in the page rather than on a route of its own, so closing it returns
 * to the same search, the same filters and the same page without a refetch.
 */
function Lightbox({
  photos,
  index,
  onIndex,
  onClose,
  onSave,
}: {
  photos: PhotoCard[]
  index: number
  onIndex: (next: number) => void
  onClose: () => void
  onSave: (photo: PhotoCard, draft: Record<string, string>) => Promise<boolean>
}) {
  const router = useRouter()
  const photo = photos[index]
  const supplier = photo?.supplier ?? null
  const [draft, setDraft] = useState<Record<string, string> | null>(null)
  const [saving, setSaving] = useState(false)
  const dirty =
    draft != null && PHOTO_FIELDS.some((f) => draft[f.column] !== (f.of(photo) ?? ''))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // While editing, Esc backs out of the form and the arrows belong to the
      // text fields — stepping to the next photo would discard the draft.
      if (draft) {
        if (e.key === 'Escape') setDraft(null)
        return
      }
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft' && index > 0) onIndex(index - 1)
      if (e.key === 'ArrowRight' && index < photos.length - 1) onIndex(index + 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [draft, index, onClose, onIndex, photos.length])

  // Moving to another photo abandons an unstarted edit rather than carrying one
  // photo's draft onto the next.
  useEffect(() => setDraft(null), [photo?.id])

  if (!photo) return null

  const save = async () => {
    if (!draft) return
    // Optimistic: leave edit mode now (the card is already patched); a refused
    // write brings the draft back.
    const staged = draft
    setDraft(null)
    setSaving(true)
    const ok = await onSave(photo, staged)
    setSaving(false)
    if (!ok) setDraft(staged)
  }

  return (
    <div className="fixed inset-0 z-[120] flex flex-col bg-background/95 backdrop-blur-sm md:flex-row">
      <div className="relative flex min-h-0 flex-1 items-center justify-center p-3">
        {/* A plain <img>, not next/image: the bytes come from our own
            signed-redirect route rather than a host the optimizer can be
            configured for, and the signature is minted per request. */}
        <img
          src={photo.imageUrl}
          alt={photo.name}
          className="max-h-full max-w-full rounded-xl object-contain"
        />
        {index > 0 && (
          <button
            type="button"
            onClick={() => onIndex(index - 1)}
            aria-label="Previous photo"
            className="absolute left-3 flex size-9 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-[var(--lps-shadow)]"
          >
            <ChevronLeft size={16} />
          </button>
        )}
        {index < photos.length - 1 && (
          <button
            type="button"
            onClick={() => onIndex(index + 1)}
            aria-label="Next photo"
            className="absolute right-3 flex size-9 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-[var(--lps-shadow)]"
          >
            <ChevronRight size={16} />
          </button>
        )}
      </div>

      <div className="flex max-h-[52%] flex-none flex-col gap-2 overflow-auto border-t border-border bg-card p-4 md:max-h-none md:w-[340px] md:border-l md:border-t-0">
        <div className="flex items-start gap-2">
          <h2 className="m-0 min-w-0 flex-1 font-serif text-[18px] font-semibold">{photo.name}</h2>
          {!draft && (
            <button
              type="button"
              onClick={() => setDraft(draftOf(photo))}
              title="Edit details"
              aria-label="Edit details"
              className="flex size-7 flex-none items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <PencilIcon size={14} />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-7 flex-none items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
          >
            <CloseIcon size={16} />
          </button>
        </div>

        {supplier && (
          <button
            type="button"
            onClick={() => router.push(`/suppliers/${supplier.id}`)}
            className="self-start text-left text-[13px] font-semibold text-primary underline underline-offset-2"
          >
            {supplier.name}
          </button>
        )}

        {!draft && photo.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {photo.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-semibold text-secondary-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {draft ? (
          <div className="mt-1 flex flex-col gap-2 border-t border-lps-hair pt-2">
            {PHOTO_FIELDS.map((field) => (
              <label key={field.column} className="flex flex-col gap-1">
                <span className="text-[10.5px] font-bold uppercase tracking-[.05em] text-muted-foreground">
                  {field.label}
                  {'hint' in field && field.hint && (
                    <span className="ml-1.5 font-medium normal-case tracking-normal text-lps-dim">
                      {field.hint}
                    </span>
                  )}
                </span>
                {'multiline' in field && field.multiline ? (
                  <textarea
                    rows={3}
                    value={draft[field.column]}
                    onChange={(e) => setDraft({ ...draft, [field.column]: e.target.value })}
                    className="w-full resize-y rounded-[7px] border border-input bg-background px-2 py-1.5 text-[12.5px] outline-none focus:border-primary"
                  />
                ) : (
                  <input
                    value={draft[field.column]}
                    onChange={(e) => setDraft({ ...draft, [field.column]: e.target.value })}
                    className="h-8 w-full rounded-[7px] border border-input bg-background px-2 text-[12.5px] outline-none focus:border-primary"
                  />
                )}
              </label>
            ))}
            {/* Says what the database is about to do, rather than letting the
                photo quietly leave the Size filter after a save. */}
            {draft.size.trim() !== (photo.size ?? '') && (
              <p className="m-0 rounded-lg bg-lps-tint px-2.5 py-2 text-[11.5px] text-muted-foreground">
                Changing the size clears its standardized bucket, so this photo
                leaves the Size filter until Daisy sets it again.
              </p>
            )}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={save}
                disabled={!dirty || saving}
                className="h-8 flex-1 rounded-[8px] bg-primary px-3 text-[12.5px] font-semibold text-primary-foreground disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save changes'}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (dirty && !window.confirm('Discard your changes to this photo?')) return
                  setDraft(null)
                }}
                disabled={saving}
                className="h-8 rounded-[8px] border border-border bg-background px-3 text-[12.5px] font-semibold text-foreground disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-1 flex flex-col gap-1 border-t border-lps-hair pt-2">
            <DetailRow label="Common" value={photo.commonName} />
            <DetailRow label="Botanical" value={photo.botanicalName && <em>{photo.botanicalName}</em>} />
            <DetailRow label="Cultivar" value={photo.cultivar} />
            <DetailRow label="Size" value={photo.size} />
            <DetailRow label="Height" value={photo.height} />
            <DetailRow label="Width" value={photo.width} />
            <DetailRow label="Caliper" value={photo.caliper} />
            <DetailRow label="Caption" value={photo.caption} />
            <DetailRow label="Notes" value={photo.notes} />
          </div>
        )}

        <div className="flex flex-col gap-1 border-t border-lps-hair pt-2">
          {/* Captured and received are different facts and are shown as such —
              a photo taken last spring and sent yesterday is not fresh. */}
          <DetailRow label="Captured" value={formatDate(photo.capturedAt)} />
          <DetailRow label="Received" value={formatDate(photo.createdAt)} />
          <DetailRow label="Provenance" value={photo.source} />
          <DetailRow
            label="File"
            value={[
              photo.pixels && `${photo.pixels.width} × ${photo.pixels.height}`,
              photo.byteSize && `${Math.round(photo.byteSize / 1024).toLocaleString('en-US')} KB`,
              photo.mimeType,
            ]
              .filter(Boolean)
              .join(' · ')}
          />
        </div>
      </div>
    </div>
  )
}

export default function PhotoCataloguePage() {
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [hydrated, setHydrated] = useState(false)
  const [photos, setPhotos] = useState<PhotoCard[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [facets, setFacets] = useState<PhotoFacets>(EMPTY_FACETS)
  const [sizes, setSizes] = useState<string[]>([])
  const [tags, setTags] = useState<string[]>([])
  const [cultivars, setCultivars] = useState<string[]>([])
  const [supplierPick, setSupplierPick] = useState<string[]>([])
  const [lightbox, setLightbox] = useState<number | null>(null)

  const labelToSupplier = useMemo(() => supplierLabels(facets.supplier), [facets.supplier])
  const supplierOptions = useMemo(() => [...labelToSupplier.keys()], [labelToSupplier])

  // The whole filter state as one stable string — same contract as plant
  // search: identical filters must serialize identically, because this is a
  // `useEffect` dependency and a debounce key.
  const serverFilterQuery = useMemo(
    () =>
      filterQuery('photo', PHOTO_FILTERS, {
        size: sizes,
        tag: tags,
        cultivar: cultivars,
        supplier: supplierPick
          .map((label) => labelToSupplier.get(label))
          .filter((id): id is number => id != null)
          .map(String),
      }),
    [cultivars, labelToSupplier, sizes, supplierPick, tags],
  )

  const {
    query: debouncedQuery, filters: debouncedFilterQuery, settled,
  } = useDebouncedSearch(query, serverFilterQuery)
  const searching = hydrated && (loading || !settled)

  useEffect(() => {
    const url = new URL(window.location.href)
    setQuery(url.searchParams.get('q') ?? '')
    setHydrated(true)

    const restore = () => setQuery(new URL(window.location.href).searchParams.get('q') ?? '')
    window.addEventListener('popstate', restore)
    return () => window.removeEventListener('popstate', restore)
  }, [])

  // Keep the address bar in step without adding a history entry per keystroke.
  useEffect(() => {
    if (!hydrated) return
    const url = new URL(window.location.href)
    if (query.trim()) url.searchParams.set('q', query)
    else url.searchParams.delete('q')
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
  }, [hydrated, query])

  // The grid appends rather than flipping pages, so a new question or filter
  // starts the list over — the effect below replaces `photos` outright, which
  // is the reset. `searchKeyRef` is what a Load more in flight compares itself
  // against: a batch that arrives after the question changed must be dropped,
  // not appended to a list it does not belong to.
  const searchKey = `${debouncedQuery}\n${debouncedFilterQuery}`
  const searchKeyRef = useRef(searchKey)
  searchKeyRef.current = searchKey

  // Options come from the whole match set rather than this page of it, and are
  // keyed on the search term alone — ticking one value never removes the rest.
  useEffect(() => {
    if (!hydrated) return
    let cancelled = false
    fetch(`/api/photos?facets=1&q=${encodeURIComponent(debouncedQuery)}`)
      .then((r) => r.json())
      .then((body: { facets?: PhotoFacets }) => {
        if (!cancelled) setFacets(body.facets ?? EMPTY_FACETS)
      })
      .catch(() => !cancelled && setFacets(EMPTY_FACETS))
    return () => {
      cancelled = true
    }
  }, [debouncedQuery, hydrated])

  const batchUrl = useCallback(
    (offset: number) =>
      `/api/photos?q=${encodeURIComponent(debouncedQuery)}&offset=${offset}` +
      (debouncedFilterQuery ? `&${debouncedFilterQuery}` : ''),
    [debouncedFilterQuery, debouncedQuery],
  )

  // The first batch of a question, which replaces whatever was on screen.
  useEffect(() => {
    if (!hydrated) return
    let cancelled = false
    setLoading(true)
    fetch(batchUrl(0))
      .then((r) => r.json())
      .then((body: { photos?: PhotoCard[]; total?: number }) => {
        if (cancelled) return
        setPhotos(body.photos ?? [])
        setTotal(body.total ?? 0)
        setLoading(false)
      })
      .catch(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [batchUrl, hydrated])

  /**
   * The next batch, appended.
   *
   * The offset is how many photos are already on screen rather than a page
   * number, so deleting one out of the middle doesn't make the next batch skip
   * the row that moved up into its place.
   */
  const loadMore = useCallback(async () => {
    const asked = searchKeyRef.current
    setLoadingMore(true)
    try {
      const res = await fetch(batchUrl(photos.length))
      const body = (await res.json()) as { photos?: PhotoCard[]; total?: number }
      // The question may have changed while this was in flight; that batch
      // belongs to a list that no longer exists.
      if (searchKeyRef.current !== asked) return
      const more = body.photos ?? []
      // Belt and braces against a double-click or a retried request: an id
      // already on screen is never appended twice.
      setPhotos((prev) => {
        const seen = new Set(prev.map((p) => p.id))
        return [...prev, ...more.filter((p) => !seen.has(p.id))]
      })
      if (body.total != null) setTotal(body.total)
    } catch {
      toast('Could not load more photos')
    } finally {
      setLoadingMore(false)
    }
  }, [batchUrl, photos.length, toast])

  // A value the current search cannot offer is a leftover from the previous
  // one. An empty option list means the facets have not arrived yet, not that
  // nothing matches, so it never clears a selection.
  useEffect(() => {
    if (loading) return
    for (const [selected, setSelected, options] of [
      [sizes, setSizes, facets.size],
      [tags, setTags, facets.tag],
      [cultivars, setCultivars, facets.cultivar],
      [supplierPick, setSupplierPick, supplierOptions],
    ] as const) {
      if (!options.length || !selected.length) continue
      const valid = new Set(options)
      const next = selected.filter((value) => valid.has(value))
      if (next.length !== selected.length) setSelected(next)
    }
  }, [cultivars, facets, loading, sizes, supplierOptions, supplierPick, tags])

  const optionList = useCallback(
    (values: string[], key: string) => [...values].sort(compareOptions(key)),
    [],
  )

  /**
   * Remove one photo from the catalogue.
   *
   * A soft delete, like everything else in this schema — the row goes inactive
   * and leaves search and this grid, and the image itself stays in the bucket.
   * The row still points at those bytes and deleting them is not reversible, so
   * that is what the confirmation says rather than promising the file is gone.
   */
  const removePhoto = useCallback(
    async (photo: PhotoCard) => {
      if (
        !window.confirm(
          `Remove “${photo.name}” from the photo catalogue? The image file itself is kept in storage.`,
        )
      ) {
        return
      }
      // Drop it here rather than refetching the page: a refetch would pull the
      // next photo up from the following page and quietly shift everything the
      // user was looking at. Optimistic — a refused delete puts it back where
      // it was.
      let at = -1
      setPhotos((prev) => {
        at = prev.findIndex((p) => p.id === photo.id)
        return prev.filter((p) => p.id !== photo.id)
      })
      setTotal((prev) => Math.max(0, prev - 1))
      const res = await fetch('/api/rows', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ table: 'plant_photos', id: photo.id }),
      })
      if (!res.ok) {
        setPhotos((prev) =>
          prev.some((p) => p.id === photo.id) ? prev : [...prev.slice(0, Math.max(0, at)), photo, ...prev.slice(Math.max(0, at))],
        )
        setTotal((prev) => prev + 1)
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        toast(body.error ?? 'Could not remove photo')
        return
      }
      toast('Photo removed')
    },
    [toast],
  )

  /**
   * Save the lightbox's staged edits — one atomic write of only what changed,
   * the same contract the supplier profile uses.
   *
   * Returns whether it stuck, so the panel knows to leave edit mode. The card
   * is patched locally rather than refetched: a refetch would re-rank the page
   * around the row that was just edited and move it out from under the reader.
   */
  const savePhoto = useCallback(
    async (photo: PhotoCard, draft: Record<string, string>) => {
      const changes: Record<string, string> = {}
      for (const field of PHOTO_FIELDS) {
        if (draft[field.column] !== (field.of(photo) ?? '')) {
          changes[field.column] = draft[field.column]
        }
      }
      if (Object.keys(changes).length === 0) return true

      setPhotos((prev) => prev.map((p) => (p.id === photo.id ? photoEditPatch(photo, draft) : p)))
      const res = await fetch('/api/rows', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ table: 'plant_photos', id: photo.id, changes }),
      })
      if (!res.ok) {
        setPhotos((prev) => prev.map((p) => (p.id === photo.id ? photo : p)))
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        toast(body.error ?? 'Could not save photo')
        return false
      }
      toast('Photo updated')
      return true
    },
    [toast],
  )

  const activeFilters = sizes.length + tags.length + cultivars.length + supplierPick.length
  const clearAll = useCallback(() => {
    setQuery('')
    setSizes([])
    setTags([])
    setCultivars([])
    setSupplierPick([])
  }, [])

  const toolbar = (rightActions: React.ReactNode) => (
    <Toolbar
      rightActions={rightActions}
      placeholder="Search plant name, optionally with size (15g)…"
      query={query}
      onQuery={setQuery}
      controls={
        <>
          <div className="w-[calc(50%-4px)] md:w-[190px]">
            <MultiFilter
              allLabel="All suppliers"
              selectionLabel="Supplier"
              options={supplierOptions}
              selected={supplierPick}
              onChange={setSupplierPick}
              buttonClassName="h-8 px-2 text-[12px]"
              filterPlaceholder="Filter suppliers…"
            />
          </div>
          <div className="w-[calc(50%-4px)] md:w-[160px]">
            <MultiFilter
              allLabel="Size: Any"
              selectionLabel="Size"
              options={optionList(facets.size, 'size')}
              selected={sizes}
              onChange={setSizes}
              buttonClassName="h-8 px-2 text-[12px]"
              filterPlaceholder="Filter sizes…"
            />
          </div>
          <div className="w-[calc(50%-4px)] md:w-[170px]">
            <MultiFilter
              allLabel="Cultivar: Any"
              selectionLabel="Cultivar"
              options={optionList(facets.cultivar, 'cultivar')}
              selected={cultivars}
              onChange={setCultivars}
              buttonClassName="h-8 px-2 text-[12px]"
              filterPlaceholder="Filter cultivars…"
            />
          </div>
          <div className="w-[calc(50%-4px)] md:w-[160px]">
            <MultiFilter
              allLabel="All tags"
              selectionLabel="Tag"
              options={optionList(facets.tag, 'tag')}
              selected={tags}
              onChange={setTags}
              buttonClassName="h-8 px-2 text-[12px]"
              filterPlaceholder="Filter tags…"
            />
          </div>
        </>
      }
      hasFilters={!!query || activeFilters > 0}
      onClear={clearAll}
      summary={
        searching
          ? 'Searching…'
          : `Showing ${photos.length.toLocaleString('en-US')} of ${total.toLocaleString('en-US')} photo${total === 1 ? '' : 's'} · ${query.trim() ? 'Ranked by match' : 'Newest first'}`
      }
    />
  )

  return (
    <Shell
      page="photos"
      title="Photo catalogue"
      toolbar={toolbar}
      hideHeaderOnMobile
      hideHeaderOnDesktop
    >
      <div className="min-h-0 flex-1 overflow-auto p-3">
        {!hydrated ? null : photos.length === 0 && !searching ? (
          <div className="flex min-h-[240px] flex-col items-center justify-center gap-2 px-6 text-center">
            <span className="text-[15px] font-semibold">
              {query.trim() || activeFilters > 0 ? 'No photos match this search' : 'No photos yet'}
            </span>
            <span className="max-w-[430px] text-[12.5px] text-muted-foreground">
              {query.trim() || activeFilters > 0
                ? 'Try a common name — search maps synonyms — or clear a filter.'
                : 'Ask Daisy to catalogue a photo and it will appear here.'}
            </span>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {photos.map((photo, i) => (
              // A div, not a button: the delete control lives inside the card,
              // and a button cannot contain another button.
              <div
                key={photo.id}
                className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-shadow hover:shadow-[var(--lps-shadow)]"
              >
                <button
                  type="button"
                  onClick={() => setLightbox(i)}
                  className="flex flex-col text-left"
                >
                  {/* Plain <img> — see the note in Lightbox. */}
                  <img
                    src={photo.imageUrl}
                    alt={photo.name}
                    loading="lazy"
                    className="aspect-square w-full bg-lps-tint object-cover"
                  />
                  <div className="flex min-w-0 flex-col gap-0.5 p-2.5">
                    <span className="truncate text-[12.5px] font-semibold">{photo.name}</span>
                    {photo.supplier && (
                      <span className="truncate text-[11.5px] text-muted-foreground">
                        {photo.supplier.name}
                      </span>
                    )}
                    <div className="flex items-baseline gap-2 text-[11px] text-lps-dim">
                      <span className="min-w-0 flex-1 truncate">{specLine(photo)}</span>
                      <span className="flex-none whitespace-nowrap">
                        {formatDate(photo.capturedAt ?? photo.createdAt)}
                      </span>
                    </div>
                  </div>
                </button>
                {/* Always present, not hover-only: there is no hover on a touch
                    screen, and this grid is used on one. */}
                <button
                  type="button"
                  onClick={() => removePhoto(photo)}
                  title="Delete photo"
                  aria-label={`Delete ${photo.name}`}
                  className="absolute right-1.5 top-1.5 inline-flex size-7 items-center justify-center rounded-full border border-border bg-card/90 text-muted-foreground shadow-[var(--lps-shadow)] backdrop-blur-sm hover:bg-lps-warn-bg hover:text-[#C24C2E] disabled:opacity-50"
                >
                  <TrashIcon size={13} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Load more, not a pager: the grid is a wall of photos people scan
            downwards, and flipping pages loses everything already looked at.
            The count says what is left so the button isn't a mystery box. */}
        {photos.length > 0 && photos.length < total && (
          <div className="flex flex-col items-center gap-1.5 py-6">
            <button
              type="button"
              onClick={loadMore}
              disabled={loadingMore}
              className="h-9 rounded-[9px] border border-border bg-card px-5 text-[12.5px] font-semibold text-foreground hover:bg-muted disabled:opacity-60"
            >
              {loadingMore ? 'Loading…' : 'Load more'}
            </button>
            <span className="text-[11.5px] text-muted-foreground tabular-nums">
              {(total - photos.length).toLocaleString('en-US')} more
            </span>
          </div>
        )}
      </div>

      <SearchOverlay show={searching} labels={PHOTO_SEARCH_LABELS} />

      {lightbox != null && (
        <Lightbox
          photos={photos}
          index={lightbox}
          onIndex={setLightbox}
          onClose={() => setLightbox(null)}
          onSave={savePhoto}
        />
      )}
    </Shell>
  )
}
