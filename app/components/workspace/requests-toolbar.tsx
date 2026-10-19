'use client'

import { ListFilter } from 'lucide-react'
import { createPortal } from 'react-dom'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import { Input } from '@/components/ui/input'
import { CloseIcon } from '@/components/workspace/icons'
import { PageControls, Toolbar, type Chip, type Pagination } from '@/components/workspace/toolbar'
import { cn } from '@/lib/utils'

const sameSet = (a: string[], b: string[]) =>
  a.length === b.length && a.every((value) => b.includes(value))

/** Count narrowed filter groups, treating the current status set as baseline. */
export const mobileRequestFilterChips = (chips: Chip[]): Chip[] =>
  chips.filter((chip) => chip.label !== 'Item status')

export function requestFilterActiveCount(chips: Chip[], statusBaseline: string[]) {
  return chips.reduce((count, chip) => {
    const active = chip.label === 'Status'
      ? !sameSet(chip.values, statusBaseline)
      : chip.values.length > 0
    return count + Number(active)
  }, 0)
}

/** Neutral on SSR/hydration; only a resolved viewport may own interactive toolbar controls. */
export function useResolvedRequestsMobile() {
  const [mobile, setMobile] = useState<boolean | null>(null)
  useEffect(() => {
    const media = window.matchMedia('(max-width: 899px)')
    const sync = () => setMobile(media.matches)
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])
  return mobile
}

function FilterGroup({ chip }: { chip: Chip }) {
  if (chip.single) {
    return (
      <fieldset className="min-w-0">
        <legend className="mb-1.5 text-[11px] font-bold uppercase tracking-[.05em] text-muted-foreground">
          {chip.label}
        </legend>
        <div className="grid min-w-0 grid-cols-1 gap-1 sm:grid-cols-2">
          {[chip.allLabel, ...chip.options].map((option) => {
            const all = option === chip.allLabel
            const checked = all ? chip.values.length === 0 : chip.values[0] === option
            return (
              <label
                key={option}
                className="flex min-h-11 min-w-0 cursor-pointer items-center gap-2 rounded-lg px-2 text-[13px] text-foreground hover:bg-muted"
              >
                <input
                  type="radio"
                  name={`requests-${chip.label}`}
                  checked={checked}
                  onChange={() => chip.onChange(all ? [] : [option])}
                  className="size-4 flex-none accent-[var(--primary)]"
                />
                <span className="min-w-0 break-words">{option}</span>
              </label>
            )
          })}
        </div>
      </fieldset>
    )
  }

  return (
    <fieldset className="min-w-0">
      <legend className="sr-only">{chip.label}</legend>
      <div className="mb-1.5 flex min-w-0 items-center justify-between gap-2">
        <span aria-hidden="true" className="text-[11px] font-bold uppercase tracking-[.05em] text-muted-foreground">
          {chip.label}
        </span>
        {chip.selectAllActions ? <div className="flex items-center gap-2">
          <button type="button" onClick={() => chip.onChange([...chip.options])} className="min-h-11 px-2 text-[12px] font-semibold text-muted-foreground underline">Select all</button>
          <button type="button" onClick={() => chip.onChange([])} className="min-h-11 px-2 text-[12px] font-semibold text-muted-foreground underline">Deselect all</button>
        </div> : (
        <button
          type="button"
          onClick={() => chip.onChange([])}
          className="min-h-11 flex-none cursor-pointer border-none bg-transparent px-2 text-[12px] font-semibold text-muted-foreground underline"
        >
          {chip.allLabel}
        </button>)}
      </div>
      <div className="grid min-w-0 grid-cols-1 gap-1 sm:grid-cols-2">
        {chip.options.map((option) => (
          <label
            key={option}
            className="flex min-h-11 min-w-0 cursor-pointer items-center gap-2 rounded-lg px-2 text-[13px] text-foreground hover:bg-muted"
          >
            <input
              type="checkbox"
              checked={chip.values.includes(option)}
              onChange={() => chip.onChange(
                chip.values.includes(option)
                  ? chip.values.filter((value) => value !== option)
                  : [...chip.values, option],
              )}
              className="size-4 flex-none accent-[var(--primary)]"
            />
            <span className="min-w-0 break-words">{option}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

interface BackgroundState {
  node: HTMLElement
  inert: boolean
  hadInert: boolean
  ariaHidden: string | null
}

export function RequestFilters({
  chips,
  statusBaseline,
  onClear,
  onOpenChange,
}: {
  chips: Chip[]
  statusBaseline: string[]
  onClear: () => void
  onOpenChange?: (open: boolean) => void
}) {
  const [open, setOpen] = useState(false)
  const [portalNode, setPortalNode] = useState<HTMLElement | null>(null)
  const visibleChips = useMemo(() => mobileRequestFilterChips(chips), [chips])
  const trigger = useRef<HTMLButtonElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  const surface = useRef<HTMLDivElement>(null)
  const restoreFrame = useRef<number | null>(null)
  const activeCount = useMemo(
    () => requestFilterActiveCount(visibleChips, statusBaseline),
    [visibleChips, statusBaseline],
  )

  const dismiss = useCallback((restoreFocus = true) => {
    setOpen(false)
    setPortalNode(null)
    onOpenChange?.(false)
    if (!restoreFocus) return
    if (restoreFrame.current != null) cancelAnimationFrame(restoreFrame.current)
    restoreFrame.current = requestAnimationFrame(() => {
      restoreFrame.current = null
      const target = trigger.current
      if (target?.isConnected && !target.closest('[inert], [aria-hidden="true"]')) target.focus()
    })
  }, [onOpenChange])

  // The dialog must be a sibling of the app before the app can be made inert.
  useEffect(() => {
    if (!open) return
    const portal = document.createElement('div')
    portal.dataset.requestFilterPortal = 'true'
    document.body.appendChild(portal)
    setPortalNode(portal)

    const priorOverflow = document.body.style.overflow
    const background: BackgroundState[] = [...document.body.children]
      .filter((node): node is HTMLElement => node instanceof HTMLElement && node !== portal)
      .map((node) => ({
        node,
        inert: node.inert,
        hadInert: node.hasAttribute('inert'),
        ariaHidden: node.getAttribute('aria-hidden'),
      }))
    document.body.style.overflow = 'hidden'
    for (const state of background) {
      state.node.inert = true
      state.node.setAttribute('inert', '')
      state.node.setAttribute('aria-hidden', 'true')
    }

    return () => {
      document.body.style.overflow = priorOverflow
      for (const state of background) {
        state.node.inert = state.inert
        if (state.hadInert) state.node.setAttribute('inert', '')
        else state.node.removeAttribute('inert')
        if (state.ariaHidden == null) state.node.removeAttribute('aria-hidden')
        else state.node.setAttribute('aria-hidden', state.ariaHidden)
      }
      portal.remove()
    }
  }, [open])

  useEffect(() => {
    if (!open || !portalNode) return
    const focusFrame = requestAnimationFrame(() => closeButton.current?.focus())
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        dismiss()
        return
      }
      if (event.key !== 'Tab' || !surface.current) return
      const focusable = [...surface.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      )].filter((element) => !element.inert && !element.closest('[inert], [aria-hidden="true"]'))
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && (document.activeElement === first || !surface.current.contains(document.activeElement))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      cancelAnimationFrame(focusFrame)
      document.removeEventListener('keydown', onKeyDown, true)
    }
  }, [dismiss, open, portalNode])

  useEffect(() => () => {
    if (restoreFrame.current != null) cancelAnimationFrame(restoreFrame.current)
  }, [])

  const accessibleName = activeCount ? `Filters, ${activeCount} active` : 'Filters'
  const controlsId = 'request-filter-surface'

  return (
    <>
      <button
        ref={trigger}
        type="button"
        title="Filters"
        aria-haspopup="dialog"
        aria-label={accessibleName}
        aria-expanded={open}
        aria-controls={controlsId}
        onClick={() => {
          setOpen(true)
          onOpenChange?.(true)
        }}
        className={cn(
          'relative flex size-11 flex-none cursor-pointer items-center justify-center rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          activeCount
            ? 'border-primary bg-secondary text-primary'
            : 'border-border bg-card text-muted-foreground',
        )}
      >
        <ListFilter size={18} aria-hidden="true" />
        {activeCount > 0 && (
          <span
            aria-hidden="true"
            className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-bold text-primary-foreground"
          >
            {activeCount}
          </span>
        )}
      </button>
      {open && portalNode && createPortal(
        <div
          role="presentation"
          data-request-filter-backdrop
          className="fixed inset-0 z-[115] flex items-end justify-center bg-black/40 p-2 sm:items-center"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) dismiss()
          }}
        >
          <div
            ref={surface}
            id={controlsId}
            role="dialog"
            aria-modal="true"
            aria-labelledby="request-filter-title"
            className="lps-pop max-h-[calc(100dvh-1rem)] w-full max-w-lg overflow-y-auto overflow-x-hidden rounded-2xl border border-border bg-popover p-3 shadow-[var(--lps-shadow)]"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between gap-2 bg-popover pb-2">
              <h2 id="request-filter-title" className="text-[16px] font-bold text-foreground">
                Filters
              </h2>
              <button
                ref={closeButton}
                type="button"
                aria-label="Close filters"
                onClick={() => dismiss()}
                className="flex size-11 cursor-pointer items-center justify-center rounded-lg border-none bg-transparent text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <CloseIcon size={16} />
              </button>
            </div>
            <div className="flex min-w-0 flex-col gap-4">
              {visibleChips.map((chip) => <FilterGroup key={chip.label} chip={chip} />)}
            </div>
            <div className="mt-4 flex justify-end border-t border-border pt-3">
              <button
                type="button"
                onClick={onClear}
                className="min-h-11 cursor-pointer rounded-full border border-border bg-card px-4 text-[13px] font-semibold text-foreground"
              >
                Clear all filters
              </button>
            </div>
          </div>
        </div>,
        portalNode,
      )}
    </>
  )
}

/** Exactly one resolved branch owns controls; unresolved hydration stays neutral. */
export function RequestsToolbar({
  placeholder,
  query,
  onQuery,
  chips,
  statusBaseline,
  controls,
  rightActions,
  hasFilters,
  onClear,
  summary,
  pagination,
  resolvedMobile,
}: {
  placeholder: string
  query: string
  onQuery: (value: string) => void
  chips: Chip[]
  statusBaseline: string[]
  controls: React.ReactNode
  rightActions?: React.ReactNode
  hasFilters: boolean
  onClear: () => void
  summary: string
  pagination?: Pagination
  /** The page's single resolved 899/900 breakpoint; null is hydration-neutral. */
  resolvedMobile: boolean | null
}) {
  const mobile = resolvedMobile
  const branch = useRef<HTMLDivElement>(null)
  const previousMobile = useRef<boolean | null>(null)
  const toolbarOwnedFocus = useRef(false)
  const mobileFiltersOpen = useRef(false)
  const focusGeneration = useRef(0)
  const handleMobileFiltersOpenChange = useCallback((open: boolean) => {
    mobileFiltersOpen.current = open
  }, [])

  useEffect(() => {
    const before = previousMobile.current
    previousMobile.current = mobile
    const transfer = toolbarOwnedFocus.current || mobileFiltersOpen.current
    toolbarOwnedFocus.current = false
    mobileFiltersOpen.current = false
    const generation = ++focusGeneration.current
    if (before == null || mobile == null || before === mobile || !transfer) return
    const frame = requestAnimationFrame(() => {
      if (generation !== focusGeneration.current) return
      const owner = branch.current
      const active = document.activeElement as HTMLElement | null
      const connectedOutside = !!active && active !== document.body && active.isConnected && !owner?.contains(active)
      const unrelatedModal = [...document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]')]
        .some((dialog) => !owner?.contains(dialog))
      if (connectedOutside || unrelatedModal) return
      owner?.querySelector<HTMLInputElement>('input[type="text"], input:not([type])')?.focus()
    })
    return () => {
      focusGeneration.current += 1
      cancelAnimationFrame(frame)
    }
  }, [mobile])

  const focusOwnership = {
    onFocusCapture: () => { toolbarOwnedFocus.current = true },
    onBlurCapture: (event: React.FocusEvent<HTMLDivElement>) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
        toolbarOwnedFocus.current = false
      }
    },
  }

  if (mobile == null) {
    return (
      <div
        data-requests-toolbar-branch="neutral"
        aria-hidden="true"
        className="h-[65px] flex-none border-b border-border bg-card"
      />
    )
  }

  if (mobile) {
    return (
      <div
        ref={branch}
        {...focusOwnership}
        data-requests-toolbar-branch="mobile"
        className="flex w-full max-w-full min-w-0 flex-none flex-col gap-2 border-b border-border bg-card px-3 py-2.5"
      >
        <div data-request-mobile-search-row className="flex min-w-0 flex-nowrap items-center gap-2">
          <div className="min-w-0 flex-1">
            <Input
              value={query}
              onChange={(event) => onQuery(event.target.value)}
              placeholder="Search jobs…"
              aria-label={placeholder}
              className="h-11"
            />
          </div>
          <RequestFilters
            chips={chips}
            statusBaseline={statusBaseline}
            onClear={onClear}
            onOpenChange={handleMobileFiltersOpenChange}
          />
        </div>
        {summary && <div className="text-[11px] text-muted-foreground">{summary}</div>}
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {controls}
          {pagination && pagination.pageCount > 1 && <PageControls {...pagination} />}
        </div>
      </div>
    )
  }

  return (
    <div ref={branch} {...focusOwnership} data-requests-toolbar-branch="desktop" className="flex-none">
      <Toolbar
        singleRow
        rightActions={rightActions}
        placeholder={placeholder}
        query={query}
        onQuery={onQuery}
        chips={chips}
        hasFilters={hasFilters}
        onClear={onClear}
        summary={summary}
        pagination={pagination}
        controls={controls}
      />
    </div>
  )
}
