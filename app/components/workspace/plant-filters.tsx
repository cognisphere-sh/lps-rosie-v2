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
export const PLANT_QUICK_FILTER_MIN_WIDTH = 1024
/** Wide row excluding Search and summary: padding/inset, gaps, four quick tracks, Filters and action. */
export const PLANT_WIDE_TOOLBAR_CHROME_WIDTH = 513
/** Shared selector chrome for the visible Plant Search toolbar. */
export const PLANT_TOOLBAR_SELECT_CLASS = 'h-11 gap-1 rounded-md border-input bg-background px-1 text-[11px] font-medium shadow-none transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-background'

export const estimatePlantSummaryWidth = (summary: string) => Math.max(140, summary.length * 7)
export const plantWideToolbarMinWidth = (panelWidth: number, summary: string) => Math.max(
  PLANT_QUICK_FILTER_MIN_WIDTH,
  panelWidth + PLANT_WIDE_TOOLBAR_CHROME_WIDTH + estimatePlantSummaryWidth(summary),
)
export const plantFiltersAreCompact = (width: number, panelWidth: number, summary: string) =>
  width < plantWideToolbarMinWidth(panelWidth, summary)

/**
 * CSS owns the safe base 1024px branch from first paint. The observed content
 * box adds a synchronous render-time overflow override for live panel width and
 * exact summary text; focus/open coordination consumes the same resolved mode.
 */
export function usePlantFilterContainer(
  ref: RefObject<HTMLElement | null>,
  panelWidth: number,
  summary: string,
) {
  const [width, setWidth] = useState<number | null>(null)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    // Toolbar owns an unpadded container wrapper, so clientWidth and the
    // observer's content box are the same inline measurement CSS queries use.
    setWidth(node.clientWidth)
    const observer = new ResizeObserver((entries) => {
      const entry = entries.find((candidate) => candidate.target === node)
      if (entry) setWidth(entry.contentRect.width)
    })
    observer.observe(node, { box: 'content-box' })
    return () => observer.disconnect()
  }, [ref])

  return width === null ? null : plantFiltersAreCompact(width, panelWidth, summary)
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
  cultivarOptions,
  cultivars,
  onCultivars,
  cultivarOpenOwner,
  onCultivarOpenOwnerChange,
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
  cultivarOptions: string[]
  cultivars: string[]
  onCultivars: (next: string[]) => void
  cultivarOpenOwner: 'wide' | 'compact' | null
  onCultivarOpenOwnerChange: (owner: 'wide' | 'compact' | null) => void
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
  const focusFrame = useRef<number | null>(null)
  const focusGeneration = useRef(0)
  const pendingFocus = useRef<{
    target: 'advanced' | 'cultivar'
    compact: boolean
    owner: 'wide' | 'compact' | null
    dialogOpen: boolean
  } | null>(null)
  const focusRequest = useRef<{
    intent: NonNullable<typeof pendingFocus.current>
    source: { compact: boolean; owner: 'wide' | 'compact' | null; dialogOpen: boolean }
  } | null>(null)
  const currentFocusState = useRef({ compact: compactForFocus, owner: cultivarOpenOwner, dialogOpen: open })
  currentFocusState.current = { compact: compactForFocus, owner: cultivarOpenOwner, dialogOpen: open }

  const cancelScheduledFocus = useCallback(() => {
    focusGeneration.current += 1
    if (focusFrame.current !== null) cancelAnimationFrame(focusFrame.current)
    focusFrame.current = null
  }, [])

  const scheduleFocus = useCallback((intent: NonNullable<typeof pendingFocus.current>) => {
    cancelScheduledFocus()
    const generation = focusGeneration.current
    const frame = requestAnimationFrame(() => {
      const current = currentFocusState.current
      if (
        focusGeneration.current !== generation ||
        focusFrame.current !== frame ||
        current.compact !== intent.compact ||
        current.owner !== intent.owner ||
        current.dialogOpen !== intent.dialogOpen
      ) return
      focusFrame.current = null
      const source = intent.compact ? compactFields.current : focusSourceRef?.current
      const target = intent.target === 'advanced'
        ? trigger.current
        : source?.querySelector<HTMLButtonElement>('[data-plant-cultivar] button')
      target?.focus()
    })
    focusFrame.current = frame
  }, [cancelScheduledFocus, focusSourceRef])

  const close = useCallback(() => {
    cancelScheduledFocus()
    pendingFocus.current = null
    focusRequest.current = null
    const nextOwner = compactForFocus && cultivarOpenOwner === 'compact' ? null : cultivarOpenOwner
    focusRequest.current = {
      source: currentFocusState.current,
      intent: {
        target: 'advanced', compact: compactForFocus, owner: nextOwner, dialogOpen: false,
      },
    }
    setOpen(false)
    if (nextOwner !== cultivarOpenOwner) onCultivarOpenOwnerChange(nextOwner)
  }, [cancelScheduledFocus, compactForFocus, cultivarOpenOwner, onCultivarOpenOwnerChange])
  const openDialog = useCallback(() => {
    cancelScheduledFocus()
    pendingFocus.current = null
    focusRequest.current = null
    setOpen(true)
  }, [cancelScheduledFocus])
  const pop = useOutsideClose(open, close)

  useEffect(() => {
    if (previousCompact.current === compactForFocus) return
    cancelScheduledFocus()
    pendingFocus.current = null
    focusRequest.current = null
    previousCompact.current = compactForFocus
    const active = document.activeElement
    const hiddenSource = compactForFocus ? focusSourceRef?.current : compactFields.current

    if (cultivarOpenOwner) {
      const nextOwner = compactForFocus ? 'compact' : 'wide'
      focusRequest.current = {
        source: currentFocusState.current,
        intent: {
          target: 'cultivar', compact: compactForFocus, owner: nextOwner, dialogOpen: true,
        },
      }
      if (compactForFocus) setOpen(true)
      if (cultivarOpenOwner !== nextOwner) onCultivarOpenOwnerChange(nextOwner)
      return
    }
    const foldedWideControl = compactForFocus && active instanceof HTMLElement
      ? active.closest('[data-plant-folded-filter]')
      : null
    if (active && hiddenSource?.contains(active) && (!compactForFocus || foldedWideControl)) {
      trigger.current?.focus()
    }
  }, [cancelScheduledFocus, compactForFocus, cultivarOpenOwner, focusSourceRef, onCultivarOpenOwnerChange])

  useEffect(() => {
    cancelScheduledFocus()
    const current = currentFocusState.current
    const sameState = (candidate: { compact: boolean; owner: 'wide' | 'compact' | null; dialogOpen: boolean }) =>
      candidate.compact === current.compact &&
      candidate.owner === current.owner &&
      candidate.dialogOpen === current.dialogOpen

    const intent = pendingFocus.current
    if (intent) {
      if (!sameState(intent)) {
        pendingFocus.current = null
        return cancelScheduledFocus
      }
      pendingFocus.current = null
      scheduleFocus(intent)
      return cancelScheduledFocus
    }

    const request = focusRequest.current
    if (!request) return cancelScheduledFocus
    if (sameState(request.intent)) {
      focusRequest.current = null
      pendingFocus.current = request.intent
      const committedIntent = pendingFocus.current
      pendingFocus.current = null
      scheduleFocus(committedIntent)
      return cancelScheduledFocus
    }
    // A request may survive exactly its own state update: before React commits,
    // the current state is still the captured source. Any third state means the
    // request was superseded and can never be allowed to become valid later.
    if (!sameState(request.source)) focusRequest.current = null
    return cancelScheduledFocus
  }, [cancelScheduledFocus, compactForFocus, cultivarOpenOwner, open, scheduleFocus])

  useEffect(() => () => {
    pendingFocus.current = null
    focusRequest.current = null
    cancelScheduledFocus()
  }, [cancelScheduledFocus])

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
        onClick={() => open ? close() : openDialog()}
        className={cn(
          'relative flex size-11 items-center justify-center rounded-md border border-input bg-background shadow-none transition-[color,box-shadow] outline-none hover:bg-muted focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-background',
          activeCount ? 'text-primary' : 'text-foreground',
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
              className={cn('contents @min-[1024px]:hidden', compactForFocus && '@min-[1024px]:!contents')}
            >
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
                    open={cultivarOpenOwner === 'compact'}
                    onOpenChange={(next) => {
                      cancelScheduledFocus()
                      pendingFocus.current = null
                      focusRequest.current = null
                      onCultivarOpenOwnerChange(next ? 'compact' : null)
                    }}
                    menuClassName="w-full min-w-0 max-w-full"
                    wrapOptionLabels
                  />
                </Field>
              </div>
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
