'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { Pencil } from 'lucide-react'
import { CustomerChatButton } from '@/components/workspace/customer-chat-button'
import { CopyQuoteMenu } from '@/components/workspace/copy-quote-menu'

import { ChevronDown, ChevronRight } from '@/components/workspace/icons'
import {
  RequestBody,
  RequestLinks,
  StatusPill,
  newestNote,
} from '@/components/workspace/job-request'
import { JobActionsMenu } from '@/components/workspace/job-actions-menu'
import { EditableText } from '@/components/workspace/editable'
import { EditableFulfillment, JobMetadata } from '@/components/workspace/job-metadata'
import { openChat } from '@/lib/chat-bus'
import { customerThreadId } from '@/lib/customers'
import { formatWeekdayMonthDay, money } from '@/lib/format'
import { jobNameIncludesCustomer } from '@/lib/job-identity'
import {
  REQUEST_STATUS_OPTIONS,
  requestRef,
  requestStatusLabel,
  requestStatusTone,
} from '@/lib/job-requests'
import { shortStamp } from '@/lib/notes'
import type { JobRequestItem, JobRequestRow } from '@/lib/rows'

function trimmedIdentity(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function RequestCardOverview({ request, edit, tone, onNameSaved }: {
  request: JobRequestRow
  edit: { table: 'job_requests'; id: number; onSaved: () => void }
  tone: ReturnType<typeof requestStatusTone>
  onNameSaved?: (requestId: number) => void
}) {
  const customer = trimmedIdentity(request.customer?.company) ?? trimmedIdentity(request.customer?.name) ?? 'Unassigned customer'
  const retail = request.customer?.type === 'Homeowner/Retail'
  const job = trimmedIdentity(request.name) ?? 'Unnamed job'
  const fullJobName = jobNameIncludesCustomer(request)
  return <div className="min-w-0 flex-1">
    <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
      <StatusPill {...edit} column="status" value={request.status} label={requestStatusLabel(request.status)} accessibleLabel={requestStatusLabel(request.status)} tone={tone} options={REQUEST_STATUS_OPTIONS} />
      <span className="group/job-name inline-flex min-w-0 max-w-full items-center gap-1 font-semibold">
      <Link href={`/jobs?jr=${request.id}`} title={`Created ${formatWeekdayMonthDay(request.createdAt) || '—'}`}
        aria-label={`Open ${requestRef(request.id)} — ${fullJobName ? job : `${customer} — ${job}`}`}
        className="min-w-0 truncate text-[12.5px] font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span className="text-primary">{requestRef(request.id)}</span> - {retail ? 'Retail ' : ''}{!fullJobName && <>{customer} - </>}<span className="group-has-[input]/job-name:hidden">{job}</span>
      </Link>
        <span data-job-name-editor={request.id} className="contents">
          <EditableText key={request.id} {...edit} column="name" value={request.name}
            onSaved={() => onNameSaved ? onNameSaved(request.id) : edit.onSaved()}
            placeholder="Add job name" title={`Edit job name for ${requestRef(request.id)}`}
            triggerContent={<Pencil size={12} aria-hidden="true" />}
            className="size-6 w-auto shrink-0 cursor-pointer p-1 opacity-0 group-hover/job-name:opacity-100 group-focus-within/job-name:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100" />
        </span>
      </span>
      <JobMetadata request={request} onDateSaved={edit.onSaved} showFulfillment={false} className="grid-cols-[max-content]" />
      <div className="ml-auto flex items-center gap-2 text-[11px] text-muted-foreground">
        <EditableFulfillment request={request} onSaved={edit.onSaved} />
        <span aria-hidden="true">:</span>
        <span>{request.itemCount} {request.itemCount === 1 ? 'item' : 'items'}</span>
        <span aria-hidden="true">:</span>
        <span className="font-semibold tabular-nums text-foreground">{money(request.lineTotal) || '$0.00'}</span>
        <button type="button" onClick={() => openChat({ agentId: 'rosie', threadId: `jr-${request.id}`, label: job })}
          aria-label={`Chat with Rosie about ${requestRef(request.id)}`}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-1.5 py-1 font-semibold text-lps-accent-turquoise-text hover:bg-muted">
          <Image src="/rosie.png" alt="" width={22} height={22} className="size-[22px] rounded-full object-cover ring-1 ring-lps-accent-turquoise-border" />
        </button>
      </div>
    </div>
  </div>
}

export function RequestCardHeader({ request, mobile, expanded, onToggle, onDelete, onSaved, onNameSaved, supplierTabs = false, showActions = mobile === false }: {
  request: JobRequestRow
  mobile: boolean | null
  expanded: boolean
  onToggle: () => void
  onDelete: (returnFocus: HTMLElement | null) => void
  onSaved: () => void
  onNameSaved?: (requestId: number) => void
  /** The focused Job reaches its suppliers' ARs through the body's tabs instead of header pills. */
  supplierTabs?: boolean
  showActions?: boolean
}) {
  const tone = requestStatusTone(request.status)
  const edit = { table: 'job_requests' as const, id: request.id, onSaved }
  const latest = newestNote(request.notes.filter((note) => note.kind === 'customer'))
  const customerName = trimmedIdentity(request.customer?.name) ?? trimmedIdentity(request.customer?.company) ?? 'Unassigned customer'
  const customerThread = request.customer ? customerThreadId(request.customer) : null

  return (
    <div data-request-card-head className="flex flex-col gap-1.5 px-3.5 py-2.5 hover:bg-lps-tint">
      <div className="flex min-w-0 items-start gap-2.5">
        {mobile === false && <button
          type="button"
          aria-expanded={expanded}
          aria-controls={`request-body-${request.id}`}
          aria-label={`${expanded ? 'Collapse' : 'Expand'} ${requestRef(request.id)}`}
          onClick={onToggle}
          className="flex size-6 flex-none cursor-pointer items-center justify-center self-center rounded-md border-none bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>}
        <RequestCardOverview request={request} edit={edit} tone={tone} onNameSaved={onNameSaved} />
        {showActions && <div className="flex flex-none items-center gap-1 self-center">
          <CopyQuoteMenu request={request} />
          <JobActionsMenu requestId={request.id} onDelete={onDelete} />
        </div>}
      </div>

      {(latest || request.customer || (!supplierTabs && request.supplierLinks.length > 0)) && (
        <div data-request-card-secondary className="flex min-w-0 items-center gap-2">
          {(latest || request.customer) && <span
            data-request-customer-pill
            className="inline-flex w-[22rem] max-w-full shrink-0 items-stretch overflow-hidden rounded-xl border border-lps-edge bg-card text-[10.5px] font-semibold"
          >
            {request.customer ? <Link
              href={`/customers/${request.customer.id}`}
              title={customerName}
              className="flex min-h-8 min-w-0 items-center px-2 py-0.5 text-foreground hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            >
              <span className="max-w-[11rem] truncate">{customerName}</span>
            </Link> : <span className="flex min-h-8 min-w-0 items-center px-2 py-0.5 text-foreground" title={customerName}>
              <span className="max-w-[11rem] truncate">{customerName}</span>
            </span>}
            {request.customer && <CustomerChatButton customerId={request.customer.id} threadId={customerThread} label={customerName}
              className="inline-flex shrink-0 items-center justify-center border-l border-lps-hair px-2 py-0.5 text-primary hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring" />}
            {latest && <span
              className="flex min-w-0 flex-1 items-center border-l border-lps-hair px-2 py-0.5 font-normal text-muted-foreground"
              title={`${latest.text}${latest.stamp ? ` — ${shortStamp(latest.stamp)}` : ''}`}
            >
              <span className="truncate">{latest.text}</span>
            </span>}
          </span>}
          {!supplierTabs && request.supplierLinks.length > 0 && <RequestLinks
            request={request} relatedOnly hideCustomerChat className="ml-auto min-w-0 flex-1 justify-end"
          />}
        </div>
      )}
    </div>
  )
}

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

  return (
    <div className="flex-none overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md">
      {/* The head contains independent controls, so it is not clickable itself.
          Mobile navigates through identity; desktop alone owns disclosure. */}
      <RequestCardHeader request={request} mobile={mobile} expanded={expanded} onToggle={onToggle} onDelete={onDelete} onSaved={onSaved} />

      {mobile !== true && (
        <div id={`request-body-${request.id}`}>
          {expanded && (
            <RequestBody
              request={request}
              version={version}
              detailsOpen={detailsOpen}
              onToggleDetails={() => setDetailsOpen((value) => !value)}
              compactJobDetails={mobile === false}
              touchTargets={mobile === false}
              selected={selected}
              onSelect={onSelect}
              onDeleteItem={onDeleteItem}
              onSaved={onSaved}
            />
          )}
        </div>
      )}
    </div>
  )
}
