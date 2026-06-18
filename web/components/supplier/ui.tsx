"use client"

import { cn } from "@/lib/utils"
import Link from "next/link"
import { Leaf, ArrowLeft } from "lucide-react"
import type { ReactNode } from "react"

type Tone = "neutral" | "info" | "warn" | "success" | "danger" | "muted"

const toneClasses: Record<Tone, string> = {
  neutral:
    "bg-secondary text-secondary-foreground border border-border",
  info:
    "bg-sky-100 text-sky-800 border border-sky-200 dark:bg-sky-950/40 dark:text-sky-200 dark:border-sky-800",
  warn:
    "bg-amber-100 text-amber-900 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800",
  success:
    "bg-primary/10 text-primary border border-primary/20 dark:bg-primary/20 dark:text-primary-foreground/90",
  danger:
    "bg-red-100 text-red-800 border border-red-200 dark:bg-red-950/40 dark:text-red-200 dark:border-red-800",
  muted:
    "bg-muted text-muted-foreground border border-border",
}

export function StatusPill({
  tone = "neutral",
  children,
  className,
}: {
  tone?: Tone
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium leading-none",
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

export function SourceDot({ source }: { source: "web" | "sms" | "email" }) {
  const map: Record<typeof source, { color: string; label: string }> = {
    web: { color: "bg-primary", label: "Web" },
    sms: { color: "bg-sky-500", label: "SMS" },
    email: { color: "bg-amber-500", label: "Email" },
  }
  const cfg = map[source]
  return (
    <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
      <span className={cn("h-1.5 w-1.5 rounded-full", cfg.color)} />
      {cfg.label}
    </span>
  )
}

export function V2Header({
  title,
  subtitle,
  backHref = "/",
  backLabel = "Back to overview",
  right,
}: {
  title: string
  subtitle?: string
  backHref?: string
  backLabel?: string
  right?: ReactNode
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/65">
      <div className="flex w-full items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href={backHref}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={backLabel}
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent">
            <Leaf className="h-4 w-4 text-accent-foreground" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold leading-tight sm:text-base">
              {title}
            </h1>
            {subtitle && (
              <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">{right}</div>
      </div>
    </header>
  )
}

export function formatCurrency(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" })
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function formatRelative(iso: string) {
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  const mins = Math.round(diff / 60_000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days}d ago`
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}
