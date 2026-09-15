'use client'

import { useEffect, useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'

import { FocusedJobHeader } from '@/components/workspace/focused-job-header'
import { DemandSummary, RequestBody, RequestLinks, StatusPill } from '@/components/workspace/job-request'
import { DeleteRequestDialog, deleteRequestFromApi, requestDeletionCounts } from '@/components/workspace/request-delete'
import { useToast } from '@/components/workspace/shell'
import {
  REQUEST_STATUS_OPTIONS,
  requestStatusLabel,
  requestStatusTone,
} from '@/lib/job-requests'
import type { JobRequestRow } from '@/lib/rows'

/** One selected focused Job. Its secondary tray state belongs to this exact JR. */
export function FocusedJobRecord({
  request,
  mobile,
  version,
  onSaved,
  onNameSaved,
  onDeleted,
  actionsTarget,
}: {
  request: JobRequestRow
  mobile: boolean
  version: number
  onSaved: () => void
  onNameSaved?: (requestId: number) => void
  onDeleted?: () => void
  actionsTarget?: HTMLElement | null
}) {
  const toast = useToast()
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const deleteReturnFocus = useRef<HTMLElement | null>(null)
  const deleteSubmitting = useRef(false)
  useEffect(() => {
    setDetailsOpen(false)
    setDeleteOpen(false)
    setDeleteBusy(false)
    setDeleteError('')
    deleteSubmitting.current = false
  }, [request.id])

  return (
    <div data-focused-job-record={request.id} className="m-3 overflow-hidden rounded-xl border border-border bg-card">
      <FocusedJobHeader
        request={request}
        mobile={mobile}
        actionsTarget={actionsTarget}
        status={
          <StatusPill
            table="job_requests"
            id={request.id}
            column="status"
            value={request.status}
            label={requestStatusLabel(request.status)}
            accessibleLabel={requestStatusLabel(request.status)}
            tone={requestStatusTone(request.status)}
            options={REQUEST_STATUS_OPTIONS}
            touchTarget
            onSaved={onSaved}
          />
        }
        actions={
          <button
            type="button"
            aria-label={`Delete JR-${request.id}`}
            onClick={(event) => {
              deleteReturnFocus.current = event.currentTarget
              setDeleteError('')
              setDeleteOpen(true)
            }}
            className="flex min-h-11 items-center gap-1.5 rounded-md px-2 text-[11px] font-semibold text-muted-foreground outline-none hover:bg-destructive/10 hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Trash2 aria-hidden="true" size={14} /> Delete job
          </button>
        }
        preview={
          <div data-focused-job-summary className="space-y-2 border-b border-border bg-lps-tint px-3 py-2.5">
            <DemandSummary lineTotal={request.lineTotal} itemCount={request.itemCount} counts={request.statusCounts} wrap />
            <RequestLinks request={request} focusedMobile={mobile} relatedOnly={!mobile} />
          </div>
        }
        onNameSaved={onNameSaved ?? (() => onSaved())}
        onDateSaved={() => onSaved()}
      />
      <RequestBody
        request={request}
        version={version}
        detailsOpen={detailsOpen}
        onToggleDetails={() => setDetailsOpen((open) => !open)}
        compactJobDetails
        summaryInHeader
        touchTargets
        emptyItemsCopy="No active line items have been saved for this job yet."
        onSaved={onSaved}
      />
      {deleteOpen && (
        <DeleteRequestDialog
          request={request}
          busy={deleteBusy}
          error={deleteError}
          returnFocus={deleteReturnFocus}
          onCancel={() => setDeleteOpen(false)}
          onConfirm={() => {
            if (deleteSubmitting.current) return
            deleteSubmitting.current = true
            setDeleteBusy(true)
            setDeleteError('')
            const ref = `JR-${request.id}`
            void deleteRequestFromApi(request.id).then((result) => {
              if (!result.ok) {
                const message = `Could not delete ${ref}${result.body.error ? ` — ${result.body.error}` : ''}`
                setDeleteError(message)
                toast(message)
                return
              }
              const deleted = requestDeletionCounts(result.body)
              if (!deleted) {
                const message = `Could not delete ${ref} — invalid response from the server.`
                setDeleteError(message)
                toast(message)
                return
              }
              const lines = `${deleted.items} ${deleted.items === 1 ? 'line' : 'lines'}`
              const availability = deleted.availabilityRequests
                ? `, ${deleted.availabilityRequests} ${deleted.availabilityRequests === 1 ? 'availability request' : 'availability requests'}`
                : ''
              const orders = deleted.orders ? `, ${deleted.orders} ${deleted.orders === 1 ? 'order' : 'orders'}` : ''
              toast(`${ref} deleted · ${lines}${availability}${orders}`)
              setDeleteOpen(false)
              onDeleted?.()
            }).catch(() => {
              const message = `Could not delete ${ref} — check your connection and try again.`
              setDeleteError(message)
              toast(message)
            }).finally(() => {
              deleteSubmitting.current = false
              setDeleteBusy(false)
            })
          }}
        />
      )}
    </div>
  )
}
