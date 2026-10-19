'use client'

import { useEffect, useState } from 'react'

const SPROUT_X = [14, 42, 70]

/** Quirky captions the loader rotates through, one set per search flavour. */
export const PLANT_SEARCH_LABELS = [
  'Growing your matches…',
  'Watering the seedlings…',
  'Checking the greenhouse…',
  'Reading the leaf tags…',
  'Talking to the ferns…',
  'Pruning the results…',
  'Waiting on the bees…',
]

export const PHOTO_SEARCH_LABELS = [
  'Developing the film…',
  'Flipping through the album…',
  'Focusing the lens…',
  'Sorting the contact sheet…',
  'Matching leaves to labels…',
]

export const SUPPLIER_SEARCH_LABELS = [
  'Digging through suppliers…',
  'Ringing the nurseries…',
  'Walking the growers’ rows…',
  'Flipping through price lists…',
  'Knocking on greenhouse doors…',
  'Counting the delivery trucks…',
]

/**
 * Search loader: three seedlings sprout from the soil, sway, and sink back in
 * a staggered loop. Keyframes live in globals.css (`.lps-sprout`). The caption
 * rotates through `labels` while the loader stays up.
 */
export function SearchLoader({ labels }: { labels: string[] }) {
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (labels.length < 2) return
    const timer = setInterval(() => setTick((t) => t + 1), 1600)
    return () => clearInterval(timer)
  }, [labels.length])

  const label = labels[tick % labels.length]

  return (
    <div role="status" className="flex flex-col items-center gap-2">
      <svg width="84" height="64" viewBox="0 0 84 64" fill="none" aria-hidden="true">
        {SPROUT_X.map((x, i) => (
          <g key={x} transform={`translate(${x} 0)`}>
            <g className="lps-sprout" style={{ animationDelay: `${i * 0.35}s` }}>
              <path
                d="M0 56 C .5 48 -.5 42 0 33"
                stroke="var(--primary)"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <path d="M0 46 C -3 44.5 -6.5 44.5 -8.5 40.5 C -4.5 39.5 -1 42 0 46 Z" fill="var(--chart-2)" />
              <path d="M0 41 C 3 39.5 6.5 39.5 8.5 35.5 C 4.5 34.5 1 37 0 41 Z" fill="var(--chart-2)" />
              <circle cx="0" cy="31" r="3" fill="var(--chart-4)" />
            </g>
          </g>
        ))}
        <path
          d="M4 59 C 18 55.5 30 55.5 42 59 C 54 55.5 66 55.5 80 59"
          stroke="var(--lps-edge)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
      {/* Keyed on the label so each rotation replays the pop-in animation. */}
      <span key={label} className="lps-pop text-[13px] font-semibold text-muted-foreground">
        {label}
      </span>
    </div>
  )
}

// x position and scale of each seedling in a `SproutRow`, tallest at the centre.
const ROW_SPROUTS: [number, number][] = [
  [22, 0.7], [64, 1], [106, 0.8], [150, 1.25], [194, 0.85], [236, 1.05], [278, 0.72],
]

/**
 * The loader's seedlings as a still row: the brand motif for sign-in and empty
 * states. Each one grows in once (`.lps-sprout-once`), staggered from the left.
 */
export function SproutRow({
  className,
  stem = 'var(--primary)',
  leaf = 'var(--chart-2)',
  bud = 'var(--chart-4)',
  soil = 'var(--lps-edge)',
}: {
  className?: string
  stem?: string
  leaf?: string
  bud?: string
  soil?: string
}) {
  return (
    <svg viewBox="0 0 300 64" fill="none" aria-hidden="true" className={className}>
      {ROW_SPROUTS.map(([x, s], i) => (
        <g key={x} transform={`translate(${x} ${56 - 56 * s}) scale(${s})`}>
          <g className="lps-sprout-once" style={{ animationDelay: `${0.1 + i * 0.07}s` }}>
            <path d="M0 56 C .5 48 -.5 42 0 33" stroke={stem} strokeWidth="2.5" strokeLinecap="round" />
            <path d="M0 46 C -3 44.5 -6.5 44.5 -8.5 40.5 C -4.5 39.5 -1 42 0 46 Z" fill={leaf} />
            <path d="M0 41 C 3 39.5 6.5 39.5 8.5 35.5 C 4.5 34.5 1 37 0 41 Z" fill={leaf} />
            <circle cx="0" cy="31" r="3" fill={bud} />
          </g>
        </g>
      ))}
      <path
        d="M4 59 C 40 55.5 76 55.5 112 59 C 148 55.5 186 55.5 222 59 C 250 56 274 56 296 59"
        stroke={soil}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

/**
 * Dims the results area and centres the loader while a search request is in
 * flight. The nearest positioned ancestor decides what it covers.
 */
export function SearchOverlay({ show, labels }: { show: boolean; labels: string[] }) {
  if (!show) return null
  return (
    <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-background/60 backdrop-blur-[1.5px]">
      <SearchLoader labels={labels} />
    </div>
  )
}
