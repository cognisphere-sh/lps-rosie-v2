'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { CloseIcon, ChevronLeft, ChevronRight } from '@/components/workspace/icons'
import { PHOTO_SEARCH_LABELS, SearchOverlay } from '@/components/workspace/search-loader'
import { Shell } from '@/components/workspace/shell'
import { MultiFilter } from '@/components/workspace/table-parts'
import { Toolbar } from '@/components/workspace/toolbar'
import { formatDate } from '@/lib/format'
import type { PhotoCard, PhotoFacets } from '@/lib/rows'
import { PHOTO_FILTERS, filterQuery } from '@/lib/server-filters'
import { compareOptions } from '@/lib/table-config'
import { useDebouncedSearch } from '@/lib/use-debounced'

const EMPTY_FACETS: PhotoFacets = { size: [], tag: [], supplier: [] }

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
}: {
  photos: PhotoCard[]
  index: number
  onIndex: (next: number) => void
  onClose: () => void
}) {
  const router = useRouter()
  const photo = photos[index]
  const supplier = photo?.supplier ?? null

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft' && index > 0) onIndex(index - 1)
      if (e.key === 'ArrowRight' && index < photos.length - 1) onIndex(index + 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, onClose, onIndex, photos.length])

  if (!photo) return null

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

        {photo.tags.length > 0 && (
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
  const [query, setQuery] = useState('')
  const [hydrated, setHydrated] = useState(false)
  const [photos, setPhotos] = useState<PhotoCard[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageCount, setPageCount] = useState(1)
  const [loading, setLoading] = useState(false)
  const [facets, setFacets] = useState<PhotoFacets>(EMPTY_FACETS)
  const [sizes, setSizes] = useState<string[]>([])
  const [tags, setTags] = useState<string[]>([])
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
        supplier: supplierPick
          .map((label) => labelToSupplier.get(label))
          .filter((id): id is number => id != null)
          .map(String),
      }),
    [labelToSupplier, sizes, supplierPick, tags],
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

  // A new question or a new filter starts again at page 1. Reset while
  // rendering rather than in an effect, or the fetch below runs once against
  // the outgoing page number first — see the same note on plant search.
  const searchKey = `${debouncedQuery}\n${debouncedFilterQuery}`
  const [pagedFor, setPagedFor] = useState(searchKey)
  if (pagedFor !== searchKey) {
    setPagedFor(searchKey)
    setPage(1)
  }

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

  useEffect(() => {
    if (!hydrated) return
    let cancelled = false
    setLoading(true)
    const suffix = debouncedFilterQuery ? `&${debouncedFilterQuery}` : ''
    fetch(`/api/photos?q=${encodeURIComponent(debouncedQuery)}&page=${page}${suffix}`)
      .then((r) => r.json())
      .then((body: { photos?: PhotoCard[]; total?: number; pageCount?: number }) => {
        if (cancelled) return
        setPhotos(body.photos ?? [])
        setTotal(body.total ?? 0)
        setPageCount(body.pageCount ?? 1)
        setLoading(false)
      })
      .catch(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [debouncedFilterQuery, debouncedQuery, hydrated, page])

  // A value the current search cannot offer is a leftover from the previous one.
  useEffect(() => {
    if (loading) return
    if (facets.size.length && sizes.length) {
      const valid = new Set(facets.size)
      const next = sizes.filter((s) => valid.has(s))
      if (next.length !== sizes.length) setSizes(next)
    }
    if (facets.tag.length && tags.length) {
      const valid = new Set(facets.tag)
      const next = tags.filter((t) => valid.has(t))
      if (next.length !== tags.length) setTags(next)
    }
    if (supplierOptions.length && supplierPick.length) {
      const valid = new Set(supplierOptions)
      const next = supplierPick.filter((s) => valid.has(s))
      if (next.length !== supplierPick.length) setSupplierPick(next)
    }
  }, [facets, loading, sizes, supplierOptions, supplierPick, tags])

  const optionList = useCallback(
    (values: string[], key: string) => [...values].sort(compareOptions(key)),
    [],
  )

  const activeFilters = sizes.length + tags.length + supplierPick.length
  const clearAll = useCallback(() => {
    setQuery('')
    setSizes([])
    setTags([])
    setSupplierPick([])
  }, [])

  const toolbar = (
    <Toolbar
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
          : `Showing ${photos.length} of ${total.toLocaleString('en-US')} photo${total === 1 ? '' : 's'}`
      }
      pagination={{ page, pageCount, onPage: setPage, busy: searching }}
    />
  )

  return (
    <Shell
      page="photos"
      title="Photo catalogue"
      subtitle={query.trim() ? 'Ranked by match' : 'Newest first'}
      toolbar={toolbar}
      hideHeaderOnMobile
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
              <button
                key={photo.id}
                type="button"
                onClick={() => setLightbox(i)}
                className="flex flex-col overflow-hidden rounded-xl border border-border bg-card text-left transition-shadow hover:shadow-[var(--lps-shadow)]"
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
            ))}
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
        />
      )}
    </Shell>
  )
}
