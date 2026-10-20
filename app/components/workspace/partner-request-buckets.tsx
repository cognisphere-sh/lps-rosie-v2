'use client'

import { PartnerRequestCardLayout } from './partner-request-card-layout'
import { EmptyState, type EmptyArt } from './empty-state'

import { Check } from 'lucide-react'
import type { CSSProperties } from 'react'

import { partnerRequestName } from '@/components/workspace/partner'
import { type ARDetail } from '@/lib/availability'
import { cn } from '@/lib/utils'

/**
 * The portal's three work buckets, in the shared status tones (`--lps-tone-*`
 * in globals.css), so a bucket, its request pill and the admin's AR pill are
 * one colour. Text and border both read the tone's `-fg`: it clears 4.5:1 on
 * the card and on the tone's own tint in both themes, where the `-dot` would
 * not hold 3:1 as a border for every tone.
 */
export const REQUEST_BUCKETS = [
  { id: 'new', label: 'New', tone: 'blue' },
  { id: 'processing', label: 'Processing', tone: 'orange' },
  { id: 'submitted', label: 'Completed', tone: 'green' },
] as const satisfies readonly { id: string; label: string; tone: string }[]

export type RequestBucketId = (typeof REQUEST_BUCKETS)[number]['id']
export const DEFAULT_REQUEST_BUCKETS: readonly RequestBucketId[] = ['new', 'processing']

function paletteVariables(tone: (typeof REQUEST_BUCKETS)[number]['tone']): CSSProperties {
  return {
    '--bucket-text': `var(--lps-tone-${tone}-fg)`,
    '--bucket-bg': `var(--lps-tone-${tone}-bg)`,
  } as CSSProperties
}

const paletteClasses = 'border-[var(--bucket-text)] text-[var(--bucket-text)]'
const selectedPaletteClasses = 'bg-[var(--bucket-bg)]'

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
  return (
    <div role="group" aria-label="Request work buckets" className="flex gap-2 overflow-x-auto max-[899px]:w-full">
      {REQUEST_BUCKETS.map((bucket) => {
        const isSelected = selected.includes(bucket.id)
        return (
          <button
            key={bucket.id}
            type="button"
            data-request-bucket={bucket.id}
            onClick={() => onChange(
              isSelected ? selected.filter((id) => id !== bucket.id) : [...selected, bucket.id],
            )}
            aria-pressed={isSelected}
            aria-label={`${bucket.label}: ${counts[bucket.id]} requests, ${isSelected ? 'selected' : 'not selected'}`}
            className={cn(
              // Phones share the strip's width three ways; desktop keeps fixed boxes.
              'flex w-[9rem] min-w-[6.5rem] cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg border px-3 py-2 transition-colors duration-150 ease-lps max-[899px]:w-auto max-[899px]:min-w-0 max-[899px]:flex-1 max-[899px]:py-1.5',
              paletteClasses,
              isSelected
                ? selectedPaletteClasses
                : 'bg-transparent hover:bg-[var(--bucket-bg)]',
            )}
            style={paletteVariables(bucket.tone)}
          >
            <span className="inline-flex items-center gap-1 whitespace-nowrap text-[13px] font-medium">
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
        'inline-flex h-7 items-center justify-center whitespace-nowrap rounded-full border px-3 text-[13px] font-medium sm:w-[8.5rem]',
        paletteClasses,
        selectedPaletteClasses,
      )}
      style={paletteVariables(bucket.tone)}
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
    className="border-[var(--bucket-text)]" style={paletteVariables(bucket.tone)} />
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
  let empty: { art: EmptyArt; title: string; detail: string } | null = null

  if (requests.length === 0) {
    empty = {
      art: 'seed',
      title: 'No open requests',
      detail: 'New, Processing and Completed requests appear here as Local Plant Supply sends them.',
    }
  } else if (selected.length === 0) {
    empty = {
      art: 'tag',
      title: 'No request buckets selected',
      detail: 'Select one or more buckets to see those requests.',
    }
  } else if (shown.length === 0 && activeCount === 0 && selected.some((id) => id === 'new' || id === 'processing')) {
    empty = {
      art: 'bloom',
      title: 'No New or Processing requests',
      detail: 'There is no active request work right now. Select Completed to review submitted requests.',
    }
  } else if (shown.length === 0) {
    empty = {
      art: 'tag',
      title: 'Nothing in the selected buckets',
      detail: 'Choose another bucket to see the rest of the open request workload.',
    }
  }

  return (
    <>
      {empty && (
        <div role="status">
          <EmptyState art={empty.art} title={empty.title} hint={empty.detail} />
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
