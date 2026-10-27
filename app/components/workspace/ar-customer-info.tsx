'use client'

import { Check, LoaderCircle } from 'lucide-react'
import { useId, type ReactNode } from 'react'

import type { ARDetail } from '@/lib/availability'
import { cn } from '@/lib/utils'

export type CustomerInfoState = {
  phase: 'ready' | 'saving' | 'checking' | 'error' | 'unknown'
  confirmed: boolean | null
  intent: boolean | null
  message: string
}

/**
 * The job page's AR card (2026-10-26): one row of the card's own controls
 * (status, Copy availability) and the admin-only, selected-AR **Share
 * Customer Info** switch — a disclosure preference, never a public-link action.
 */
export function ARCustomerInfo({ ar, state, onToggle, onReconcile, actions }: {
  ar: ARDetail
  state: CustomerInfoState
  onToggle: (next: boolean) => void
  onReconcile: () => void
  /** The AR card's controls left of the switch: its status and Copy availability. */
  actions?: ReactNode
}) {
  const description = useId()
  const busy = state.phase === 'saving' || state.phase === 'checking'
  const uncertain = state.phase === 'unknown'
  const applied = !busy && !uncertain && state.confirmed === true
  const disabled = busy || uncertain || state.confirmed == null || ar.status === 'closed'
  const label = busy ? state.phase === 'checking' ? 'Checking saved state…' : `Saving ${state.intent ? 'on' : 'off'}…`
    : uncertain ? 'Saved state unknown' : state.confirmed ? 'Saved on' : 'Saved off'
  return (
    <section aria-label={`Customer info for AR-${ar.id} · ${ar.supplierName}`}
      className="min-w-0 rounded-xl border border-border bg-card px-3 py-2">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {actions}
        <button type="button" role="switch" aria-label={`Share customer info for AR-${ar.id} · ${ar.supplierName}`}
          aria-checked={applied} aria-describedby={`${description}-state`} aria-busy={busy}
          disabled={disabled} onClick={() => onToggle(!state.confirmed)}
          className="relative ml-auto inline-flex flex-none cursor-pointer items-center gap-2 whitespace-nowrap rounded-md text-[12px] font-semibold text-foreground outline-offset-2 focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:after:absolute pointer-coarse:after:-inset-2.5 pointer-coarse:after:content-['']">
          Share info
          <span aria-hidden="true" className={cn('inline-flex h-5 w-9 flex-none items-center rounded-full p-0.5 transition-colors duration-150 ease-lps',
            applied ? 'bg-emerald-600' : 'bg-input')}>
            <span className={cn('flex size-4 items-center justify-center rounded-full bg-card shadow-sm transition-transform duration-150 ease-lps',
              applied ? 'translate-x-4 text-emerald-700' : 'translate-x-0 text-muted-foreground')}>
              {busy ? <LoaderCircle className="size-3 animate-spin" /> : applied && <Check className="size-3" />}
            </span>
          </span>
        </button>
      </div>
      <p id={`${description}-state`} role="status" aria-live="polite" className="sr-only">
        {label}{(busy || uncertain) && state.confirmed != null ? ` · Last confirmed ${state.confirmed ? 'on' : 'off'}` : ''}
        {ar.status === 'closed' ? ' · Closed — read-only' : ar.status === 'draft' ? ' · Draft preference, not published' : ''}
      </p>
      {state.message && <p role="alert" className="m-0 mt-1 break-words text-[12px] text-destructive">{state.message}</p>}
      {(uncertain || state.phase === 'error') && (
        <button type="button" onClick={onReconcile} disabled={busy}
          className="mt-1 min-h-11 rounded-lg border border-border px-3 text-[12px] font-semibold outline-offset-2 focus-visible:outline-2 focus-visible:outline-primary">
          Check saved state
        </button>
      )}
    </section>
  )
}
