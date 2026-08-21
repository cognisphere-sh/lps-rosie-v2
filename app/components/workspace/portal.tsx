'use client'

// The supplier portal's chrome — the outside-facing sibling of the admin
// Shell, and deliberately the same design language: a collapsible left nav
// rail on desktop, a bottom tab bar on mobile, and the theme / settings /
// log-out controls at the rail's foot. A supplier gets their identity and two
// destinations, not the operator's pages or agent chat. Settings and Log out
// are drawn but disabled: both belong to supplier sign-in, which is a
// deliberately deferred step — see docs/app/README.md (Supplier portal).

import Link from 'next/link'
import { Leaf, MessagesSquare } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { ChatLegend, Composer, Thread } from '@/components/workspace/availability'
import {
  ChevronLeft, ChevronRight, FileIcon, LogoutIcon, MoonIcon, RequestsIcon, SettingsIcon, SunIcon,
} from '@/components/workspace/icons'
import { useIsMobile, useTheme } from '@/components/workspace/shell'
import type { SupplierMessage } from '@/lib/availability'
import { cn } from '@/lib/utils'

/**
 * The supplier's ONE chat thread with Local Plant Supply, self-contained: it
 * fetches, polls (daisy answers this thread), auto-scrolls and sends. Pages
 * hand it to the frame's `chat` slot; the frame owns the docked chrome.
 */
export function PortalChat({ supplierId }: { supplierId: number }) {
  const [messages, setMessages] = useState<SupplierMessage[]>([])
  const [error, setError] = useState('')
  const scroller = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    const res = await fetch(`/api/portal/${supplierId}/messages`)
    if (res.ok) {
      setMessages(((await res.json()) as { messages: SupplierMessage[] }).messages)
    }
  }, [supplierId])

  useEffect(() => {
    if (!Number.isInteger(supplierId)) return
    void load().catch(() => {})
    const timer = setInterval(() => {
      void load().catch(() => {})
    }, 10_000)
    return () => clearInterval(timer)
  }, [supplierId, load])

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight })
  }, [messages.length])

  const send = async (body: string) => {
    setError('')
    const res = await fetch(`/api/portal/${supplierId}/messages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ body }),
    })
    if (!res.ok) {
      const b = (await res.json().catch(() => ({}))) as { error?: string }
      setError(b.error ?? 'Could not send')
    }
    await load()
  }

  return (
    <>
      <div ref={scroller} className="flex min-h-[220px] flex-1 flex-col gap-2.5 overflow-auto p-3">
        <p className="m-0 text-[12px] text-muted-foreground">
          Anything at all — availability, substitutes, timing, delivery. Your message goes straight
          to the Local Plant Supply team.
        </p>
        {/* The same legend the admin's Conversation tab draws, flipped to this
            side of the thread — the two views are one chat. */}
        <ChatLegend ownSide="supplier" />
        <Thread messages={messages} ownSide="supplier" emptyText="No messages yet." />
        {error && <p className="m-0 text-[11.5px] text-destructive">{error}</p>}
      </div>
      <div className="flex-none border-t border-border p-2.5">
        <Composer
          modes={[{ channel: 'app', label: 'Message', placeholder: 'Write a message…' }]}
          onSend={(body) => send(body)}
        />
      </div>
    </>
  )
}

export type PortalTab = 'requests' | 'orders'

const AUTH_LATER = 'Available once supplier sign-in lands'

export function PortalFrame({
  supplierId,
  supplierName,
  tab,
  chat,
  chatSubtitle,
  children,
}: {
  supplierId: number
  /** Null while loading — the frame draws before the fetch answers. */
  supplierName: string | null
  tab: PortalTab
  /**
   * The availability chat, docked on the right like the admin app's agent
   * panel — collapsible to the same 46px rail on desktop, rendered under the
   * content on mobile. The page supplies the thread + composer; the frame
   * owns the chrome.
   */
  chat?: React.ReactNode
  /** What the chat is about — "Availability request AR-3". */
  chatSubtitle?: string
  children: React.ReactNode
}) {
  const isMobile = useIsMobile()
  const { dark, toggle } = useTheme()
  const [navOpen, setNavOpen] = useState(true)
  // Starts as the rail — clicking it opens the sidebar (Bhoumik, 2026-08-19).
  const [chatOpen, setChatOpen] = useState(false)

  const chatHeader = (
    <div className="flex flex-none items-center gap-2.5 border-b border-border px-3 py-2.5">
      <span className="flex size-8 flex-none items-center justify-center rounded-full bg-accent">
        <Leaf className="size-4 text-accent-foreground" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-bold leading-tight text-foreground">
          Local Plant Supply
        </span>
        <span className="block truncate text-[10.5px] text-muted-foreground">
          {chatSubtitle ?? 'Availability chat'}
        </span>
      </span>
      <button
        type="button"
        onClick={() => setChatOpen(false)}
        aria-label="Hide chat"
        title="Hide chat"
        className="flex size-7 flex-none cursor-pointer items-center justify-center rounded-lg border-none bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <ChevronRight size={15} />
      </button>
    </div>
  )

  const nav: { id: PortalTab; label: string; href: string; Icon: typeof RequestsIcon }[] = [
    { id: 'requests', label: 'Availability Requests', href: `/portal/${supplierId}`, Icon: RequestsIcon },
    { id: 'orders', label: 'Orders', href: `/portal/${supplierId}/orders`, Icon: FileIcon },
  ]

  const railBtn = (active: boolean, enabled = true) =>
    cn(
      'flex items-center gap-2.5 rounded-[10px] border-none text-[13px] font-semibold w-full text-left transition-colors',
      navOpen ? 'px-2.5 py-2 justify-start' : 'px-0 py-2 justify-center',
      active ? 'bg-secondary text-primary' : 'text-muted-foreground',
      enabled ? 'cursor-pointer hover:bg-muted hover:text-foreground' : 'cursor-not-allowed opacity-45',
    )

  const identity = (
    <div className="flex min-w-0 items-center gap-2.5">
      <span className="flex size-9 flex-none items-center justify-center rounded-full bg-accent">
        <Leaf className="size-4.5 text-accent-foreground" />
      </span>
      {(!isMobile ? navOpen : true) && (
        <span className="min-w-0">
          <span className="block truncate font-serif text-[14.5px] font-bold leading-tight text-foreground">
            {supplierName ?? '…'}
          </span>
          <span className="block text-[10.5px] text-muted-foreground">
            Supplier portal · Local Plant Supply
          </span>
        </span>
      )}
    </div>
  )

  if (isMobile) {
    return (
      <div className="flex min-h-dvh flex-col bg-background">
        <header className="sticky top-0 z-40 border-b border-border bg-card px-3 py-2.5">
          {identity}
        </header>
        <main className="flex flex-1 flex-col gap-3 overflow-auto px-3 py-3">
          {children}
          {chat && (
            <section className="mt-1 flex flex-col overflow-hidden rounded-xl border border-border bg-card">
              {/* Mobile gets the same chat under the content; only the hide
                  button makes no sense where there is no rail to reopen from. */}
              <div className="flex flex-none items-center gap-2.5 border-b border-border px-3 py-2.5">
                <span className="flex size-8 flex-none items-center justify-center rounded-full bg-accent">
                  <Leaf className="size-4 text-accent-foreground" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-bold leading-tight text-foreground">
                    Local Plant Supply
                  </span>
                  <span className="block truncate text-[10.5px] text-muted-foreground">
                    {chatSubtitle ?? 'Availability chat'}
                  </span>
                </span>
              </div>
              {chat}
            </section>
          )}
        </main>
        <nav className="sticky bottom-0 flex flex-none items-stretch gap-0.5 overflow-hidden border-t border-border bg-card px-1 pt-[5px] pb-[calc(5px+env(safe-area-inset-bottom))]">
          {nav.map(({ id, label, href, Icon }) => (
            <Link
              key={id}
              href={href}
              aria-label={label}
              className={cn(
                'flex min-w-0 flex-1 cursor-pointer flex-col items-center gap-1 rounded-[10px] border-none bg-transparent px-0.5 py-1.5',
                tab === id ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              <span className="flex size-[18px] items-center justify-center"><Icon /></span>
              <span className="text-center text-[10.5px] font-semibold leading-tight">
                {id === 'requests' ? 'Requests' : label}
              </span>
            </Link>
          ))}
          <button
            type="button"
            onClick={toggle}
            aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            className="flex min-w-0 flex-1 cursor-pointer flex-col items-center gap-1 rounded-[10px] border-none bg-transparent px-0.5 py-1.5 text-muted-foreground"
          >
            <span className="flex size-[18px] items-center justify-center">
              {dark ? <MoonIcon /> : <SunIcon />}
            </span>
            <span className="text-center text-[10.5px] font-semibold leading-tight">Theme</span>
          </button>
          <button
            type="button"
            disabled
            title={AUTH_LATER}
            aria-label="Log out"
            className="flex min-w-0 flex-1 cursor-not-allowed flex-col items-center gap-1 rounded-[10px] border-none bg-transparent px-0.5 py-1.5 text-muted-foreground opacity-45"
          >
            <span className="flex size-[18px] items-center justify-center"><LogoutIcon /></span>
            <span className="text-center text-[10.5px] font-semibold leading-tight">Log out</span>
          </button>
        </nav>
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh bg-background">
      <nav
        className="sticky top-0 flex h-dvh flex-none flex-col gap-0.5 border-r border-border bg-card"
        style={{ width: navOpen ? 232 : 56, padding: navOpen ? '12px 10px' : '12px 8px' }}
      >
        <div className={cn('mb-2', navOpen ? 'px-1' : 'flex justify-center')}>{identity}</div>

        {nav.map(({ id, label, href, Icon }) => (
          <Link key={id} href={href} title={label} className={railBtn(tab === id)}>
            <span className="flex size-4 flex-none items-center justify-center"><Icon /></span>
            {navOpen && <span>{label}</span>}
          </Link>
        ))}

        <div className="flex-1" />

        <div className="flex flex-col gap-0.5 border-t border-lps-hair pt-2">
          <button type="button" onClick={toggle} title={dark ? 'Dark mode' : 'Light mode'} className={railBtn(false)}>
            <span className="flex size-4 flex-none items-center justify-center">
              {dark ? <MoonIcon /> : <SunIcon />}
            </span>
            {navOpen && (
              <>
                <span>{dark ? 'Dark mode' : 'Light mode'}</span>
                <span className={cn('relative ml-auto h-[17px] w-[30px] flex-none rounded-full', dark ? 'bg-primary' : 'bg-muted')}>
                  <span
                    className="absolute top-[2px] size-[13px] rounded-full bg-card transition-all"
                    style={{ left: dark ? 15 : 2 }}
                  />
                </span>
              </>
            )}
          </button>

          <button type="button" disabled title={`Settings — ${AUTH_LATER.toLowerCase()}`} className={railBtn(false, false)}>
            <span className="flex size-4 flex-none items-center justify-center"><SettingsIcon /></span>
            {navOpen && <span>Settings</span>}
          </button>

          <button type="button" disabled title={`Log out — ${AUTH_LATER.toLowerCase()}`} className={railBtn(false, false)}>
            <span className="flex size-4 flex-none items-center justify-center"><LogoutIcon /></span>
            {navOpen && <span>Log out</span>}
          </button>
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

      <main className="flex min-w-0 flex-1 flex-col">
        <div className="mx-auto flex w-full max-w-[1100px] flex-1 flex-col gap-3 px-4 py-4">
          {children}
        </div>
      </main>

      {/* The availability chat, docked right like the admin app's agent panel. */}
      {chat &&
        (chatOpen ? (
          <aside className="sticky top-0 flex h-dvh w-[360px] flex-none flex-col border-l border-border bg-card">
            {chatHeader}
            <div className="flex min-h-0 flex-1 flex-col">{chat}</div>
          </aside>
        ) : (
          <div className="sticky top-0 flex h-dvh w-[46px] flex-none flex-col items-center border-l border-border bg-card py-3.5">
            <button
              type="button"
              onClick={() => setChatOpen(true)}
              aria-label="Show chat"
              title="Availability chat"
              className="flex cursor-pointer flex-col items-center gap-2.5 border-none bg-transparent p-0 text-muted-foreground hover:text-foreground"
            >
              <MessagesSquare className="size-[20px]" />
              <span className="text-[11px] font-bold uppercase tracking-[.08em] [writing-mode:vertical-rl]">
                Chat
              </span>
            </button>
          </div>
        ))}
    </div>
  )
}
