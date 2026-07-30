'use client'

const SPROUT_X = [14, 42, 70]

/**
 * Search loader: three seedlings sprout from the soil, sway, and sink back in
 * a staggered loop. Keyframes live in globals.css (`.lps-sprout`).
 */
export function SearchLoader({ label }: { label: string }) {
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
      <span className="text-[12.5px] font-semibold text-muted-foreground">{label}</span>
    </div>
  )
}

/**
 * Dims the results area and centres the loader while a search request is in
 * flight. The nearest positioned ancestor decides what it covers.
 */
export function SearchOverlay({ show, label }: { show: boolean; label: string }) {
  if (!show) return null
  return (
    <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-background/60 backdrop-blur-[1.5px]">
      <SearchLoader label={label} />
    </div>
  )
}
