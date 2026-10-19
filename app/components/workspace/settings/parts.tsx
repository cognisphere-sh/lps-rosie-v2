'use client'

import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

/** A titled block. Every settings section on this page is one of these. */
export function Panel({
  title,
  description,
  action,
  children,
}: {
  title: string
  description?: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-[13px] font-bold">{title}</h3>
          {description && (
            <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{description}</p>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-bold uppercase tracking-[.05em] text-lps-dim">{label}</span>
      {children}
    </label>
  )
}

export function StatusPill({
  ok,
  okLabel,
  offLabel,
}: {
  ok: boolean
  okLabel: string
  offLabel: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-colors duration-150 ease-lps',
        ok ? 'bg-secondary text-secondary-foreground' : 'bg-lps-warn-bg text-lps-warn-fg',
      )}
    >
      <span className={cn('size-1.5 rounded-full', ok ? 'bg-primary' : 'bg-lps-warn-dot')} />
      {ok ? okLabel : offLabel}
    </span>
  )
}

export function btn(kind: 'primary' | 'outline' | 'ghost') {
  return cn(
    'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-semibold transition-colors duration-150 disabled:opacity-50',
    kind === 'primary' && 'bg-primary text-primary-foreground transition-[opacity,transform,scale] duration-100 ease-lps hover:opacity-90 active:scale-[.97]',
    kind === 'outline' && 'border border-border bg-card hover:bg-muted',
    kind === 'ghost' && 'border border-border bg-card text-muted-foreground hover:bg-muted',
  )
}

export const inputClass =
  'min-w-0 flex-1 rounded-lg border border-border bg-card px-2.5 py-2 text-[12px] outline-none focus:border-primary'
