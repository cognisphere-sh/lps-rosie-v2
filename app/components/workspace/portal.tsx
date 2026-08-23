'use client'

// The supplier portal's chrome — the outside-facing sibling of the admin
// Shell, and deliberately the same design language: a collapsible left nav
// rail on desktop, a bottom tab bar on mobile, and the theme / settings /
// log-out controls at the rail's foot. A supplier gets their identity and two
// destinations, not the operator's pages or agent chat. Settings and Log out
// are drawn but disabled: both belong to supplier sign-in, which is a
// deliberately deferred step — see docs/app/README.md (Supplier portal).

import Link from 'next/link'
import { Leaf } from 'lucide-react'
import { useEffect, useState } from 'react'

import {
  ChevronLeft, ChevronRight, FileIcon, LogoutIcon, MoonIcon, RequestsIcon, SettingsIcon, SunIcon,
} from '@/components/workspace/icons'
import { useIsMobile, useTheme } from '@/components/workspace/shell'
import { cn } from '@/lib/utils'

export type PortalTab = 'requests' | 'orders'

const AUTH_LATER = 'Available once supplier sign-in lands'

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

    </div>
  )
}
