'use client'

import Image from 'next/image'
import { createPortal } from 'react-dom'
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { MessageSquare, X } from 'lucide-react'

import { openChat } from '@/lib/chat-bus'
import { canonicalJobThread } from '@/lib/job-inbox'
import { requestRef } from '@/lib/job-requests'
import type { JobRequestRow } from '@/lib/rows'

export interface FocusedJobChatTarget {
  agentId: 'rosie'
  threadId: string
  label: string
}

export interface FocusedJobChatChoice {
  label: string
  target: FocusedJobChatTarget
}

/** A strict project calendar date, never a timestamp or Date-parse fallback. */
export function formatEstimatedProjectDate(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null

  const [, yearText, monthText, dayText] = match
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const daysInMonth = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth[month - 1]) return null

  // Format from the validated calendar components: no Date construction means
  // no rollover and no browser/server timezone can move the project day.
  return `${month}/${day}/${yearText.slice(-2)}`
}

export function focusedJobChatTarget(request: Pick<JobRequestRow, 'id' | 'name'>): FocusedJobChatTarget {
  return {
    agentId: 'rosie',
    threadId: canonicalJobThread(request.id),
    label: request.name || requestRef(request.id),
  }
}

/**
 * Existing conversations only: canonical Job first, then one supplier option
 * per normalized thread id in stable first-seen supplier order. A duplicate or
 * Job-thread collision is not another destination, whatever label carried it.
 */
export function focusedJobChatChoices(
  request: Pick<JobRequestRow, 'id' | 'name' | 'supplierLinks'>,
): FocusedJobChatChoice[] {
  const job = focusedJobChatTarget(request)
  const seen = new Set([job.threadId])
  const suppliers: FocusedJobChatChoice[] = []
  for (const supplier of request.supplierLinks) {
    const threadId = supplier.rosieThreadId?.trim()
    if (!threadId || seen.has(threadId)) continue
    seen.add(threadId)
    suppliers.push({
      label: `Supplier chat · ${supplier.name}`,
      target: { agentId: 'rosie', threadId, label: supplier.name },
    })
  }
  return [{ label: `Job chat · ${requestRef(request.id)}`, target: job }, ...suppliers]
}

function FocusedJobChatChooser({
  request,
  onOpenRosie,
}: {
  request: JobRequestRow
  onOpenRosie: (target: FocusedJobChatTarget) => void
}) {
  const [open, setOpen] = useState(false)
  const [portalHost, setPortalHost] = useState<HTMLDivElement | null>(null)
  const portalHostRef = useRef<HTMLDivElement | null>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const surface = useRef<HTMLDivElement>(null)
  const firstOption = useRef<HTMLButtonElement>(null)
  const restoreFocus = useRef(true)
  const titleId = useId()
  const dialogId = useId()
  const choices = focusedJobChatChoices(request)

  useEffect(() => () => portalHostRef.current?.remove(), [])

  useEffect(() => {
    if (!open || !portalHost) return
    const siblings = [...document.body.children]
      .filter((element): element is HTMLElement => element instanceof HTMLElement && element !== portalHost)
      .map((element) => ({
        element,
        hadInertAttribute: element.hasAttribute('inert'),
        inertAttribute: element.getAttribute('inert'),
        hadInertProperty: 'inert' in element,
        inertProperty: (element as HTMLElement & { inert?: boolean }).inert,
        hadAriaHidden: element.hasAttribute('aria-hidden'),
        ariaHidden: element.getAttribute('aria-hidden'),
      }))
    const overflow = document.body.style.overflow

    for (const snapshot of siblings) {
      snapshot.element.setAttribute('inert', '')
      ;(snapshot.element as HTMLElement & { inert: boolean }).inert = true
      snapshot.element.setAttribute('aria-hidden', 'true')
    }
    document.body.style.overflow = 'hidden'
    firstOption.current?.focus()

    return () => {
      for (const snapshot of siblings) {
        // Chromium reflects `.inert` through the boolean attribute. Restore
        // the property first, then put the exact captured attribute bytes back;
        // doing this in the opposite order normalizes `inert="legacy-value"`.
        if (snapshot.hadInertProperty) {
          ;(snapshot.element as HTMLElement & { inert?: boolean }).inert = snapshot.inertProperty
        } else {
          Reflect.deleteProperty(snapshot.element, 'inert')
        }
        if (snapshot.hadInertAttribute) {
          snapshot.element.setAttribute('inert', snapshot.inertAttribute ?? '')
        } else {
          snapshot.element.removeAttribute('inert')
        }
        if (snapshot.hadAriaHidden) {
          snapshot.element.setAttribute('aria-hidden', snapshot.ariaHidden ?? '')
        } else {
          snapshot.element.removeAttribute('aria-hidden')
        }
      }
      document.body.style.overflow = overflow
      portalHost.remove()
      if (portalHostRef.current === portalHost) portalHostRef.current = null
      if (restoreFocus.current && trigger.current?.isConnected) trigger.current.focus()
    }
  }, [open, portalHost])

  const show = () => {
    restoreFocus.current = true
    const host = document.createElement('div')
    host.dataset.focusedJobChatPortalHost = ''
    document.body.appendChild(host)
    portalHostRef.current = host
    setPortalHost(host)
    setOpen(true)
  }
  const dismiss = () => {
    restoreFocus.current = true
    setOpen(false)
  }
  const choose = (target: FocusedJobChatTarget) => {
    // The global chat sheet/panel owns focus after routing; do not pull focus
    // back behind it as this chooser unmounts.
    restoreFocus.current = false
    setOpen(false)
    onOpenRosie(target)
  }
  const containFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      dismiss()
      return
    }
    if (event.key !== 'Tab') return
    const controls = [...(surface.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') ?? [])]
    if (!controls.length) return
    const first = controls[0]
    const last = controls[controls.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    } else if (!surface.current?.contains(document.activeElement)) {
      event.preventDefault()
      firstOption.current?.focus()
    }
  }

  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-label={`Choose a Rosie chat for ${requestRef(request.id)}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? dialogId : undefined}
        onClick={show}
        className="flex size-11 flex-none cursor-pointer items-center justify-center rounded-full border border-border bg-background text-primary hover:bg-muted"
      >
        <MessageSquare aria-hidden="true" size={20} />
      </button>
      {open && portalHost && createPortal(
        <div
          role="presentation"
          data-focused-job-chat-backdrop
          className="fixed inset-0 z-[120] flex items-end justify-center bg-black/40 p-3 sm:items-center"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) dismiss()
          }}
        >
          <div
            ref={surface}
            id={dialogId}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onKeyDown={containFocus}
            className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-sm flex-col overflow-hidden rounded-2xl border border-border bg-popover shadow-[var(--lps-shadow)]"
          >
            <div className="sticky top-0 z-10 flex flex-none items-center justify-between gap-2 border-b border-border bg-popover py-1.5 pl-3 pr-1.5">
              <h2 id={titleId} className="text-[14px] font-bold text-foreground">Choose a chat</h2>
              <button
                type="button"
                aria-label="Close chat chooser"
                onClick={dismiss}
                className="flex size-11 flex-none cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X aria-hidden="true" size={18} />
              </button>
            </div>
            <div data-focused-job-chat-options className="flex min-h-0 min-w-0 flex-col overflow-y-auto p-1.5">
              {choices.map((choice, index) => (
                <button
                  key={choice.target.threadId}
                  ref={index === 0 ? firstOption : undefined}
                  type="button"
                  onClick={() => choose(choice.target)}
                  className="flex min-h-11 min-w-0 cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-left text-[12.5px] font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <MessageSquare aria-hidden="true" className="flex-none text-primary" size={16} />
                  <span className="min-w-0 break-words [overflow-wrap:anywhere]">{choice.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>,
        portalHost,
      )}
    </>
  )
}

/**
 * The selected Job's identity row. The breakpoint is resolved by /jobs once,
 * so only one status control and one Rosie action are mounted at a time.
 */
export function FocusedJobHeader({
  request,
  mobile,
  projectDate,
  status,
  preview,
  onOpenRosie = openChat,
}: {
  request: JobRequestRow
  mobile: boolean
  /** Existing project-date metadata only; null keeps the honest omission. */
  projectDate: string | null
  status: ReactNode
  preview: ReactNode
  onOpenRosie?: (target: FocusedJobChatTarget) => void
}) {
  const name = request.name || request.customer?.company || request.customer?.name || 'Unnamed job'
  const projectDateLabel = formatEstimatedProjectDate(projectDate)

  return (
    <>
      {mobile ? (
        <div data-focused-job-header="mobile" className="border-b border-border px-3 py-2.5">
          <div className="flex min-w-0 items-start gap-2">
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-bold uppercase tracking-[.06em] text-primary">
                {requestRef(request.id)}
              </div>
              <h1 className="m-0 min-w-0 break-words text-[18px] font-bold leading-tight [overflow-wrap:anywhere]">
                {name}
              </h1>
              <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-2">
                {projectDateLabel && (
                  <span className="whitespace-nowrap text-[11px] font-semibold text-muted-foreground">
                    EPD: {projectDateLabel}
                  </span>
                )}
                {status}
              </div>
            </div>
            <FocusedJobChatChooser request={request} onOpenRosie={onOpenRosie} />
          </div>
        </div>
      ) : (
        <div data-focused-job-header="desktop" className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
          <span className="font-bold text-primary">{requestRef(request.id)}</span>
          <span className="min-w-0 flex-1 truncate font-semibold">{name}</span>
          {status}
          <button
            type="button"
            onClick={() => onOpenRosie(focusedJobChatTarget(request))}
            className="flex min-h-11 items-center gap-2 rounded-full px-3 text-[12px] font-semibold text-primary"
          >
            <Image src="/rosie.png" alt="" width={22} height={22} className="rounded-full" />
            Chat with Rosie
            <MessageSquare size={14} />
          </button>
        </div>
      )}
      {preview}
    </>
  )
}
