'use client'

import {
  useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent as ReactMouseEvent,
} from 'react'

import { ARJobSchedules } from '@/components/workspace/ar-job-schedules'
import { AREditorBody, AREditorFooter, useAREditor, useARNarrow } from '@/components/workspace/ar-editor'
import { SizePill } from '@/components/workspace/chat-kit'
import {
  BodyModalPortal,
  firstModalFocusTarget,
  validModalFocusTarget,
} from '@/components/workspace/body-modal-portal'
import { CloseIcon } from '@/components/workspace/icons'
import { onOpenAvailabilityRequest, type ARPresentation } from '@/lib/chat-bus'
import { availabilityRecordName } from '@/lib/availability'
import { formatWeekdayMonthDay } from '@/lib/format'

interface DrawerSession {
  id: number
  generation: number
  presentation: ARPresentation
}

const DRAWER_WIDTH_STORE = 'lps:availability-request-drawer-width'
const DRAWER_DEFAULT_WIDTH = 640
const DRAWER_MIN_WIDTH = 360

function clampDrawerWidth(width: number): number {
  const max = Math.max(DRAWER_MIN_WIDTH, window.innerWidth)
  return Math.min(Math.max(width, DRAWER_MIN_WIDTH), max)
}

/**
 * One availability request in a right-hand drawer, openable from anywhere —
 * a job-request card's AR links, or an `[…](ar:<id>)` button in the chat
 * panel. Mounted once by the Shell; `openAvailabilityRequest(id)` opens it.
 *
 * Editable, unlike the supplier profile's read-only copy: suppliers answer by
 * phone and email as often as through the portal, so the admin enters those
 * answers here on their behalf, corrects the requested plant details, and moves
 * the request's own status. A closed request is read-only — reopen it first.
 */
export function AvailabilityRequestDrawer() {
  const [session, setSession] = useState<DrawerSession | null>(null)
  const [viewport, setViewport] = useState<{ top: number; height: number } | null>(null)
  const [width, setWidth] = useState(DRAWER_DEFAULT_WIDTH)
  const mobile = useARNarrow()

  const sessionRef = useRef<DrawerSession | null>(null)
  const generation = useRef(0)
  const returnFocus = useRef<HTMLElement | null>(null)
  const returnFocusFrame = useRef<number | null>(null)
  const widthHydrated = useRef(false)
  const resizeCleanup = useRef<(() => void) | null>(null)

  const cancelReturnFocusFrame = useCallback(() => {
    if (returnFocusFrame.current != null) cancelAnimationFrame(returnFocusFrame.current)
    returnFocusFrame.current = null
  }, [])

  const stopResize = useCallback(() => {
    resizeCleanup.current?.()
    resizeCleanup.current = null
  }, [])

  const scheduleOutsideFocus = useCallback((preferred: HTMLElement | null, closingHost: HTMLElement | null) => {
    cancelReturnFocusFrame()
    const attempt = (remaining: number) => {
      returnFocusFrame.current = requestAnimationFrame(() => {
        returnFocusFrame.current = null
        if (validModalFocusTarget(preferred)) {
          preferred.focus()
          return
        }
        // A close event can run before React commits the portal cleanup. Do not
        // choose a fallback while every candidate is still intentionally inert.
        if (closingHost?.isConnected && remaining > 0) {
          attempt(remaining - 1)
          return
        }
        firstModalFocusTarget(document.body, closingHost)?.focus()
      })
    }
    attempt(3)
  }, [cancelReturnFocusFrame])

  const close = useCallback(() => {
    if (!sessionRef.current) return
    const closingHost = document.querySelector<HTMLElement>('[data-ar-drawer-host]')
    const preferred = returnFocus.current
    stopResize()
    generation.current += 1
    sessionRef.current = null
    setSession(null)
    scheduleOutsideFocus(preferred, closingHost)
  }, [scheduleOutsideFocus, stopResize])

  useEffect(() => onOpenAvailabilityRequest((id, presentation) => {
    cancelReturnFocusFrame()
    if (!sessionRef.current) {
      const active = document.activeElement instanceof HTMLElement ? document.activeElement : null
      if (!active?.closest('[data-ar-drawer-host]')) returnFocus.current = active
    }
    generation.current += 1
    // A new generation remounts the session's editor, abandoning the old AR's work.
    const next = { id, generation: generation.current, presentation }
    sessionRef.current = next
    setSession(next)
  }), [cancelReturnFocusFrame])

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => setViewport({ top: vv.offsetTop, height: vv.height })
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])

  useEffect(() => {
    try {
      const saved = Number(window.localStorage.getItem(DRAWER_WIDTH_STORE))
      if (Number.isFinite(saved) && saved > 0) setWidth(clampDrawerWidth(saved))
    } catch {
      // Storage can be unavailable in a private browser context.
    }
    widthHydrated.current = true
  }, [])

  useEffect(() => {
    if (!widthHydrated.current) return
    try {
      window.localStorage.setItem(DRAWER_WIDTH_STORE, String(width))
    } catch {
      // The drawer remains usable if its preference cannot be saved.
    }
  }, [width])

  useEffect(() => {
    if (mobile) return
    const clamp = () => setWidth((current) => clampDrawerWidth(current))
    window.addEventListener('resize', clamp)
    return () => window.removeEventListener('resize', clamp)
  }, [mobile])

  useEffect(() => () => stopResize(), [stopResize])

  useEffect(() => () => {
    const closingHost = document.querySelector<HTMLElement>('[data-ar-drawer-host]')
    const preferred = returnFocus.current
    const wasOpen = sessionRef.current != null || closingHost != null
    generation.current += 1
    sessionRef.current = null
    if (wasOpen) scheduleOutsideFocus(preferred, closingHost)
  }, [scheduleOutsideFocus])

  const startResize = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault()
    stopResize()
    const startX = event.clientX
    const startWidth = width
    const move = (moved: MouseEvent) => setWidth(clampDrawerWidth(startWidth + (startX - moved.clientX)))
    const up = () => stopResize()
    resizeCleanup.current = () => {
      document.removeEventListener('mousemove', move)
      document.removeEventListener('mouseup', up)
    }
    document.addEventListener('mousemove', move)
    document.addEventListener('mouseup', up)
  }

  if (!session) return null

  return (
    <BodyModalPortal hostAttribute="data-ar-drawer-host">
      <div
        data-ar-drawer-backdrop
        className="lps-scrim fixed inset-x-0 top-0 z-[85] flex justify-end bg-black/30"
        style={{ top: viewport?.top ?? 0, height: viewport?.height ?? '100dvh' }}
        onClick={close}
      >
        {/* Not keyed: swapping the AR remounts the panel without re-sliding. */}
        <div className="lps-sheet h-full w-full min-[900px]:w-auto">
          <DrawerPanel
            key={session.generation}
            session={session}
            mobile={mobile}
            width={width}
            onWidth={setWidth}
            onStartResize={startResize}
            onClose={close}
          />
        </div>
      </div>
    </BodyModalPortal>
  )
}

/** One open session of the drawer: mounted per generation, so it edits exactly one AR. */
function DrawerPanel({ session, mobile, width, onWidth, onStartResize, onClose }: {
  session: DrawerSession
  mobile: boolean
  width: number
  onWidth: (width: number) => void
  onStartResize: (event: ReactMouseEvent<HTMLDivElement>) => void
  onClose: () => void
}) {
  const editor = useAREditor(session.id)
  const { ar } = editor
  const panel = useRef<HTMLDivElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  const focusFrame = useRef<number | null>(null)
  const focused = useRef(false)
  const priorMobile = useRef<boolean | null>(null)

  const cancelFocusFrame = useCallback(() => {
    if (focusFrame.current != null) cancelAnimationFrame(focusFrame.current)
    focusFrame.current = null
  }, [])

  // Focus the close button once per session, as soon as it can take focus.
  useEffect(() => {
    if (focused.current) return
    cancelFocusFrame()
    focusFrame.current = requestAnimationFrame(() => {
      focusFrame.current = null
      if (focused.current) return
      if (validModalFocusTarget(closeButton.current)) {
        focused.current = true
        closeButton.current.focus()
      }
    })
  }, [cancelFocusFrame, ar])

  useEffect(() => {
    const changed = priorMobile.current != null && priorMobile.current !== mobile
    priorMobile.current = mobile
    if (!changed) return
    cancelFocusFrame()
    focusFrame.current = requestAnimationFrame(() => {
      focusFrame.current = null
      if (validModalFocusTarget(closeButton.current)) closeButton.current.focus()
    })
  }, [cancelFocusFrame, mobile])

  useEffect(() => () => cancelFocusFrame(), [cancelFocusFrame])

  const keepFocusInside = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }
    if (event.key !== 'Tab') return
    const controls = Array.from(panel.current?.querySelectorAll<HTMLElement>(
      'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
    ) ?? []).filter(validModalFocusTarget)
    if (controls.length === 0) {
      event.preventDefault()
      panel.current?.focus()
      return
    }
    const first = controls[0]
    const last = controls[controls.length - 1]
    if (event.shiftKey && (document.activeElement === first || !panel.current?.contains(document.activeElement))) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && (document.activeElement === last || !panel.current?.contains(document.activeElement))) {
      event.preventDefault()
      first.focus()
    }
  }

  const name = availabilityRecordName(ar ?? { id: session.id })

  return (
    <div
      ref={panel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="availability-request-drawer-title"
      data-ar-generation={session.generation}
      tabIndex={-1}
      onKeyDown={keepFocusInside}
      onClick={(event) => event.stopPropagation()}
      className="relative flex h-full w-full flex-col overflow-hidden border-l border-border bg-background shadow-[var(--lps-shadow)] min-[900px]:w-[var(--ar-drawer-width)] min-[900px]:overflow-y-auto"
      style={{ '--ar-drawer-width': `${width}px` } as CSSProperties}
    >
      <div
        data-ar-drawer-resize-handle
        onMouseDown={onStartResize}
        title="Drag to resize"
        className="absolute -left-[3px] bottom-0 top-0 z-20 hidden w-[7px] cursor-col-resize select-none hover:bg-lps-edge min-[900px]:block"
      />
      <header className="flex flex-none items-start gap-2 border-b border-border bg-background pb-2 pl-[max(12px,env(safe-area-inset-left))] pr-[max(12px,env(safe-area-inset-right))] pt-[max(12px,env(safe-area-inset-top))] min-[900px]:border-b-0 min-[900px]:px-4 min-[900px]:pb-0 min-[900px]:pt-4">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
          <h2 id="availability-request-drawer-title" className="m-0 min-w-0 break-words text-[14px] font-bold text-foreground">
            Availability request {name}
          </h2>
          {ar && (
            <>
              <span className="whitespace-nowrap text-[11px] text-muted-foreground">
                Created on <span className="font-semibold tabular-nums text-foreground">{formatWeekdayMonthDay(ar.createdAt) || '—'}</span>
              </span>
              <ARJobSchedules schedules={ar.jobSchedules} showJobNames />
            </>
          )}
        </div>
        <button
          ref={closeButton}
          type="button"
          onClick={onClose}
          aria-label={`Close availability request ${name}`}
          className="ml-auto flex size-11 flex-none cursor-pointer items-center justify-center rounded-full border-none bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground min-[900px]:size-7"
        >
          <CloseIcon size={14} />
        </button>
      </header>

      <div className="hidden flex-none items-center gap-1 border-b border-border px-4 py-2 min-[900px]:flex">
        {([
          ['Full', () => clampDrawerWidth(window.innerWidth)],
          ['50%', () => clampDrawerWidth(Math.round(window.innerWidth * 0.5))],
          ['30%', () => clampDrawerWidth(Math.round(window.innerWidth * 0.3))],
        ] as const).map(([label, target]) => (
          <SizePill key={label} label={label} width={width} target={target} onPick={onWidth} />
        ))}
      </div>

      <div
        data-ar-drawer-scroller
        className="min-h-0 flex-1 space-y-2.5 overflow-y-auto py-3 pl-[max(12px,env(safe-area-inset-left))] pr-[max(12px,env(safe-area-inset-right))] min-[900px]:flex-none min-[900px]:overflow-visible min-[900px]:px-4 min-[900px]:pb-2 min-[900px]:pt-2.5"
      >
        <AREditorBody editor={editor} portal={session.presentation === 'focused-job'} mobile={mobile} drawerModal />
      </div>

      <AREditorFooter
        editor={editor}
        data-ar-drawer-footer=""
        className="flex-none border-t border-border bg-background pl-[max(12px,env(safe-area-inset-left))] pr-[max(12px,env(safe-area-inset-right))] pt-2.5 pb-[max(12px,env(safe-area-inset-bottom))] min-[900px]:mx-4 min-[900px]:mb-4 min-[900px]:border-t-0 min-[900px]:p-0"
      />
    </div>
  )
}
