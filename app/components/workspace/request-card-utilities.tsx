'use client'

import { TrashIcon } from '@/components/workspace/icons'
import { requestRef } from '@/lib/job-requests'

/** The only mobile whole-job action, mounted only for an expanded request card. */
export function MobileRequestUtilities({
  requestId,
  onDelete,
}: {
  requestId: number
  onDelete: (returnFocus: HTMLElement | null) => void
}) {
  return (
    <div className="flex justify-end border-t border-lps-hair px-3.5 py-1.5 min-[900px]:hidden">
      <button
        type="button"
        onClick={(event) => onDelete(event.currentTarget)}
        title={`Delete ${requestRef(requestId)} permanently`}
        aria-label={`Delete ${requestRef(requestId)} permanently`}
        className="flex min-h-11 cursor-pointer items-center gap-1.5 rounded-lg border-none bg-transparent px-2.5 text-[12px] font-semibold text-destructive hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <TrashIcon size={14} /> Delete job
      </button>
    </div>
  )
}
