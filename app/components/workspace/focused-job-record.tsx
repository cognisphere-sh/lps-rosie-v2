'use client'

import { useEffect, useRef, useState } from 'react'
import { RequestCardHeader } from '@/components/workspace/request-list-card'

import { RequestBody } from '@/components/workspace/job-request'
import { DeleteRequestDialog, deleteRequestFromApi, requestDeletionCounts } from '@/components/workspace/request-delete'
import { useToast } from '@/components/workspace/frame'
import type { JobRequestRow } from '@/lib/rows'

/** One selected focused Job. Its secondary tray state belongs to this exact JR. */
export function FocusedJobRecord({
  request,
  mobile,
  version,
  onSaved,
  onNameSaved,
  onDeleted,
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
  const [expanded, setExpanded] = useState(true)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const deleteReturnFocus = useRef<HTMLElement | null>(null)
  const deleteSubmitting = useRef(false)
  useEffect(() => {
    setExpanded(true)
    setDetailsOpen(false)
    setDeleteOpen(false)
    setDeleteBusy(false)
    setDeleteError('')
    deleteSubmitting.current = false
  }, [request.id])

  return (
    <div data-focused-job-record={request.id} className="m-3 overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md">
      <RequestCardHeader
        request={request}
        mobile={mobile}
        expanded={expanded}
        onToggle={() => setExpanded((open) => !open)}
        onSaved={onSaved}
        onNameSaved={onNameSaved}
        showActions
        stacked
        onDelete={(returnFocus) => {
          deleteReturnFocus.current = returnFocus
          setDeleteError('')
          setDeleteOpen(true)
        }}
      />
      <div id={`request-body-${request.id}`}>
        {expanded && <RequestBody
          request={request}
          version={version}
          detailsOpen={detailsOpen}
          onToggleDetails={() => setDetailsOpen((open) => !open)}
          compactJobDetails
          touchTargets
          emptyItemsCopy="No active line items have been saved for this job yet."
          supplierTabs
          mobile={mobile}
          onSaved={onSaved}
        />}
      </div>
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
                toast(message, 'error')
                return
              }
              const deleted = requestDeletionCounts(result.body)
              if (!deleted) {
                const message = `Could not delete ${ref} — invalid response from the server.`
                setDeleteError(message)
                toast(message, 'error')
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
              toast(message, 'error')
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
