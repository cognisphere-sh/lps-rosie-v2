'use client'

import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

import { usePWA } from '@/components/pwa/pwa-provider'
import { Button } from '@/components/ui/button'

// sessionStorage, not localStorage: the offer comes back in a new tab or after
// a browser restart, but never twice in one sitting.
const SHOWN_KEY = 'pwa_prompt_shown'

// Nobody signing in wants a dialog over the form, and a public link's visitor
// has no app to install.
const AUTH_PATHS = ['/login', '/change-password']
const PUBLIC_PREFIXES = ['/public/', '/a/']

/**
 * The unprompted install offer, Chrome-only. Safari and Firefox never fire
 * `beforeinstallprompt`, so gating on `isChrome` keeps the popup from appearing
 * with an Install button that could not do anything.
 */
export function PWAInstallPopup() {
  const { isSupported, isChrome, isStandalone, promptInstall } = usePWA()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!isSupported || !isChrome || isStandalone) return
    if (AUTH_PATHS.includes(pathname) || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return
    if (window.sessionStorage.getItem(SHOWN_KEY)) return

    // A beat after load, so it does not land while the page is still settling.
    const t = setTimeout(() => {
      window.sessionStorage.setItem(SHOWN_KEY, '1')
      setOpen(true)
    }, 1000)
    return () => clearTimeout(t)
  }, [isSupported, isChrome, isStandalone, pathname])

  useEffect(() => {
    if (!open) return
    const onEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onEscape)
    return () => document.removeEventListener('keydown', onEscape)
  }, [open])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pwa-install-title"
      className="lps-scrim fixed inset-0 z-[120] flex items-end justify-center bg-foreground/40 p-4 sm:items-center"
      onClick={() => setOpen(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="lps-pop lps-pop-dialog w-full max-w-sm rounded-2xl border border-border bg-popover p-5 shadow-[var(--lps-shadow)]"
      >
        <div className="flex items-center gap-3">
          <Image src="/lps-cactus-icon-192.png" alt="" width={44} height={44} className="rounded-xl" />
          <div className="min-w-0">
            <h2 id="pwa-install-title" className="font-serif text-[18px] font-semibold text-foreground">
              Install Local Plant Supply
            </h2>
            <p className="text-[12px] text-muted-foreground">
              Full screen, on your home screen, opens straight to suppliers.
            </p>
          </div>
        </div>

        <div className="mt-5 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>
            Not now
          </Button>
          <Button
            className="flex-1"
            onClick={async () => {
              await promptInstall()
              setOpen(false)
            }}
          >
            Install
          </Button>
        </div>
      </div>
    </div>
  )
}
