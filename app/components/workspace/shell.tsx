'use client'

// The admin app's chrome: the shared `WorkspaceFrame` (frame.tsx) filled in
// with the operator's destinations, agent chat, notification bell and the
// signed-in user. What is drawn here is only what the supplier portal does
// not also draw — the layout itself lives in the frame, once.

import Image from 'next/image'
import Link from 'next/link'
import { Bell, Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import {
  createContext, useCallback, useContext, useEffect, useRef, useState,
} from 'react'

import { AvailabilityRequestDrawer } from '@/components/workspace/ar-drawer'
import { AgentChat } from '@/components/workspace/chat'
import { WorkspaceFrame, moreItemClass, useIsMobile, useTheme, useToast } from '@/components/workspace/frame'
import { onOpenChat, openChat } from '@/lib/chat-bus'
import { useHistoryView } from '@/lib/history-view'
import { ChatNotificationsProvider, useChatNotifications } from '@/lib/chat-notifications'
import {
  AgentsIcon, ChevronRight, InventoryIcon, LogoutIcon,
  CustomersIcon, PhotosIcon, RequestsIcon, SettingsIcon, SuppliersIcon,
} from '@/components/workspace/icons'
import { AGENTS, CHAT_AGENTS, chatBlockedReason } from '@/lib/agents'
import { jobInboxNewNavigationAction } from '@/lib/job-inbox'
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

// The layout hooks moved to the frame; every page still imports them from here.
export { useIsMobile, useTheme, useToast } from '@/components/workspace/frame'

export type PageId =
  | 'suppliers' | 'inventory' | 'photos' | 'customers' | 'requests' | 'agents' | 'settings'

/** The All jobs identity opens the focused job; disclosure remains a sibling control. */
export function JobIdentityLink({ request }: { request: { id: number; name: string | null } }) {
  return (
    <Link
      href={`/jobs?jr=${request.id}`}
      aria-label={`Open ${requestRef(request.id)}${request.name ? ` — ${request.name}` : ''}`}
      onClick={(event) => event.stopPropagation()}
      className="flex min-h-11 min-w-0 max-w-[30rem] items-center gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex-none text-[13.5px] font-bold tracking-tight text-lps-accent-light-blue-text">
        {requestRef(request.id)}
      </span>
      {request.name && (
        <span className="min-w-0 truncate text-[13.5px] font-semibold text-foreground">
          {request.name}
        </span>
      )}
    </Link>
  )
}

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

const NAV = [
  { id: 'suppliers', label: 'Suppliers', href: '/suppliers', Icon: SuppliersIcon, enabled: true },
  { id: 'inventory', label: 'Plant search', href: '/plants', Icon: InventoryIcon, enabled: true },
  { id: 'photos', label: 'Photos', href: '/photos', Icon: PhotosIcon, enabled: true },
  // The customer side, in the order it is worked: who they are, then what they
  // asked for.
  { id: 'customers', label: 'Customers', href: '/customers', Icon: CustomersIcon, enabled: true },
  { id: 'requests', label: 'Jobs', href: '/requests', Icon: RequestsIcon, enabled: true },
] as const

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

// ------------------------------------------------------------------- account

type AccountRailActionsProps = {
  navOpen: boolean
  page: PageId
  user: string | null
  open: boolean
  setOpen: (open: boolean) => void
  supplierOpen: boolean
  setSupplierOpen: (open: boolean) => void
  toggleSupplier: () => void
  supplierList: (className: string, onSelect?: () => void) => React.ReactNode
  signOut: () => void
  railBtn: (active: boolean, enabled?: boolean) => string
}

/** Desktop-only account disclosure; mobile keeps the established More rows. */
export function AccountRailActions({
  navOpen,
  page,
  user,
  open,
  setOpen,
  supplierOpen,
  setSupplierOpen,
  toggleSupplier,
  supplierList,
  signOut,
  railBtn,
}: AccountRailActionsProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverId = 'desktop-account-popover'
  const supplierId = 'desktop-account-supplier-view'

  const close = useCallback((restoreFocus = false) => {
    setSupplierOpen(false)
    setOpen(false)
    if (restoreFocus) window.setTimeout(() => triggerRef.current?.focus(), 0)
  }, [setOpen, setSupplierOpen])

  useEffect(() => {
    if (!open) return
    const dismissOutside = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close()
    }
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      close(true)
    }
    document.addEventListener('mousedown', dismissOutside)
    document.addEventListener('keydown', dismissOnEscape)
    return () => {
      document.removeEventListener('mousedown', dismissOutside)
      document.removeEventListener('keydown', dismissOnEscape)
    }
  }, [close, open])

  return (
    <div ref={rootRef} data-menu className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          if (open) close()
          else setOpen(true)
        }}
        title="Account"
        aria-label="Account"
        aria-expanded={open}
        aria-controls={popoverId}
        aria-current={open ? 'true' : undefined}
        className={cn(railBtn(open), 'min-h-11 overflow-hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary')}
      >
        {navOpen && (
          <span className="inline-flex size-[26px] flex-none items-center justify-center rounded-full bg-secondary text-[10px] font-bold text-secondary-foreground">
            {user ? initialsOf(user) : '·'}
          </span>
        )}
        <span className={navOpen ? undefined : 'w-full text-center text-[9px] font-bold leading-none'}>Account</span>
      </button>

      {open && (
        <div
          id={popoverId}
          aria-label="Account actions"
          className="lps-pop absolute bottom-[calc(100%+6px)] left-0 z-[96] min-w-[230px] rounded-xl border border-border bg-popover p-1.5 shadow-[var(--lps-shadow)]"
        >
          <div className="mb-1 border-b border-lps-hair px-2.5 pb-2 pt-1.5">
            <div className="text-[12.5px] font-semibold">{user ?? 'Signed in'}</div>
            <div className="text-[11px] text-muted-foreground">Austin Plant Supply</div>
          </div>
          <Link
            href="/agents"
            aria-current={page === 'agents' ? 'page' : undefined}
            onClick={() => close()}
            className="flex min-h-11 w-full items-center gap-2 rounded-lg px-2.5 text-[12.5px] font-semibold text-foreground hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary"
          >
            <AgentsIcon size={14} />
            Know your Agents
          </Link>
          <button
            type="button"
            aria-expanded={supplierOpen}
            aria-controls={supplierId}
            onClick={toggleSupplier}
            className="flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-lg border-none bg-transparent px-2.5 text-left text-[12.5px] font-semibold text-foreground hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary"
          >
            <SuppliersIcon size={14} />
            Supplier view
            <ChevronRight size={13} className={cn('ml-auto transition-transform', supplierOpen && 'rotate-90')} />
          </button>
          {supplierOpen && (
            <div id={supplierId} className="ml-2 border-l border-lps-hair pl-1">
              <div className="border-b border-lps-hair px-2.5 pb-1.5 pt-1 text-[11px] text-muted-foreground">
                See the portal as a supplier — a stand-in until supplier sign-in exists.
              </div>
              {supplierList(
                'flex min-h-11 w-full items-center rounded-lg px-2.5 text-[12.5px] font-semibold text-foreground hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary',
                () => close(),
              )}
            </div>
          )}
          <button
            type="button"
            onClick={signOut}
            className="flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-lg border-none bg-transparent px-2.5 text-left text-[12.5px] font-semibold text-[#C24C2E] hover:bg-lps-warn-bg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary"
          >
            <LogoutIcon size={14} />
            Log out
          </button>
        </div>
      )}
    </div>
  )
}

type SupplierLoadState = 'idle' | 'loading' | 'loaded' | 'error'

export async function fetchPartnerSuppliers(
  signal?: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<{ id: number; name: string }[]> {
  const response = await fetcher('/api/availability-requests/suppliers', { signal })
  if (!response.ok) throw new Error('Supplier list request failed')
  const body = (await response.json()) as { suppliers: { id: number; name: string; is_lps_partner: boolean }[] }
  return body.suppliers.filter((supplier) => supplier.is_lps_partner)
}

export function SupplierPortalList({
  state,
  suppliers,
  retry,
  className,
  onSelect,
}: {
  state: SupplierLoadState
  suppliers: { id: number; name: string }[]
  retry: () => void
  className: string
  onSelect: () => void
}) {
  if (state === 'idle' || state === 'loading') {
    return <div role="status" className="px-2.5 py-1.5 text-[12px] text-muted-foreground">Loading…</div>
  }
  if (state === 'error') {
    return (
      <div role="alert" className="px-2.5 py-2 text-[12px] text-muted-foreground">
        <div>Couldn’t load LPS Partners.</div>
        <button type="button" onClick={retry} className="mt-1 min-h-11 rounded-lg px-2.5 font-semibold text-primary hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">Retry</button>
      </div>
    )
  }
  if (suppliers.length === 0) {
    return <div className="px-2.5 py-1.5 text-[12px] text-muted-foreground">No LPS Partners yet.</div>
  }
  return suppliers.map((supplier) => (
    <a
      key={supplier.id}
      href={`/partner/${supplier.id}`}
      target="_blank"
      rel="noreferrer"
      onClick={onSelect}
      className={className}
    >
      {supplier.name}
    </a>
  ))
}

/** Clear disclosure state when either responsive implementation is replaced. */
export function useBreakpointMenuReset(
  isMobile: boolean,
  setAccountOpen: (open: boolean) => void,
  setSupplierOpen: (open: boolean) => void,
) {
  useEffect(() => () => {
    setAccountOpen(false)
    setSupplierOpen(false)
  }, [isMobile, setAccountOpen, setSupplierOpen])
}

// ------------------------------------------------------------------- shell

export function Shell({
  page,
  title,
  toolbar,
  headerAction,
  hideHeaderOnMobile = false,
  hideHeaderOnDesktop = false,
  focusedJobsDesktop = false,
  replaceNewJobEntry = false,
  focusedIntake,
  focusedJob,
  children,
}: {
  page: PageId
  title: string
  /** A render slot keeps Shell-owned controls inside the route's existing toolbar. */
  toolbar?: React.ReactNode | ((rightActions: React.ReactNode) => React.ReactNode)
  headerAction?: React.ReactNode
  hideHeaderOnMobile?: boolean
  hideHeaderOnDesktop?: boolean
  /** Selected desktop Jobs replaces the ordinary app rail; mobile chrome is unchanged. */
  focusedJobsDesktop?: boolean
  /** New replaces a selected Jobs detail entry; the All jobs list and other routes push. */
  replaceNewJobEntry?: boolean
  focusedIntake?: { id: number; onExit: () => void; savedPanel?: React.ReactNode }
  focusedJob?: { id: number; name: string | null }
  children: React.ReactNode
}) {
  const router = useRouter()
  const isMobile = useIsMobile()
  const theme = useTheme()
  const user = useSessionUser()
  const [desktopChatFull, setDesktopChatFull] = useState(false)
  const [desktopPeekOpen, setDesktopPeekOpen] = useState(false)
  const [userMenu, setUserMenu] = useState(false)
  // The "see the portal as a supplier" picker. It began as a stand-in for
  // supplier sign-in; now that suppliers really do sign in (2026-08-30) it is
  // the admin's way into any portal without their credentials — `admin` passes
  // `canAccessSupplier` for every company. Lists the LPS Partners, lazily on
  // first open.
  const [supplierViewMenu, setSupplierViewMenu] = useState(false)
  const [partnerSuppliers, setPartnerSuppliers] = useState<{ id: number; name: string }[]>([])
  const [supplierLoadState, setSupplierLoadState] = useState<SupplierLoadState>('idle')
  const supplierFetchController = useRef<AbortController | null>(null)
  // The Agents list and a conversation are mobile pages, not overlays: each
  // one is a history entry, so Back pops it instead of leaving the route.
  const mobileView = useHistoryView<MobileView>()
  const mobileAgentsOpen = mobileView.view?.name === 'agents'
  const mobileChat = mobileView.view?.name === 'chat'
  const [chatAppearance, setChatAppearance] = useState<ChatAppearance>(DEFAULT_CHAT_APPEARANCE)
  const [appAccent, setAppAccent] = useState<AppAccentId>(DEFAULT_APP_ACCENT)
  const { dark } = theme

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

  useEffect(() => {
    // Desktop Full is a layout mode, never a mobile state. This also repairs a
    // stale Full flag if the breakpoint changes after hydration or rotation.
    if (isMobile) {
      setDesktopChatFull(false)
      setDesktopPeekOpen(false)
    }
  }, [isMobile])

  useBreakpointMenuReset(isMobile, setUserMenu, setSupplierViewMenu)

  useEffect(() => () => supplierFetchController.current?.abort(), [])

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

  // Same treatment for the supplier-view picker.
  useEffect(() => {
    if (!supplierViewMenu) return
    const close = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-menu]')) setSupplierViewMenu(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [supplierViewMenu])

  const signOut = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } finally {
      router.push('/login')
      router.refresh()
    }
  }

  const loadPartnerSuppliers = useCallback(() => {
    supplierFetchController.current?.abort()
    const controller = new AbortController()
    supplierFetchController.current = controller
    setSupplierLoadState('loading')
    fetchPartnerSuppliers(controller.signal)
      .then((suppliers) => {
        setPartnerSuppliers(suppliers)
        setSupplierLoadState('loaded')
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === 'AbortError') return
        setPartnerSuppliers([])
        setSupplierLoadState('error')
      })
  }, [])

  const toggleSupplierView = () => {
    setSupplierViewMenu((open) => {
      const next = !open
      if (next && supplierLoadState === 'idle') loadPartnerSuppliers()
      return next
    })
  }

  const supplierList = (className: string, onSelect = () => setSupplierViewMenu(false)) => (
    <SupplierPortalList
      state={supplierLoadState}
      suppliers={partnerSuppliers}
      retry={loadPartnerSuppliers}
      className={className}
      onSelect={onSelect}
    />
  )

  return (
    <ChatAppearanceCtx.Provider value={{
      appearance: chatAppearance,
      appAccent,
      save: saveChatAppearance,
      saveAppAccent,
      reset: resetAppearance,
    }}>
      <ChatNotificationsProvider>
        <AvailabilityRequestDrawer />
        <WorkspaceFrame
          title={title}
          toolbar={typeof toolbar === 'function' ? toolbar(!isMobile ? (
            <span className="flex items-center gap-1">
              {page === 'requests' && !focusedIntake && <NewJobRequestButton compact fromSelectedEntry={replaceNewJobEntry} />}
              <NotificationBell />
            </span>
          ) : null) : toolbar}
          headerAction={headerAction}
          // Mobile chat supplies its own compact identity header; do not
          // stack the underlying page header above it.
          hideHeaderOnMobile={hideHeaderOnMobile || mobileAgentsOpen || mobileChat || !!focusedIntake}
          hideHeaderOnDesktop={hideHeaderOnDesktop}
          hideHeader={!!focusedIntake}
          headerExtras={!hideHeaderOnDesktop && (
            <>
              {page === 'requests' && !focusedIntake && <NewJobRequestButton fromSelectedEntry={replaceNewJobEntry} />}
              <NotificationBell />
            </>
          )}
          theme={theme}
          nav={NAV}
          activeId={page}
          moreActive={page === 'settings'}
          mobileOverlay={{ open: !!mobileView.view, close: mobileView.close, dismiss: mobileView.dismiss }}
          disablePull={mobileAgentsOpen || mobileChat || !!focusedIntake}
          railHidden={desktopChatFull || focusedJobsDesktop || !!focusedIntake}
          hideMobileBar={!!focusedIntake}
          // Full chat hides the workspace until the center-edge pull handle
          // reveals a narrow supplier/search peek pane.
          pageColumnClassName={focusedIntake ? 'flex-1 min-[900px]:w-0 min-[900px]:flex-none' : !desktopChatFull ? 'flex-1' : desktopPeekOpen ? 'w-[240px] flex-none' : 'w-0 flex-none'}
          style={appAccentStyle(appAccent, dark)}
          railTop={({ navOpen, railBtn }) => (
            <Link href="/settings" title="Settings" className={railBtn(page === 'settings')}>
              <span className="flex size-4 flex-none items-center justify-center"><SettingsIcon /></span>
              {navOpen && <span>Settings</span>}
            </Link>
          )}
          railBottom={({ navOpen, railBtn }) => (
            <AccountRailActions
              navOpen={navOpen}
              page={page}
              user={user}
              open={userMenu}
              setOpen={setUserMenu}
              supplierOpen={supplierViewMenu}
              setSupplierOpen={setSupplierViewMenu}
              toggleSupplier={toggleSupplierView}
              supplierList={supplierList}
              signOut={signOut}
              railBtn={railBtn}
            />
          )}
          moreTop={({ closeMoreMenu }) => (
            <Link
              href="/settings"
              onClick={() => {
                // Leaving the More menu for another page — the mobile Agents
                // view has to come off the screen with it, or the route
                // transition looks like the tap did nothing. `dismiss` leaves
                // its history entry alone, so Back still returns to the
                // conversation it was opened on.
                closeMoreMenu()
                mobileView.dismiss()
              }}
              className={moreItemClass}
            >
              <SettingsIcon size={14} />
              Settings
            </Link>
          )}
          moreBottom={({ closeMoreMenu }) => (
            <>
              <Link
                href="/agents"
                onClick={() => {
                  closeMoreMenu()
                  mobileView.dismiss()
                }}
                className={moreItemClass}
              >
                <AgentsIcon size={14} />
                Know your Agents
              </Link>
              <div data-menu>
                <button
                  type="button"
                  onClick={toggleSupplierView}
                  aria-expanded={supplierViewMenu}
                  className={moreItemClass}
                >
                  <SuppliersIcon size={14} />
                  Supplier view
                  <ChevronRight size={13} className={cn('ml-auto transition-transform', supplierViewMenu && 'rotate-90')} />
                </button>
                {supplierViewMenu && (
                  <div className="ml-5 border-l border-lps-hair pl-1">
                    {supplierList(
                      'block truncate rounded-lg px-2.5 py-[7px] text-[12px] font-semibold text-foreground hover:bg-muted',
                      () => {
                        setSupplierViewMenu(false)
                        closeMoreMenu()
                      },
                    )}
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
            </>
          )}
          mobileBarLeft={() => <NotificationBell mobile />}
          mobileBarRight={({ closeMoreMenu }) => (
            <button
              type="button"
              onClick={() => {
                closeMoreMenu()
                // One step at a time, the way Back walks it: a conversation
                // returns to the list, the list to the page. A conversation
                // opened from a card has no list under it — its way out is
                // the page — so this tab opens one instead of walking out of
                // the conversation entirely.
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
          )}
          pageOverlays={({ isMobile, moreMenuOpen, keyboardOpen }) => (
            <>
              {/* Mobile's New job request. Out of the way of anything that
                  takes over the column — the chat sheet, the Agents list, the
                  ⋯ menu it would sit under — and of the keyboard. */}
              {isMobile && page === 'requests' && !focusedIntake &&
                !mobileChat && !mobileAgentsOpen && !moreMenuOpen && !keyboardOpen && (
                  <NewJobRequestButton fab fromSelectedEntry={replaceNewJobEntry} />
                )}

              {/* Agents is a mobile channel list, not a new route or transport.
                  Each row opens the same existing agent conversation. */}
              {isMobile && mobileAgentsOpen && (
                <div className="absolute inset-0 z-[69] flex flex-col bg-background">
                  <div className="flex flex-none items-center border-b border-border bg-card px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
                    <div className="min-w-0 flex-1">
                      <h2 className="m-0 text-[18px] font-bold text-foreground">Agents</h2>
                      <p className="m-0 text-[11.5px] text-muted-foreground">Your AI team</p>
                    </div>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto p-2">
                    {AGENTS.map((agent) => {
                      const blocked = chatBlockedReason(agent)
                      return (
                      <button
                        key={agent.id}
                        type="button"
                        disabled={!!blocked}
                        onClick={() => mobileView.open({ name: 'chat', agent: agent.id, from: 'agents' })}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-xl border-none bg-transparent px-3 py-3 text-left hover:bg-muted',
                          blocked ? 'cursor-not-allowed opacity-55' : 'cursor-pointer',
                        )}
                      >
                        <Image src={agent.avatar} alt="" width={44} height={44} className="size-11 flex-none rounded-full object-cover" />
                        <div className="min-w-0 flex-1 border-b border-lps-hair pb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-[14px] font-bold text-foreground">{agent.name}</span>
                            <AgentUnreadDot agentId={agent.id} />
                            <span className="text-[11px] text-muted-foreground">{agent.role}</span>
                            <span className={cn('ml-auto text-[10.5px] font-semibold', blocked ? 'text-muted-foreground' : 'text-primary')}>
                              {blocked ?? 'Online'}
                            </span>
                          </div>
                          <p className="mt-1 truncate text-[12px] text-muted-foreground">{agent.intro}</p>
                        </div>
                        {!blocked && <ChevronRight size={15} className="flex-none text-lps-dim" />}
                      </button>
                      )
                    })}
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
                  focusedIntake={focusedIntake}
                />
              )}
            </>
          )}
          // Agent chat on desktop: a docked panel, or a collapsed rail when
          // hidden. The mobile sheet is rendered inside the page column above
          // so the bottom tab bar stays put.
          rightColumn={({ setNavOpen }) => (
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
              focusedIntake={focusedIntake}
              focusedJob={focusedJob}
              hideAgentSelector={focusedJobsDesktop}
            />
          )}
        >
          {children}
        </WorkspaceFrame>
      </ChatNotificationsProvider>
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
function NewJobRequestButton({
  fab = false,
  compact = false,
  label = 'New job request',
  fromSelectedEntry = false,
}: {
  fab?: boolean
  compact?: boolean
  label?: string
  fromSelectedEntry?: boolean
}) {
  const toast = useToast()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const navigate = (url: string) => {
    if (jobInboxNewNavigationAction(fromSelectedEntry) === 'replace') router.replace(url, { scroll: false })
    else router.push(url, { scroll: false })
  }

  const start = async () => {
    setBusy(true)
    try {
      // A prior reserve may have landed while navigation failed. Its tab marker
      // is recovery evidence: reopen that exact id, never allocate a second.
      let saved: { id?: number } | null = null
      try {
        saved = JSON.parse(window.sessionStorage.getItem('lps.jobs.intake.v1') ?? 'null') as { id?: number } | null
      } catch {
        window.sessionStorage.removeItem('lps.jobs.intake.v1')
      }
      const savedId = saved?.id
      if (typeof savedId === 'number' && Number.isSafeInteger(savedId) && savedId > 0) {
        navigate(`/jobs?jr=${savedId}`)
        openChat({ agentId: 'rosie', threadId: `jr-${savedId}`, label: requestRef(savedId) })
        return
      }
      const res = await fetch('/api/requests/reserve', { method: 'POST' })
      const body = (await res.json().catch(() => ({}))) as { id?: number; error?: string }
      if (!res.ok || !body.id) throw new Error(body.error ?? 'Could not start a job request')
      // Write recovery evidence before either route/panel operation. A retry
      // after this point reuses this id; only a failed reserve can allocate one.
      const returnUrl = `${window.location.pathname}${window.location.search}`
      if (window.location.pathname === '/jobs') {
        window.sessionStorage.setItem('lps.jobs.origin.v1', 'new')
        window.sessionStorage.setItem('lps.jobs.origin-id.v1', String(body.id))
      }
      window.sessionStorage.setItem('lps.jobs.intake.v1', JSON.stringify({ id: body.id, returnUrl }))
      navigate(`/jobs?jr=${body.id}`)
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
      id="jobs-new-trigger"
      aria-label="New job request"
      className={cn(
        'flex flex-none items-center border-none bg-primary font-semibold text-primary-foreground',
        fab
          ? 'absolute bottom-3 right-3 z-[64] size-12 justify-center rounded-full shadow-[var(--lps-shadow)]'
          : compact ? 'h-9 min-w-9 gap-1.5 whitespace-nowrap rounded-full px-3 text-[12px]'
          : 'min-h-11 min-w-11 gap-1.5 rounded-full px-3 py-1.5 text-[12.5px]',
        busy ? 'cursor-default opacity-50' : 'cursor-pointer hover:opacity-90',
      )}
    >
      <Plus size={fab ? 22 : 14} />
      {!fab && <span>{label}</span>}
    </button>
  )
}

/** Shell-owned focused Jobs actions: one New flow and the existing notification behavior. */
export function JobsTopActions({ children }: { children?: React.ReactNode }) {
  return (
    <div aria-label="Job actions" className="flex min-h-11 flex-wrap items-center justify-end gap-1">
      {children}
      <NewJobRequestButton compact fromSelectedEntry />
      <NotificationBell />
    </div>
  )
}

/**
 * The header's notification bell: unread agent-chat messages across every
 * agent and thread, newest first. Clicking one opens that agent's panel on
 * that thread — which is also what marks it read (the panel's own poll).
 *
 * The chip row filters the list to one agent. It's a view of the same unread
 * set, so the badge keeps counting everything; only the list and "Mark all
 * read" narrow — marking read what you can't see would be a surprise. The
 * filter resets when the popup closes.
 */
function NotificationBell({ mobile = false }: { mobile?: boolean }) {
  const { unread, unreadByAgent, markAllRead } = useChatNotifications()
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-notif-bell]')) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const agentOf = (id: string) => AGENTS.find((a) => a.id === id)
  const shown = filter ? unread.filter((n) => n.agentId === filter) : unread

  return (
    <div data-notif-bell className={cn('relative flex-none', mobile && 'w-[52px]')}>
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v)
          setFilter(null)
        }}
        title="Notifications"
        aria-label={unread.length ? `Notifications — ${unread.length} unread` : 'Notifications'}
        className={cn(
          'cursor-pointer border-none bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
          mobile
            ? 'flex w-full flex-col items-center gap-1 rounded-[10px] px-0.5 py-1.5'
            : 'relative flex size-11 items-center justify-center rounded-full',
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
            {shown.length > 0 && (
              <button
                type="button"
                onClick={() => markAllRead(shown)}
                className="ml-auto cursor-pointer border-none bg-transparent text-[11px] font-semibold text-primary hover:underline"
              >
                {filter ? 'Mark read' : 'Mark all read'}
              </button>
            )}
          </div>
          <div className="flex flex-none items-center gap-1 overflow-x-auto border-b border-border px-2 py-1.5">
            {[{ id: null, name: 'All', count: unread.length }, ...CHAT_AGENTS.map((a) => ({
              id: a.id as string | null,
              name: a.name,
              count: unreadByAgent[a.id] ?? 0,
            }))].map((chip) => (
              <button
                key={chip.id ?? 'all'}
                type="button"
                onClick={() => setFilter(chip.id)}
                aria-pressed={filter === chip.id}
                className={cn(
                  'flex flex-none cursor-pointer items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px] font-semibold',
                  filter === chip.id
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <span>{chip.name}</span>
                {chip.count > 0 && (
                  <span className={cn('text-[10px]', filter === chip.id ? 'opacity-80' : 'text-lps-dim')}>
                    {chip.count}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="flex min-h-0 flex-col overflow-y-auto p-1.5">
            {shown.length === 0 && (
              <p className="m-0 px-2 py-3 text-center text-[12px] text-muted-foreground">
                {filter ? `Nothing unread from ${agentOf(filter)?.name ?? filter}.` : 'You’re all caught up.'}
              </p>
            )}
            {shown.map((n) => {
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
