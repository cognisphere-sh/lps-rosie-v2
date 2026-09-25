'use client'

import Image from 'next/image'
import { createPortal } from 'react-dom'
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { MessageSquare, Pencil } from 'lucide-react'

import { openChat } from '@/lib/chat-bus'
import { patchRow } from '@/components/workspace/editable'
import { JobMetadata } from '@/components/workspace/job-metadata'
import { useToast } from '@/components/workspace/shell'
import { JOB_NAME_MAX_LENGTH, jobRequestIdentityLine, storedJobIdentityComponents } from '@/lib/job-identity'
import { canonicalJobThread } from '@/lib/job-inbox'
import { requestRef } from '@/lib/job-requests'
import { formatWeekdayMonthDay } from '@/lib/format'
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

export interface FocusedJobChatMenuPosition {
  left: number
  width: number
  maxHeight: number
  top?: number
  bottom?: number
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

/** Fixed-position menu geometry: right-aligned where possible, clamped inward. */
export function focusedJobChatMenuPosition(
  trigger: Pick<DOMRect, 'left' | 'right' | 'top' | 'bottom'>,
  viewport: { width: number; height: number },
  itemCount: number,
): FocusedJobChatMenuPosition | null {
  const margin = 8
  const gap = 6
  if (trigger.bottom <= 0 || trigger.top >= viewport.height) return null

  const viewportRight = Math.max(margin, viewport.width - margin)
  const viewportBottom = Math.max(margin, viewport.height - margin)
  const width = Math.max(0, Math.min(288, viewportRight - margin))
  const naturalHeight = itemCount * 44 + 12
  const anchorTop = Math.min(Math.max(trigger.top, margin), viewportBottom)
  const anchorBottom = Math.min(Math.max(trigger.bottom, margin), viewportBottom)
  const belowTop = Math.min(Math.max(anchorBottom + gap, margin), viewportBottom)
  const aboveBottom = Math.min(Math.max(viewport.height - anchorTop + gap, margin), viewportBottom)
  const below = Math.max(0, viewportBottom - belowTop)
  const above = Math.max(0, viewportBottom - aboveBottom)
  const openAbove = naturalHeight > below && above > below
  const maxHeight = Math.min(naturalHeight, openAbove ? above : below)
  const maxLeft = Math.max(margin, viewportRight - width)
  const left = Math.min(Math.max(trigger.right - width, margin), maxLeft)
  return openAbove
    ? { left, width, maxHeight, bottom: aboveBottom }
    : { left, width, maxHeight, top: belowTop }
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
  const [position, setPosition] = useState<FocusedJobChatMenuPosition | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const portalHostRef = useRef<HTMLDivElement | null>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const restoreFocus = useRef(true)
  const initialFocus = useRef<'first' | 'last'>('first')
  const activeIndexRef = useRef(0)
  const focusedThreadRef = useRef<string | null>(null)
  const menuOwnsFocus = useRef(false)
  const choiceCountRef = useRef(0)
  const menuId = useId()
  const choices = focusedJobChatChoices(request)
  const choiceSignature = choices.map((choice) => `${choice.target.threadId}\u0000${choice.label}`).join('\u0001')
  choiceCountRef.current = choices.length

  const nextPosition = () => {
    const box = trigger.current?.getBoundingClientRect()
    if (!box) return null
    return focusedJobChatMenuPosition(
      box,
      { width: window.innerWidth, height: window.innerHeight },
      choiceCountRef.current,
    )
  }
  const close = (restore = true) => {
    restoreFocus.current = restore
    setOpen(false)
  }
  const show = (focus: 'first' | 'last' = 'first') => {
    if (open) {
      close()
      return
    }
    const next = nextPosition()
    if (!next) return
    const focusIndex = focus === 'first' ? 0 : choices.length - 1
    restoreFocus.current = true
    initialFocus.current = focus
    activeIndexRef.current = focusIndex
    focusedThreadRef.current = choices[focusIndex]?.target.threadId ?? null
    setActiveIndex(focusIndex)
    setPosition(next)
    const oldHost = portalHostRef.current
    if (oldHost?.isConnected) oldHost.remove()
    const host = document.createElement('div')
    host.dataset.focusedJobChatPortalHost = ''
    document.body.appendChild(host)
    portalHostRef.current = host
    setPortalHost(host)
    setOpen(true)
  }
  const choose = (target: FocusedJobChatTarget) => {
    // The global chat sheet/panel owns focus after routing; do not pull focus
    // back behind it as this menu unmounts.
    restoreFocus.current = false
    menuOwnsFocus.current = false
    setOpen(false)
    onOpenRosie(target)
  }
  const itemButtons = () => [
    ...(menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []),
  ]
  const focusItem = (index: number) => {
    const items = itemButtons()
    if (!items.length) return
    const next = (index + items.length) % items.length
    activeIndexRef.current = next
    focusedThreadRef.current = choices[next]?.target.threadId ?? null
    menuOwnsFocus.current = true
    setActiveIndex(next)
    items[next].focus()
  }
  const tabAway = (backward: boolean) => {
    const host = portalHostRef.current
    const focusable = [...document.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )].filter((element) => !host?.contains(element) && element.getAttribute('aria-hidden') !== 'true')
    const triggerIndex = trigger.current ? focusable.indexOf(trigger.current) : -1
    const destination = focusable[triggerIndex + (backward ? -1 : 1)]
    menuOwnsFocus.current = false
    close(false)
    if (destination) destination.focus()
    else trigger.current?.blur()
  }

  // The host belongs only to this open instance. Supplier refreshes update the
  // live portal contents below; they must never tear down and recreate its root.
  useEffect(() => {
    if (!open || !portalHost) return
    const focusIndex = initialFocus.current === 'first' ? 0 : choiceCountRef.current - 1
    focusItem(focusIndex)
    return () => {
      portalHost.remove()
      if (portalHostRef.current === portalHost) portalHostRef.current = null
      if (restoreFocus.current && trigger.current?.isConnected) trigger.current.focus()
    }
    // Opening captures one host and one initial focus target; refreshed options
    // are reconciled by the choice-signature effect without changing this root.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, portalHost])

  useEffect(() => {
    if (!open || !portalHost) return
    const outside = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (trigger.current?.contains(target) || menu.current?.contains(target)) return
      close()
    }
    const reposition = () => {
      const next = nextPosition()
      if (!next) {
        menuOwnsFocus.current = false
        close(false)
        return
      }
      setPosition(next)
    }
    const trackFocus = (event: FocusEvent) => {
      menuOwnsFocus.current = !!menu.current?.contains(event.target as Node | null)
    }
    document.addEventListener('pointerdown', outside, true)
    document.addEventListener('focusin', trackFocus, true)
    window.addEventListener('resize', reposition)
    window.addEventListener('scroll', reposition, true)
    return () => {
      document.removeEventListener('pointerdown', outside, true)
      document.removeEventListener('focusin', trackFocus, true)
      window.removeEventListener('resize', reposition)
      window.removeEventListener('scroll', reposition, true)
    }
    // Listener identity follows the open host only; current choice count is read
    // through a ref so a supplier refresh cannot leave stale geometry behind.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, portalHost])

  useEffect(() => {
    if (!open || !portalHost) return
    const next = nextPosition()
    if (!next) {
      menuOwnsFocus.current = false
      close(false)
      return
    }
    setPosition(next)

    const preserved = choices.findIndex((choice) => choice.target.threadId === focusedThreadRef.current)
    const nextActive = preserved >= 0
      ? preserved
      : Math.min(activeIndexRef.current, choices.length - 1)
    activeIndexRef.current = nextActive
    focusedThreadRef.current = choices[nextActive]?.target.threadId ?? null
    setActiveIndex(nextActive)
    if (menuOwnsFocus.current && (preserved < 0 || !menu.current?.contains(document.activeElement))) {
      itemButtons()[nextActive]?.focus()
    }
    // Route+label signature is the option-list lifecycle; the portal host and
    // global listeners intentionally remain owned by the open instance above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, portalHost, choiceSignature])

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = itemButtons()
    const current = items.indexOf(document.activeElement as HTMLButtonElement)
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      close()
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      focusItem(current + 1)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      focusItem(current - 1)
    } else if (event.key === 'Home') {
      event.preventDefault()
      focusItem(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      focusItem(items.length - 1)
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      items[current]?.click()
    } else if (event.key === 'Tab') {
      // A body-portal is not beside its trigger in DOM order, so hand Tab to
      // the trigger's real neighbour instead of trapping or wrapping the page.
      event.preventDefault()
      tabAway(event.shiftKey)
    }
  }

  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-label={`Choose a Rosie chat for ${requestRef(request.id)}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => show('first')}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
          event.preventDefault()
          if (open) focusItem(event.key === 'ArrowDown' ? 0 : choices.length - 1)
          else show(event.key === 'ArrowDown' ? 'first' : 'last')
        }}
        className="flex size-11 flex-none cursor-pointer items-center justify-center rounded-full border border-border bg-background hover:bg-muted"
      >
        <Image src="/rosie.png" alt="" width={28} height={28} className="size-7 rounded-full object-cover" />
      </button>
      {open && portalHost && position && createPortal(
        <div
          ref={menu}
          id={menuId}
          role="menu"
          aria-label={`Rosie chats for ${requestRef(request.id)}`}
          data-focused-job-chat-menu
          onKeyDown={onMenuKeyDown}
          style={position}
          className="fixed z-[120] overflow-y-auto rounded-xl border border-border bg-popover p-1.5 shadow-[var(--lps-shadow)]"
        >
          {choices.map((choice, index) => (
            <button
              key={choice.target.threadId}
              type="button"
              role="menuitem"
              tabIndex={activeIndex === index ? 0 : -1}
              onFocus={() => {
                activeIndexRef.current = index
                focusedThreadRef.current = choice.target.threadId
                menuOwnsFocus.current = true
                setActiveIndex(index)
              }}
              onClick={() => choose(choice.target)}
              className="flex min-h-11 w-full min-w-0 cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12.5px] font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <MessageSquare aria-hidden="true" className="flex-none text-primary" size={16} />
              <span className="min-w-0 break-words [overflow-wrap:anywhere]">{choice.label}</span>
            </button>
          ))}
        </div>,
        portalHost,
      )}
    </>
  )
}

export function focusConnectedJobNameTrigger(root: ParentNode | null, requestId: number): boolean {
  const target = root?.querySelector<HTMLButtonElement>(`[data-job-name-trigger="${requestId}"], [data-job-name-editor="${requestId}"] button`)
  if (!target?.isConnected || target.closest('[inert]')) return false
  target.focus({ preventScroll: true })
  return true
}

export function FocusedJobNameEditor({
  request,
  mobile,
  onSaved,
}: {
  request: JobRequestRow
  mobile: boolean
  onSaved: (requestId: number) => void
}) {
  const toast = useToast()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [validationError, setValidationError] = useState('')
  const trigger = useRef<HTMLButtonElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const controller = useRef<AbortController | null>(null)
  const generation = useRef(0)
  const submitting = useRef(false)
  const name = request.name?.trim() || ''
  const identity = storedJobIdentityComponents(request)
  const identityLine = jobRequestIdentityLine(request)

  const restoreFocus = () => requestAnimationFrame(() => {
    const target = trigger.current
    if (target?.isConnected && !target.closest('[inert]')) target.focus({ preventScroll: true })
  })

  useEffect(() => {
    generation.current += 1
    controller.current?.abort()
    controller.current = null
    submitting.current = false
    setEditing(false)
    setBusy(false)
    setDraft('')
    setValidationError('')
    return () => {
      generation.current += 1
      controller.current?.abort()
      controller.current = null
      submitting.current = false
    }
  }, [request.id])

  const cancel = () => {
    controller.current?.abort()
    controller.current = null
    submitting.current = false
    setEditing(false)
    setBusy(false)
    setValidationError('')
    restoreFocus()
  }

  const save = () => {
    if (submitting.current) return
    const next = draft.trim()
    if (!next || next === name) {
      cancel()
      return
    }
    if (next.length > JOB_NAME_MAX_LENGTH) {
      setValidationError(`Job name must be ${JOB_NAME_MAX_LENGTH} characters or fewer.`)
      requestAnimationFrame(() => input.current?.focus())
      return
    }
    setValidationError('')
    submitting.current = true
    const expected = generation.current
    const abort = new AbortController()
    controller.current = abort
    setBusy(true)
    void patchRow('job_requests', request.id, 'name', next, abort.signal)
      .then(() => {
        if (generation.current !== expected || abort.signal.aborted) return
        setEditing(false)
        onSaved(request.id)
      })
      .catch((error: unknown) => {
        if (generation.current !== expected || abort.signal.aborted) return
        toast(error instanceof Error ? error.message : 'Could not save')
        requestAnimationFrame(() => input.current?.focus())
      })
      .finally(() => {
        if (generation.current !== expected || abort.signal.aborted) return
        controller.current = null
        submitting.current = false
        setBusy(false)
        restoreFocus()
      })
  }

  if (editing) {
    const errorId = `job-name-error-${request.id}`
    return (
      <div data-job-name-editor className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center justify-center gap-1">
          <input
            ref={input}
            autoFocus
            aria-label={`Job name for JR-${request.id}`}
            aria-describedby={validationError ? errorId : undefined}
            aria-invalid={Boolean(validationError)}
            value={draft}
            placeholder="Job name"
            disabled={busy}
            onChange={(event) => {
              const next = event.target.value
              setDraft(next)
              setValidationError(next.trim().length > JOB_NAME_MAX_LENGTH
                ? `Job name must be ${JOB_NAME_MAX_LENGTH} characters or fewer.`
                : '')
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                save()
              } else if (event.key === 'Escape') {
                event.preventDefault()
                cancel()
              }
            }}
            className={mobile
              ? 'min-h-11 min-w-0 flex-1 rounded-md border border-primary bg-card px-2 text-[16px] font-bold outline-none focus-visible:ring-2 focus-visible:ring-ring'
              : 'min-h-11 min-w-[12rem] flex-1 rounded-md border border-primary bg-card px-2 text-center text-[12px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring'}
          />
          <button type="button" disabled={busy} onClick={save} className="min-h-11 rounded-md px-3 text-[12px] font-bold text-primary outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50">Save</button>
          <button type="button" disabled={busy} onClick={cancel} className="min-h-11 rounded-md px-3 text-[12px] font-semibold text-muted-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50">Cancel</button>
        </div>
        {validationError && <p id={errorId} role="alert" className="mt-1 text-[11px] font-semibold text-destructive">{validationError}</p>}
      </div>
    )
  }

  const begin = () => {
    setDraft(name)
    setValidationError('')
    setEditing(true)
  }

  if (mobile) {
    return (
      <button
        ref={trigger}
        type="button"
        disabled={busy}
        aria-label={`${name ? 'Edit' : 'Add'} job name for JR-${request.id}`}
        title={request.createdAt ? `Created ${formatWeekdayMonthDay(request.createdAt)}` : (name ? `Edit Job name: ${name}` : 'Add Job name')}
        data-job-name-trigger={request.id}
        onClick={begin}
        className="min-h-11 w-full min-w-0 break-words rounded-md text-left text-[18px] font-bold leading-tight outline-none [overflow-wrap:anywhere] hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
      >
        {name || 'Add Job name'}
      </button>
    )
  }

  const beforeJob = Boolean(identity.company && identity.job)
  const afterJob = Boolean(identity.job && identity.contact)
  const companyToContact = Boolean(identity.company && !identity.job && identity.contact)
  return (
    <div
      title={identityLine || 'No stored identity values'}
      className="min-h-11 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-center font-semibold leading-[44px]"
    >
      {identity.company && <span>{identity.company}</span>}
      {(beforeJob || companyToContact) && <span aria-hidden="true"> | </span>}
      {identity.job && (
        <button
          ref={trigger}
          type="button"
          disabled={busy}
          aria-label={`Edit job name for JR-${request.id}`}
          title={request.createdAt ? `Created ${formatWeekdayMonthDay(request.createdAt)}` : `Edit Job name: ${identity.job}`}
          data-job-name-trigger={request.id}
          onClick={begin}
          className="inline-flex min-h-11 max-w-full items-center rounded-md align-top font-semibold outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        >
          {identity.job}
        </button>
      )}
      {afterJob && <span aria-hidden="true"> | </span>}
      {identity.contact && <span>{identity.contact}</span>}
      {!identity.job && (
        <button
          ref={trigger}
          type="button"
          disabled={busy}
          aria-label={`Add job name for JR-${request.id}`}
          title="Add Job name"
          data-job-name-trigger={request.id}
          onClick={begin}
          className="ml-1 inline-flex size-11 items-center justify-center rounded-md align-top text-muted-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        >
          <Pencil aria-hidden="true" size={14} />
        </button>
      )}
    </div>
  )
}

/**
 * The selected Job's identity row. The breakpoint is resolved by /jobs once,
 * so only one status control and one Rosie action are mounted at a time.
 */
export function FocusedJobHeader({
  request,
  mobile,
  status,
  preview,
  actions,
  actionsTarget,
  onNameSaved = () => undefined,
  onDateSaved = () => undefined,
  onOpenRosie = openChat,
}: {
  request: JobRequestRow
  mobile: boolean
  status: ReactNode
  preview: ReactNode
  actions?: ReactNode
  actionsTarget?: HTMLElement | null
  onNameSaved?: (requestId: number) => void
  onDateSaved?: (requestId: number) => void
  onOpenRosie?: (target: FocusedJobChatTarget) => void
}) {
  const headerActions = (
    <div className="ml-auto flex flex-wrap items-center gap-1">
      {mobile ? <FocusedJobChatChooser request={request} onOpenRosie={onOpenRosie} /> : (
        <button
          type="button"
          onClick={() => onOpenRosie(focusedJobChatTarget(request))}
          title={`Chat with Rosie about ${requestRef(request.id)}`}
          aria-label="Chat with Rosie"
          className="flex size-11 flex-none items-center justify-center rounded-full text-primary outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Image src="/rosie.png" alt="" width={24} height={24} className="size-6 rounded-full" />
          <MessageSquare aria-hidden="true" className="sr-only" size={14} />
        </button>
      )}
      {actions}
    </div>
  )
  const fulfillmentTag = request.fulfillmentMethod && (
    <span data-job-fulfillment className="inline-flex shrink-0 items-center rounded-full border border-border px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
      {request.fulfillmentMethod === 'pickup' ? 'Pickup' : 'Delivery'}
    </span>
  )
  const identityLine = jobRequestIdentityLine(request)
  return (
    <>
      {mobile ? (
        <div data-focused-job-header="mobile" className="border-b border-border px-3 py-2.5">
          <div className="flex min-w-0 flex-wrap items-start gap-2">
            <div className="flex-none">{status}</div>
            <div className="min-w-0 flex-1 basis-40">
              <div className="text-[10px] font-bold uppercase tracking-[.06em] text-primary">
                {requestRef(request.id)}
              </div>
              <h1 className="m-0 min-w-0">
                <FocusedJobNameEditor key={request.id} request={request} mobile onSaved={onNameSaved} />
              </h1>
              {identityLine && identityLine !== request.name?.trim() && (
                <p data-mobile-job-identity className="m-0 min-w-0 break-words text-[11px] font-semibold text-muted-foreground [overflow-wrap:anywhere]">
                  {identityLine}
                </p>
              )}
              <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-2">
                {fulfillmentTag}
              </div>
            </div>
            <JobMetadata request={request} className="self-center" onDateSaved={onDateSaved} />
            {!actionsTarget && headerActions}
          </div>
        </div>
      ) : (
        <div
          data-focused-job-header="desktop"
          className="flex min-h-14 flex-wrap items-center gap-x-3 gap-y-1 border-b border-border px-3 py-1.5"
        >
          <div data-balanced-header-flank="left" className="flex min-w-0 items-center gap-1 overflow-hidden">
            {status}
            <span className="min-w-0 truncate font-bold text-primary">{requestRef(request.id)}</span>
            {fulfillmentTag}
          </div>
          <div data-desktop-job-identity className="min-w-0 flex-1 basis-40">
            <FocusedJobNameEditor key={request.id} request={request} mobile={false} onSaved={onNameSaved} />
          </div>
          <JobMetadata request={request} onDateSaved={onDateSaved} />
          {!actionsTarget && <div data-balanced-header-flank="right" className="ml-auto">{headerActions}</div>}
        </div>
      )}
      {actionsTarget && createPortal(headerActions, actionsTarget)}
      {preview}
    </>
  )
}
