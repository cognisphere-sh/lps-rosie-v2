'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'

/**
 * Registers the service worker and captures Chrome's `beforeinstallprompt`, so
 * the app can offer installation on its own terms instead of leaving it to the
 * browser's mini-infobar.
 */

// Not in lib.dom yet — Chrome-only.
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/** Per-window memory that this window was launched as the installed app. */
const STANDALONE_STORE = 'lps.pwa.standalone'

export type InstallOutcome = 'accepted' | 'dismissed' | 'unavailable'

type PWAState = {
  /** Chrome has fired `beforeinstallprompt`, so `promptInstall()` will work. */
  isSupported: boolean
  isIOS: boolean
  isChrome: boolean
  /** Already launched from the home screen — there is nothing left to install. */
  isStandalone: boolean
  promptInstall: () => Promise<InstallOutcome>
}

const PWAContext = createContext<PWAState>({
  isSupported: false,
  isIOS: false,
  isChrome: false,
  isStandalone: false,
  promptInstall: async () => 'unavailable',
})

export const usePWA = () => useContext(PWAContext)

export function PWAProvider({ children }: { children: React.ReactNode }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [env, setEnv] = useState({ isIOS: false, isChrome: false, isStandalone: false })

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    // A failed registration (insecure origin, say) is not worth surfacing —
    // the install entry points explain the situation on their own.
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  }, [])

  useEffect(() => {
    const capture = (e: Event) => {
      // Suppress Chrome's own infobar; we prompt from the popup / rail button.
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    const installed = () => setDeferred(null)

    window.addEventListener('beforeinstallprompt', capture)
    window.addEventListener('appinstalled', installed)
    return () => {
      window.removeEventListener('beforeinstallprompt', capture)
      window.removeEventListener('appinstalled', installed)
    }
  }, [])

  useEffect(() => {
    // Deferred a tick to keep the UA sniff out of the render pass.
    const t = setTimeout(() => {
      const ua = window.navigator.userAgent
      // "Not a browser tab" rather than "is standalone": Chrome reports the
      // installed window as standalone, minimal-ui or window-controls-overlay
      // depending on version and manifest, and a plain standalone match was
      // seen flipping false after an in-app reload (2026-08-26) — which hid the
      // Reload row and showed Install app inside the installed app. Once a
      // window has been seen installed it stays so for its lifetime, since a
      // reload cannot turn an app window back into a tab.
      let installed = !window.matchMedia('(display-mode: browser)').matches ||
        (window.navigator as Navigator & { standalone?: boolean }).standalone === true
      try {
        if (installed) window.sessionStorage.setItem(STANDALONE_STORE, '1')
        else installed = window.sessionStorage.getItem(STANDALONE_STORE) === '1'
      } catch {
        // Storage can be unavailable; the live check alone is fine then.
      }
      setEnv({
        isIOS: /iPad|iPhone|iPod/.test(ua),
        isChrome: /Chrome|CriOS|Edg/.test(ua) && !/OPR|SamsungBrowser/.test(ua),
        isStandalone: installed,
      })
    }, 0)
    return () => clearTimeout(t)
  }, [])

  const promptInstall = useCallback(async (): Promise<InstallOutcome> => {
    if (!deferred) return 'unavailable'
    await deferred.prompt()
    const { outcome } = await deferred.userChoice
    // The event is single-use; Chrome re-fires it on a later load if dismissed.
    setDeferred(null)
    return outcome
  }, [deferred])

  return (
    <PWAContext.Provider value={{ ...env, isSupported: !!deferred, promptInstall }}>
      {children}
    </PWAContext.Provider>
  )
}
