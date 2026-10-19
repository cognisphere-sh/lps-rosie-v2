'use client'

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowLeft, PanelLeftClose, PanelLeftOpen, Search, X } from 'lucide-react'

import {
  FOCUSED_JOBS_RAIL_STORE,
  focusedJobsRailOpen,
  jobInboxRailPrimaryLine,
  type JobInboxViewRow,
} from '@/lib/job-inbox'
import { requestRef, requestStatusTone, toneDot, toneStyle } from '@/lib/job-requests'
import { formatWeekdayMonthDay } from '@/lib/format'
import { cn } from '@/lib/utils'

export const FOCUSED_JOBS_RAIL_ID = 'focused-jobs-rail'

export function FocusedJobsRailSearch({ value, onChange, matches, loading }: {
  value: string
  onChange: (value: string) => void
  matches: number
  loading: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div className="flex-none border-b border-border p-2">
      <div className="flex min-h-11 items-center rounded-lg border border-border bg-background focus-within:ring-2 focus-within:ring-ring">
        <Search aria-hidden="true" size={15} className="ml-3 flex-none text-muted-foreground" />
        <input
          ref={inputRef}
          type="search"
          aria-label="Search active jobs"
          aria-describedby="active-jobs-search-help"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Name, plant, notes…"
          className="min-h-11 min-w-0 flex-1 border-0 bg-transparent px-2 text-[12px] text-foreground outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:appearance-none"
        />
        {value && (
          <button
            type="button"
            aria-label="Clear job search"
            onClick={() => { onChange(''); inputRef.current?.focus() }}
            className="flex size-11 flex-none items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X aria-hidden="true" size={15} />
          </button>
        )}
      </div>
      <p id="active-jobs-search-help" className="sr-only">Search job names, JR references, customers, plants, sizes and job or plant notes. All search words must match.</p>
      {value.trim() && (
        <p role="status" className="m-0 px-1 pt-2 text-[11px] text-muted-foreground">
          {loading ? 'Loading active jobs…' : `${matches} matching ${matches === 1 ? 'job' : 'jobs'}`}
        </p>
      )}
    </div>
  )
}

export function FocusedJobsRailRow({
  row,
  selected,
  statusLabel,
  buttonRef,
  onSelect,
  ariaLabel,
}: {
  row: JobInboxViewRow
  selected: boolean
  statusLabel: string
  buttonRef?: (element: HTMLButtonElement | null) => void
  onSelect: () => void
  ariaLabel: string
}) {
  const primary = jobInboxRailPrimaryLine(row)
  const tone = requestStatusTone(row.status)
  const customer = row.customerCompany?.trim() || row.customerContact?.trim() || 'Unassigned customer'
  const retail = row.customerType === 'Homeowner/Retail'
  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onSelect}
      aria-label={ariaLabel}
      aria-current={selected ? 'page' : undefined}
      className={cn(
        'mb-1 min-h-11 w-full min-w-0 rounded-lg border border-transparent px-3 py-2 text-left outline-none transition-[background-color,color,border-color,box-shadow] duration-150 ease-lps hover:bg-lps-tint focus-visible:ring-2 focus-visible:ring-ring',
        selected && 'border-primary bg-lps-tint ring-1 ring-primary/20',
      )}
    >
      <span className="mb-1 flex items-center justify-between gap-2">
        <span className="inline-flex min-w-0 items-center gap-1.5 text-[11px] font-bold text-primary">
          <span className="shrink-0">{requestRef(row.id)}</span>
          <span className="truncate" title={`${retail ? 'Retail ' : ''}${customer}`}>· {retail ? 'Retail ' : ''}{customer}</span>
          {row.unread && <span aria-hidden="true" title="Unread messages" className="size-1.5 shrink-0 rounded-full bg-primary" />}
        </span>
        <span
          data-job-status={row.status}
          title={statusLabel}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-bold transition-colors duration-150 ease-lps"
          style={toneStyle(tone)}
        >
          <span aria-hidden="true" className="size-1.5 rounded-full transition-colors duration-150 ease-lps" style={{ background: toneDot(tone) }} />
          <span>{statusLabel}</span>
        </span>
      </span>
      <span className="flex min-w-0 items-baseline justify-between gap-2">
        <span
          data-focused-job-rail-primary
          className="min-w-0 truncate text-[13px] font-semibold leading-snug text-foreground"
          title={`${primary} · Created ${formatWeekdayMonthDay(row.createdAt) || '—'}`}
        >
          {row.name?.trim() || 'Unnamed job'}
        </span>
        <span data-focused-job-rail-dates className="shrink-0 text-[11px] text-muted-foreground">
          <span aria-label="Expected delivery date"><span className="font-semibold tabular-nums text-foreground">{formatWeekdayMonthDay(row.expectedInstallDate) || '—'}</span></span>
        </span>
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
