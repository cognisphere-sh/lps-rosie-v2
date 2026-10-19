'use client'

import Image from 'next/image'

import { Button } from '@/components/ui/button'

/**
 * Safari has no install API — `beforeinstallprompt` never fires on iOS — so the
 * only thing left is to tell people where the button is.
 */
export function IosInstallModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ios-install-title"
      className="lps-scrim fixed inset-0 z-[120] flex items-end justify-center bg-foreground/40 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="lps-pop lps-pop-dialog w-full max-w-sm rounded-2xl border border-border bg-popover p-5 shadow-[var(--lps-shadow)]"
      >
        <div className="flex items-center gap-3">
          <Image src="/lps-cactus-icon-192.png" alt="" width={44} height={44} className="rounded-xl" />
          <div className="min-w-0">
            <h2 id="ios-install-title" className="font-serif text-[18px] font-semibold text-foreground">
              Add to Home Screen
            </h2>
            <p className="text-[12px] text-muted-foreground">Local Plant Supply, one tap away.</p>
          </div>
        </div>

        <ol className="mt-4 flex flex-col gap-2.5 text-[13px] text-foreground">
          {[
            <>Tap the <strong>Share</strong> button in Safari&rsquo;s toolbar.</>,
            <>Scroll down and choose <strong>Add to Home Screen</strong>.</>,
            <>Tap <strong>Add</strong> — the app opens full screen from then on.</>,
          ].map((step, i) => (
            <li key={i} className="flex gap-2.5">
              <span className="inline-flex size-5 flex-none items-center justify-center rounded-full bg-secondary text-[11px] font-bold text-secondary-foreground">
                {i + 1}
              </span>
              <span className="leading-snug">{step}</span>
            </li>
          ))}
        </ol>

        <Button onClick={onClose} className="mt-5 w-full">
          Got it
        </Button>
      </div>
    </div>
  )
}
