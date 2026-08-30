'use client'

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowLeft, PanelLeftClose, PanelLeftOpen } from 'lucide-react'

import { FOCUSED_JOBS_RAIL_STORE, focusedJobsRailOpen } from '@/lib/job-inbox'
import { cn } from '@/lib/utils'

export const FOCUSED_JOBS_RAIL_ID = 'focused-jobs-rail'

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
