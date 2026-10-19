'use client'

import { useEffect } from 'react'

/** Where each leaf of the burst flies to (px from centre) and how far it spins. */
const LEAVES = Array.from({ length: 12 }, (_, i) => {
  const angle = (i / 12) * Math.PI * 2 + (i % 2 ? 0.2 : -0.1)
  const reach = i % 3 === 0 ? 112 : i % 3 === 1 ? 92 : 76
  return {
    dx: Math.round(Math.cos(angle) * reach),
    dy: Math.round(Math.sin(angle) * reach),
    spin: (i % 2 ? 1 : -1) * (120 + i * 25),
    fill: i % 3 === 0 ? 'var(--chart-3)' : i % 3 === 1 ? 'var(--chart-2)' : 'var(--primary)',
  }
})

/**
 * The portal's "we got it" moment after Submit: a ring and check draw in, a
 * seedling sprouts from the check and a ring of leaves bursts outward.
 * Keyframes live in globals.css (`.lps-received*`). It dismisses itself after
 * a few seconds, or on click / Escape.
 */
export function SubmitReceived({ resubmit, onDone }: { resubmit: boolean; onDone: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDone, 3200)
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onDone() }
    window.addEventListener('keydown', onKey)
    return () => { clearTimeout(timer); window.removeEventListener('keydown', onKey) }
  }, [onDone])

  return (
    <div
      role="status"
      onClick={onDone}
      className="lps-received-backdrop fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-background/70 backdrop-blur-[2px] print:hidden"
    >
      <div className="lps-received-card relative flex w-[min(320px,calc(100vw-32px))] flex-col items-center gap-1.5 rounded-2xl border border-border bg-card px-6 pt-7 pb-6 text-center shadow-[var(--lps-shadow)]">
        <div className="relative size-24">
          {LEAVES.map((leaf, i) => (
            <span
              key={i}
              aria-hidden="true"
              className="lps-received-leaf absolute top-1/2 left-1/2 h-2.5 w-4 rounded-[100%_0]"
              style={{
                background: leaf.fill,
                ['--dx' as string]: `${leaf.dx}px`,
                ['--dy' as string]: `${leaf.dy}px`,
                ['--spin' as string]: `${leaf.spin}deg`,
              }}
            />
          ))}
          <svg viewBox="0 0 96 96" className="relative size-24" fill="none" aria-hidden="true">
            <circle cx="48" cy="48" r="40" fill="var(--secondary)" className="lps-received-disc" />
            <circle
              cx="48" cy="48" r="40" stroke="var(--primary)" strokeWidth="4" strokeLinecap="round"
              pathLength={1} className="lps-received-ring" transform="rotate(-90 48 48)"
            />
            <path
              d="M31 50 L43 61 L66 36" stroke="var(--primary)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"
              pathLength={1} className="lps-received-check"
            />
            {/* The seedling grows up from the check's upper arm. */}
            <g className="lps-received-sprout">
              <path d="M66 36 C 66.5 31 65.5 27 66 22" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M66 30 C 63 28.5 59.5 28.5 57.5 24.5 C 61.5 23.5 65 26 66 30 Z" fill="var(--chart-2)" />
              <path d="M66 26 C 69 24.5 72.5 24.5 74.5 20.5 C 70.5 19.5 67 22 66 26 Z" fill="var(--chart-3)" />
            </g>
          </svg>
        </div>
        <p className="lps-received-text mt-2 text-[18px] font-semibold text-foreground">
          {resubmit ? 'Update received' : 'Availability received'}
        </p>
        <p className="lps-received-text text-[13px] text-muted-foreground [animation-delay:.95s]">
          Thanks! Local Plant Supply has your answers.
        </p>
      </div>
    </div>
  )
}
