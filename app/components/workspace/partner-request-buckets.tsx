'use client'

import { PartnerRequestCardLayout } from './partner-request-card-layout'

import { Check } from 'lucide-react'
import type { CSSProperties } from 'react'

import { partnerRequestName } from '@/components/workspace/partner'
import { type ARDetail } from '@/lib/availability'
import { cn } from '@/lib/utils'

export type SemanticPalette = {
  light: { foreground: string; background: string; border: string; normal: string }
  dark: { foreground: string; background: string; border: string; normal: string }
}

/**
 * Explicit accessible pairs for both app themes. `normal` is the actual card
 * behind an unselected control/row; `background` is the selected/pill tint.
 * Text pairs are >= 4.5:1 and borders/icons are >= 3:1 against both.
 */
export const REQUEST_BUCKETS = [
  {
    id: 'new', label: 'New',
    palette: {
      light: { foreground: '#075EA8', background: '#EAF4FF', border: '#1976C9', normal: '#FFFFFF' },
      dark: { foreground: '#7FC4FF', background: '#102A3D', border: '#3E9BE0', normal: '#1A1A1A' },
    },
  },
  {
    id: 'processing', label: 'Processing',
    palette: {
      light: { foreground: '#8A3F00', background: '#FFF2DD', border: '#B85C00', normal: '#FFFFFF' },
      dark: { foreground: '#FFB86B', background: '#3A2412', border: '#D57A1F', normal: '#1A1A1A' },
    },
  },
  {
    id: 'submitted', label: 'Completed',
    palette: {
      light: { foreground: '#126B36', background: '#EAF8EF', border: '#25864B', normal: '#FFFFFF' },
      dark: { foreground: '#79D99B', background: '#12301F', border: '#36A463', normal: '#1A1A1A' },
    },
  },
] as const satisfies readonly { id: string; label: string; palette: SemanticPalette }[]

export const SELECT_ALL_PALETTE: SemanticPalette = {
  light: { foreground: '#1E3B28', background: '#EDF4EE', border: '#486251', normal: '#FFFFFF' },
  dark: { foreground: '#E8E8E8', background: '#253029', border: '#9EAEA2', normal: '#1A1A1A' },
}

export type RequestBucketId = (typeof REQUEST_BUCKETS)[number]['id']
export const DEFAULT_REQUEST_BUCKETS: readonly RequestBucketId[] = ['new', 'processing', 'submitted']

function paletteVariables(palette: SemanticPalette): CSSProperties {
  return {
    '--bucket-light-foreground': palette.light.foreground,
    '--bucket-light-background': palette.light.background,
    '--bucket-light-border': palette.light.border,
    '--bucket-dark-foreground': palette.dark.foreground,
    '--bucket-dark-background': palette.dark.background,
    '--bucket-dark-border': palette.dark.border,
  } as CSSProperties
}

const paletteClasses = 'border-[var(--bucket-light-border)] text-[var(--bucket-light-foreground)] dark:border-[var(--bucket-dark-border)] dark:text-[var(--bucket-dark-foreground)]'
const selectedPaletteClasses = 'bg-[var(--bucket-light-background)] dark:bg-[var(--bucket-dark-background)]'

export function requestBucketCounts(requests: ARDetail[]) {
  const counts: Record<RequestBucketId, number> = { new: 0, processing: 0, submitted: 0 }
  for (const request of requests) {
    if (request.status === 'new' || request.status === 'processing' || request.status === 'submitted') {
      counts[request.status] += 1
    }
  }
  return counts
}

export function requestsInBuckets(requests: ARDetail[], selected: readonly RequestBucketId[]) {
  return requests.filter((request) => selected.includes(request.status as RequestBucketId))
}

export function RequestBucketControls({
  counts,
  selected,
  onChange,
}: {
  counts: Record<RequestBucketId, number>
  selected: readonly RequestBucketId[]
  onChange: (next: RequestBucketId[]) => void
}) {
  const allSelected = REQUEST_BUCKETS.every((bucket) => selected.includes(bucket.id))
  const total = counts.new + counts.processing + counts.submitted

  return (
    <div role="group" aria-label="Request work buckets" className="flex gap-2 overflow-x-auto">
      <button
        type="button"
        onClick={() => onChange(REQUEST_BUCKETS.map((bucket) => bucket.id))}
        aria-pressed={allSelected}
        aria-label={`Select all request buckets, ${total} open requests`}
        className={cn(
          'flex w-[8rem] min-w-[6.5rem] cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg border px-3 py-2',
          paletteClasses,
          allSelected
            ? selectedPaletteClasses
            : 'bg-transparent hover:bg-[var(--bucket-light-background)] dark:hover:bg-[var(--bucket-dark-background)]',
        )}
        style={paletteVariables(SELECT_ALL_PALETTE)}
      >
        <span className="inline-flex items-center gap-1 whitespace-nowrap text-[12.5px] font-medium">
          {allSelected && <Check aria-hidden="true" className="size-3.5" />}
          All
        </span>
        <span className="text-[18px] font-semibold tabular-nums leading-tight">{total}</span>
      </button>

      {REQUEST_BUCKETS.map((bucket) => {
        const isSelected = !allSelected && selected.includes(bucket.id)
        return (
          <button
            key={bucket.id}
            type="button"
            data-request-bucket={bucket.id}
            onClick={() => onChange(
              [bucket.id],
            )}
            aria-pressed={isSelected}
            aria-label={`${bucket.label}: ${counts[bucket.id]} requests, ${isSelected ? 'selected' : 'not selected'}`}
            className={cn(
              'flex w-[9rem] min-w-[6.5rem] cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg border px-3 py-2',
              paletteClasses,
              isSelected
                ? selectedPaletteClasses
                : 'bg-transparent hover:bg-[var(--bucket-light-background)] dark:hover:bg-[var(--bucket-dark-background)]',
            )}
            style={paletteVariables(bucket.palette)}
          >
            <span className="inline-flex items-center gap-1 whitespace-nowrap text-[12.5px] font-medium">
              {isSelected && <Check aria-hidden="true" className="size-3.5" />}
              {bucket.label}
            </span>
            <span className="text-[18px] font-semibold tabular-nums leading-tight">
              {counts[bucket.id]}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function RequestStatusPill({ status }: { status: RequestBucketId }) {
  const bucket = REQUEST_BUCKETS.find((entry) => entry.id === status)!
  return (
    <span
      data-request-status={status}
      className={cn(
        'inline-flex h-7 items-center justify-center whitespace-nowrap rounded-full border px-3 text-[12.5px] font-medium sm:w-[8.5rem]',
        paletteClasses,
        selectedPaletteClasses,
      )}
      style={paletteVariables(bucket.palette)}
    >
      {bucket.label}
    </span>
  )
}

export function PartnerRequestRow({ request, href }: { request: ARDetail; href: string }) {
  const status = request.status as RequestBucketId
  const bucket = REQUEST_BUCKETS.find((entry) => entry.id === status)!
  return <PartnerRequestCardLayout request={request} href={href} name={partnerRequestName(request)}
    label={`${bucket.label} request: ${partnerRequestName(request)}`} status={<RequestStatusPill status={status} />}
    className="border-[var(--bucket-light-border)] dark:border-[var(--bucket-dark-border)]" style={paletteVariables(bucket.palette)} />
}

export function RequestBucketList({
  requests,
  selected,
  supplierId,
}: {
  requests: ARDetail[]
  selected: readonly RequestBucketId[]
  supplierId: number
}) {
  const shown = requestsInBuckets(requests, selected)
  const activeCount = requests.filter((request) => request.status === 'new' || request.status === 'processing').length
  let empty: { title: string; detail: string } | null = null

  if (requests.length === 0) {
    empty = {
      title: 'No open requests',
      detail: 'New, Processing and Completed requests appear here as Local Plant Supply sends them.',
    }
  } else if (selected.length === 0) {
    empty = {
      title: 'No request buckets selected',
      detail: 'Select one or more buckets to see those requests.',
    }
  } else if (shown.length === 0 && activeCount === 0 && selected.some((id) => id === 'new' || id === 'processing')) {
    empty = {
      title: 'No New or Processing requests',
      detail: 'There is no active request work right now. Select Completed to review submitted requests.',
    }
  } else if (shown.length === 0) {
    empty = {
      title: 'Nothing in the selected buckets',
      detail: 'Choose another bucket to see the rest of the open request workload.',
    }
  }

  return (
    <>
      {empty && (
        <div className="flex flex-col items-center gap-2 py-16 text-center" role="status">
          <span className="text-[14px] font-semibold text-foreground">{empty.title}</span>
          <span className="text-[12.5px] text-muted-foreground">{empty.detail}</span>
        </div>
      )}
      {shown.map((request) => (
        <PartnerRequestRow
          key={request.id}
          request={request}
          href={`/partner/${supplierId}/requests/${request.id}`}
        />
      ))}
    </>
  )
}
