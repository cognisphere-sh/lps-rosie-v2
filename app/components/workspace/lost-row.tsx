import Link from 'next/link'

import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// x and scale of each seedling in the row, tallest at the centre — the same
// row the sign-in page grows, with the centre one missing.
const ROW: [number, number][] = [[22, 0.7], [64, 1], [106, 0.8], [194, 0.85], [236, 1.05], [278, 0.72]]

/**
 * A row of seedlings with a gap where the tallest should be. `wilt` droops
 * the gap's survivor instead of leaving a blank tag — the error page's
 * version: something was here, and it didn't take.
 */
function GapRow({ wilt }: { wilt?: boolean }) {
  return (
    <svg viewBox="0 0 300 72" fill="none" aria-hidden="true" className="w-[min(340px,80vw)]">
      {ROW.map(([x, s], i) => (
        <g key={x} transform={`translate(${x} ${64 - 56 * s}) scale(${s})`}>
          <g className="lps-sprout-once" style={{ animationDelay: `${0.1 + i * 0.07}s` }}>
            <path d="M0 56 C .5 48 -.5 42 0 33" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M0 46 C -3 44.5 -6.5 44.5 -8.5 40.5 C -4.5 39.5 -1 42 0 46 Z" fill="var(--chart-2)" />
            <path d="M0 41 C 3 39.5 6.5 39.5 8.5 35.5 C 4.5 34.5 1 37 0 41 Z" fill="var(--chart-2)" />
            <circle cx="0" cy="31" r="3" fill="var(--chart-4)" />
          </g>
        </g>
      ))}
      {wilt ? (
        // Bent over at the top, leaves hanging, bud down by the soil.
        <g transform="translate(150 8) scale(1.25)">
          <g className="lps-sprout-once" style={{ animationDelay: '.3s' }}>
            <path d="M0 45 C .5 38 0 33 4 31 C 9 29 11 34 10 39" stroke="var(--lps-dim)" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M0 40 C -3 41 -6 43 -7 47 C -3 46.5 -.5 44 0 40 Z" fill="var(--lps-dim)" opacity=".7" />
            <circle cx="10" cy="42" r="3" fill="var(--chart-4)" opacity=".8" />
          </g>
        </g>
      ) : (
        // A blank nursery tag where the tallest seedling should be.
        <g className="lps-tag-settle">
          <path
            d="M143 20.5 h14 a3 3 0 0 1 3 3 v27 l-10 14 l-10 -14 v-27 a3 3 0 0 1 3 -3 z"
            fill="var(--card)"
            stroke="var(--lps-dim)"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <circle cx="150" cy="27" r="1.8" stroke="var(--lps-dim)" strokeWidth="1.5" />
          <path d="M145.5 35.5 h9 M145.5 41.5 h6" stroke="var(--lps-edge)" strokeWidth="2" strokeLinecap="round" />
        </g>
      )}
      <path
        d="M4 67 C 40 63.5 76 63.5 112 67 C 148 63.5 186 63.5 222 67 C 250 64 274 64 296 67"
        stroke="var(--lps-edge)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

/**
 * The full-page frame the 404 and error pages share: the gap in the row,
 * a serif headline, what happened, and the way out.
 */
export function LostRow({
  title,
  body,
  wilt,
  children,
}: {
  title: string
  body: React.ReactNode
  wilt?: boolean
  children?: React.ReactNode
}) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-background px-6 py-10 text-center">
      <GapRow wilt={wilt} />
      <h1 className="m-0 mt-2 text-balance font-serif text-[32px] font-bold leading-tight tracking-[-0.01em] text-foreground">
        {title}
      </h1>
      <p className="m-0 max-w-[440px] text-balance text-[14px] leading-[1.5] text-muted-foreground">{body}</p>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
        {children}
      </div>
    </main>
  )
}

/** The way back to the workspace's front door. */
export function HomeLink({ primary }: { primary?: boolean }) {
  return (
    <Link href="/" className={cn(buttonVariants({ variant: primary ? 'default' : 'outline' }))}>
      Back to Jobs
    </Link>
  )
}
