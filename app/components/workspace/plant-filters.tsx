'use client'

import { SlidersHorizontal, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'

import { FilterControl, MultiFilter, useOutsideClose } from '@/components/workspace/table-parts'
import { PLANT_COLS } from '@/lib/columns'
import type { ColFilter } from '@/lib/table-config'
import { cn } from '@/lib/utils'

export const PLANT_ADVANCED_FILTER_KEYS = [
  'name', 'common_name', 'botanical_name', 'price', 'qty', 'h', 'w', 'cal', 'notes', 'internal_notes',
] as const
export const PLANT_QUICK_FILTER_MIN_WIDTH = 900

export const plantFiltersAreCompact = (width: number) => width < PLANT_QUICK_FILTER_MIN_WIDTH

/**
 * Coordination companion to the CSS container query. CSS alone owns display
 * and accessibility-tree membership from first paint; this state only moves
 * focus and preserves open menus when the page column crosses the boundary.
 */
export function usePlantFilterContainer(ref: RefObject<HTMLElement | null>) {
  const [compact, setCompact] = useState(true)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    const update = (width: number) => setCompact(plantFiltersAreCompact(width))
    update(node.getBoundingClientRect().width)
    const observer = new ResizeObserver((entries) => {
      const entry = entries.find((candidate) => candidate.target === node)
      if (entry) update(entry.contentRect.width)
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [ref])

  return compact
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 text-[11px] font-bold uppercase tracking-[.05em] text-muted-foreground">
      <span>{label}</span>
      {children}
    </div>
  )
}

export function PlantAdvancedFilters({
  companyOptions,
  companies,
  onCompanies,
  plantFilters,
  onPlantFilter,
  sizeOptions,
  selectedSizes,
  onSizes,
  cultivarOptions,
  cultivars,
  onCultivars,
  cultivarOpen,
  onCultivarOpenChange,
  categoryOptions,
  categories,
  onCategories,
  stateOptions,
  states,
  onStates,
  compactForFocus,
  focusSourceRef,
  activeCount,
  onClear,
}: {
  companyOptions: string[]
  companies: string[]
  onCompanies: (next: string[]) => void
  plantFilters: Record<string, ColFilter>
  onPlantFilter: (key: string, value: ColFilter) => void
  sizeOptions: string[]
  selectedSizes: string[]
  onSizes: (next: string[]) => void
  cultivarOptions: string[]
  cultivars: string[]
  onCultivars: (next: string[]) => void
  cultivarOpen: boolean
  onCultivarOpenChange: (open: boolean) => void
  categoryOptions: string[]
  categories: string[]
  onCategories: (next: string[]) => void
  stateOptions: string[]
  states: string[]
  onStates: (next: string[]) => void
  compactForFocus: boolean
  focusSourceRef?: RefObject<HTMLElement | null>
  activeCount: number
  onClear: () => void
}) {
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const compactFields = useRef<HTMLDivElement>(null)
  const previousCompact = useRef(compactForFocus)
  const close = useCallback(() => {
    setOpen(false)
    if (compactForFocus && cultivarOpen) onCultivarOpenChange(false)
    requestAnimationFrame(() => trigger.current?.focus())
  }, [compactForFocus, cultivarOpen, onCultivarOpenChange])
  const pop = useOutsideClose(open, close)

  useEffect(() => {
    if (previousCompact.current === compactForFocus) return
    previousCompact.current = compactForFocus
    const active = document.activeElement
    const hiddenSource = compactForFocus ? focusSourceRef?.current : compactFields.current

    if (cultivarOpen) {
      if (compactForFocus) setOpen(true)
      requestAnimationFrame(() => {
        const visibleSource = compactForFocus ? compactFields.current : focusSourceRef?.current
        visibleSource?.querySelector<HTMLButtonElement>('[data-plant-cultivar] button')?.focus()
      })
      return
    }
    if (active && hiddenSource?.contains(active)) trigger.current?.focus()
  }, [compactForFocus, cultivarOpen, focusSourceRef])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      const nestedMenu = (event.target as HTMLElement).closest('[data-menu]')
      if (nestedMenu && nestedMenu !== pop.current) return
      event.preventDefault()
      close()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [close, open])

  return (
    <div ref={pop} data-menu className="static flex-none">
      <button
        ref={trigger}
        type="button"
        title="More filters"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={activeCount ? `More filters, ${activeCount} active` : 'More filters'}
        onClick={() => open ? close() : setOpen(true)}
        className={cn(
          'relative flex size-11 items-center justify-center rounded-full border bg-background hover:bg-muted',
          activeCount ? 'border-primary text-primary' : 'border-border text-foreground',
        )}
      >
        <SlidersHorizontal size={17} />
        {activeCount > 0 && (
          <span aria-hidden="true" className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
            {activeCount}
          </span>
        )}
      </button>
      {open && (
        <section
          role="dialog"
          aria-labelledby="plant-filters-title"
          className="lps-pop absolute right-2 top-[calc(100%+6px)] z-[98] max-h-[calc(100dvh-8rem)] w-[calc(100cqw-1rem)] max-w-[498px] overflow-y-auto rounded-xl border border-border bg-popover shadow-[var(--lps-shadow)]"
        >
          <div className="flex items-center justify-between gap-3 border-b border-border py-1.5 pl-3 pr-1.5">
            <div>
              <h2 id="plant-filters-title" className="text-sm font-bold text-foreground">More filters</h2>
              <p className="text-[11px] text-muted-foreground">Company, names, stock and dimensions</p>
            </div>
            <button type="button" onClick={close} aria-label="Close more filters" className="flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground">
              <X size={18} />
            </button>
          </div>
          <div className="grid min-w-0 grid-cols-1 gap-x-3 gap-y-2.5 p-3 @[480px]:grid-cols-2 @[640px]:grid-cols-3">
            <div
              ref={compactFields}
              data-plant-compact-filters
              className="contents @min-[900px]:hidden"
            >
              <Field label="Size">
                <MultiFilter
                  allLabel="Any size"
                  selectionLabel="Size"
                  accessibleName="Size"
                  options={sizeOptions}
                  selected={selectedSizes}
                  onChange={onSizes}
                  buttonClassName="min-h-11 px-2 normal-case tracking-normal"
                  filterPlaceholder="Filter sizes…"
                  largeTargets
                  menuClassName="w-full min-w-0 max-w-full"
                  wrapOptionLabels
                />
              </Field>
              <div data-plant-cultivar className="contents">
                <Field label="Cultivar">
                  <MultiFilter
                    allLabel="Any cultivar"
                    selectionLabel="Cultivar"
                    accessibleName="Cultivar"
                    options={cultivarOptions}
                    selected={cultivars}
                    onChange={onCultivars}
                    buttonClassName="min-h-11 px-2 normal-case tracking-normal"
                    filterPlaceholder="Filter cultivars…"
                    largeTargets
                    restoreFocusOnClose
                    open={cultivarOpen}
                    onOpenChange={onCultivarOpenChange}
                    menuClassName="w-full min-w-0 max-w-full"
                    wrapOptionLabels
                  />
                </Field>
              </div>
              <Field label="Supplier type">
                <MultiFilter
                  allLabel="Any type"
                  selectionLabel="Type"
                  accessibleName="Supplier type"
                  options={categoryOptions}
                  selected={categories}
                  onChange={onCategories}
                  buttonClassName="min-h-11 px-2 normal-case tracking-normal"
                  filterPlaceholder="Filter supplier types…"
                  largeTargets
                  menuClassName="w-full min-w-0 max-w-full"
                  wrapOptionLabels
                />
              </Field>
              <Field label="State">
                <MultiFilter
                  allLabel="Any state"
                  selectionLabel="State"
                  accessibleName="State"
                  options={stateOptions}
                  selected={states}
                  onChange={onStates}
                  buttonClassName="min-h-11 px-2 normal-case tracking-normal"
                  filterPlaceholder="Filter states…"
                  largeTargets
                  menuAlign="right"
                  menuClassName="w-full min-w-0 max-w-full"
                  wrapOptionLabels
                />
              </Field>
            </div>
            <Field label="Company">
              <MultiFilter
                allLabel="Any company"
                selectionLabel="Company"
                accessibleName="Company"
                options={companyOptions}
                selected={companies}
                onChange={onCompanies}
                buttonClassName="min-h-11 px-2 normal-case tracking-normal"
                filterPlaceholder="Filter companies…"
                largeTargets
                menuClassName="w-full min-w-0 max-w-full"
                wrapOptionLabels
              />
            </Field>
            {PLANT_ADVANCED_FILTER_KEYS.map((key) => {
              const col = PLANT_COLS.find((candidate) => candidate.key === key)!
              return (
                <Field key={key} label={col.label}>
                  <FilterControl
                    col={col}
                    value={plantFilters[key]}
                    options={[]}
                    onFilter={(value) => onPlantFilter(key, value)}
                    largeTargets
                  />
                </Field>
              )
            })}
          </div>
          <div className="flex justify-end border-t border-border px-3 py-2">
            <button type="button" onClick={onClear} className="min-h-11 rounded-lg border border-input bg-background px-3 text-[12px] font-semibold text-foreground hover:bg-muted">
              Clear all
            </button>
          </div>
        </section>
      )}
    </div>
  )
}
