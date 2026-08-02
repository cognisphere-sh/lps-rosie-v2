'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  createContext, useCallback, useContext, useEffect, useRef, useState,
} from 'react'

import { AgentChat } from '@/components/workspace/chat'
import {
  AgentsIcon, ChevronLeft, ChevronRight, CheckIcon, InventoryIcon, LogoutIcon,
  MoonIcon, RequestsIcon, SettingsIcon, SuppliersIcon, SunIcon,
} from '@/components/workspace/icons'
import { AGENTS, CHAT_AGENTS } from '@/lib/agents'
import { cn } from '@/lib/utils'

export type PageId = 'suppliers' | 'inventory' | 'agents' | 'requests' | 'settings'

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
  children,
}: {
  page: PageId
  title: string
  subtitle?: string
  toolbar?: React.ReactNode
  headerAction?: React.ReactNode
  children: React.ReactNode
}) {
  const router = useRouter()
  const isMobile = useIsMobile()
  const { dark, toggle } = useTheme()
  const user = useSessionUser()
  const [navOpen, setNavOpen] = useState(true)
  const [userMenu, setUserMenu] = useState(false)
  const [mobileChat, setMobileChat] = useState(false)
  const [mobileAgent, setMobileAgent] = useState(CHAT_AGENTS[0].id)
  const [moreMenu, setMoreMenu] = useState(false)
  const [toast, setToast] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const showToast = useCallback((message: string) => {
    setToast(message)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setToast(''), 2200)
  }, [])

  useEffect(() => () => clearTimeout(timer.current), [])

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

  const railBtn = (active: boolean, enabled = true) =>
    cn(
      'flex items-center gap-2.5 rounded-[10px] border-none text-[13px] font-semibold w-full text-left transition-colors',
      navOpen ? 'px-2.5 py-2 justify-start' : 'px-0 py-2 justify-center',
      active ? 'bg-secondary text-primary' : 'text-muted-foreground',
      enabled ? 'cursor-pointer hover:bg-muted hover:text-foreground' : 'cursor-not-allowed opacity-45',
    )

  return (
    <ToastCtx.Provider value={showToast}>
      <div className="flex h-dvh flex-col overflow-hidden">
        {/* Header */}
        <div className="flex flex-none items-center gap-3 border-b border-border bg-card px-4 py-2.5">
          <div className="flex min-w-0 flex-1 items-baseline gap-3">
            <h1 className="m-0 truncate font-serif text-[21px] font-semibold text-foreground">{title}</h1>
            {subtitle && (
              <span className="min-w-0 flex-1 truncate text-[12.5px] text-muted-foreground">{subtitle}</span>
            )}
          </div>
          {headerAction && <div className="flex flex-none items-center gap-2">{headerAction}</div>}
        </div>

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
                <button type="button" disabled title="Settings — not built yet" className={railBtn(false, false)}>
                  <span className="flex size-4 flex-none items-center justify-center"><SettingsIcon /></span>
                  {navOpen && <span>Settings</span>}
                </button>

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
            <div className="relative flex min-h-0 flex-1 flex-col">
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

              {/* The chat sheet overlays the content inside this wrapper, so
                  the tab bar below stays visible while it is open. */}
              {isMobile && (
                <AgentChat
                  isMobile
                  mobileOpen={mobileChat}
                  mobileAgentId={mobileAgent}
                  onMobileClose={() => setMobileChat(false)}
                />
              )}

              {/* The ⋯ menu popover lives here rather than in the tab bar —
                  the bar scrolls horizontally, and an overflow container would
                  clip anything popping out of it. */}
              {isMobile && moreMenu && (
                <div data-more-menu className="lps-pop absolute bottom-2 right-2 z-[80] min-w-[210px] rounded-xl border border-border bg-popover p-1.5 shadow-[var(--lps-shadow)]">
                  <button
                    type="button"
                    disabled
                    title="Settings — not built yet"
                    className="flex w-full cursor-not-allowed items-center gap-2 rounded-lg border-none bg-transparent px-2.5 py-[7px] text-left text-[12.5px] font-semibold text-muted-foreground opacity-45"
                  >
                    <SettingsIcon size={14} />
                    Settings
                  </button>
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
                    onClick={() => setMoreMenu(false)}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-[7px] text-[12.5px] font-semibold text-foreground hover:bg-muted"
                  >
                    <AgentsIcon size={14} />
                    Know your Agents
                  </Link>
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
            {isMobile && (
              <nav className="flex flex-none items-stretch gap-0.5 overflow-x-auto border-t border-border bg-card px-1.5 pt-[5px] pb-[calc(5px+env(safe-area-inset-bottom))]">
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
                    'flex min-w-[72px] flex-1 flex-col items-center gap-1 rounded-[10px] border-none bg-transparent px-1 py-1.5',
                    active ? 'text-primary' : 'text-muted-foreground',
                    enabled ? 'cursor-pointer' : 'cursor-not-allowed opacity-45',
                  )
                  return enabled ? (
                    <Link key={id} href={href} aria-label={label} className={klass}>{inner}</Link>
                  ) : (
                    <button key={id} type="button" disabled aria-label={label} className={klass}>{inner}</button>
                  )
                })}
                {AGENTS.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    disabled={a.upcoming}
                    onClick={() => {
                      // Same agent again toggles the sheet; another agent switches it.
                      if (mobileChat && mobileAgent === a.id) {
                        setMobileChat(false)
                      } else {
                        setMobileAgent(a.id)
                        setMobileChat(true)
                      }
                    }}
                    aria-label={a.upcoming ? `${a.name} — coming soon` : a.name}
                    className={cn(
                      'flex min-w-[72px] flex-1 flex-col items-center gap-1 rounded-[10px] border-none bg-transparent px-2 py-1.5',
                      mobileChat && mobileAgent === a.id ? 'text-primary' : 'text-muted-foreground',
                      a.upcoming ? 'cursor-not-allowed opacity-45' : 'cursor-pointer',
                    )}
                  >
                    <Image src={a.avatar} alt="" width={18} height={18} className="size-[18px] rounded-full object-cover" />
                    <span className="text-[10.5px] font-semibold">{a.name}</span>
                  </button>
                ))}
                <button
                  type="button"
                  data-more-menu
                  onClick={() => setMoreMenu((v) => !v)}
                  aria-label="More"
                  aria-expanded={moreMenu}
                  className={cn(
                    'flex min-w-[72px] flex-1 cursor-pointer flex-col items-center gap-1 rounded-[10px] border-none bg-transparent px-2 py-1.5',
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
              onMobileClose={() => setMobileChat(false)}
            />
          )}
        </div>
      </div>
    </ToastCtx.Provider>
  )
}
