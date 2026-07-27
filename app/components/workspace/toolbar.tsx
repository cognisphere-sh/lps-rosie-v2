'use client'

import { useState } from 'react'

import { Input } from '@/components/ui/input'
import { ChevronDown } from '@/components/workspace/icons'
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

export function Toolbar({
  placeholder,
  query,
  onQuery,
  chips = [],
  hasFilters,
  onClear,
  summary,
}: {
  placeholder: string
  query: string
  onQuery: (value: string) => void
  chips?: Chip[]
  hasFilters: boolean
  onClear: () => void
  summary: string
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
      <span className="ml-auto hidden whitespace-nowrap text-[12px] text-muted-foreground md:inline">
        {summary}
      </span>
    </div>
  )
}
