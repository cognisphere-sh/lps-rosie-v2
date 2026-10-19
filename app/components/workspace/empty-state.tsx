import { cn } from '@/lib/utils'

/**
 * Which drawing an empty state carries. Each is the search loader's seedling
 * world at rest, and each says something different about *why* it is empty:
 *
 * - `seed`  — nothing yet: one sprout just breaking the soil.
 * - `tag`   — nothing matches: a blank plant tag pushed into bare soil.
 * - `bloom` — all done: the sprout has flowered (notifications, closed lists).
 */
export type EmptyArt = 'seed' | 'tag' | 'bloom'

const LEFT_LEAF = 'M0 -12 C -3.5 -13.5 -7.5 -13.5 -10 -18 C -5.5 -19 -1.5 -16.5 0 -12 Z'
const RIGHT_LEAF = 'M0 -16 C 3.5 -17.5 7.5 -17.5 10 -22 C 5.5 -23 1.5 -20.5 0 -16 Z'
const SOIL = 'M10 57 C 34 52.5 86 52.5 110 57'

/** The drawing alone, for places that set their own copy (notifications). */
export function EmptyArtwork({ art, className }: { art: EmptyArt; className?: string }) {
  return (
    <svg viewBox="0 0 120 64" fill="none" aria-hidden="true" className={cn('w-[112px]', className)}>
      {art === 'seed' && (
        <g transform="translate(60 54)">
          <g className="lps-sprout-once">
            <path d="M0 0 C .4 -6 -.4 -10 0 -18" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" />
            <path d={LEFT_LEAF} fill="var(--chart-2)" />
            <path d={RIGHT_LEAF} fill="var(--chart-2)" />
          </g>
        </g>
      )}
      {art === 'bloom' && (
        <g transform="translate(60 55)">
          <g className="lps-sprout-once">
            <path d="M0 0 C .5 -9 -.5 -16 0 -27" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" />
            <path d={LEFT_LEAF} fill="var(--chart-2)" />
            <path d={RIGHT_LEAF} fill="var(--chart-2)" />
            {[0, 72, 144, 216, 288].map((turn) => (
              <circle key={turn} cx="0" cy="-35.5" r="3.6" fill="var(--chart-4)" transform={`rotate(${turn} 0 -31)`} />
            ))}
            <circle cx="0" cy="-31" r="2.6" fill="var(--chart-3)" />
          </g>
        </g>
      )}
      {art === 'tag' && (
        // A nursery tag: rounded head, eyelet, two blank write-on lines and a
        // point that disappears into the soil. It settles once as it lands.
        <g className="lps-tag-settle">
          <path
            d="M53 10 h14 a3 3 0 0 1 3 3 v27 l-10 14 l-10 -14 v-27 a3 3 0 0 1 3 -3 z"
            fill="var(--card)"
            stroke="var(--lps-dim)"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <circle cx="60" cy="16.5" r="1.8" stroke="var(--lps-dim)" strokeWidth="1.5" />
          <path d="M55.5 25 h9 M55.5 31 h6" stroke="var(--lps-edge)" strokeWidth="2" strokeLinecap="round" />
        </g>
      )}
      <path d={SOIL} stroke="var(--lps-edge)" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="36" cy="58.5" r="1.4" fill="var(--lps-edge)" />
      <circle cx="87" cy="58" r="1.1" fill="var(--lps-edge)" />
    </svg>
  )
}

/**
 * The workspace's empty state: a small drawing, what is (not) here, and what
 * to do about it. `children` is room for an action under the hint.
 */
export function EmptyState({
  art,
  title,
  hint,
  className,
  children,
}: {
  art: EmptyArt
  title: React.ReactNode
  hint?: React.ReactNode
  className?: string
  children?: React.ReactNode
}) {
  return (
    <div className={cn('flex flex-col items-center gap-2 px-5 py-14 text-center', className)}>
      <EmptyArtwork art={art} className="mb-1" />
      <span className="text-balance text-[14px] font-semibold text-foreground">{title}</span>
      {hint && <span className="max-w-[430px] text-balance text-[13px] text-muted-foreground">{hint}</span>}
      {children}
    </div>
  )
}
