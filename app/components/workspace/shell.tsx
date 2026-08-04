'use client'

import Image from 'next/image'
import Link from 'next/link'
import { RefreshCw } from 'lucide-react'
import { useRouter } from 'next/navigation'
import {
  createContext, useCallback, useContext, useEffect, useRef, useState,
} from 'react'

import { InstallAppButton } from '@/components/pwa/install-app-button'
import { AgentChat } from '@/components/workspace/chat'
import {
  AgentsIcon, ChevronLeft, ChevronRight, CheckIcon, InstallIcon, InventoryIcon, LogoutIcon,
  MoonIcon, RequestsIcon, SettingsIcon, SuppliersIcon, SunIcon,
} from '@/components/workspace/icons'
import { AGENTS, CHAT_AGENTS } from '@/lib/agents'
import {
  CHAT_APPEARANCE_STORE, DEFAULT_CHAT_APPEARANCE, isChatTheme, isChatWallpaper,
  type ChatAgentId, type ChatAppearance,
} from '@/lib/chat-appearance'
import { cn } from '@/lib/utils'

export type PageId = 'suppliers' | 'inventory' | 'agents' | 'requests' | 'settings'

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
  // Designed but out of scope for this build — shown disabled so the rail keeps
  // its shape without offering a route that goes nowhere.
  { id: 'requests', label: 'Job Requests', href: '#', Icon: RequestsIcon, enabled: false },
] as const

// ------------------------------------------------------------------- toasts

const ToastCtx = createContext<(message: string) => void>(() => {})
export const useToast = () => useContext(ToastCtx)

const ChatAppearanceCtx = createContext<{
  appearance: ChatAppearance
  save: (next: ChatAppearance) => void
} | null>(null)

export function useChatAppearanceSettings() {
  const value = useContext(ChatAppearanceCtx)
  if (!value) throw new Error('useChatAppearanceSettings must be used inside Shell')
  return value
}

// ------------------------------------------------------------------- theme

function useTheme() {
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
  const [navOpen, setNavOpen] = useState(true)
  const [userMenu, setUserMenu] = useState(false)
  const [mobileAgentsOpen, setMobileAgentsOpen] = useState(false)
  const [mobileChat, setMobileChat] = useState(false)
  const [mobileAgent, setMobileAgent] = useState(CHAT_AGENTS[0].id)
  const [moreMenu, setMoreMenu] = useState(false)
  const [chatAppearance, setChatAppearance] = useState<ChatAppearance>(DEFAULT_CHAT_APPEARANCE)
  const [viewportFrame, setViewportFrame] = useState({ top: '0px', height: '100dvh' })
  const [keyboardOpen, setKeyboardOpen] = useState(false)
  const [pagePull, setPagePull] = useState(0)
  const [pageRefreshing, setPageRefreshing] = useState(false)
  const [toast, setToast] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
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
        | { themes?: Partial<Record<ChatAgentId, unknown>>; theme?: unknown; wallpaper?: unknown }
        | null
      if (!saved) return
      const themes = { ...DEFAULT_CHAT_APPEARANCE.themes }
      for (const id of ['daisy', 'rosie', 'nova'] as const) {
        if (isChatTheme(saved.themes?.[id])) themes[id] = saved.themes[id]
      }
      // Upgrade the original agent-color defaults to profile-matched colors;
      // any genuinely customized combination remains untouched.
      if (themes.daisy === 'garden' && themes.rosie === 'desert' && themes.nova === 'agave') {
        Object.assign(themes, DEFAULT_CHAT_APPEARANCE.themes)
      }
      const wallpaper = isChatWallpaper(saved.wallpaper)
        ? saved.wallpaper
        : saved.wallpaper === true ? 'line-art' : 'none'
      setChatAppearance({ themes, wallpaper })
    } catch {
      // A malformed local preference should fall back to the product default.
    }
  }, [])

  const saveChatAppearance = useCallback((next: ChatAppearance) => {
    setChatAppearance(next)
    window.localStorage.setItem(CHAT_APPEARANCE_STORE, JSON.stringify(next))
  }, [])

  // Close the user menu on any outside click, like the design's data-menu handler.
  useEffect(() => {
    if (!userMenu) return
    const close = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-menu]')) setUserMenu(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [userMenu])

  // Same treatment for the mobile ⋯ menu.
  useEffect(() => {
    if (!moreMenu) return
    const close = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-more-menu]')) setMoreMenu(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [moreMenu])

  const signOut = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } finally {
      router.push('/login')
      router.refresh()
    }
  }

  // Leaving the More menu for another page. The mobile chat sheet is a
  // full-screen overlay inside the same wrapper as this popover, so it has to
  // go: a route transition keeps the current page mounted until the new one
  // arrives, and behind the sheet that reads as the tap having done nothing.
  const leaveMoreMenu = () => {
    setMoreMenu(false)
    setMobileAgentsOpen(false)
    setMobileChat(false)
  }

  const railBtn = (active: boolean, enabled = true) =>
    cn(
      'flex items-center gap-2.5 rounded-[10px] border-none text-[13px] font-semibold w-full text-left transition-colors',
      navOpen ? 'px-2.5 py-2 justify-start' : 'px-0 py-2 justify-center',
      active ? 'bg-secondary text-primary' : 'text-muted-foreground',
      enabled ? 'cursor-pointer hover:bg-muted hover:text-foreground' : 'cursor-not-allowed opacity-45',
    )

  return (
    <ChatAppearanceCtx.Provider value={{ appearance: chatAppearance, save: saveChatAppearance }}>
      <ToastCtx.Provider value={showToast}>
        <div
          data-workspace-shell
          className="fixed inset-x-0 flex flex-col overflow-hidden"
          style={{ top: viewportFrame.top, height: viewportFrame.height }}
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
          </div>
        )}

        <div className="flex min-h-0 flex-1">
          {/* Desktop nav rail */}
          {!isMobile && (
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
                onClick={() => setNavOpen((v) => !v)}
                aria-label={navOpen ? 'Collapse navigation' : 'Expand navigation'}
                title={navOpen ? 'Collapse navigation' : 'Expand navigation'}
                className="mt-1.5 flex h-7 cursor-pointer items-center justify-center rounded-[9px] border border-border bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <span className="flex size-3.5">{navOpen ? <ChevronLeft /> : <ChevronRight />}</span>
              </button>
            </nav>
          )}

          {/* Main column */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
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
                        onClick={() => {
                          setMobileAgent(agent.id)
                          setMobileAgentsOpen(false)
                          setMobileChat(true)
                        }}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-xl border-none bg-transparent px-3 py-3 text-left hover:bg-muted',
                          agent.upcoming ? 'cursor-not-allowed opacity-55' : 'cursor-pointer',
                        )}
                      >
                        <Image src={agent.avatar} alt="" width={44} height={44} className="size-11 flex-none rounded-full object-cover" />
                        <div className="min-w-0 flex-1 border-b border-lps-hair pb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-[14px] font-bold text-foreground">{agent.name}</span>
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
                  mobileAgentId={mobileAgent}
                  appearance={chatAppearance}
                  onMobileBack={() => {
                    setMobileChat(false)
                    setMobileAgentsOpen(true)
                  }}
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
                  <Link
                    href="/agents"
                    onClick={leaveMoreMenu}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-[7px] text-[12.5px] font-semibold text-foreground hover:bg-muted"
                  >
                    <AgentsIcon size={14} />
                    Know your Agents
                  </Link>
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

            {/* Mobile bottom tab bar. items-stretch, not items-center: a label
                that wraps to two lines ("Plant search") must not push its icon
                out of line with the rest. */}
            {isMobile && !keyboardOpen && (
              <nav className="flex flex-none items-stretch gap-0.5 overflow-hidden border-t border-border bg-card px-1 pt-[5px] pb-[calc(5px+env(safe-area-inset-bottom))]">
                {NAV.map(({ id, label, href, Icon, enabled }) => {
                  const active = page === id
                  const inner = (
                    <>
                      <span className={cn('flex size-[18px] items-center justify-center', active ? 'text-primary' : '')}>
                        <Icon />
                      </span>
                      <span className="text-center text-[10.5px] font-semibold leading-tight">{label}</span>
                    </>
                  )
                  const klass = cn(
                    'flex min-w-0 flex-1 flex-col items-center gap-1 rounded-[10px] border-none bg-transparent px-0.5 py-1.5',
                    active ? 'text-primary' : 'text-muted-foreground',
                    enabled ? 'cursor-pointer' : 'cursor-not-allowed opacity-45',
                  )
                  return enabled ? (
                    <Link key={id} href={href} aria-label={label} className={klass}>{inner}</Link>
                  ) : (
                    <button key={id} type="button" disabled aria-label={label} className={klass}>{inner}</button>
                  )
                })}
                <button
                  type="button"
                  onClick={() => {
                    setMoreMenu(false)
                    setMobileChat(false)
                    setMobileAgentsOpen((open) => !open || mobileChat)
                  }}
                  aria-label="Agents"
                  aria-expanded={mobileAgentsOpen || mobileChat}
                  className={cn(
                    'flex min-w-0 flex-1 cursor-pointer flex-col items-center gap-1 rounded-[10px] border-none bg-transparent px-0.5 py-1.5',
                    mobileAgentsOpen || mobileChat || page === 'agents' ? 'text-primary' : 'text-muted-foreground',
                  )}
                >
                  <span className="flex size-[18px] items-center justify-center"><AgentsIcon /></span>
                  <span className="text-[10.5px] font-semibold">Agents</span>
                </button>
                <button
                  type="button"
                  data-more-menu
                  onClick={() => setMoreMenu((v) => !v)}
                  aria-label="More"
                  aria-expanded={moreMenu}
                  className={cn(
                    'flex min-w-0 flex-1 cursor-pointer flex-col items-center gap-1 rounded-[10px] border-none bg-transparent px-0.5 py-1.5',
                    moreMenu ? 'text-primary' : 'text-muted-foreground',
                  )}
                >
                  <span className="flex size-[18px] items-center justify-center text-[16px] font-bold leading-none">⋯</span>
                  <span className="text-[10.5px] font-semibold">More</span>
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
            />
          )}
        </div>
        </div>
      </ToastCtx.Provider>
    </ChatAppearanceCtx.Provider>
  )
}
