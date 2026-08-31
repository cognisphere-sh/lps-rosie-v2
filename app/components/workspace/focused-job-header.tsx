'use client'

import Image from 'next/image'
import { createPortal } from 'react-dom'
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { MessageSquare } from 'lucide-react'

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

export interface FocusedJobChatMenuPosition {
  left: number
  width: number
  maxHeight: number
  top?: number
  bottom?: number
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
