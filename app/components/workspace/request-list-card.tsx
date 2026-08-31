'use client'

import Image from 'next/image'
import { useState } from 'react'

import { ChevronDown, ChevronRight, TrashIcon } from '@/components/workspace/icons'
import {
  DemandSummary,
  NOTE_KIND,
  RequestBody,
  RequestLinks,
  StatusPill,
  newestNote,
} from '@/components/workspace/job-request'
import { MobileRequestUtilities } from '@/components/workspace/request-card-utilities'
import { JobIdentityLink } from '@/components/workspace/shell'
import { openChat } from '@/lib/chat-bus'
import { formatDate } from '@/lib/format'
import {
  REQUEST_STATUS_OPTIONS,
  requestRef,
  requestStatusLabel,
  requestStatusTone,
  toneStyle,
} from '@/lib/job-requests'
import { shortStamp } from '@/lib/notes'
import type { JobRequestItem, JobRequestRow } from '@/lib/rows'

export function RequestCard({
  request,
  expanded,
  selected,
  version,
  onToggle,
  onSelect,
  onDelete,
  onDeleteItem,
  onSaved,
  mobile,
}: {
  request: JobRequestRow
  expanded: boolean
  /** The page's one resolved 899/900 branch; null owns no responsive action. */
  mobile: boolean | null
  /** Every selected line id on the page; the card reads its own out of it. */
  selected: Set<number>
  /** Bumped after every write — what makes an open history drawer refresh. */
  version: number
  onToggle: () => void
  /** Select or clear these line ids; the page owns the set. */
  onSelect: (ids: number[], on: boolean) => void
  /** Delete the whole request, permanently. Confirmed by the page. */
  onDelete: (returnFocus: HTMLElement | null) => void
  /** Delete one of its lines, permanently. Confirmed by the page. */
  onDeleteItem: (item: JobRequestItem) => void
  onSaved: () => void
}) {
  // The second level of expansion, kept on the card: opening a request's
  // details is a fact about looking at that card, not about the page, and the
  // card stays mounted while its lines collapse and reopen.
  const [detailsOpen, setDetailsOpen] = useState(false)

  const tone = requestStatusTone(request.status)
  const edit = { table: 'job_requests', id: request.id, onSaved }
  const latest = newestNote(request.notes)

  return (
    <div className="flex-none overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md">
      {/* The head contains independent interactive controls, so it is not
          clickable itself. The job link navigates; only the chevron toggles. */}
      <div className="flex flex-col gap-1.5 px-3.5 py-2.5 hover:bg-lps-tint">
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={`request-body-${request.id}`}
            aria-label={`${expanded ? 'Collapse' : 'Expand'} ${requestRef(request.id)}`}
            onClick={(event) => {
              event.stopPropagation()
              onToggle()
            }}
            className="flex size-11 flex-none cursor-pointer items-center justify-center rounded-md border-none bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
          <JobIdentityLink request={request} />
          <StatusPill
            {...edit}
            column="status"
            value={request.status}
            label={requestStatusLabel(request.status)}
            tone={tone}
            options={REQUEST_STATUS_OPTIONS}
          />
          <span
            className="ml-auto whitespace-nowrap text-[11px] text-lps-dim"
            title={`Created ${formatDate(request.createdAt)}`}
          >
            {formatDate(request.updatedAt)}
          </span>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              openChat({
                agentId: 'rosie',
                threadId: `jr-${request.id}`,
                label: request.name ?? requestRef(request.id),
              })
            }}
            title={`Chat with Rosie about ${requestRef(request.id)}`}
            aria-label={`Chat with Rosie about ${requestRef(request.id)}`}
            className="flex size-11 flex-none cursor-pointer items-center justify-center rounded-full border-none bg-transparent opacity-75 hover:opacity-100 md:size-[22px]"
          >
            <Image src="/rosie.png" alt="" width={22} height={22} className="size-[22px] rounded-full object-cover" />
          </button>
          {/* Exactly one resolved responsive branch owns whole-job deletion. */}
          {mobile === false && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onDelete(event.currentTarget)
              }}
              title={`Delete ${requestRef(request.id)} permanently`}
              aria-label={`Delete ${requestRef(request.id)}`}
              className="flex size-[22px] flex-none cursor-pointer items-center justify-center rounded-md border-none bg-transparent text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            >
              <TrashIcon size={14} />
            </button>
          )}
        </div>

        <RequestLinks request={request} suppliersHidden={!expanded} className="pl-[30px]" />

        {!expanded && (
          <div className="pl-[30px]">
            <DemandSummary
              lineTotal={request.lineTotal}
              itemCount={request.itemCount}
              counts={request.statusCounts}
            />
          </div>
        )}

        {!expanded && latest && (
          <div
            className="flex min-w-0 items-baseline gap-2 border-t border-lps-hair pl-[30px] pt-2"
            title={latest.text}
          >
            <span
              className="flex-none rounded-full px-1.5 py-px text-[9.5px] font-bold uppercase tracking-wide"
              style={toneStyle(NOTE_KIND[latest.kind].tone)}
            >
              {NOTE_KIND[latest.kind].label}
            </span>
            <span className="min-w-0 truncate text-[11.5px] text-muted-foreground">
              {latest.text}
            </span>
            {latest.stamp && (
              <span className="ml-auto flex-none whitespace-nowrap text-[10.5px] text-lps-dim">
                {shortStamp(latest.stamp)}
              </span>
            )}
          </div>
        )}
      </div>

      <div id={`request-body-${request.id}`}>
        {expanded && (
          <>
            {mobile === true && (
              <MobileRequestUtilities requestId={request.id} onDelete={onDelete} />
            )}
            <RequestBody
              request={request}
              version={version}
              detailsOpen={detailsOpen}
              onToggleDetails={() => setDetailsOpen((value) => !value)}
              selected={selected}
              onSelect={onSelect}
              onDeleteItem={onDeleteItem}
              onSaved={onSaved}
            />
          </>
        )}
      </div>
    </div>
  )
}
