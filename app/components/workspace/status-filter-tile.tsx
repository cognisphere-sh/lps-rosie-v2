import type { ButtonHTMLAttributes, CSSProperties } from 'react'

import { cn } from '@/lib/utils'

/** Shared selection treatment for request, order and item count filters. */
export function StatusFilterTile({
  label, count, color, selected, className, disabled, style, ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  label: string
  count: number
  color: string
  selected: boolean
}) {
  return (
    <button
      {...props}
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      style={{ '--status-filter-color': color, ...style } as CSSProperties}
      className={cn(
        'flex min-h-[60px] cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border px-2 py-2 transition-colors duration-150 ease-lps focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-default',
        selected
          ? 'border-[var(--status-filter-color)] bg-[var(--status-filter-color)] text-card'
          : 'border-[var(--status-filter-color)] bg-card text-[var(--status-filter-color)] enabled:hover:bg-muted',
        className,
      )}
    >
      <span className="text-[18px] font-semibold leading-tight tabular-nums">
        {count}
      </span>
      <span className="min-w-0 text-center text-[12px] font-medium leading-tight [overflow-wrap:anywhere]">{label}</span>
    </button>
  )
}
