'use client'

import { useEffect, useRef } from 'react'

/** Where each leaf flies (px from the centre) and how far it spins. */
const LEAVES = Array.from({ length: 9 }, (_, i) => {
  const angle = (i / 9) * Math.PI * 2 - Math.PI / 2 + (i % 2 ? 0.25 : -0.15)
  const reach = i % 3 === 0 ? 38 : i % 3 === 1 ? 30 : 24
  return {
    dx: Math.round(Math.cos(angle) * reach),
    dy: Math.round(Math.sin(angle) * reach * 0.8),
    spin: (i % 2 ? 1 : -1) * (140 + i * 30),
    fill: i % 3 === 0 ? 'var(--chart-3)' : i % 3 === 1 ? 'var(--chart-2)' : 'var(--lps-tone-green-dot)',
  }
})

/**
 * A job marked Won: a handful of leaves fly off the status pill once, the
 * workspace-sized cousin of the portal's received burst. Purely decorative —
 * the pill's label already says Won — so it is hidden from assistive tech and
 * from reduced-motion users (globals.css). Place it inside a positioned
 * element; `onDone` unmounts it after the flight.
 */
export function LeafBurst({ onDone }: { onDone: () => void }) {
  // Read through a ref so a parent re-render mid-flight doesn't restart the timer.
  const done = useRef(onDone)
  done.current = onDone
  useEffect(() => {
    const timer = setTimeout(() => done.current(), 900)
    return () => clearTimeout(timer)
  }, [])

  return (
    <span aria-hidden="true" className="pointer-events-none absolute top-1/2 left-1/2 z-10 size-0">
      {LEAVES.map((leaf, i) => (
        <span
          key={i}
          className="lps-burst-leaf absolute top-0 left-0 h-[7px] w-[11px] rounded-[100%_0]"
          style={{
            background: leaf.fill,
            ['--dx' as string]: `${leaf.dx}px`,
            ['--dy' as string]: `${leaf.dy}px`,
            ['--spin' as string]: `${leaf.spin}deg`,
          }}
        />
      ))}
    </span>
  )
}
