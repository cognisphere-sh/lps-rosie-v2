'use client'

import { useEffect, useRef } from 'react'

import { requestRef } from '@/lib/job-requests'
import type { JobRequestRow } from '@/lib/rows'
import { cn } from '@/lib/utils'

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

export interface DeleteRequestBody {
  error?: string
  deleted?: {
    items: number
    availabilityRequests: number
    availabilityRequestItems: number
    changelog: number
    answers: number
    orders?: number
    orderItems?: number
    threads?: number
  }
}

/** Accept only the exact count object returned by the permanent DELETE route. */
export function requestDeletionCounts(body: DeleteRequestBody): NonNullable<DeleteRequestBody['deleted']> | null {
  const deleted = body.deleted
  if (!deleted) return null
  for (const value of [deleted.items, deleted.availabilityRequests, deleted.availabilityRequestItems, deleted.changelog, deleted.answers]) {
    if (!Number.isSafeInteger(value) || value < 0) return null
  }
  for (const value of [deleted.orders, deleted.orderItems, deleted.threads]) {
    if (value !== undefined && (!Number.isSafeInteger(value) || value < 0)) return null
  }
  return deleted
}

/** The one client path to the guarded permanent whole-request DELETE route. */
export async function deleteRequestFromApi(
  requestId: number,
  fetcher: typeof fetch = fetch,
): Promise<{ ok: boolean; status: number; body: DeleteRequestBody }> {
  const response = await fetcher(`/api/requests/${requestId}`, { method: 'DELETE' })
  const body = (await response.json().catch(() => ({}))) as DeleteRequestBody
  return { ok: response.ok, status: response.status, body }
}

export function DeleteRequestDialog({
  request,
  busy,
  error,
  returnFocus,
  onCancel,
  onConfirm,
}: {
  request: JobRequestRow
  busy: boolean
  error: string
  returnFocus: React.RefObject<HTMLElement | null>
  onCancel: () => void
  onConfirm: () => void
}) {
  const cancel = useRef<HTMLButtonElement>(null)
  const confirm = useRef<HTMLButtonElement>(null)
  const label = request.name ? `${requestRef(request.id)} — ${request.name}` : requestRef(request.id)

  useEffect(() => {
    cancel.current?.focus()
    return () => {
      // Cancel keeps the trigger; a successful delete replaces it with the
      // still-mounted request list before closing the dialog.
      setTimeout(() => returnFocus.current?.focus(), 0)
    }
  }, [returnFocus])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-busy={busy}
      aria-labelledby="delete-request-title"
      aria-describedby="delete-request-impact delete-request-status"
      className="lps-scrim fixed inset-0 z-[120] flex items-end justify-center bg-black/45 p-4 sm:items-center"
      onClick={() => { if (!busy) onCancel() }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !busy) onCancel()
        if (event.key !== 'Tab') return
        if (event.shiftKey && document.activeElement === cancel.current) {
          event.preventDefault()
          confirm.current?.focus()
        } else if (!event.shiftKey && document.activeElement === confirm.current) {
          event.preventDefault()
          cancel.current?.focus()
        }
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="lps-pop lps-pop-dialog w-full max-w-md rounded-2xl border border-border bg-popover p-5 shadow-[var(--lps-shadow)]"
      >
        <h2 id="delete-request-title" className="text-[18px] font-bold text-foreground">
          Permanently delete {label}?
        </h2>
        <p id="delete-request-impact" className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          This permanently removes {plural(request.itemCount, 'line')} and the request&apos;s change history.
          Its Rosie chat, availability requests and orders are also permanently deleted; an order shared with another job loses only this job's lines. The job deletion cannot be undone.
        </p>
        <p id="delete-request-status" role="status" aria-live="polite" className="mt-3 min-h-5 text-[12px] font-semibold text-muted-foreground">
          {busy ? 'Deleting request…' : ''}
        </p>
        {error && (
          <p role="alert" aria-live="assertive" className="mt-2 rounded-lg bg-destructive/10 px-3 py-2 text-[12px] font-semibold text-destructive">
            {error}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button
            ref={cancel}
            type="button"
            aria-disabled={busy}
            onClick={() => { if (!busy) onCancel() }}
            className={cn(
              'min-h-11 rounded-full border border-border bg-card px-5 text-[13px] font-semibold text-foreground transition-colors hover:bg-muted',
              busy ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
            )}
          >
            Cancel
          </button>
          <button
            ref={confirm}
            type="button"
            aria-disabled={busy}
            onClick={() => { if (!busy) onConfirm() }}
            className={cn(
              'min-h-11 rounded-full bg-destructive px-5 text-[13px] font-bold text-destructive-foreground transition-transform duration-100 ease-lps',
              busy ? 'cursor-not-allowed opacity-50' : 'cursor-pointer active:scale-[.97]',
            )}
          >
            {busy ? 'Deleting…' : 'Delete permanently'}
          </button>
        </div>
      </div>
    </div>
  )
}
