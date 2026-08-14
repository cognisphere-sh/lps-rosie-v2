'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ChevronDown, ChevronLeft, ChevronRight } from '@/components/workspace/icons'
import { useOutsideClose } from '@/components/workspace/table-parts'
import { cn } from '@/lib/utils'

export interface Chip {
  label: string
  value: string
  options: string[]
  onChange: (value: string) => void
  allLabel: string
}

function ChipMenu({ chip }: { chip: Chip }) {
  const [open, setOpen] = useState(false)
  useOutsideClose(open, () => setOpen(false))
  const active = chip.value !== 'all'

  return (
    <div data-menu className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex cursor-pointer items-center gap-1.5 rounded-full border px-[11px] py-[5px] text-[12px] font-semibold',
          active ? 'border-primary bg-secondary text-primary' : 'border-border bg-card text-muted-foreground',
        )}
      >
        {active ? chip.value : chip.label}
        <ChevronDown size={12} />
      </button>
      {open && (
        <div className="lps-pop absolute left-0 top-[calc(100%+6px)] z-[80] max-h-[280px] min-w-[200px] overflow-auto rounded-xl border border-border bg-popover p-1.5 shadow-[var(--lps-shadow)]">
          {['all', ...chip.options].map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => {
                chip.onChange(o)
                setOpen(false)
              }}
              className={cn(
                'flex w-full cursor-pointer items-center rounded-lg border-none bg-transparent px-2 py-1.5 text-left text-[12px] hover:bg-muted',
                chip.value === o ? 'font-semibold text-foreground' : 'font-normal text-muted-foreground',
              )}
            >
              {o === 'all' ? chip.allLabel : o}
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
      <div className="ml-auto flex items-center gap-3">
        <span className="hidden whitespace-nowrap text-[12px] text-muted-foreground md:inline">
          {summary}
        </span>
        {pagination && pagination.pageCount > 1 && <PageControls {...pagination} />}
      </div>
    </div>
  )
}
