'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Bell, Plus, RefreshCw } from 'lucide-react'
import { useRouter } from 'next/navigation'
import {
  createContext, useCallback, useContext, useEffect, useRef, useState,
} from 'react'

import { InstallAppButton } from '@/components/pwa/install-app-button'
import { AvailabilityRequestDrawer } from '@/components/workspace/ar-drawer'
import { AgentChat } from '@/components/workspace/chat'
import { onOpenChat, openChat } from '@/lib/chat-bus'
import { useHistoryView } from '@/lib/history-view'
import { ChatNotificationsProvider, useChatNotifications } from '@/lib/chat-notifications'
import {
  AgentsIcon, ChevronLeft, ChevronRight, CheckIcon, InstallIcon, InventoryIcon, LogoutIcon,
  CustomersIcon, MoonIcon, PhotosIcon, RequestsIcon, SettingsIcon, SuppliersIcon, SunIcon,
} from '@/components/workspace/icons'
import { AGENTS } from '@/lib/agents'
import { requestRef } from '@/lib/job-requests'
import {
  APP_APPEARANCE_STORE, DEFAULT_APP_ACCENT, appAccentColor, appAccentStyle, readAppAccent,
  type AppAccentId,
} from '@/lib/app-appearance'
import {
  CHAT_APPEARANCE_STORE, CHAT_EDGE_DEFAULT_MIGRATION_STORE, DEFAULT_CHAT_APPEARANCE,
  isChatTheme, readChatWallpapers,
  type ChatAgentId, type ChatAppearance,
} from '@/lib/chat-appearance'
import { cn } from '@/lib/utils'

export type PageId =
  | 'suppliers' | 'inventory' | 'photos' | 'customers' | 'requests' | 'agents' | 'settings'

/**
 * What the mobile Agents tab has open over the page, if anything.
 *
 * `from` says what a conversation was opened *from*, which is what Back out of
 * it means: `agents` has the channel list under it, anything else was opened
 * from a card on the page and has only the page.
 */
type MobileView =
  | { name: 'agents' }
  | { name: 'chat'; agent: string; from?: 'agents' }

function nearestVerticalScroller(target: EventTarget | null, boundary: HTMLElement): HTMLElement | null {
  let el = target instanceof HTMLElement ? target : null
  while (el && el !== boundary) {
    const overflow = window.getComputedStyle(el).overflowY
    if ((overflow === 'auto' || overflow === 'scroll') && el.scrollHeight > el.clientHeight) return el
    el = el.parentElement
  }
  return null
}

const NAV = [
  { id: 'suppliers', label: 'Suppliers', href: '/suppliers', Icon: SuppliersIcon, enabled: true },
  { id: 'inventory', label: 'Plant search', href: '/plants', Icon: InventoryIcon, enabled: true },
  { id: 'photos', label: 'Photos', href: '/photos', Icon: PhotosIcon, enabled: true },
  // The customer side, in the order it is worked: who they are, then what they
  // asked for.
  { id: 'customers', label: 'Customers', href: '/customers', Icon: CustomersIcon, enabled: true },
  { id: 'requests', label: 'Job Requests', href: '/requests', Icon: RequestsIcon, enabled: true },
] as const

// ------------------------------------------------------------------- toasts

/**
 * The desktop nav rail's collapsed/expanded choice, per device.
 *
 * It has to be stored rather than held in state: every page renders its own
 * `Shell`, so a plain `useState` springs back to its initial value on each
 * navigation. The rail starts **collapsed** — the workspace tables want the
 * width more than the labels do — and only the rail's own chevron changes that.
 */
const NAV_OPEN_STORE = 'lps.nav.open'

const ToastCtx = createContext<(message: string) => void>(() => {})
export const useToast = () => useContext(ToastCtx)

const ChatAppearanceCtx = createContext<{
  appearance: ChatAppearance
  appAccent: AppAccentId
  save: (next: ChatAppearance) => void
  saveAppAccent: (next: AppAccentId) => void
  reset: () => void
} | null>(null)

export function useChatAppearanceSettings() {
  const value = useContext(ChatAppearanceCtx)
  if (!value) throw new Error('useChatAppearanceSettings must be used inside Shell')
  return value
}

// ------------------------------------------------------------------- theme

/** Shared with the supplier portal, so both read one `lps.theme` preference. */
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

/**
 * Who is actually signed in. The harness owns the session, so ask it rather
 * than showing a name baked into the design mock.
 */
function useSessionUser() {
  const [user, setUser] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((body: { user?: string | null }) => setUser(body.user ?? null))
      .catch(() => setUser(null))
  }, [])

  return user
}

/** "Chris" → "C"; "Ada Lovelace" → "AL". */
function initialsOf(name: string): string {
  const parts = name.trim().split(/[\s._-]+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
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

// ------------------------------------------------------------------- shell

export function Shell({
  page,
  title,
  subtitle,
  toolbar,
  headerAction,
  hideHeaderOnMobile = false,
  children,
}: {
  page: PageId
  title: string
  subtitle?: string
  toolbar?: React.ReactNode
  headerAction?: React.ReactNode
  hideHeaderOnMobile?: boolean
  children: React.ReactNode
}) {
  const router = useRouter()
  const isMobile = useIsMobile()
  const { dark, toggle } = useTheme()
  const user = useSessionUser()
  const [navOpen, setNavOpen] = useState(false)
  const [desktopChatFull, setDesktopChatFull] = useState(false)
  const [desktopPeekOpen, setDesktopPeekOpen] = useState(false)
  const [userMenu, setUserMenu] = useState(false)
  // The temporary "see the portal as a supplier" picker — a stand-in until
  // supplier sign-in exists. Lists onboarded suppliers, lazily on first open.
  const [supplierViewMenu, setSupplierViewMenu] = useState(false)
  const [portalSuppliers, setPortalSuppliers] = useState<{ id: number; name: string }[] | null>(null)
  // The Agents list and a conversation are mobile pages, not overlays: each
  // one is a history entry, so Back pops it instead of leaving the route.
  const mobileView = useHistoryView<MobileView>()
  const mobileAgentsOpen = mobileView.view?.name === 'agents'
  const mobileChat = mobileView.view?.name === 'chat'
  const [moreMenu, setMoreMenu] = useState(false)
  const mobileNavScroll = useRef<HTMLDivElement | null>(null)
  const mobileNavItems = useRef<Partial<Record<PageId | 'more', HTMLElement | null>>>({})
  const [chatAppearance, setChatAppearance] = useState<ChatAppearance>(DEFAULT_CHAT_APPEARANCE)
  const [appAccent, setAppAccent] = useState<AppAccentId>(DEFAULT_APP_ACCENT)
  const [viewportFrame, setViewportFrame] = useState({ top: '0px', height: '100dvh' })
  const [keyboardOpen, setKeyboardOpen] = useState(false)
  const [pagePull, setPagePull] = useState(0)
  const [pageRefreshing, setPageRefreshing] = useState(false)
  const [toast, setToast] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // A card anywhere can ask for a chat thread; on mobile that means opening
  // the conversation on the right agent (the thread is the panel's own state).
  useEffect(
    () =>
      onOpenChat(({ agentId }) => {
        if (!window.matchMedia('(min-width: 900px)').matches) {
          // One entry, so Back returns to the card the conversation was opened
          // from. It used to push the Agents list underneath as well, which
          // sent you somewhere you had never been on the way out.
          mobileView.open({ name: 'chat', agent: agentId })
        }
      }),
    [mobileView.open],
  )
  const pageRefreshTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const pagePullStart = useRef<{ x: number; y: number; scroller: HTMLElement | null } | null>(null)

  const showToast = useCallback((message: string) => {
    setToast(message)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setToast(''), 2200)
  }, [])

  useEffect(() => () => {
    clearTimeout(timer.current)
    clearTimeout(pageRefreshTimer.current)
  }, [])

  useEffect(() => {
    // Desktop Full is a layout mode, never a mobile state. This also repairs a
    // stale Full flag if the breakpoint changes after hydration or rotation.
    if (isMobile) {
      setDesktopChatFull(false)
      setDesktopPeekOpen(false)
    }
  }, [isMobile])

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
    try {
      // `theme` is the legacy global-color shape. Preserve its wallpaper choice,
      // then migrate colors to the new agent-specific defaults.
      const saved = JSON.parse(window.localStorage.getItem(CHAT_APPEARANCE_STORE) ?? 'null') as
        | {
            themes?: Partial<Record<ChatAgentId, unknown>>
            theme?: unknown
            wallpapers?: Partial<Record<ChatAgentId, unknown>>
            wallpaper?: unknown
          }
        | null
      if (!saved) {
        window.localStorage.setItem(CHAT_EDGE_DEFAULT_MIGRATION_STORE, '1')
        return
      }
      const themes = { ...DEFAULT_CHAT_APPEARANCE.themes }
      for (const id of ['daisy', 'rosie', 'nova'] as const) {
        if (isChatTheme(saved.themes?.[id])) themes[id] = saved.themes[id]
      }
      // Upgrade the original agent-color defaults to profile-matched colors;
      // any genuinely customized combination remains untouched.
      if (themes.daisy === 'garden' && themes.rosie === 'desert' && themes.nova === 'agave') {
        Object.assign(themes, DEFAULT_CHAT_APPEARANCE.themes)
      }
      // The old exact default trio often exists only because choosing a
      // wallpaper saved the whole appearance object. Move that one combination
      // to the requested teal once; any custom color combination is preserved,
      // and choosing Forest Green after this migration remains intentional.
      if (
        !window.localStorage.getItem(CHAT_EDGE_DEFAULT_MIGRATION_STORE) &&
        themes.daisy === 'forest' && themes.rosie === 'rose' && themes.nova === 'violet'
      ) {
        Object.assign(themes, DEFAULT_CHAT_APPEARANCE.themes)
      }
      window.localStorage.setItem(CHAT_EDGE_DEFAULT_MIGRATION_STORE, '1')
      setChatAppearance({ themes, wallpapers: readChatWallpapers(saved) })
    } catch {
      // A malformed local preference should fall back to the product default.
    }
  }, [])

  const saveChatAppearance = useCallback((next: ChatAppearance) => {
    setChatAppearance(next)
    window.localStorage.setItem(CHAT_APPEARANCE_STORE, JSON.stringify(next))
    window.localStorage.setItem(CHAT_EDGE_DEFAULT_MIGRATION_STORE, '1')
  }, [])

  useEffect(() => {
    // Only '1' opens it: an unset preference means collapsed, so the default
    // costs no expand-then-collapse flash on first paint.
    setNavOpen(window.localStorage.getItem(NAV_OPEN_STORE) === '1')
  }, [])

  const toggleNav = useCallback(() => {
    setNavOpen((open) => {
      window.localStorage.setItem(NAV_OPEN_STORE, open ? '0' : '1')
      return !open
    })
  }, [])

  useEffect(() => {
    setAppAccent(readAppAccent(window.localStorage.getItem(APP_APPEARANCE_STORE)))
  }, [])

  const saveAppAccent = useCallback((next: AppAccentId) => {
    setAppAccent(next)
    window.localStorage.setItem(APP_APPEARANCE_STORE, JSON.stringify({ accent: next }))
  }, [])

  const resetAppearance = useCallback(() => {
    saveChatAppearance(DEFAULT_CHAT_APPEARANCE)
    saveAppAccent(DEFAULT_APP_ACCENT)
  }, [saveAppAccent, saveChatAppearance])

  useEffect(() => {
    document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
      ?.setAttribute('content', appAccentColor(appAccent, dark))
  }, [appAccent, dark])

  // Close the user menu on any outside click, like the design's data-menu handler.
  useEffect(() => {
    if (!userMenu) return
    const close = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-menu]')) setUserMenu(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [userMenu])

  // Same treatment for the supplier-view picker.
  useEffect(() => {
    if (!supplierViewMenu) return
    const close = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-menu]')) setSupplierViewMenu(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [supplierViewMenu])

  // Same treatment for the mobile ⋯ menu.
  useEffect(() => {
    if (!moreMenu) return
    const close = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-more-menu]')) setMoreMenu(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [moreMenu])

  // The middle mobile strip deliberately shows only three destinations at a
  // time. Keep the current route (or More for Settings) in view without using
  // scrollIntoView, which can also move the page horizontally on mobile.
  useEffect(() => {
    if (!isMobile || page === 'agents') return
    const strip = mobileNavScroll.current
    const active = mobileNavItems.current[page === 'settings' ? 'more' : page]
    if (!strip || !active) return
    const left = active.offsetLeft - (strip.clientWidth - active.offsetWidth) / 2
    strip.scrollTo({ left: Math.max(0, left), behavior: 'smooth' })
  }, [isMobile, page])

  const signOut = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } finally {
      router.push('/login')
      router.refresh()
    }
  }

  // Leaving the More menu for another page — the mobile Agents view has to
  // come off the screen with it, or the route transition looks like the tap
  // did nothing. `dismiss` leaves its history entry alone, so Back still
  // returns to the conversation it was opened on.
  const leaveMoreMenu = () => {
    setMoreMenu(false)
    mobileView.dismiss()
  }

  const railBtn = (active: boolean, enabled = true) =>
    cn(
      'flex items-center gap-2.5 rounded-[10px] border-none text-[13px] font-semibold w-full text-left transition-colors',
      navOpen ? 'px-2.5 py-2 justify-start' : 'px-0 py-2 justify-center',
      active ? 'bg-secondary text-primary' : 'text-muted-foreground',
      enabled ? 'cursor-pointer hover:bg-muted hover:text-foreground' : 'cursor-not-allowed opacity-45',
    )

  return (
    <ChatAppearanceCtx.Provider value={{
      appearance: chatAppearance,
      appAccent,
      save: saveChatAppearance,
      saveAppAccent,
      reset: resetAppearance,
    }}>
      <ToastCtx.Provider value={showToast}>
        <ChatNotificationsProvider>
        <AvailabilityRequestDrawer />
        <div
          data-workspace-shell
          className="fixed inset-x-0 flex flex-col overflow-hidden"
          style={{ top: viewportFrame.top, height: viewportFrame.height, ...appAccentStyle(appAccent, dark) }}
        >
        {/* Mobile chat supplies its own compact identity header; do not stack
            the underlying page header above it. */}
        {!(isMobile && (mobileAgentsOpen || mobileChat || hideHeaderOnMobile)) && (
          <div className="flex flex-none items-center gap-3 border-b border-border bg-card px-4 py-2.5">
            <div className="flex min-w-0 flex-1 items-baseline gap-3">
              <h1 className="m-0 truncate font-serif text-[21px] font-semibold text-foreground">{title}</h1>
              {subtitle && (
                <span className="min-w-0 flex-1 truncate text-[12.5px] text-muted-foreground">{subtitle}</span>
              )}
            </div>
            {headerAction && <div className="flex flex-none items-center gap-2">{headerAction}</div>}
            {/* The Job Requests page only — this is that page's action, and
                mobile carries it as the floating button below instead (this
                header is not drawn there). */}
            {!isMobile && page === 'requests' && <NewJobRequestButton />}
            {!isMobile && <NotificationBell />}
          </div>
        )}

        <div className="flex min-h-0 flex-1">
          {/* Desktop nav rail */}
          {!isMobile && !desktopChatFull && (
            <nav
              className="flex flex-none flex-col gap-0.5 border-r border-border bg-card"
              style={{ width: navOpen ? 196 : 56, padding: navOpen ? '12px 10px' : '12px 8px' }}
            >
              {NAV.map(({ id, label, href, Icon, enabled }) =>
                enabled ? (
                  <Link key={id} href={href} title={label} className={railBtn(page === id)}>
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
                <Link href="/settings" title="Settings" className={railBtn(page === 'settings')}>
                  <span className="flex size-4 flex-none items-center justify-center"><SettingsIcon /></span>
                  {navOpen && <span>Settings</span>}
                </Link>

                <button type="button" onClick={toggle} title={dark ? 'Dark mode' : 'Light mode'} className={railBtn(false)}>
                  <span className="flex size-4 flex-none items-center justify-center">
                    {dark ? <MoonIcon /> : <SunIcon />}
                  </span>
                  {navOpen && (
                    <>
                      <span>{dark ? 'Dark mode' : 'Light mode'}</span>
                      <span
                        className={cn('relative ml-auto h-[17px] w-[30px] flex-none rounded-full', dark ? 'bg-primary' : 'bg-muted')}
                      >
                        <span
                          className="absolute top-[2px] size-[13px] rounded-full bg-card transition-all"
                          style={{ left: dark ? 15 : 2 }}
                        />
                      </span>
                    </>
                  )}
                </button>

                <InstallAppButton title="Install app" onMessage={showToast} className={railBtn(false)}>
                  <span className="flex size-4 flex-none items-center justify-center"><InstallIcon /></span>
                  {navOpen && <span>Install app</span>}
                </InstallAppButton>

                <Link href="/agents" title="Know your Agents" className={railBtn(page === 'agents')}>
                  <span className="flex size-4 flex-none items-center justify-center"><AgentsIcon /></span>
                  {navOpen && <span>Know your Agents</span>}
                </Link>

                <div data-menu className="relative">
                  <button
                    type="button"
                    title="Supplier view — open the portal as an onboarded supplier"
                    onClick={() => {
                      setSupplierViewMenu((v) => !v)
                      if (portalSuppliers == null) {
                        fetch('/api/availability-requests/suppliers')
                          .then(async (res) => {
                            const body = res.ok
                              ? ((await res.json()) as { suppliers: { id: number; name: string }[] })
                              : { suppliers: [] }
                            setPortalSuppliers(body.suppliers)
                          })
                          .catch(() => setPortalSuppliers([]))
                      }
                    }}
                    className={railBtn(false)}
                  >
                    <span className="flex size-4 flex-none items-center justify-center"><SuppliersIcon /></span>
                    {navOpen && <span>Supplier view</span>}
                  </button>
                  {supplierViewMenu && (
                    <div className="lps-pop absolute bottom-[calc(100%+6px)] left-0 z-[96] min-w-[210px] rounded-xl border border-border bg-popover p-1.5 shadow-[var(--lps-shadow)]">
                      <div className="border-b border-lps-hair px-2.5 pb-1.5 pt-1 text-[11px] text-muted-foreground">
                        See the portal as a supplier — a stand-in until supplier sign-in exists.
                      </div>
                      {portalSuppliers == null && (
                        <div className="px-2.5 py-1.5 text-[12px] text-muted-foreground">Loading…</div>
                      )}
                      {portalSuppliers?.length === 0 && (
                        <div className="px-2.5 py-1.5 text-[12px] text-muted-foreground">
                          No onboarded suppliers yet.
                        </div>
                      )}
                      {portalSuppliers?.map((s) => (
                        <a
                          key={s.id}
                          href={`/portal/${s.id}`}
                          target="_blank"
                          rel="noreferrer"
                          onClick={() => setSupplierViewMenu(false)}
                          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-[7px] text-[12.5px] font-semibold text-foreground hover:bg-muted"
                        >
                          {s.name}
                        </a>
                      ))}
                    </div>
                  )}
                </div>

                <div data-menu className="relative">
                  <button
                    type="button"
                    onClick={() => setUserMenu((v) => !v)}
                    title={user ?? 'Signed in'}
                    className={cn(
                      'flex w-full cursor-pointer items-center gap-2.5 rounded-[10px] border-none bg-transparent text-left hover:bg-muted',
                      navOpen ? 'px-2 py-1.5 justify-start' : 'px-0 py-1.5 justify-center',
                    )}
                  >
                    <span className="inline-flex size-[26px] flex-none items-center justify-center rounded-full bg-secondary text-[10px] font-bold text-secondary-foreground">
                      {user ? initialsOf(user) : '·'}
                    </span>
                    {navOpen && (
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12.5px] font-semibold text-foreground">
                          {user ?? '…'}
                        </span>
                        <span className="block truncate text-[11px] text-muted-foreground">Austin Plant Supply</span>
                      </span>
                    )}
                  </button>

                  {userMenu && (
                    <div className="lps-pop absolute bottom-[calc(100%+6px)] left-0 z-[96] min-w-[184px] rounded-xl border border-border bg-popover p-1.5 shadow-[var(--lps-shadow)]">
                      <div className="mb-1 border-b border-lps-hair px-2.5 pb-2 pt-1.5">
                        <div className="text-[12.5px] font-semibold">{user ?? 'Signed in'}</div>
                        <div className="text-[11px] text-muted-foreground">Austin Plant Supply</div>
                      </div>
                      <button
                        type="button"
                        onClick={signOut}
                        className="flex w-full cursor-pointer items-center gap-2 rounded-lg border-none bg-transparent px-2.5 py-[7px] text-left text-[12.5px] font-semibold text-[#C24C2E] hover:bg-lps-warn-bg"
                      >
                        <LogoutIcon size={14} />
                        Log out
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={toggleNav}
                aria-label={navOpen ? 'Collapse navigation' : 'Expand navigation'}
                title={navOpen ? 'Collapse navigation' : 'Expand navigation'}
                className="mt-1.5 flex h-7 cursor-pointer items-center justify-center rounded-[9px] border border-border bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <span className="flex size-3.5">{navOpen ? <ChevronLeft /> : <ChevronRight />}</span>
              </button>
            </nav>
          )}

          {/* Main workspace: Full chat hides it until the center-edge pull
              handle reveals a narrow supplier/search peek pane. */}
          <div
            className={cn(
              'flex min-h-0 min-w-0 flex-col overflow-hidden',
              !desktopChatFull ? 'flex-1' : desktopPeekOpen ? 'w-[240px] flex-none' : 'w-0 flex-none',
            )}
          >
            <div
              className="relative flex min-h-0 flex-1 flex-col"
              onTouchStart={(e) => {
                if (!isMobile || mobileAgentsOpen || mobileChat || keyboardOpen || pageRefreshing || e.touches.length !== 1) return
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
              <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>

              {toast && (
                <div className="pointer-events-none absolute inset-x-0 bottom-[22px] z-[65] flex justify-center">
                  <span className="lps-pop inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-[9px] text-[12.5px] font-semibold text-background shadow-[var(--lps-shadow)]">
                    <CheckIcon size={14} />
                    {toast}
                  </span>
                </div>
              )}

              {/* Mobile's New job request. Out of the way of anything that
                  takes over the column — the chat sheet, the Agents list, the
                  ⋯ menu it would sit under — and of the keyboard. */}
              {isMobile && page === 'requests' &&
                !mobileChat && !mobileAgentsOpen && !moreMenu && !keyboardOpen && (
                  <NewJobRequestButton fab />
                )}

              {/* Agents is a mobile channel list, not a new route or transport.
                  Each row opens the same existing agent conversation. */}
              {isMobile && mobileAgentsOpen && (
                <div className="absolute inset-0 z-[69] flex flex-col bg-background">
                  <div className="flex flex-none items-center border-b border-border bg-card px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <h2 className="m-0 text-[18px] font-bold text-foreground">Agents</h2>
                      <p className="m-0 text-[11.5px] text-muted-foreground">Your AI team</p>
                    </div>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto p-2">
                    {AGENTS.map((agent) => (
                      <button
                        key={agent.id}
                        type="button"
                        disabled={agent.upcoming}
                        onClick={() => mobileView.open({ name: 'chat', agent: agent.id, from: 'agents' })}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-xl border-none bg-transparent px-3 py-3 text-left hover:bg-muted',
                          agent.upcoming ? 'cursor-not-allowed opacity-55' : 'cursor-pointer',
                        )}
                      >
                        <Image src={agent.avatar} alt="" width={44} height={44} className="size-11 flex-none rounded-full object-cover" />
                        <div className="min-w-0 flex-1 border-b border-lps-hair pb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-[14px] font-bold text-foreground">{agent.name}</span>
                            <AgentUnreadDot agentId={agent.id} />
                            <span className="text-[11px] text-muted-foreground">{agent.role}</span>
                            <span className={cn('ml-auto text-[10.5px] font-semibold', agent.upcoming ? 'text-muted-foreground' : 'text-primary')}>
                              {agent.upcoming ? 'Coming soon' : 'Online'}
                            </span>
                          </div>
                          <p className="mt-1 truncate text-[12px] text-muted-foreground">{agent.intro}</p>
                        </div>
                        {!agent.upcoming && <ChevronRight size={15} className="flex-none text-lps-dim" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* The conversation overlays the channel list/page, while the
                  global Agents tab stays visible below it. */}
              {isMobile && (
                <AgentChat
                  isMobile
                  mobileOpen={mobileChat}
                  mobileAgentId={mobileView.view?.name === 'chat' ? mobileView.view.agent : undefined}
                  appearance={chatAppearance}
                  onMobileBack={mobileView.back}
                  mobileBackLabel={
                    mobileView.view?.name === 'chat' && mobileView.view.from !== 'agents'
                      ? 'Back'
                      : 'Back to Agents'
                  }
                />
              )}

              {/* The ⋯ menu popover lives here rather than inside the
                  overflow-clipped tab bar. */}
              {isMobile && moreMenu && (
                <div data-more-menu className="lps-pop absolute bottom-2 right-2 z-[80] min-w-[210px] rounded-xl border border-border bg-popover p-1.5 shadow-[var(--lps-shadow)]">
                  <Link
                    href="/settings"
                    onClick={leaveMoreMenu}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-[7px] text-[12.5px] font-semibold text-foreground hover:bg-muted"
                  >
                    <SettingsIcon size={14} />
                    Settings
                  </Link>
                  <button
                    type="button"
                    onClick={toggle}
                    className="flex w-full cursor-pointer items-center gap-2 rounded-lg border-none bg-transparent px-2.5 py-[7px] text-left text-[12.5px] font-semibold text-foreground hover:bg-muted"
                  >
                    {dark ? <MoonIcon size={14} /> : <SunIcon size={14} />}
                    {dark ? 'Dark mode' : 'Light mode'}
                  </button>
                  <InstallAppButton
                    onMessage={(message) => {
                      setMoreMenu(false)
                      showToast(message)
                    }}
                    className="flex w-full cursor-pointer items-center gap-2 rounded-lg border-none bg-transparent px-2.5 py-[7px] text-left text-[12.5px] font-semibold text-foreground hover:bg-muted"
                  >
                    <InstallIcon size={14} />
                    Install app
                  </InstallAppButton>
                  <Link
                    href="/agents"
                    onClick={leaveMoreMenu}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-[7px] text-[12.5px] font-semibold text-foreground hover:bg-muted"
                  >
                    <AgentsIcon size={14} />
                    Know your Agents
                  </Link>
                  <div data-menu>
                    <button
                      type="button"
                      onClick={() => {
                        setSupplierViewMenu((open) => !open)
                        if (portalSuppliers == null) {
                          fetch('/api/availability-requests/suppliers')
                            .then(async (res) => {
                              const body = res.ok
                                ? ((await res.json()) as { suppliers: { id: number; name: string }[] })
                                : { suppliers: [] }
                              setPortalSuppliers(body.suppliers)
                            })
                            .catch(() => setPortalSuppliers([]))
                        }
                      }}
                      aria-expanded={supplierViewMenu}
                      className="flex w-full cursor-pointer items-center gap-2 rounded-lg border-none bg-transparent px-2.5 py-[7px] text-left text-[12.5px] font-semibold text-foreground hover:bg-muted"
                    >
                      <SuppliersIcon size={14} />
                      Supplier view
                      <ChevronRight size={13} className={cn('ml-auto transition-transform', supplierViewMenu && 'rotate-90')} />
                    </button>
                    {supplierViewMenu && (
                      <div className="ml-5 border-l border-lps-hair pl-1">
                        {portalSuppliers == null && (
                          <div className="px-2.5 py-1.5 text-[12px] text-muted-foreground">Loading…</div>
                        )}
                        {portalSuppliers?.length === 0 && (
                          <div className="px-2.5 py-1.5 text-[12px] text-muted-foreground">No onboarded suppliers yet.</div>
                        )}
                        {portalSuppliers?.map((supplier) => (
                          <a
                            key={supplier.id}
                            href={`/portal/${supplier.id}`}
                            target="_blank"
                            rel="noreferrer"
                            onClick={() => {
                              setSupplierViewMenu(false)
                              setMoreMenu(false)
                            }}
                            className="block truncate rounded-lg px-2.5 py-[7px] text-[12px] font-semibold text-foreground hover:bg-muted"
                          >
                            {supplier.name}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="mb-1 mt-1 border-t border-lps-hair px-2.5 pb-1 pt-2">
                    <div className="text-[12.5px] font-semibold">{user ?? 'Signed in'}</div>
                    <div className="text-[11px] text-muted-foreground">Austin Plant Supply</div>
                  </div>
                  <button
                    type="button"
                    onClick={signOut}
                    className="flex w-full cursor-pointer items-center gap-2 rounded-lg border-none bg-transparent px-2.5 py-[7px] text-left text-[12.5px] font-semibold text-[#C24C2E] hover:bg-lps-warn-bg"
                  >
                    <LogoutIcon size={14} />
                    Log out
                  </button>
                </div>
              )}
            </div>

            {/* Mobile bottom navigation keeps global actions pinned at both
                edges. The center strip is independently scrollable and sizes
                each destination to one third of its viewport. */}
            {isMobile && !keyboardOpen && (
              <nav className="flex flex-none items-stretch gap-0.5 overflow-visible border-t border-border bg-card px-1 pt-[5px] pb-[calc(5px+env(safe-area-inset-bottom))]">
                <NotificationBell mobile />
                <div
                  ref={mobileNavScroll}
                  role="group"
                  aria-label="Pages"
                  className="lps-mobile-nav-scroll flex min-w-0 flex-1 items-stretch overflow-x-auto overflow-y-hidden overscroll-x-contain touch-pan-x"
                >
                  {NAV.map(({ id, label, href, Icon, enabled }) => {
                    // A view open over the page owns the highlight — the page
                    // underneath is not what you are looking at.
                    const active = page === id && !mobileView.view
                    const inner = (
                      <>
                        <span className={cn('flex size-[18px] items-center justify-center', active ? 'text-primary' : '')}>
                          <Icon />
                        </span>
                        <span className="text-center text-[10.5px] font-semibold leading-tight">{label}</span>
                      </>
                    )
                    const klass = cn(
                      'flex min-w-0 basis-1/3 shrink-0 flex-col items-center gap-1 rounded-[10px] border-none bg-transparent px-0.5 py-1.5',
                      active ? 'text-primary' : 'text-muted-foreground',
                      enabled ? 'cursor-pointer' : 'cursor-not-allowed opacity-45',
                    )
                    return enabled ? (
                      <Link
                        key={id}
                        ref={(node) => { mobileNavItems.current[id] = node }}
                        href={href}
                        aria-label={label}
                        onClick={(e) => {
                          setMoreMenu(false)
                          if (!mobileView.view) return
                          // Tapping the destination you are already on has no
                          // route change to make, so the tap means "put the
                          // page back" — unwind the views instead of pushing a
                          // second entry for the same route.
                          if (page === id) {
                            e.preventDefault()
                            mobileView.close()
                          } else {
                            mobileView.dismiss()
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
                      'flex min-w-0 basis-1/3 shrink-0 cursor-pointer flex-col items-center gap-1 rounded-[10px] border-none bg-transparent px-0.5 py-1.5',
                      moreMenu || (page === 'settings' && !mobileView.view)
                        ? 'text-primary'
                        : 'text-muted-foreground',
                    )}
                  >
                    <span className="flex size-[18px] items-center justify-center text-[16px] font-bold leading-none">⋯</span>
                    <span className="text-[10.5px] font-semibold">More</span>
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setMoreMenu(false)
                    // One step at a time, the way Back walks it: a
                    // conversation returns to the list, the list to the page.
                    // A conversation opened from a card has no list under it —
                    // its way out is the page — so this tab opens one instead
                    // of walking out of the conversation entirely.
                    const open = mobileView.view
                    if (open?.name === 'chat' && open.from !== 'agents') {
                      mobileView.open({ name: 'agents' })
                    } else if (open) {
                      mobileView.back()
                    } else {
                      mobileView.open({ name: 'agents' })
                    }
                  }}
                  aria-label="Agents"
                  aria-expanded={mobileAgentsOpen || mobileChat}
                  className={cn(
                    'flex w-[52px] flex-none cursor-pointer flex-col items-center gap-1 rounded-[10px] border-none bg-transparent px-0.5 py-1.5',
                    mobileAgentsOpen || mobileChat || page === 'agents' ? 'text-primary' : 'text-muted-foreground',
                  )}
                >
                  <span className="relative flex size-[18px] items-center justify-center">
                    <AgentsIcon />
                    <AgentUnreadDot className="absolute -right-1 -top-1" />
                  </span>
                  <span className="text-[10.5px] font-semibold">Agents</span>
                </button>
              </nav>
            )}
          </div>

          {/* Agent chat on desktop: a docked panel, or a collapsed rail when
              hidden. The mobile sheet is rendered inside the main column above
              so the bottom tab bar stays put. */}
          {!isMobile && (
            <AgentChat
              isMobile={false}
              mobileOpen={mobileChat}
              appearance={chatAppearance}
              desktopFull={desktopChatFull}
              desktopPeekOpen={desktopPeekOpen}
              onDesktopFull={() => {
                setNavOpen(false)
                setDesktopPeekOpen(false)
                setDesktopChatFull(true)
              }}
              onDesktopExitFull={() => {
                setDesktopChatFull(false)
                setDesktopPeekOpen(false)
              }}
              onDesktopPeekToggle={() => setDesktopPeekOpen((open) => !open)}
            />
          )}
        </div>
        </div>
        </ChatNotificationsProvider>
      </ToastCtx.Provider>
    </ChatAppearanceCtx.Provider>
  )
}

/** `14:05` today, `Aug 22` before — the bell list's timestamp. */
function fmtNotifAt(ms: number): string {
  const d = new Date(ms)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  return sameDay
    ? d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/**
 * **New job request** — the Job Requests page's action, on both breakpoints.
 *
 * It writes nothing. All it takes is the *id* the request will have
 * (`POST /api/requests/reserve`), because the thread is named after the row —
 * `jr-<id>`. The row itself is rosie's to create, in that conversation, along
 * with the customer and the lines (her `job-requests` skill). Start one and
 * say nothing and nothing exists: an unused id is a gap in a sequence.
 *
 * Two shapes, because the page has two chromes: a labelled pill in the desktop
 * header, and on mobile a floating button above the tab bar — `/requests`
 * draws no header on mobile (`hideHeaderOnMobile`), so a header-only action
 * would not exist where it is most wanted.
 */
function NewJobRequestButton({ fab = false }: { fab?: boolean }) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)

  const start = async () => {
    setBusy(true)
    try {
      const res = await fetch('/api/requests/reserve', { method: 'POST' })
      const body = (await res.json().catch(() => ({}))) as { id?: number; error?: string }
      if (!res.ok || !body.id) throw new Error(body.error ?? 'Could not start a job request')
      openChat({ agentId: 'rosie', threadId: `jr-${body.id}`, label: requestRef(body.id) })
    } catch (e) {
      toast((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={start}
      title="Start a job request and open its Rosie conversation"
      aria-label="New job request"
      className={cn(
        'flex flex-none items-center border-none bg-primary font-semibold text-primary-foreground',
        fab
          ? 'absolute bottom-3 right-3 z-[64] size-12 justify-center rounded-full shadow-[var(--lps-shadow)]'
          : 'gap-1.5 rounded-full px-3 py-1.5 text-[12.5px]',
        busy ? 'cursor-default opacity-50' : 'cursor-pointer hover:opacity-90',
      )}
    >
      <Plus size={fab ? 22 : 14} />
      {!fab && <span>New job request</span>}
    </button>
  )
}

/**
 * The header's notification bell: unread agent-chat messages across every
 * agent and thread, newest first. Clicking one opens that agent's panel on
 * that thread — which is also what marks it read (the panel's own poll).
 */
function NotificationBell({ mobile = false }: { mobile?: boolean }) {
  const { unread, markAllRead } = useChatNotifications()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-notif-bell]')) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const agentOf = (id: string) => AGENTS.find((a) => a.id === id)

  return (
    <div data-notif-bell className={cn('relative flex-none', mobile && 'w-[52px]')}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Notifications"
        aria-label={unread.length ? `Notifications — ${unread.length} unread` : 'Notifications'}
        className={cn(
          'cursor-pointer border-none bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
          mobile
            ? 'flex w-full flex-col items-center gap-1 rounded-[10px] px-0.5 py-1.5'
            : 'relative flex size-8 items-center justify-center rounded-full',
          open && mobile && 'text-primary',
        )}
      >
        <span className={cn('relative flex items-center justify-center', mobile ? 'size-[18px]' : '')}>
          <Bell size={16} />
          {unread.length > 0 && (
            <span className="absolute -right-2 -top-1.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-[var(--lps-warn-dot)] px-0.5 text-[9px] font-bold leading-none text-white">
              {unread.length > 9 ? '9+' : unread.length}
            </span>
          )}
        </span>
        {mobile && <span className="text-[10.5px] font-semibold">Alerts</span>}
      </button>
      {open && (
        <div
          className={cn(
            'lps-pop absolute z-[96] flex max-h-[70vh] flex-col overflow-hidden rounded-xl border border-border bg-popover shadow-[var(--lps-shadow)]',
            mobile ? 'bottom-[calc(100%+6px)] left-0' : 'right-0 top-[calc(100%+6px)] w-[320px]',
          )}
          style={mobile ? { width: 'min(320px, calc(100vw - 16px))' } : undefined}
        >
          <div className="flex flex-none items-center gap-2 border-b border-border px-3 py-2">
            <span className="text-[12.5px] font-bold text-foreground">Notifications</span>
            {unread.length > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="ml-auto cursor-pointer border-none bg-transparent text-[11px] font-semibold text-primary hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="flex min-h-0 flex-col overflow-y-auto p-1.5">
            {unread.length === 0 && (
              <p className="m-0 px-2 py-3 text-center text-[12px] text-muted-foreground">
                You’re all caught up.
              </p>
            )}
            {unread.map((n) => {
              const agent = agentOf(n.agentId)
              return (
                <button
                  key={`${n.agentId}/${n.threadId}`}
                  type="button"
                  onClick={() => {
                    setOpen(false)
                    openChat({ agentId: n.agentId, threadId: n.threadId })
                  }}
                  className="flex w-full cursor-pointer items-start gap-2.5 rounded-lg border-none bg-transparent px-2 py-2 text-left hover:bg-muted"
                >
                  {agent && (
                    <Image src={agent.avatar} alt="" width={26} height={26} className="mt-0.5 size-[26px] flex-none rounded-full object-cover" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-1.5">
                      <span className="truncate text-[12.5px] font-bold text-foreground">{n.from}</span>
                      <span className="truncate text-[10.5px] text-muted-foreground">
                        {n.threadId === 'main' ? 'Main' : n.threadId}
                      </span>
                      <span className="ml-auto flex-none text-[10.5px] text-lps-dim">{fmtNotifAt(n.lastAt)}</span>
                    </span>
                    <span className="block truncate text-[11.5px] text-muted-foreground">{n.lastText}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

/** A warn-colored dot shown while an agent has unread chat messages. */
function AgentUnreadDot({ agentId, className }: { agentId?: string; className?: string }) {
  const { unread, unreadByAgent } = useChatNotifications()
  const count = agentId ? (unreadByAgent[agentId] ?? 0) : unread.length
  if (!count) return null
  return (
    <span
      className={cn('size-2 rounded-full border border-card bg-[var(--lps-warn-dot)]', className)}
      aria-label="Unread messages"
    />
  )
}
