import type { CSSProperties, ReactNode } from 'react'

import { ChevronDown } from '@/components/workspace/icons'
import { toneDot, toneStyle, type Tone } from '@/lib/job-requests'
import { cn } from '@/lib/utils'

export type LineCardCell = { key: string; label: string; node: ReactNode }

/**
 * The phone line card shared by a job's request items, an availability
 * request's lines and an order's lines: `Qty × Size Plant name` on top, an optional full-width
 * note, then one row of labelled cells (header over value), then any extras.
 * The callers supply the controls; this owns the geometry, so the cards
 * cannot drift apart.
 */
export function LineCard({
  accent,
  background,
  ariaLabel,
  leading,
  trailing,
  qty,
  size,
  name,
  note,
  cells,
  children,
  as: Tag = 'div',
  ...attrs
}: {
  /** Left-edge colour, the line's status tone. */
  accent: string
  background?: string
  ariaLabel?: string
  /** Before the quantity — the select checkbox. */
  leading?: ReactNode
  /** After the plant name — the delete button. */
  trailing?: ReactNode
  qty: ReactNode
  size: ReactNode
  name: ReactNode
  /** Full width under the first row. */
  note?: ReactNode
  cells: LineCardCell[]
  children?: ReactNode
  as?: 'div' | 'article'
} & Record<`data-${string}`, string | boolean | undefined>) {
  const style: CSSProperties = { borderLeft: `3px solid ${accent}`, background }
  return (
    <Tag
      {...attrs}
      aria-label={ariaLabel}
      className="flex min-w-0 flex-col gap-1 overflow-hidden rounded-xl border border-border px-3 py-1.5 shadow-sm [overflow-wrap:anywhere]"
      style={style}
    >
      {/* Centred on one axis, so a plant name that wraps keeps Qty × Size
          level with its middle; the quantity and size grow to fit rather than
          wrap ("1 G or 4 in" stays one line). */}
      <div className="flex min-w-0 items-center gap-1.5">
        {leading}
        <div className="flex min-w-0 flex-1 items-center gap-x-1 px-0.5">
          <span className="min-w-9 max-w-16 flex-none">{qty}</span>
          <span aria-hidden="true" className="text-[16px] leading-6 text-muted-foreground">×</span>
          <span className="min-w-14 flex-none">{size}</span>
          <span className="min-w-0 flex-1">{name}</span>
        </div>
        {trailing}
      </div>
      {note}
      {/* Sized to what the cells hold at phone width: the widest status pill,
          a short count, and money that must not break mid-figure — the card's
          anywhere-wrapping stops here, and the Price cell grows to fit. A
          phone card carries no line total (2026-10-26). An order line has no
          Avail, so its two cells drop the middle column. */}
      <div className={cn('grid min-w-0 gap-0.5 rounded-lg bg-card/70 py-1.5 [overflow-wrap:normal]', cells.length === 2
        ? 'grid-cols-[minmax(0,1.5fr)_minmax(max-content,1fr)]'
        : 'grid-cols-[minmax(0,1.5fr)_minmax(0,0.75fr)_minmax(max-content,1fr)]')}>
        {cells.map((cell) => (
          <label key={cell.key} className="flex min-w-0 flex-col gap-0.5">
            <span className="text-center text-[11px] font-bold uppercase tracking-[.05em] text-muted-foreground">{cell.label}</span>
            <div className="flex min-h-11 min-w-0 items-center justify-center [&>*]:w-full">{cell.node}</div>
          </label>
        ))}
      </div>
      {children}
    </Tag>
  )
}

/** A card's read-only value: the same box an editable one has, so a line reads alike either way. */
export function LineCardValue({ align = 'center', wrap = false, className, children }: {
  align?: 'left' | 'center'
  wrap?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <span className={cn('block w-full min-w-0 border border-transparent px-1.5 py-0.5 text-[13px] tabular-nums text-foreground',
      align === 'center' && 'text-center', wrap ? 'whitespace-pre-wrap [overflow-wrap:anywhere]' : 'truncate', className)}>
      {children}
    </span>
  )
}

/** A card's status pill, toned; `chevron` when it is also the picker. */
export function LineStatusPill({ tone, label, chevron }: { tone: Tone; label: string; chevron: boolean }) {
  return (
    <span className="inline-flex max-w-full min-w-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-semibold transition-colors duration-150 ease-lps" style={toneStyle(tone)}>
      <span className="size-[7px] flex-none rounded-full transition-colors duration-150 ease-lps" style={{ background: toneDot(tone) }} />
      <span className="min-w-0 truncate">{label}</span>
      {chevron && <ChevronDown size={10} className="flex-none" />}
    </span>
  )
}
