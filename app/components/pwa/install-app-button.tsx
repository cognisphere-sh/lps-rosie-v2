'use client'

import { useState } from 'react'

import { IosInstallModal } from '@/components/pwa/ios-install-modal'
import { usePWA } from '@/components/pwa/pwa-provider'

/**
 * Manual entry point for installing the app. Renders whatever chrome the caller
 * gives it (rail row, menu item) and owns only the click behaviour, since the
 * three outcomes — prompt, iOS instructions, "can't" — all look the same to the
 * surrounding layout.
 *
 * `onMessage` reports the cases with nothing to show: the button stays put and
 * says why rather than silently doing nothing.
 */
export function InstallAppButton({
  className,
  appName,
  title,
  onMessage,
  children,
}: {
  className?: string
  appName?: string
  title?: string
  onMessage: (message: string) => void
  children: React.ReactNode
}) {
  const { isSupported, isIOS, isStandalone, promptInstall } = usePWA()
  const [iosOpen, setIosOpen] = useState(false)

  const click = async () => {
    if (isIOS) {
      setIosOpen(true)
      return
    }
    if (isSupported) {
      await promptInstall()
      return
    }
    if (isStandalone) {
      onMessage('Already installed — this is the app.')
      return
    }
    // Chrome only fires the install event on a secure origin. A LAN IP is the
    // usual reason it never arrives while testing on a phone.
    const secure = window.location.protocol === 'https:' ||
      ['localhost', '127.0.0.1'].includes(window.location.hostname)
    onMessage(
      secure
        ? 'Already installed, or this browser cannot install apps.'
        : 'Installing needs HTTPS or localhost, not a LAN address.',
    )
  }

  return (
    <>
      <button type="button" onClick={click} title={title} className={className}>
        {children}
      </button>
      {iosOpen && <IosInstallModal appName={appName} onClose={() => setIosOpen(false)} />}
    </>
  )
}
