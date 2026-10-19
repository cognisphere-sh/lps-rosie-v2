'use client'

import { SlidersHorizontal, X } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useCallback, useEffect, useRef, useState } from 'react'

import { Input } from '@/components/ui/input'
import { MultiFilter, useOutsideClose } from '@/components/workspace/table-parts'
import { PARTNER_FILTER_OPTIONS, supplierFilterSummary, supplierFilterValues } from '@/lib/supplier-filters'
import type { ColFilters } from '@/lib/table-config'
import { cn } from '@/lib/utils'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 text-[11px] font-bold uppercase tracking-[.05em] text-muted-foreground">
      <span>{label}</span>
      {children}
    </div>
  )
}

export function SupplierFilters({
  mobile,
  filters,
  options,
  onFilter,
  onClear,
}: {
  mobile: boolean
  filters: ColFilters
  options: (key: string) => string[]
  onFilter: (key: string, value: string | string[]) => void
  onClear: () => void
}) {
  const [open, setOpen] = useState(false)
  const [portalNode, setPortalNode] = useState<HTMLElement | null>(null)
  const anchor = useRef<HTMLButtonElement>(null)
  const dialog = useRef<HTMLElement>(null)
  const firstField = useRef<HTMLInputElement>(null)
  const swipeStart = useRef<number | null>(null)
  const close = useCallback(() => {
    setOpen(false)
    requestAnimationFrame(() => anchor.current?.focus())
  }, [])
  // The dialog's own keydown handles Escape (and its focus trap).
  const pop = useOutsideClose(open && !mobile, close, false)
  const values = supplierFilterValues(filters)
  const advancedSummaries = supplierFilterSummary(values).filter(
    (summary) => !summary.startsWith('Type:') && !summary.startsWith('State:'),
  )

  // The mobile sheet is portalled beside the app, not nested inside it. That
  // lets the app be truly inert/hidden while the dialog remains interactive.
  useEffect(() => {
    if (!open || !mobile) return
    const portal = document.createElement('div')
    portal.dataset.supplierFilterPortal = 'true'
    document.body.appendChild(portal)
    setPortalNode(portal)

    const priorOverflow = document.body.style.overflow
    const background = [...document.body.children]
      .filter((node): node is HTMLElement => node instanceof HTMLElement && node !== portal)
      .map((node) => ({ node, inert: node.inert, ariaHidden: node.getAttribute('aria-hidden') }))
    document.body.style.overflow = 'hidden'
    for (const { node } of background) {
      node.inert = true
      node.setAttribute('aria-hidden', 'true')
    }

    return () => {
      document.body.style.overflow = priorOverflow
      for (const { node, inert, ariaHidden } of background) {
        node.inert = inert
        if (ariaHidden == null) node.removeAttribute('aria-hidden')
        else node.setAttribute('aria-hidden', ariaHidden)
      }
      portal.remove()
      setPortalNode(null)
    }
  }, [open, mobile])

  useEffect(() => {
    if (!open || (mobile && !portalNode)) return
    const frame = requestAnimationFrame(() => firstField.current?.focus())
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        close()
        return
      }
      if (event.key !== 'Tab' || !mobile) return
      const focusable = [...(dialog.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      ) ?? [])].filter((element) => !element.inert && element.getClientRects().length > 0)
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && (document.activeElement === first || !dialog.current?.contains(document.activeElement))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', keydown)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('keydown', keydown)
    }
  }, [open, mobile, portalNode, close])

  const body = (
    <>
      <div className={cn('border-b border-border px-4', mobile ? 'pb-2 pt-1' : 'py-2')}>
        {mobile && (
          <div
            aria-hidden="true"
            data-supplier-filter-handle
            className="mx-auto flex h-7 w-20 touch-none items-center justify-center"
            onPointerDown={(event) => {
              swipeStart.current = event.clientY
              event.currentTarget.setPointerCapture(event.pointerId)
            }}
            onPointerUp={(event) => {
              const shouldClose = swipeStart.current != null && event.clientY - swipeStart.current >= 70
              swipeStart.current = null
              if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId)
              }
              if (shouldClose) close()
            }}
            onPointerCancel={(event) => {
              swipeStart.current = null
              if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId)
              }
            }}
          >
            <span className="h-1 w-10 rounded-full bg-muted-foreground/35" />
          </div>
        )}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 id="supplier-filters-title" className="text-sm font-bold text-foreground">Advanced filters</h2>
            <p className="text-[11px] font-normal normal-case tracking-normal text-muted-foreground">Name, city and partner status</p>
          </div>
          <button type="button" onClick={close} aria-label="Close advanced filters" className="flex size-11 flex-none items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground">
            <X size={18} />
          </button>
        </div>
      </div>
      <div className={cn('grid gap-x-3 gap-y-4 p-4 min-[900px]:grid-cols-2', mobile && 'min-h-0 flex-1 overflow-y-auto')}>
        <Field label="Name contains">
          <Input
            ref={firstField}
            value={values.name}
            onChange={(event) => onFilter('name', event.target.value)}
            placeholder="Strict supplier name match…"
            aria-label="Name contains"
            className="h-11 normal-case tracking-normal"
          />
        </Field>
        <Field label="City">
          <MultiFilter allLabel="All cities" selectionLabel="City" options={options('city')} selected={values.city} onChange={(next) => onFilter('city', next)} buttonClassName="min-h-11 px-3 normal-case tracking-normal" filterPlaceholder="Search cities…" largeTargets />
        </Field>
        <fieldset className="min-w-0 min-[900px]:col-span-2">
          <legend className="mb-1.5 text-[11px] font-bold uppercase tracking-[.05em] text-muted-foreground">LPS Partner</legend>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(PARTNER_FILTER_OPTIONS).map(([label, value]) => {
              const selected = values.partner.includes(value)
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onFilter('lps_partner', selected ? [] : [value])}
                  className={cn('min-h-11 rounded-lg border px-3 text-[12px] font-semibold transition-colors duration-150 ease-lps', selected ? 'border-primary bg-secondary text-primary' : 'border-input bg-background text-foreground hover:bg-muted')}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </fieldset>
      </div>
      {mobile && (
        <div className="sticky bottom-0 grid grid-cols-2 gap-2 border-t border-border bg-popover px-4 py-3 pb-[calc(.75rem+env(safe-area-inset-bottom))]">
          <button type="button" onClick={onClear} className="min-h-11 rounded-lg border border-input bg-background px-3 text-[12px] font-semibold text-foreground hover:bg-muted">
            Clear all
          </button>
          <button type="button" onClick={close} className="min-h-11 rounded-lg bg-primary px-3 text-[12px] font-semibold text-primary-foreground transition-[opacity,transform,scale] duration-100 ease-lps hover:opacity-90 active:scale-[.97]">
            Show results
          </button>
        </div>
      )}
    </>
  )

  return (
    <div ref={pop} data-menu className="relative flex min-w-0 items-center gap-2 max-[899px]:w-full max-[899px]:flex-wrap">
      <div className="min-w-0 flex-1 min-[900px]:w-[170px] min-[900px]:flex-none">
        <MultiFilter allLabel="Supplier type" selectionLabel="Type" options={options('category')} selected={values.category} onChange={(next) => onFilter('category', next)} buttonClassName="min-h-11 rounded-full px-3 min-[900px]:min-h-9" filterPlaceholder="Search supplier types…" largeTargets />
      </div>
      <div className="min-w-0 flex-1 min-[900px]:w-[130px] min-[900px]:flex-none">
        <MultiFilter allLabel="State" selectionLabel="State" options={options('state')} selected={values.state} onChange={(next) => onFilter('state', next)} buttonClassName="min-h-11 rounded-full px-3 min-[900px]:min-h-9" filterPlaceholder="Search states…" largeTargets menuAlign="right" />
      </div>
      <button
        ref={anchor}
        type="button"
        title="Advanced filters"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={advancedSummaries.length ? `Advanced filters, ${advancedSummaries.length} active` : 'Advanced filters'}
        onClick={() => setOpen((value) => !value)}
        className="relative flex size-11 flex-none items-center justify-center rounded-full border border-border bg-background min-[900px]:size-9 text-foreground hover:bg-muted"
      >
        <SlidersHorizontal size={17} />
        {advancedSummaries.length > 0 && (
          <span aria-hidden="true" className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-bold text-primary-foreground">
            {advancedSummaries.length}
          </span>
        )}
      </button>
      {advancedSummaries.length > 0 && (
        <div aria-label="Active supplier filters" className="flex min-w-0 max-w-[240px] gap-1.5 overflow-x-auto whitespace-nowrap py-1 max-[899px]:w-full max-[899px]:max-w-none max-[899px]:basis-full">
          {advancedSummaries.map((summary) => <span key={summary} title={summary} className="max-w-[220px] flex-none truncate rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold text-secondary-foreground">{summary}</span>)}
        </div>
      )}
      {open && (mobile ? (portalNode && createPortal(
        <div role="presentation" data-supplier-filter-backdrop className="lps-scrim fixed inset-0 z-[115] flex items-end bg-black/45" onMouseDown={(event) => { if (event.target === event.currentTarget) close() }}>
          <section ref={dialog} role="dialog" aria-modal="true" aria-labelledby="supplier-filters-title" className="lps-pop lps-pop-dialog flex max-h-[88dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-border bg-popover shadow-[var(--lps-shadow)]">
            {body}
          </section>
        </div>,
        portalNode,
      )) : (
        <section ref={dialog} role="dialog" aria-labelledby="supplier-filters-title" className="lps-pop lps-pop-down absolute right-0 top-[calc(100%+6px)] z-[96] w-[480px] rounded-xl border border-border bg-popover shadow-[var(--lps-shadow)]">
          {body}
        </section>
      ))}
    </div>
  )
}
