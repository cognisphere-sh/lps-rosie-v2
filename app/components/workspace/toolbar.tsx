'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CheckIcon, ChevronDown, ChevronLeft, ChevronRight } from '@/components/workspace/icons'
import { useOutsideClose } from '@/components/workspace/table-parts'
import { cn } from '@/lib/utils'

export interface Chip {
  label: string
  /**
   * The picked option labels. Empty means "all" — a filter nobody has narrowed
   * is the absence of a filter, not a list of every option.
   */
  values: string[]
  options: string[]
  onChange: (values: string[]) => void
  allLabel: string
  /**
   * Pick one at a time. For options that cannot overlap — a date range is
   * "the last 7 days" or "the last 30", never both.
   */
  single?: boolean
}

function ChipMenu({ chip }: { chip: Chip }) {
  const [open, setOpen] = useState(false)
  const pop = useOutsideClose(open, () => setOpen(false))
  const picked = new Set(chip.values)
  const active = picked.size > 0

  const toggle = (o: string) => {
    if (chip.single) {
      chip.onChange([o])
      setOpen(false)
      return
    }
    // The menu stays open: picking a second value is the point of a
    // multi-select, and closing after the first would hide it.
    chip.onChange(picked.has(o) ? chip.values.filter((v) => v !== o) : [...chip.values, o])
  }

  return (
    <div ref={pop} data-menu className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex cursor-pointer items-center gap-1.5 rounded-full border px-[11px] py-[5px] text-[12px] font-semibold',
          active ? 'border-primary bg-secondary text-primary' : 'border-border bg-card text-muted-foreground',
        )}
      >
        {picked.size === 1 ? chip.values[0] : picked.size ? `${chip.label} · ${picked.size}` : chip.label}
        <ChevronDown size={12} />
      </button>
      {open && (
        <div className="lps-pop absolute left-0 top-[calc(100%+6px)] z-[80] max-h-[280px] min-w-[200px] overflow-auto rounded-xl border border-border bg-popover p-1.5 shadow-[var(--lps-shadow)]">
          <button
            type="button"
            onClick={() => {
              chip.onChange([])
              setOpen(false)
            }}
            className={cn(
              'flex w-full cursor-pointer items-center gap-2 rounded-lg border-none bg-transparent px-2 py-1.5 text-left text-[12px] hover:bg-muted',
              active ? 'font-normal text-muted-foreground' : 'font-semibold text-foreground',
            )}
          >
            <span className="size-[15px] flex-none" />
            {chip.allLabel}
          </button>
          {chip.options.map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => toggle(o)}
              className={cn(
                'flex w-full cursor-pointer items-center gap-2 rounded-lg border-none bg-transparent px-2 py-1.5 text-left text-[12px] hover:bg-muted',
                picked.has(o) ? 'font-semibold text-foreground' : 'font-normal text-muted-foreground',
              )}
            >
              <span
                className={cn(
                  'inline-flex size-[15px] flex-none items-center justify-center rounded-[5px] border',
                  picked.has(o)
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-input bg-background',
                )}
              >
                {picked.has(o) && <CheckIcon size={10} />}
              </span>
              {o}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export interface Pagination {
  page: number
  pageCount: number
  onPage: (page: number) => void
  busy?: boolean
}

/** Previous / next across server pages. Hidden while a search fits on one page. */
function PageControls({ page, pageCount, onPage, busy }: Pagination) {
  return (
    <div className="flex items-center gap-1.5">
      <Button
        variant="outline"
        size="icon-sm"
        aria-label="Previous page"
        disabled={page <= 1 || busy}
        onClick={() => onPage(page - 1)}
      >
        <ChevronLeft size={14} />
      </Button>
      <span className="whitespace-nowrap text-[12px] tabular-nums text-muted-foreground">
        Page {page} of {pageCount}
      </span>
      <Button
        variant="outline"
        size="icon-sm"
        aria-label="Next page"
        disabled={page >= pageCount || busy}
        onClick={() => onPage(page + 1)}
      >
        <ChevronRight size={14} />
      </Button>
    </div>
  )
}

export function Toolbar({
  placeholder,
  query,
  onQuery,
  chips = [],
  controls,
  rightActions,
  hasFilters,
  onClear,
  summary,
  pagination,
}: {
  placeholder: string
  query: string
  onQuery: (value: string) => void
  chips?: Chip[]
  controls?: React.ReactNode
  /** Desktop shell controls placed in this toolbar's trailing cluster. */
  rightActions?: React.ReactNode
  hasFilters: boolean
  onClear: () => void
  summary: string
  pagination?: Pagination
}) {
  return (
    <div className="flex flex-none flex-wrap items-center gap-2 border-b border-border bg-card px-4 py-2.5">
      <div className="w-full min-w-0 md:w-[290px]">
        <Input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="h-9"
        />
      </div>
      {controls}
      {chips.map((chip) => (
        <ChipMenu key={chip.label} chip={chip} />
      ))}
      {hasFilters && (
        <button
          type="button"
          onClick={onClear}
          className="cursor-pointer border-none bg-transparent text-[12px] text-muted-foreground underline"
        >
          Clear all
        </button>
      )}
      <div className="ml-auto flex flex-wrap items-center justify-end gap-3 min-[900px]:w-full min-[1024px]:w-auto">
        <span className="hidden whitespace-nowrap text-[12px] text-muted-foreground md:inline">
          {summary}
        </span>
        {pagination && pagination.pageCount > 1 && <PageControls {...pagination} />}
        {rightActions}
      </div>
    </div>
  )
}
