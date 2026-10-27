import { Leaf } from 'lucide-react'

import { SproutRow } from '@/components/workspace/search-loader'

/**
 * The frame `/login` and `/change-password` share: an Edge Teal brand field
 * carrying the wordmark and the seedling row, beside the form. On a phone the
 * field shrinks to a band above the form. Only `/login` opts into the supplied
 * logo; other callers keep the original wordmark.
 */
export function AuthFrame({ children, signInLogo = false }: { children: React.ReactNode; signInLogo?: boolean }) {
  return (
    <main className="grid min-h-dvh bg-background lg:grid-cols-[minmax(0,1.15fr)_minmax(440px,1fr)]">
      <section className="relative flex flex-col justify-between gap-6 overflow-hidden bg-primary px-6 pb-5 pt-[max(24px,env(safe-area-inset-top))] text-primary-foreground lg:px-14 lg:pb-12 lg:pt-14">
        <span className="flex size-11 items-center justify-center rounded-full bg-primary-foreground/15 lg:size-14">
          <Leaf className="size-5 lg:size-7" />
        </span>
        {signInLogo ? (
          <h1 className="relative m-0 aspect-[1600/533] w-full max-w-[800px]">
            <span className="sr-only">Local Plant Supply</span>
            <img
              src="/lps-sign-in-logo.png"
              alt=""
              aria-hidden="true"
              width={1600}
              height={533}
              className="absolute inset-0 h-full w-full object-contain"
            />
          </h1>
        ) : (
          <h1 className="m-0 max-w-[9ch] text-balance font-serif text-[40px] font-bold leading-[.95] tracking-[-0.02em] lg:text-[84px]">
            Local Plant Supply
          </h1>
        )}
        <SproutRow
          className="w-full max-w-[560px]"
          stem="var(--primary-foreground)"
          leaf="color-mix(in oklab, var(--primary-foreground) 62%, var(--primary))"
          bud="var(--chart-3)"
          soil="color-mix(in oklab, var(--primary-foreground) 40%, var(--primary))"
        />
      </section>
      <div className="grid place-items-center px-5 py-8 lg:p-10">{children}</div>
    </main>
  )
}
