'use client'

// The one workspace chrome both apps stand in. The admin `Shell` and the
// supplier `PartnerFrame` used to be two copies of the same layout — a
// collapsible left rail, a header, a page column, a chat column on the right,
// a bottom tab bar with a ⋯ More menu on mobile — that drifted whenever one
// gained something (a Reload button, say) the other didn't. This is the
// layout, once. Everything a role adds — its destinations, its identity,
// its bell, its chat, what sits around the shared footer actions — comes in
// through slots; the frame itself owns only what both apps do identically.

import { RefreshCw } from 'lucide-react'
import { useRouter } from 'next/navigation'
import {
  createContext, useCallback, useContext, useEffect, useRef, useState,
} from 'react'
import Link from 'next/link'

import { InstallAppButton } from '@/components/pwa/install-app-button'
import { usePWA } from '@/components/pwa/pwa-provider'
import {
  AlertIcon, CheckIcon, ChevronLeft, ChevronRight, CloseIcon, InstallIcon, MoonIcon, SunIcon,
} from '@/components/workspace/icons'
import { cn } from '@/lib/utils'

// ------------------------------------------------------------------- toasts

// A confirmation fades on its own; a failure stays until it is dismissed (or
// replaced), so a write that did not land never passes for one that did.
export type ToastTone = 'success' | 'error'
export type ShowToast = (message: string, tone?: ToastTone) => void

const ToastCtx = createContext<ShowToast>(() => {})
export const useToast = () => useContext(ToastCtx)

// ------------------------------------------------------------------- theme

/** Both apps read one `lps.theme` preference. */
export function useTheme() {
  const [dark, setDark] = useState(false)

  useEffect(() => {
    const stored = window.localStorage.getItem('lps.theme')
    const isDark = stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches
    setDark(isDark)
    document.documentElement.classList.toggle('dark', isDark)
  }, [])

  const toggle = () =>
    setDark((prev) => {
      const next = !prev
      document.documentElement.classList.toggle('dark', next)
      window.localStorage.setItem('lps.theme', next ? 'dark' : 'light')
      return next
    })

  return { dark, toggle }
}

/** Mirrors the design's `isMobile = width < 900` breakpoint. */
export function useIsMobile() {
  const [mobile, setMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 899px)')
    const sync = () => setMobile(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])
  return mobile
}

/**
 * The desktop nav rail's collapsed/expanded choice, per device.
 *
 * It has to be stored rather than held in state: every page renders its own
 * frame, so a plain `useState` springs back to its initial value on each
 * navigation. The rail starts **collapsed** — the workspace tables want the
 * width more than the labels do — and only the rail's own chevron changes that.
 */
const NAV_OPEN_STORE = 'lps.nav.open'

function nearestVerticalScroller(target: EventTarget | null, boundary: HTMLElement): HTMLElement | null {
  let el = target instanceof HTMLElement ? target : null
  while (el && el !== boundary) {
    const overflow = window.getComputedStyle(el).overflowY
    if ((overflow === 'auto' || overflow === 'scroll') && el.scrollHeight > el.clientHeight) return el
    el = el.parentElement
  }
  return null
}

// ------------------------------------------------------------------- frame

export type NavItem = {
  id: string
  label: string
  /** The mobile bottom bar's label, where the rail's may not fit. */
  short?: string
  href: string
  Icon: React.ComponentType<{ size?: number }>
  enabled?: boolean
}

/** What the frame knows that a role's slots may need. */
export type FrameState = {
  isMobile: boolean
  navOpen: boolean
  /** Collapses/expands the rail for now, without changing the saved choice. */
  setNavOpen: (open: boolean) => void
  keyboardOpen: boolean
  moreMenuOpen: boolean
  closeMoreMenu: () => void
  showToast: ShowToast
  /** The rail's row style — so a role's own rows match the shared ones. */
  railBtn: (active: boolean, enabled?: boolean) => string
}

/** The ⋯ More menu's row style, shared the same way. The menu is mobile-only, so rows keep a 44px target. */
export const moreItemClass =
  'flex w-full cursor-pointer items-center gap-2 rounded-lg border-none bg-transparent px-2.5 min-h-11 text-left text-[13px] font-semibold text-foreground transition-colors duration-150 hover:bg-muted'

type Slot = (state: FrameState) => React.ReactNode

export function WorkspaceFrame({
  title,
  toolbar,
  headerAction,
  headerExtras,
  hideHeaderOnMobile = false,
  hideHeaderOnDesktop = false,
  hideHeader = false,
  theme,
  nav,
  activeId,
  moreActive = false,
  onNavOpenChange,
  mobileOverlay,
  railIdentity,
  railTop,
  railBottom,
  railHidden = false,
  railOpenWidth = 196,
  moreTop,
  moreBottom,
  mobileBarLeft,
  mobileBarRight,
  hideMobileBar = false,
  pageOverlays,
  rightColumn,
  pageColumnClassName = 'flex-1',
  disablePull = false,
  style,
  children,
}: {
  title: string
  /** Sits under the header, above the scrolling page. */
  toolbar?: React.ReactNode
  headerAction?: React.ReactNode
  /** Trailing header content, desktop only — the role's bell and the like. */
  headerExtras?: React.ReactNode
  hideHeaderOnMobile?: boolean
  /** Ordinary list workspaces can use their existing toolbar as the desktop top row. */
  hideHeaderOnDesktop?: boolean
  /** Purpose-built full-screen surfaces replace the shared header entirely. */
  hideHeader?: boolean
  /** The caller's `useTheme()` — it is above the frame, so it owns the hook. */
  theme: { dark: boolean; toggle: () => void }
  nav: readonly NavItem[]
  activeId: string
  /** Highlight the mobile ⋯ More tab — the page lives under it. */
  moreActive?: boolean
  onNavOpenChange?: (open: boolean) => void
  /**
   * A view a role opens over the page column on mobile (a chat, a list).
   * While it is open the page underneath is not what you are looking at, so
   * the bar's highlight and taps are about putting the page back: tapping
   * the destination you are on `close`s it, tapping another `dismiss`es it
   * (its history entry stays, so Back returns to it) on the way out.
   */
  mobileOverlay?: { open: boolean; close: () => void; dismiss: () => void }
  /** Drawn above the destinations in the rail — the supplier's identity. */
  railIdentity?: Slot
  /** Rail footer rows before / after the shared Dark mode · Install · Reload. */
  railTop?: Slot
  railBottom?: Slot
  railHidden?: boolean
  railOpenWidth?: number
  /** ⋯ More rows before / after the shared ones, in the rail's order. */
  moreTop?: Slot
  moreBottom?: Slot
  /** The bottom bar's pinned edges: the bell on the left, chat on the right. */
  mobileBarLeft: Slot
  mobileBarRight: Slot
  /** Purpose-built full-screen modes (such as focused intake) hide app navigation. */
  hideMobileBar?: boolean
  /** Rendered inside the page column, over its content. */
  pageOverlays?: Slot
  /** The desktop column right of the page — a chat panel or its rail. */
  rightColumn?: Slot
  pageColumnClassName?: string
  /** Pull-to-refresh is off while something covers the page. */
  disablePull?: boolean
  style?: React.CSSProperties
  children: React.ReactNode
}) {
  const router = useRouter()
  const isMobile = useIsMobile()
  const { dark, toggle } = theme
  const { isStandalone } = usePWA()
  const [navOpen, setNavOpen] = useState(false)
  const [moreMenu, setMoreMenu] = useState(false)
  const mobileNavScroll = useRef<HTMLDivElement | null>(null)
  const mobileNavItems = useRef<Record<string, HTMLElement | null>>({})
  const [viewportFrame, setViewportFrame] = useState({ top: '0px', height: '100dvh' })
  const [keyboardOpen, setKeyboardOpen] = useState(false)
  const [pagePull, setPagePull] = useState(0)
  const [pageRefreshing, setPageRefreshing] = useState(false)
  const [toast, setToast] = useState<{ message: string; tone: ToastTone } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const pageRefreshTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const pagePullStart = useRef<{ x: number; y: number; scroller: HTMLElement | null } | null>(null)

  const showToast = useCallback<ShowToast>((message, tone = 'success') => {
    setToast({ message, tone })
    clearTimeout(timer.current)
    if (tone !== 'error') timer.current = setTimeout(() => setToast(null), 4000)
  }, [])

  useEffect(() => () => {
    clearTimeout(timer.current)
    clearTimeout(pageRefreshTimer.current)
  }, [])

  useEffect(() => {
    // Android standalone PWAs can report 100dvh as the full physical display,
    // including system bars outside the usable visual viewport. When its
    // keyboard pans to a focused field, visualViewport.offsetTop is non-zero;
    // anchoring to that offset prevents equal-and-opposite clipping/blank space.
    const viewport = window.visualViewport
    const update = () => {
      const height = Math.min(window.innerHeight, viewport?.height ?? window.innerHeight)
      setViewportFrame({
        top: `${Math.round(viewport?.offsetTop ?? 0)}px`,
        height: `${Math.round(height)}px`,
      })

      const active = document.activeElement
      const typing = active instanceof HTMLInputElement
        || active instanceof HTMLTextAreaElement
        || (active instanceof HTMLElement && active.isContentEditable)
      setKeyboardOpen(window.matchMedia('(max-width: 899px)').matches && typing)
    }
    update()
    window.addEventListener('resize', update)
    document.addEventListener('focusin', update)
    document.addEventListener('focusout', update)
    viewport?.addEventListener('resize', update)
    viewport?.addEventListener('scroll', update)
    return () => {
      window.removeEventListener('resize', update)
      document.removeEventListener('focusin', update)
      document.removeEventListener('focusout', update)
      viewport?.removeEventListener('resize', update)
      viewport?.removeEventListener('scroll', update)
    }
  }, [])

  useEffect(() => {
    // Only '1' opens it: an unset preference means collapsed, so the default
    // costs no expand-then-collapse flash on first paint.
    setNavOpen(window.localStorage.getItem(NAV_OPEN_STORE) === '1')
  }, [])

  const setNavOpenStored = useCallback((open: boolean) => {
    window.localStorage.setItem(NAV_OPEN_STORE, open ? '1' : '0')
    setNavOpen(open)
  }, [])

  useEffect(() => {
    onNavOpenChange?.(navOpen)
  }, [navOpen, onNavOpenChange])

  // Close the mobile ⋯ menu on any outside click.
  useEffect(() => {
    if (!moreMenu) return
    const close = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-more-menu]')) setMoreMenu(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [moreMenu])

  // The middle mobile strip deliberately shows only three destinations at a
  // time. Keep the current route (or More) in view without using
  // scrollIntoView, which can also move the page horizontally on mobile.
  useEffect(() => {
    if (!isMobile) return
    const strip = mobileNavScroll.current
    const active = mobileNavItems.current[moreActive ? 'more' : activeId]
    if (!strip || !active) return
    // Measured against the strip itself: `offsetLeft` counts from the nav,
    // which also holds the pinned left button, so it overshot by that width.
    const left = strip.scrollLeft + active.getBoundingClientRect().left - strip.getBoundingClientRect().left
      - (strip.clientWidth - active.offsetWidth) / 2
    strip.scrollTo({ left: Math.max(0, left), behavior: 'smooth' })
  }, [isMobile, activeId, moreActive])

  const closeMoreMenu = useCallback(() => setMoreMenu(false), [])

  const railBtn = (active: boolean, enabled = true) =>
    cn(
      'flex items-center gap-2.5 rounded-[10px] border-none text-[13px] font-semibold w-full text-left transition-colors duration-150 ease-lps',
      navOpen ? 'px-2.5 py-2 justify-start' : 'px-0 py-2 justify-center',
      // Where you are is the rail's one solid mark; everything else stays ink.
      active ? 'bg-primary text-primary-foreground shadow-[0_1px_2px_rgba(30,59,40,.2)]' : 'text-muted-foreground',
      !enabled ? 'cursor-not-allowed opacity-45' : active ? 'cursor-pointer' : 'cursor-pointer hover:bg-muted hover:text-foreground',
    )

  const state: FrameState = {
    isMobile, navOpen, setNavOpen, keyboardOpen,
    moreMenuOpen: moreMenu, closeMoreMenu, showToast, railBtn,
  }

  const overlayOpen = !!mobileOverlay?.open

  return (
    <ToastCtx.Provider value={showToast}>
      <div
        data-workspace-shell
        className="fixed inset-x-0 flex flex-col overflow-hidden bg-background"
        style={{ top: viewportFrame.top, height: viewportFrame.height, ...style }}
      >
        <a href="#main-content"
          className="sr-only z-[100] rounded-md bg-primary px-3 py-2 text-[13px] font-semibold text-primary-foreground focus:not-sr-only focus:absolute focus:left-2 focus:top-2">
          Skip to content
        </a>
        {/* A page that hides the header still has a heading to navigate by. */}
        {(hideHeader || (isMobile ? hideHeaderOnMobile : hideHeaderOnDesktop)) && <h1 className="sr-only">{title}</h1>}
        {!hideHeader && (isMobile ? !hideHeaderOnMobile : !hideHeaderOnDesktop) && (
          <div className="flex min-h-12 flex-none items-center gap-2 border-b border-border bg-card px-3 pb-1 pt-[calc(0.25rem+env(safe-area-inset-top))] md:px-4 min-[900px]:pt-1">
            <div className="min-w-0 flex-1">
              <h1
                title={title}
                className="m-0 truncate font-serif text-[20px] font-bold leading-7 tracking-[-0.01em] text-foreground min-[900px]:text-[23px]"
              >
                {title}
              </h1>
            </div>
            {headerAction && (
              <div className="flex flex-none items-center gap-1.5 [&>a]:min-h-11 [&>a]:min-w-11 [&>button]:min-h-11 [&>button]:min-w-11">
                {headerAction}
              </div>
            )}
            {!isMobile && headerExtras && (
              <div className="flex flex-none items-center gap-1.5 [&>a]:min-h-11 [&>a]:min-w-11 [&>button]:min-h-11 [&>button]:min-w-11">
                {headerExtras}
              </div>
            )}
          </div>
        )}

        <div className={cn('flex min-h-0 flex-1', !hideHeader && isMobile && hideHeaderOnMobile && !overlayOpen && 'pt-[env(safe-area-inset-top)]')}>
          {/* Desktop nav rail */}
          {!isMobile && !railHidden && (
            <nav
              className="flex flex-none flex-col gap-0.5 border-r border-border bg-card"
              style={{ width: navOpen ? railOpenWidth : 56, padding: navOpen ? '12px 10px' : '12px 8px' }}
            >
              {railIdentity && (
                <div className={cn('mb-2', navOpen ? 'px-1' : 'flex justify-center')}>{railIdentity(state)}</div>
              )}

              {nav.map(({ id, label, href, Icon, enabled = true }) =>
                enabled ? (
                  <Link key={id} href={href} title={label} aria-label={navOpen ? undefined : label}
                    aria-current={activeId === id ? 'page' : undefined} className={railBtn(activeId === id)}>
                    <span className="flex size-4 flex-none items-center justify-center"><Icon /></span>
                    {navOpen && <span>{label}</span>}
                  </Link>
                ) : (
                  <button key={id} type="button" disabled title={`${label} — not built yet`} className={railBtn(false, false)}>
                    <span className="flex size-4 flex-none items-center justify-center"><Icon /></span>
                    {navOpen && <span>{label}</span>}
                  </button>
                ),
              )}

              <div className="flex-1" />

              <div className="flex flex-col gap-0.5 border-t border-lps-hair pt-2">
                {railTop?.(state)}

                <button type="button" onClick={toggle} title={dark ? 'Dark mode' : 'Light mode'} className={railBtn(false)}>
                  <span className="flex size-4 flex-none items-center justify-center">
                    {dark ? <MoonIcon /> : <SunIcon />}
                  </span>
                  {navOpen && (
                    <>
                      <span>{dark ? 'Dark mode' : 'Light mode'}</span>
                      <span
                        className={cn('relative ml-auto h-[17px] w-[30px] flex-none rounded-full transition-colors duration-150 ease-lps', dark ? 'bg-primary' : 'bg-muted')}
                      >
                        <span
                          className={cn('absolute left-[2px] top-[2px] size-[13px] rounded-full bg-card transition-transform duration-150 ease-lps', dark && 'translate-x-[13px]')}
                        />
                      </span>
                    </>
                  )}
                </button>

                {/* Install app and Reload are each other's complement: a
                    browser tab can install but reloads itself; the installed
                    window has no toolbar to reload from and nothing to install. */}
                {!isStandalone && (
                  <InstallAppButton title="Install app" onMessage={showToast} className={railBtn(false)}>
                    <span className="flex size-4 flex-none items-center justify-center"><InstallIcon /></span>
                    {navOpen && <span>Install app</span>}
                  </InstallAppButton>
                )}

                {isStandalone && (
                  <button type="button" onClick={() => window.location.reload()} title="Reload" className={railBtn(false)}>
                    <span className="flex size-4 flex-none items-center justify-center"><RefreshCw size={15} /></span>
                    {navOpen && <span>Reload</span>}
                  </button>
                )}

                {railBottom?.(state)}
              </div>

              <button
                type="button"
                onClick={() => setNavOpenStored(!navOpen)}
                aria-label={navOpen ? 'Collapse navigation' : 'Expand navigation'}
                title={navOpen ? 'Collapse navigation' : 'Expand navigation'}
                className="mt-1.5 flex h-7 cursor-pointer items-center justify-center rounded-[9px] border border-border bg-transparent text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
              >
                <span className="flex size-3.5">{navOpen ? <ChevronLeft /> : <ChevronRight />}</span>
              </button>
            </nav>
          )}

          {/* The page column: toolbar pinned under the header, then the
              page's own scroller, then whatever the role draws over it. */}
          <div className={cn('flex min-h-0 min-w-0 flex-col overflow-hidden', pageColumnClassName)}>
            <div
              className="relative flex min-h-0 flex-1 flex-col"
              onTouchStart={(e) => {
                if (!isMobile || disablePull || keyboardOpen || pageRefreshing || e.touches.length !== 1) return
                const scroller = nearestVerticalScroller(e.target, e.currentTarget)
                if (scroller && scroller.scrollTop > 0) return
                pagePullStart.current = {
                  x: e.touches[0].clientX,
                  y: e.touches[0].clientY,
                  scroller,
                }
              }}
              onTouchMove={(e) => {
                const start = pagePullStart.current
                if (!start || e.touches.length !== 1) return
                if (start.scroller && start.scroller.scrollTop > 0) {
                  pagePullStart.current = null
                  setPagePull(0)
                  return
                }
                const x = e.touches[0].clientX - start.x
                const y = e.touches[0].clientY - start.y
                if (y <= 0 || Math.abs(y) <= Math.abs(x)) {
                  setPagePull(0)
                  return
                }
                e.preventDefault()
                setPagePull(Math.min(72, y * 0.45))
              }}
              onTouchEnd={() => {
                pagePullStart.current = null
                if (pagePull < 54 || pageRefreshing) {
                  setPagePull(0)
                  return
                }
                setPageRefreshing(true)
                setPagePull(48)
                window.dispatchEvent(new Event('lps:refresh'))
                router.refresh()
                clearTimeout(pageRefreshTimer.current)
                pageRefreshTimer.current = setTimeout(() => {
                  setPageRefreshing(false)
                  setPagePull(0)
                }, 700)
              }}
              onTouchCancel={() => {
                pagePullStart.current = null
                setPagePull(0)
              }}
            >
              {(pagePull > 0 || pageRefreshing) && (
                <div
                  className="pointer-events-none absolute left-1/2 top-2 z-[95] flex size-9 -translate-x-1/2 items-center justify-center rounded-full border border-border bg-card text-primary shadow-[var(--lps-shadow)]"
                  style={{ transform: `translate(-50%, ${Math.max(0, pagePull - 18)}px)` }}
                  aria-live="polite"
                >
                  <RefreshCw size={16} className={pageRefreshing ? 'animate-spin' : ''} />
                  <span className="sr-only">{pageRefreshing ? 'Refreshing page' : 'Pull to refresh'}</span>
                </div>
              )}
              {toolbar}
              <main id="main-content" tabIndex={-1} className="relative flex min-h-0 flex-1 flex-col overflow-hidden outline-none">{children}</main>

              {/* The status region stays mounted so a screen reader is already
                  listening when a confirmation lands in it; an alert is
                  announced as it is inserted. */}
              <div className="pointer-events-none absolute inset-x-0 bottom-[22px] z-[65] flex flex-col items-center px-4">
                <div aria-live="polite" aria-atomic="true">
                  {toast?.tone === 'success' && (
                    <span className="lps-pop inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-[9px] text-[13px] font-semibold text-background shadow-[var(--lps-shadow)]">
                      <CheckIcon size={14} />
                      {toast.message}
                    </span>
                  )}
                </div>
                {toast?.tone === 'error' && (
                  <div role="alert" aria-atomic="true">
                    <span className="lps-pop pointer-events-auto flex max-w-[560px] items-start gap-2 rounded-xl border border-[var(--lps-tone-red-dot)] bg-[var(--lps-tone-red-bg)] py-2 pl-3.5 pr-1.5 text-[13px] font-semibold text-[var(--lps-tone-red-fg)] shadow-[var(--lps-shadow)]">
                      <AlertIcon size={16} className="mt-0.5 flex-none" />
                      <span className="min-w-0 flex-1 py-0.5">{toast.message}</span>
                      <button
                        type="button"
                        aria-label="Dismiss"
                        onClick={() => setToast(null)}
                        className="-my-0.5 inline-flex size-7 flex-none items-center justify-center rounded-md transition-colors duration-150 hover:bg-[var(--lps-tone-red-dot)]/15 focus-visible:outline-2 focus-visible:outline-[var(--lps-tone-red-fg)]"
                      >
                        <CloseIcon size={12} />
                      </button>
                    </span>
                  </div>
                )}
              </div>

              {pageOverlays?.(state)}

              {/* The ⋯ menu popover lives here rather than inside the
                  overflow-clipped tab bar. */}
              {isMobile && moreMenu && (
                <div data-more-menu className="lps-pop lps-pop-up absolute bottom-2 right-2 z-[80] max-h-[calc(100%-16px)] min-w-[210px] overflow-y-auto rounded-xl border border-border bg-popover p-1.5 shadow-[var(--lps-shadow)]">
                  {moreTop?.(state)}
                  <button type="button" onClick={toggle} className={moreItemClass}>
                    {dark ? <MoonIcon size={14} /> : <SunIcon size={14} />}
                    {dark ? 'Dark mode' : 'Light mode'}
                  </button>
                  {!isStandalone && (
                    <InstallAppButton
                      onMessage={(message) => {
                        setMoreMenu(false)
                        showToast(message)
                      }}
                      className={moreItemClass}
                    >
                      <InstallIcon size={14} />
                      Install app
                    </InstallAppButton>
                  )}
                  {isStandalone && (
                    <button type="button" onClick={() => window.location.reload()} className={moreItemClass}>
                      <RefreshCw size={14} />
                      Reload
                    </button>
                  )}
                  {moreBottom?.(state)}
                </div>
              )}
            </div>

            {/* Mobile bottom navigation keeps global actions pinned at both
                edges. The center strip is independently scrollable and sizes
                each destination to one third of its viewport. */}
            {isMobile && !keyboardOpen && !hideMobileBar && (
              <nav className="flex flex-none items-stretch gap-0.5 overflow-visible border-t border-border bg-card px-1 pt-[5px] pb-[calc(5px+env(safe-area-inset-bottom))]">
                {mobileBarLeft(state)}
                <div
                  ref={mobileNavScroll}
                  role="group"
                  aria-label="Pages"
                  className="lps-mobile-nav-scroll flex min-w-0 flex-1 items-stretch overflow-x-auto overflow-y-hidden overscroll-x-contain touch-pan-x"
                >
                  {nav.map(({ id, label, short, href, Icon, enabled = true }) => {
                    // A view open over the page owns the highlight — the page
                    // underneath is not what you are looking at.
                    const active = activeId === id && !overlayOpen
                    const inner = (
                      <>
                        {/* The rail's solid mark, as a pill behind the icon. */}
                        <span className={cn('flex h-6 w-11 items-center justify-center rounded-full transition-colors duration-150 ease-lps', active ? 'bg-primary text-primary-foreground' : '')}>
                          <Icon />
                        </span>
                        <span className="text-center text-[11px] font-semibold leading-tight">{short ?? label}</span>
                      </>
                    )
                    const klass = cn(
                      'flex min-w-0 basis-1/3 shrink-0 flex-col items-center gap-1 rounded-[10px] border-none bg-transparent px-0.5 py-1.5 transition-colors duration-150 ease-lps',
                      active ? 'text-foreground' : 'text-muted-foreground',
                      enabled ? 'cursor-pointer' : 'cursor-not-allowed opacity-45',
                    )
                    return enabled ? (
                      <Link
                        key={id}
                        ref={(node) => { mobileNavItems.current[id] = node }}
                        href={href}
                        aria-label={label}
                        aria-current={active ? 'page' : undefined}
                        onClick={(e) => {
                          setMoreMenu(false)
                          if (!mobileOverlay?.open) return
                          // Tapping the destination you are already on has no
                          // route change to make, so the tap means "put the
                          // page back" — unwind the views instead of pushing a
                          // second entry for the same route.
                          if (activeId === id) {
                            e.preventDefault()
                            mobileOverlay.close()
                          } else {
                            mobileOverlay.dismiss()
                          }
                        }}
                        className={klass}
                      >
                        {inner}
                      </Link>
                    ) : (
                      <button key={id} type="button" disabled aria-label={label} className={klass}>{inner}</button>
                    )
                  })}
                  <button
                    ref={(node) => { mobileNavItems.current.more = node }}
                    type="button"
                    data-more-menu
                    onClick={() => setMoreMenu((v) => !v)}
                    aria-label="More"
                    aria-expanded={moreMenu}
                    className={cn(
                      'flex min-w-0 basis-1/3 shrink-0 cursor-pointer flex-col items-center gap-1 rounded-[10px] border-none bg-transparent px-0.5 py-1.5 transition-colors duration-150 ease-lps',
                      moreMenu || (moreActive && !overlayOpen) ? 'text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    <span className={cn(
                      'flex h-6 w-11 items-center justify-center rounded-full text-[16px] font-bold leading-none transition-colors duration-150 ease-lps',
                      moreMenu || (moreActive && !overlayOpen) ? 'bg-primary text-primary-foreground' : '',
                    )}>⋯</span>
                    <span className="text-[11px] font-semibold">More</span>
                  </button>
                </div>
                {mobileBarRight(state)}
              </nav>
            )}
          </div>

          {!isMobile && rightColumn?.(state)}
        </div>
      </div>
    </ToastCtx.Provider>
  )
}
