import type { CSSProperties, ReactNode } from 'react'

import { cn } from '@/lib/utils'

export type LineCardCell = { key: string; label: string; node: ReactNode }

/**
 * The phone line card shared by a job's request items and an availability
 * request's lines: `Qty × Size Plant name` on top, an optional full-width
 * note, then one row of labelled cells (header over value), then any extras.
 * The callers supply the controls; this owns the geometry, so the two cards
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
          level with its middle; the quantity grows to fit rather than wrap. */}
      <div className="flex min-w-0 items-center gap-1.5">
        {leading}
        <div className="flex min-w-0 flex-1 items-center gap-x-1 px-0.5">
          <span className="min-w-9 max-w-16 flex-none">{qty}</span>
          <span aria-hidden="true" className="text-[16px] leading-6 text-muted-foreground">×</span>
          <span className="w-14 flex-none">{size}</span>
          <span className="min-w-0 flex-1">{name}</span>
        </div>
        {trailing}
      </div>
      {note}
      {/* Sized to what the cells hold at phone width: the widest status pill,
          a short count, and money that must not break mid-figure — the card's
          anywhere-wrapping stops here, and the last money cell (Total, or
          Price on the availability card, which has no Total) grows to fit. */}
      <div className={cn('grid min-w-0 gap-0.5 rounded-lg bg-card/70 py-1.5 [overflow-wrap:normal]', cells.length === 3
        ? 'grid-cols-[minmax(0,1.5fr)_minmax(0,0.75fr)_minmax(max-content,1fr)]'
        : 'grid-cols-[minmax(0,1.5fr)_minmax(0,0.55fr)_minmax(0,0.95fr)_minmax(max-content,1fr)]')}>
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
