'use client'

// The supplier portal's chrome — the outside-facing sibling of the admin
// Shell, and deliberately the same design language: a collapsible left nav
// rail on desktop, a chat column docked on the right, a bottom tab bar on
// mobile, and the theme / settings / log-out controls at the left rail's foot.
// A supplier gets their identity and two destinations, not the operator's
// pages or agent chat. Settings and Log out are drawn but disabled: both
// belong to supplier sign-in, which is a deliberately deferred step — see
// docs/app/README.md (Supplier portal).

import Link from 'next/link'
import { Leaf, MessagesSquare, Send, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import {
  ChevronLeft, ChevronRight, FileIcon, LogoutIcon, MoonIcon, RequestsIcon, SettingsIcon, SunIcon,
} from '@/components/workspace/icons'
import { useIsMobile, useTheme } from '@/components/workspace/shell'
import { cn } from '@/lib/utils'

export type PortalTab = 'requests' | 'orders'

const AUTH_LATER = 'Available once supplier sign-in lands'

// ------------------------------------------------------------------ the chat

interface PortalMessage {
  id: number
  at: number
  role: 'user' | 'agent'
  text: string
  senderName?: string
}

const CHAT_POLL_MS = 5000

/**
 * The supplier's chat with Local Plant Supply — the portal-visible half of
 * the supplier's rosie thread. Their messages reach the team; the team's
 * internal traffic on the same thread never reaches here (the plugin only
 * serves portal-visible rows).
 */
function PortalChat({ supplierId }: { supplierId: number }) {
  const [messages, setMessages] = useState<PortalMessage[]>([])
  const [pending, setPending] = useState(false)
  const [unavailable, setUnavailable] = useState(false)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState('')
  const cursor = useRef(0)
  const scroller = useRef<HTMLDivElement>(null)

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/portal/${supplierId}/chat?since=${cursor.current}`, {
        cache: 'no-store',
      })
      if (res.status === 404) {
        setUnavailable(true)
        return
      }
      if (!res.ok) throw new Error(String(res.status))
      const body = (await res.json()) as { messages: PortalMessage[]; pending: boolean }
      if (body.messages.length) {
        setMessages((prev) => [...prev, ...body.messages])
        cursor.current = body.messages[body.messages.length - 1].id
      }
      setPending(body.pending)
      setError('')
    } catch {
      setError('Can’t reach Local Plant Supply right now.')
    }
  }, [supplierId])

  useEffect(() => {
    cursor.current = 0
    setMessages([])
    void poll()
    const t = setInterval(() => void poll(), CHAT_POLL_MS)
    return () => clearInterval(t)
  }, [poll])

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight })
  }, [messages.length, pending])

  const send = async () => {
    const text = draft.trim()
    if (!text) return
    setDraft('')
    try {
      const res = await fetch(`/api/portal/${supplierId}/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (!res.ok) throw new Error(String(res.status))
      setPending(true)
      await poll()
    } catch {
      setError('Message failed to send.')
      setDraft(text)
    }
  }

  if (unavailable) {
    return (
      <div className="flex flex-1 items-center justify-center p-4 text-center text-[12.5px] text-muted-foreground">
        Chat isn’t switched on for this portal yet.
      </div>
    )
  }

  return (
    <>
      <div ref={scroller} className="flex min-h-[220px] flex-1 flex-col gap-2.5 overflow-auto p-3">
        <p className="m-0 text-[12px] text-muted-foreground">
          Anything at all — availability, substitutes, timing, delivery. Your message goes straight
          to the Local Plant Supply team.
        </p>
        {messages.map((m) => (
          <div
            key={m.id}
            className={cn(
              'flex max-w-[88%] flex-col gap-[3px]',
              m.role === 'user' ? 'items-end self-end' : 'items-start self-start',
            )}
          >
            <div
              className={cn(
                'whitespace-pre-wrap px-3 py-2 text-[13.5px] leading-[1.35]',
                m.role === 'user'
                  ? 'rounded-[12px_12px_4px_12px] bg-primary text-primary-foreground'
                  : 'rounded-[12px_12px_12px_4px] border border-lps-hair bg-lps-bubble text-foreground',
              )}
            >
              {m.text}
            </div>
            <span className="text-[10.5px] leading-none text-lps-dim">
              {m.role === 'user' ? 'You' : 'Local Plant Supply'}
            </span>
          </div>
        ))}
        {pending && (
          <span className="self-start text-[11.5px] text-muted-foreground">
            Local Plant Supply is typing…
          </span>
        )}
        {error && <p className="m-0 text-[11.5px] text-destructive">{error}</p>}
      </div>
      <div className="flex flex-none items-end gap-2 border-t border-border p-2.5">
        <textarea
          value={draft}
          rows={1}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void send()
            }
          }}
          placeholder="Write a message…"
          className="max-h-32 min-h-9 min-w-0 flex-1 resize-none rounded-md border border-input bg-card px-3 py-1.5 text-[13.5px] leading-6 outline-none focus-visible:border-ring"
        />
        <button
          type="button"
          onClick={() => void send()}
          disabled={!draft.trim()}
          aria-label="Send"
          className="flex size-9 flex-none cursor-pointer items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
        >
          <Send size={15} />
        </button>
      </div>
    </>
  )
}

export function PortalFrame({
  supplierId,
  supplierName,
  tab,
  children,
}: {
  supplierId: number
  /** Null while loading — the frame draws before the fetch answers. */
  supplierName: string | null
  tab: PortalTab
  children: React.ReactNode
}) {
  const isMobile = useIsMobile()
  const { dark, toggle } = useTheme()
  const [navOpen, setNavOpen] = useState(true)
  // The chat with Local Plant Supply, opened from the right-hand rail
  // (desktop) or its bottom tab (mobile) — the portal's sibling of the admin
  // agent panel.
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
        <span className="block truncate text-[10.5px] text-muted-foreground">Availability chat</span>
      </span>
      <button
        type="button"
        onClick={() => setChatOpen(false)}
        aria-label="Hide chat"
        title="Hide chat"
        className="flex size-7 flex-none cursor-pointer items-center justify-center rounded-lg border-none bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <X size={15} />
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
        </main>
        {/* The chat overlays the page content; the tab bar stays visible. */}
        {chatOpen && (
          <div className="fixed inset-x-0 top-0 z-40 flex flex-col bg-background" style={{ bottom: 'calc(52px + env(safe-area-inset-bottom))' }}>
            {chatHeader}
            <PortalChat supplierId={supplierId} />
          </div>
        )}
        <nav className="sticky bottom-0 z-50 flex flex-none items-stretch gap-0.5 overflow-hidden border-t border-border bg-card px-1 pt-[5px] pb-[calc(5px+env(safe-area-inset-bottom))]">
          {nav.map(({ id, label, href, Icon }) => (
            <Link
              key={id}
              href={href}
              aria-label={label}
              onClick={() => setChatOpen(false)}
              className={cn(
                'flex min-w-0 flex-1 cursor-pointer flex-col items-center gap-1 rounded-[10px] border-none bg-transparent px-0.5 py-1.5',
                tab === id && !chatOpen ? 'text-primary' : 'text-muted-foreground',
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
            onClick={() => setChatOpen((v) => !v)}
            aria-label="Chat with Local Plant Supply"
            className={cn(
              'flex min-w-0 flex-1 cursor-pointer flex-col items-center gap-1 rounded-[10px] border-none bg-transparent px-0.5 py-1.5',
              chatOpen ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            <span className="flex size-[18px] items-center justify-center"><MessagesSquare size={17} /></span>
            <span className="text-center text-[10.5px] font-semibold leading-tight">Chat</span>
          </button>
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

      {/* The chat with Local Plant Supply, docked on the right in the admin
          app's shape: a narrow rail carrying who you'd be talking to, which
          opens into the panel. */}
      {chatOpen ? (
        <aside className="sticky top-0 flex h-dvh w-[340px] flex-none flex-col border-l border-border bg-card">
          {chatHeader}
          <PortalChat supplierId={supplierId} />
        </aside>
      ) : (
        <div className="sticky top-0 flex h-dvh w-[46px] flex-none flex-col items-center border-l border-border bg-card py-3.5">
          <button
            type="button"
            onClick={() => setChatOpen(true)}
            aria-label="Chat with Local Plant Supply"
            title="Chat with Local Plant Supply"
            className="flex cursor-pointer flex-col items-center gap-2.5 border-none bg-transparent p-0 text-muted-foreground hover:text-foreground"
          >
            <span className="flex size-[26px] flex-none items-center justify-center rounded-full bg-accent">
              <Leaf className="size-3.5 text-accent-foreground" />
            </span>
            <span className="text-[11px] font-bold uppercase tracking-[.08em] [writing-mode:vertical-rl]">
              Local Plant Supply
            </span>
          </button>
        </div>
      )}
    </div>
  )
}
