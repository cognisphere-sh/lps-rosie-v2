'use client'

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowLeft, PanelLeftClose, PanelLeftOpen } from 'lucide-react'

import {
  FOCUSED_JOBS_RAIL_STORE,
  focusedJobsRailOpen,
  jobInboxRailPrimaryLine,
  type JobInboxViewRow,
} from '@/lib/job-inbox'
import { cn } from '@/lib/utils'

export const FOCUSED_JOBS_RAIL_ID = 'focused-jobs-rail'

export function FocusedJobsRailRow({
  row,
  selected,
  statusLabel,
  activityLabel,
  buttonRef,
  onSelect,
  ariaLabel,
}: {
  row: JobInboxViewRow
  selected: boolean
  statusLabel: string
  activityLabel: string
  buttonRef?: (element: HTMLButtonElement | null) => void
  onSelect: () => void
  ariaLabel: string
}) {
  const primary = jobInboxRailPrimaryLine(row)
  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onSelect}
      aria-label={ariaLabel}
      aria-current={selected ? 'page' : undefined}
      className={cn(
        'mb-1 min-h-11 w-full rounded-xl border border-transparent px-3 py-2 text-left outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring',
        selected && 'border-border bg-muted',
      )}
    >
      <span
        data-focused-job-rail-primary
        className="block min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[12.5px] font-semibold text-foreground"
        title={primary}
      >
        {primary}
      </span>
      <span className="mt-1 flex min-w-0 items-center gap-1.5 text-[10.5px] text-muted-foreground">
        <span className="flex-none">{statusLabel}</span>
        <span aria-hidden>·</span>
        <span className="min-w-0 flex-1 truncate">{row.preview}</span>
        {row.unread && (
          <span className="flex-none rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-bold text-primary-foreground">
            New web chat
          </span>
        )}
      </span>
      <span className="mt-1 block truncate text-[10px] text-lps-dim">
        {activityLabel}{row.unread ? ' · Unread in team web chat' : ''}
      </span>
    </button>
  )
}

export function FocusedJobsRailLayout({
  desktop,
  mobile,
  onBack,
  rail,
  children,
}: {
  desktop: boolean
  mobile: boolean
  onBack: () => void
  rail: ReactNode
  children: ReactNode
}) {
  // SSR and hydration share this neutral state. The browser resolves the local
  // preference in a layout effect, before either 292px or 44px becomes visible.
  const [open, setOpen] = useState<boolean | null>(null)
  const railRef = useRef<HTMLElement>(null)
  const collapseRef = useRef<HTMLButtonElement>(null)
  const expandRef = useRef<HTMLButtonElement>(null)
  const useBrowserLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

  useBrowserLayoutEffect(() => {
    if (!desktop) {
      setOpen(null)
      return
    }
    try { setOpen(focusedJobsRailOpen(window.localStorage.getItem(FOCUSED_JOBS_RAIL_STORE))) } catch { setOpen(true) }
  }, [desktop])

  const setPreference = (next: boolean) => {
    const focusedInRail = railRef.current?.contains(document.activeElement) ?? false
    try { window.localStorage.setItem(FOCUSED_JOBS_RAIL_STORE, next ? '1' : '0') } catch { /* preference remains in memory */ }
    setOpen(next)
    if (next || focusedInRail) {
      requestAnimationFrame(() => (next ? collapseRef : expandRef).current?.focus({ preventScroll: true }))
    }
  }

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      {desktop && open === false && (
        <aside className="w-11 flex-none border-r border-border bg-card">
          <button
            ref={expandRef}
            type="button"
            title="Expand active jobs"
            aria-label="Expand active jobs"
            aria-expanded={false}
            aria-controls={FOCUSED_JOBS_RAIL_ID}
            onClick={() => setPreference(true)}
            className="flex size-11 items-center justify-center text-primary outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          >
            <PanelLeftOpen size={18} />
          </button>
        </aside>
      )}
      <section
        ref={railRef}
        id={FOCUSED_JOBS_RAIL_ID}
        data-rail-state={open === null ? 'unresolved' : open ? 'expanded' : 'collapsed'}
        aria-label="Active job inbox"
        aria-hidden={mobile || open !== true ? true : undefined}
        inert={mobile || open !== true ? true : undefined}
        className={cn(
          'flex w-full flex-none flex-col border-r border-border bg-card',
          'min-[900px]:w-[292px]',
          (mobile || open !== true) && 'hidden',
        )}
      >
        <div className="flex h-11 flex-none items-center border-b border-border">
          {desktop && open === true && (
            <button type="button" aria-label="Back to All jobs" onClick={onBack} className="flex size-11 flex-none items-center justify-center text-primary outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
              <ArrowLeft size={18}/>
            </button>
          )}
          <div className="min-w-0 flex-1 px-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Active jobs</div>
          {desktop && open === true && (
            <button
              ref={collapseRef}
              type="button"
              title="Collapse active jobs"
              aria-label="Collapse active jobs"
              aria-expanded={true}
              aria-controls={FOCUSED_JOBS_RAIL_ID}
              onClick={() => setPreference(false)}
              className="flex size-11 flex-none items-center justify-center text-primary outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            >
              <PanelLeftClose size={18} />
            </button>
          )}
        </div>
        {rail}
      </section>
      {children}
    </div>
  )
}
