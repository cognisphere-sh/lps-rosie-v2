'use client'

import Image from 'next/image'
import Link from 'next/link'
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
import { JobIdentityLink } from '@/components/workspace/shell'
import { openChat } from '@/lib/chat-bus'
import { formatDate } from '@/lib/format'
import { jobRequestIdentityLine } from '@/lib/job-identity'
import {
  REQUEST_STATUS_OPTIONS,
  requestRef,
  itemPill,
  requestStatusLabel,
  requestStatusToken,
  requestStatusTone,
  toneDot,
  toneStyle,
} from '@/lib/job-requests'
import { shortStamp } from '@/lib/notes'
import type { JobRequestItem, JobRequestRow } from '@/lib/rows'

function trimmedIdentity(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
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

  const tone = requestStatusTone(request.status)
  const edit = { table: 'job_requests', id: request.id, onSaved }
  const latest = newestNote(request.notes)
  const mobileCustomer = trimmedIdentity(request.customer?.company)
    ?? trimmedIdentity(request.customer?.name)
    ?? 'Unassigned customer'
  const mobileJobName = trimmedIdentity(request.name)
  const mobileJob = mobileJobName ?? requestRef(request.id)
  const mobileIdentity = mobileJobName ? `${mobileCustomer} · ${mobileJobName}` : mobileCustomer
  const mobileStatusLabel = requestStatusLabel(request.status).trim() || 'Unknown status'

  return (
    <div className="flex-none overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md">
      {/* The head contains independent controls, so it is not clickable itself.
          Mobile navigates through identity; desktop alone owns disclosure. */}
      <div data-request-card-head className="flex flex-col gap-1.5 px-3.5 py-2.5 hover:bg-lps-tint">
        {mobile === true ? (
          <>
            <div
              data-mobile-request-row="identity"
              data-mobile-request-primary
              className="flex w-full max-w-full min-w-0 flex-nowrap items-center gap-1"
            >
              <span
                data-mobile-request-jr
                className="flex-none whitespace-nowrap text-[10.5px] font-semibold text-primary"
              >
                {requestRef(request.id)}
              </span>
              <div data-mobile-request-status className="flex flex-none items-center justify-center">
                <StatusPill
                  {...edit}
                  column="status"
                  value={request.status}
                  label={mobileStatusLabel}
                  accessibleLabel={mobileStatusLabel}
                  tone={tone}
                  options={REQUEST_STATUS_OPTIONS}
                />
              </div>
              <Link
                href={`/jobs?jr=${request.id}`}
                aria-label={`Open ${requestRef(request.id)}${mobileJobName ? ` — ${mobileJobName}` : ''}`}
                onClick={(event) => event.stopPropagation()}
                data-mobile-request-identity
                className="block min-h-11 min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap rounded-md text-[12.5px] leading-[44px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                title={mobileIdentity}
              >
                <span data-mobile-request-customer className="font-medium">{mobileCustomer}</span>
                {mobileJobName && (
                  <>
                    <span aria-hidden="true" className="text-muted-foreground"> · </span>
                    <span data-mobile-request-job className="font-semibold">{mobileJob}</span>
                  </>
                )}
              </Link>
            </div>
            <div
              data-mobile-request-row="pending-chat"
              data-mobile-request-secondary
              className="flex w-full max-w-full min-w-0 flex-nowrap items-center justify-between gap-2"
            >
              <div
                  data-mobile-pending-summary
                  className="inline-flex h-7 min-w-0 flex-none items-center gap-1.5 rounded-full border border-lps-hair bg-secondary/45 px-2"
                >
                  <span
                    className="size-[6px] flex-none rounded-full"
                    style={{ background: toneDot(itemPill('pending', null, null).tone) }}
                  />
                  <span className="flex-none text-[12px] font-bold tabular-nums text-foreground">
                    {request.statusCounts.pending ?? 0}
                  </span>
                  <span className="whitespace-nowrap text-[10.5px] text-muted-foreground">Pending</span>
                </div>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  openChat({
                    agentId: 'rosie',
                    threadId: `jr-${request.id}`,
                    label: mobileJob,
                  })
                }}
                title={`Chat with Rosie about ${requestRef(request.id)}`}
                aria-label={`Chat with Rosie about ${requestRef(request.id)}`}
                data-mobile-request-rosie
                className="ml-auto flex min-h-11 flex-none cursor-pointer items-center justify-center gap-1.5 rounded-full border-none bg-transparent px-2 text-[11px] font-semibold text-primary opacity-75 hover:opacity-100"
              >
                <Image src="/rosie.png" alt="" width={22} height={22} className="size-[22px] rounded-full object-cover" />
                <span className="whitespace-nowrap">Rosie Chat</span>
              </button>
            </div>
          </>
        ) : mobile === false && expanded ? (
          <div
            data-desktop-expanded-request-header
            className="grid min-h-14 grid-cols-[44px_minmax(44px,1fr)_minmax(0,2fr)_minmax(44px,1fr)_44px] items-center"
          >
            <button
              type="button"
              aria-expanded={expanded}
              aria-controls={`request-body-${request.id}`}
              aria-label={`Collapse ${requestRef(request.id)}`}
              onClick={(event) => {
                event.stopPropagation()
                onToggle()
              }}
              className="flex size-11 flex-none cursor-pointer items-center justify-center rounded-md border-none bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <ChevronDown size={16} />
            </button>
            <div data-balanced-header-flank="left" className="flex min-w-0 items-center gap-1 overflow-hidden">
              <span className="min-w-0 truncate font-bold text-primary">{requestRef(request.id)}</span>
              <StatusPill
                {...edit}
                column="status"
                value={request.status}
                label={requestStatusLabel(request.status)}
                compactLabel={requestStatusToken(request.status)}
                accessibleLabel={requestStatusLabel(request.status)}
                tone={tone}
                options={REQUEST_STATUS_OPTIONS}
              />
            </div>
            <Link
              href={`/jobs?jr=${request.id}`}
              aria-label={`Open ${requestRef(request.id)} — ${jobRequestIdentityLine(request)}`}
              data-desktop-job-identity
              title={jobRequestIdentityLine(request)}
              className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap rounded-md text-center text-[12.5px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {jobRequestIdentityLine(request)}
            </Link>
            <div data-balanced-header-flank="right" className="flex min-w-0 items-center justify-end overflow-hidden">
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
                className="flex size-11 flex-none cursor-pointer items-center justify-center rounded-full border-none bg-transparent opacity-75 outline-none hover:bg-muted hover:opacity-100 focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Image src="/rosie.png" alt="" width={24} height={24} className="size-6 rounded-full object-cover" />
              </button>
            </div>
            <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  onDelete(event.currentTarget)
                }}
                title={`Delete ${requestRef(request.id)} permanently`}
                aria-label={`Delete ${requestRef(request.id)}`}
                className="flex size-11 flex-none cursor-pointer items-center justify-center rounded-md border-none bg-transparent text-muted-foreground outline-none hover:bg-destructive/10 hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring"
              >
                <TrashIcon size={14} />
              </button>
          </div>
        ) : (
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
        )}

        {mobile !== true && !(mobile === false && expanded) && (
          <RequestLinks request={request} suppliersHidden={!expanded} className="pl-[30px]" />
        )}

        {!expanded && mobile !== true && (
          <div className="pl-[30px]">
            <DemandSummary
              lineTotal={request.lineTotal}
              itemCount={request.itemCount}
              counts={request.statusCounts}
            />
          </div>
        )}

        {!expanded && mobile !== true && latest && (
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
