'use client'

import { Button } from '@/components/ui/button'
import { HomeLink, LostRow } from '@/components/workspace/lost-row'

/**
 * Any page that throws while rendering lands here instead of on a blank
 * screen. `reset` re-renders the segment, which is usually enough for a
 * dropped request.
 */
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <LostRow
      wilt
      title="This page didn’t load"
      body="Something went wrong while opening it. Try again — if it keeps happening, the page itself may be broken, so let the team know which page it was."
    >
      <Button onClick={reset}>Try again</Button>
      <HomeLink />
    </LostRow>
  )
}
