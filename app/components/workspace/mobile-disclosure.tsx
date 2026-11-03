'use client'

import { ChevronDown } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Secondary portal content starts collapsed on phones and stays visible on desktop. */
export function MobileDisclosure({ label, children }: { label: string; children: ReactNode }) {
  const [expanded, setExpanded] = useState(false)
  const contentId = useId()
  return <div className="min-w-0">
    <button type="button" aria-expanded={expanded} aria-controls={contentId}
      aria-label={`${expanded ? 'Collapse' : 'Expand'} ${label.toLowerCase()}`}
      onClick={() => setExpanded(current => !current)}
      className="flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-lg border-none bg-transparent px-3 text-left text-[13px] font-medium text-foreground hover:bg-lps-tint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring min-[900px]:hidden print:hidden">
      <span className="min-w-0 flex-1">{label}</span>
      <span className="text-[12px] text-muted-foreground">{expanded ? 'Collapse' : 'Expand'}</span>
      <ChevronDown aria-hidden="true" className={cn('size-4 flex-none', expanded && 'rotate-180')} />
    </button>
    <div id={contentId} className={expanded ? 'block' : 'hidden min-[900px]:block print:block'}>{children}</div>
  </div>
}
