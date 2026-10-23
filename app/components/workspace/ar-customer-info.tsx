'use client'

import { Check, LoaderCircle, Share2 } from 'lucide-react'
import { useId } from 'react'

import type { ARDetail } from '@/lib/availability'
import { cn } from '@/lib/utils'

export type CustomerInfoState = {
  phase: 'ready' | 'saving' | 'checking' | 'error' | 'unknown'
  confirmed: boolean | null
  intent: boolean | null
  message: string
}

/** Admin-only, selected-AR disclosure preference; never a public-link action. */
export function ARCustomerInfo({ ar, state, onToggle, onReconcile }: {
  ar: ARDetail
  state: CustomerInfoState
  onToggle: (next: boolean) => void
  onReconcile: () => void
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
      className="min-w-0 rounded-xl border border-border bg-card px-3 py-2.5">
      <div className="flex min-w-0 items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="m-0 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Customer info · AR-{ar.id}</p>
          <p className="m-0 break-words text-[13px] font-semibold text-foreground">{ar.supplierName}</p>
          <p id={`${description}-state`} role="status" aria-live="polite" className="m-0 mt-1 text-[12px] text-muted-foreground">
            {label}{(busy || uncertain) && state.confirmed != null ? ` · Last confirmed ${state.confirmed ? 'on' : 'off'}` : ''}
            {ar.status === 'closed' ? ' · Closed — read-only' : ar.status === 'draft' ? ' · Draft preference, not published' : ''}
          </p>
        </div>
        <button type="button" aria-label={`Share customer info for AR-${ar.id} · ${ar.supplierName}`}
          aria-pressed={state.confirmed === true} aria-describedby={`${description}-state ${description}`} aria-busy={busy}
          disabled={disabled} onClick={() => onToggle(!state.confirmed)}
          className={cn('inline-flex min-h-11 min-w-11 flex-none items-center justify-center gap-1.5 rounded-lg border px-2.5 text-[13px] font-bold outline-offset-4 focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed',
            applied ? 'border-emerald-600/50 bg-emerald-600/15 text-emerald-700 dark:text-emerald-300' : 'border-border bg-lps-tint text-muted-foreground')}>
          {busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Share2 className="size-4" aria-hidden="true" />}
          CI{applied && <Check className="size-4" aria-hidden="true" />}
        </button>
      </div>
      <details className="mt-1 text-[12px] text-muted-foreground">
        <summary className="flex min-h-11 cursor-pointer items-center rounded-md font-semibold outline-offset-2 focus-visible:outline-2 focus-visible:outline-primary">What does CI share?</summary>
        <p id={description} className="m-0 break-words leading-5">Customer info (CI) shares this request’s customer contact and delivery details with this supplier and anyone holding an already-valid public link. It does not create or send a link, or publish a draft. Off does not hide names or notes entered elsewhere, or erase details already received.</p>
      </details>
      {state.message && <p role="alert" className="m-0 break-words text-[12px] text-destructive">{state.message}</p>}
      {(uncertain || state.phase === 'error') && (
        <button type="button" onClick={onReconcile} disabled={busy}
          className="mt-1 min-h-11 rounded-lg border border-border px-3 text-[12px] font-semibold outline-offset-2 focus-visible:outline-2 focus-visible:outline-primary">
          Check saved state
        </button>
      )}
    </section>
  )
}
