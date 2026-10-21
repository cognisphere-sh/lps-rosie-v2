'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState, type ReactNode } from 'react'
import { CalendarDays, Pencil, Truck } from 'lucide-react'
import { CopyQuoteMenu } from '@/components/workspace/copy-quote-menu'

import { ChevronDown } from '@/components/workspace/icons'
import {
  RequestBody,
  StatusPill,
} from '@/components/workspace/job-request'
import { JobActionsMenu } from '@/components/workspace/job-actions-menu'
import { EditableText } from '@/components/workspace/editable'
import { EditableFulfillment, JobMetadata } from '@/components/workspace/job-metadata'
import { openChat } from '@/lib/chat-bus'
import { formatWeekdayMonthDay, money } from '@/lib/format'
import { jobNameIncludesCustomer } from '@/lib/job-identity'
import {
  REQUEST_STATUS_OPTIONS,
  requestRef,
  requestStatusLabel,
  requestStatusTone,
} from '@/lib/job-requests'
import type { JobRequestItem, JobRequestRow } from '@/lib/rows'
import { cn } from '@/lib/utils'

/** Focuses a mounted card's job-name editor (see `data-job-name-editor` below); false when it is gone or inert. */
export function focusConnectedJobNameTrigger(root: ParentNode | null, requestId: number): boolean {
  const target = root?.querySelector<HTMLButtonElement>(`[data-job-name-editor="${requestId}"] button`)
  if (!target?.isConnected || target.closest('[inert]')) return false
  target.focus({ preventScroll: true })
  return true
}

function trimmedIdentity(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function RequestCardOverview({ request, edit, tone, onNameSaved, stacked = false, actions, trailing }: {
  request: JobRequestRow
  edit: { table: 'job_requests'; id: number; onSaved: () => void }
  tone: ReturnType<typeof requestStatusTone>
  onNameSaved?: (requestId: number) => void
  /** The focused Job: its own grid, with the name as the title. */
  stacked?: boolean
  /** Stacked: the job's actions share the status row, so the name keeps the full width below. */
  actions?: ReactNode
  /** All jobs list: the desktop actions, after Rosie at the end of row 1. */
  trailing?: ReactNode
}) {
  const customer = trimmedIdentity(request.customer?.company) ?? trimmedIdentity(request.customer?.name) ?? 'Unassigned customer'
  const retail = request.customer?.type === 'Homeowner/Retail'
  const job = trimmedIdentity(request.name) ?? 'Unnamed job'
  const fullJobName = jobNameIncludesCustomer(request)
  const rosieChat = <button type="button" onClick={() => openChat({ agentId: 'rosie', threadId: `jr-${request.id}`, label: job })}
    aria-label={`Chat with Rosie about ${requestRef(request.id)}`}
    className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-1.5 py-1 font-semibold text-lps-accent-turquoise-text hover:bg-muted">
    <Image src="/rosie.png" alt="" width={22} height={22} className="size-[22px] rounded-full object-cover ring-1 ring-lps-accent-turquoise-border" />
  </button>
  if (stacked) {
    // Phone: ref + status with the actions on top, customer as the title, the job
    // (usually the address) as its subtitle, then date and fulfillment tags.
    // One grid, two arrangements. Narrow (phones): ref+status | actions, then the
    // name at full width, then date + mode.
    // A wide header (560px+ of its own column, whatever the window): ref+status,
    // date+mode and actions share row 1; the name takes row 2. Sized by the
    // header, not the viewport, so the Active jobs rail and chat column beside it
    // on a 1024px screen cannot squeeze date+mode under the actions.
    return <div data-job-card-mobile className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 @min-[560px]:grid-cols-[auto_minmax(0,1fr)_auto]">
      <div className="col-start-1 row-start-1 flex min-w-0 items-center gap-2">
        <Link href={`/jobs?jr=${request.id}`} title={`Created ${formatWeekdayMonthDay(request.createdAt) || '—'}`}
          data-vt-key={`job:${request.id}`} data-vt-kind="deeper"
          aria-label={`Open ${requestRef(request.id)} — ${fullJobName ? job : `${customer} — ${job}`}`}
          className="text-[13px] font-bold leading-none text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {requestRef(request.id)}
        </Link>
        <span className="flex items-center [&>[data-pop]]:flex"><StatusPill {...edit} column="status" value={request.status} label={requestStatusLabel(request.status)} accessibleLabel={requestStatusLabel(request.status)} tone={tone} options={REQUEST_STATUS_OPTIONS} /></span>
      </div>
      <div className="col-span-2 col-start-1 row-start-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 @min-[560px]:col-span-1 @min-[560px]:col-start-2 @min-[560px]:row-start-1 @min-[560px]:justify-self-start">
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays size={14} aria-hidden="true" className="flex-none text-muted-foreground" />
          <JobMetadata request={request} onDateSaved={edit.onSaved} showFulfillment={false} tapToEdit className="grid-cols-[max-content]" />
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Truck size={14} aria-hidden="true" className="flex-none text-muted-foreground" />
          <EditableFulfillment request={request} onSaved={edit.onSaved} tapToEdit />
        </span>
      </div>
      <div className="col-start-2 row-start-1 flex flex-none items-center gap-2 justify-self-end @min-[560px]:col-start-3 [&>*:last-child]:-ml-2">
        {rosieChat}
        {actions}
      </div>
      <div className="col-span-2 col-start-1 row-start-2 min-w-0 @min-[560px]:col-span-3">
        <span data-job-name-editor={request.id} className="block min-w-0">
          <EditableText key={request.id} {...edit} column="name" value={trimmedIdentity(request.name)} wrap labelled
            onSaved={() => onNameSaved ? onNameSaved(request.id) : edit.onSaved()}
            placeholder="Add job name" title={`Edit job name for ${requestRef(request.id)}`}
            className="px-0 text-[20px] font-bold leading-tight" />
        </span>
        {!fullJobName && <div className="break-words text-[13px] text-muted-foreground [overflow-wrap:anywhere]">{retail ? 'Retail ' : ''}{customer}</div>}
      </div>
    </div>
  }
  // All jobs list: cells of the card head's grid (RequestCardHeader owns the
  // columns). Phones: status | Rosie, the identity, then date · mode · items ·
  // total, left-aligned. Desktop (900px+): one row — status, identity, then date, mode, items
  // and total in fixed columns, so those facts line up from card to card, and
  // the actions at the end. A narrow card (a sidebar open) narrows the identity.
  const identity = `${requestRef(request.id)} - ${retail ? 'Retail ' : ''}${fullJobName ? '' : `${customer} - `}${job}`
  return <>
    <span className="col-span-3 col-start-1 row-start-1 flex min-w-0 items-center min-[900px]:col-span-1 min-[900px]:col-start-2">
      <StatusPill {...edit} column="status" value={request.status} label={requestStatusLabel(request.status)} accessibleLabel={requestStatusLabel(request.status)} tone={tone} options={REQUEST_STATUS_OPTIONS} />
    </span>
    <span className="group/job-name col-span-4 col-start-1 row-start-2 flex min-w-0 items-center gap-1 font-semibold min-[900px]:col-start-3 min-[900px]:col-end-4 min-[900px]:row-start-1 min-[900px]:pr-3">
      <Link href={`/jobs?jr=${request.id}`} title={`${identity}\nCreated ${formatWeekdayMonthDay(request.createdAt) || '—'}`}
        data-vt-kind="deeper"
        aria-label={`Open ${requestRef(request.id)} — ${fullJobName ? job : `${customer} — ${job}`}`}
        className="min-w-0 truncate text-[14px] font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring max-[899px]:line-clamp-2 max-[899px]:whitespace-normal">
        <span data-vt-key={`job:${request.id}`} className="text-primary">{requestRef(request.id)}</span> - {retail ? 'Retail ' : ''}{!fullJobName && <>{customer} - </>}<span className="group-has-[input]/job-name:hidden">{job}</span>
      </Link>
      <span data-job-name-editor={request.id} className="contents">
        <EditableText key={request.id} {...edit} column="name" value={trimmedIdentity(request.name)}
          onSaved={() => onNameSaved ? onNameSaved(request.id) : edit.onSaved()}
          placeholder="Add job name" title={`Edit job name for ${requestRef(request.id)}`}
          triggerContent={<Pencil size={12} aria-hidden="true" />}
          className="size-6 w-auto shrink-0 cursor-pointer p-1 opacity-0 group-hover/job-name:opacity-100 group-focus-within/job-name:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100" />
      </span>
    </span>
    <div className="col-start-4 row-start-1 flex items-center gap-1 justify-self-end min-[900px]:col-start-8">
      {rosieChat}
      {trailing}
    </div>
    <JobMetadata request={request} onDateSaved={edit.onSaved} showFulfillment={false} className="col-start-1 row-start-3 grid-cols-[max-content] min-[900px]:col-start-4 min-[900px]:row-start-1" />
    <span className="col-start-2 row-start-3 min-w-0 text-[12px] min-[900px]:col-start-5 min-[900px]:row-start-1">
      <EditableFulfillment request={request} onSaved={edit.onSaved} />
    </span>
    <span className="col-start-3 row-start-3 whitespace-nowrap text-[12px] text-muted-foreground min-[900px]:col-start-6 min-[900px]:row-start-1">
      {request.itemCount} {request.itemCount === 1 ? 'item' : 'items'}
    </span>
    <span className="col-start-4 row-start-3 justify-self-start whitespace-nowrap text-[12px] font-semibold tabular-nums text-foreground min-[900px]:col-start-7 min-[900px]:row-start-1 min-[900px]:justify-self-end">
      {money(request.lineTotal) || '$0.00'}
    </span>
  </>
}

export function RequestCardHeader({ request, mobile, expanded, onToggle, onDelete, onSaved, onNameSaved, showActions = mobile === false, stacked = false }: {
  request: JobRequestRow
  mobile: boolean | null
  expanded: boolean
  onToggle: () => void
  onDelete: (returnFocus: HTMLElement | null) => void
  onSaved: () => void
  onNameSaved?: (requestId: number) => void
  showActions?: boolean
  /** The focused Job's layout on every breakpoint: actions join the top row of the stacked overview. */
  stacked?: boolean
}) {
  const tone = requestStatusTone(request.status)
  const edit = { table: 'job_requests' as const, id: request.id, onSaved }
  const actions = showActions && <>
    <CopyQuoteMenu request={request} />
    <JobActionsMenu requestId={request.id} onDelete={onDelete} />
  </>

  if (stacked) return (
    <div data-request-card-head data-vt-card className="@container flex flex-col gap-1.5 px-3.5 py-2.5 transition-colors duration-150 hover:bg-lps-tint">
      <div className="flex min-w-0 items-start gap-2.5">
        <RequestCardOverview request={request} edit={edit} tone={tone} onNameSaved={onNameSaved} stacked actions={actions} />
      </div>
    </div>
  )

  // One grid for the whole head. Phones: 4 columns (date | mode | items set the
  // tracks; the last takes the rest, so the total follows the items). Desktop:
  // one row of chevron | status | identity | date | mode | items | total |
  // actions, with fixed widths so every card shares the columns, each sized to
  // its widest content (the Availability pill, "Set mode", a six-figure total).
  // Only the identity's (up to 24rem) gives way when the card narrows; the
  // actions keep their own width.
  return (
    <div data-request-card-head data-vt-card className="grid grid-cols-[auto_auto_auto_1fr] items-center gap-x-2.5 gap-y-1.5 px-3.5 py-2.5 transition-colors duration-150 hover:bg-lps-tint min-[900px]:grid-cols-[auto_7.25rem_minmax(0,24rem)_5.75rem_4.5rem_4rem_5rem_minmax(max-content,1fr)] min-[900px]:gap-x-3">
      {mobile === false && <button
        type="button"
        aria-expanded={expanded}
        aria-controls={`request-body-${request.id}`}
        aria-label={`${expanded ? 'Collapse' : 'Expand'} ${requestRef(request.id)}`}
        onClick={onToggle}
        className="flex size-6 relative flex-none cursor-pointer items-center justify-center col-start-1 row-start-1 rounded-md border-none bg-transparent text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground pointer-coarse:after:absolute pointer-coarse:after:-inset-2.5 pointer-coarse:after:content-['']"
      >
        <ChevronDown size={14} className={cn('transition-transform duration-150 ease-lps', !expanded && '-rotate-90')} />
      </button>}
      <RequestCardOverview request={request} edit={edit} tone={tone} onNameSaved={onNameSaved} trailing={actions} />
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
