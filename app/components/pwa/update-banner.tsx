'use client'

import { X } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'

// A desktop window can stay visible all day without a visibility change.
const CHECK_EVERY_MS = 15 * 60 * 1000

/**
 * Offers a reload once the server is running a newer build than this page.
 *
 * A phone resumes an installed app where it left off instead of reloading it,
 * so without this a user keeps the JavaScript of whatever build they last
 * launched until they kill the app. The page's own build is the first id
 * `/api/version` answers after load; every return to the foreground (and a
 * slow interval) compares against it. An offer, not an automatic reload, so a
 * half-typed message is never thrown away.
 */
export function PWAUpdateBanner() {
  const [stale, setStale] = useState(false)

  useEffect(() => {
    let loaded: string | null = null
    const check = async () => {
      try {
        const res = await fetch('/api/version', { cache: 'no-store' })
        const { buildId } = (await res.json()) as { buildId: string | null }
        if (!buildId) return
        if (loaded === null) loaded = buildId
        else if (buildId !== loaded) setStale(true)
      } catch {
        // Offline or mid-restart — the next check will tell.
      }
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check()
    }

    void check()
    document.addEventListener('visibilitychange', onVisible)
    const t = setInterval(check, CHECK_EVERY_MS)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      clearInterval(t)
    }
  }, [])

  if (!stale) return null

  return (
    <div
      role="status"
      className="fixed inset-x-0 z-[110] flex justify-center px-4"
      style={{ top: 'calc(env(safe-area-inset-top) + 8px)' }}
    >
      <div className="flex items-center gap-2 rounded-full border border-border bg-popover py-1.5 pl-4 pr-1.5 text-[13px] text-foreground shadow-[var(--lps-shadow)]">
        <span>A new version is available</span>
        <Button size="sm" className="rounded-full" onClick={() => window.location.reload()}>
          Reload
        </Button>
        <Button size="icon-sm" variant="ghost" className="rounded-full" aria-label="Dismiss" onClick={() => setStale(false)}>
          <X />
        </Button>
      </div>
    </div>
  )
}
