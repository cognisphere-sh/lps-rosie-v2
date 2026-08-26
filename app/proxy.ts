import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { resolveUser } from '@/lib/session'

// Gate the app behind the harness login — the same credentials as the harness
// user store (harness/.secrets/users.json, i.e. HARNESS_USER / HARNESS_PASS).
//
// `pi_sid` is a *signed* stateless session cookie minted by the harness, so
// checking that it merely exists proves nothing. That distinction matters here:
// every page reads Supabase server-side with the project's secret key, and the
// harness is no longer in the path to re-check the session on each data call.
// A presence-only gate would therefore let a hand-set `pi_sid=anything` read
// the whole supplier and inventory database. So verify the cookie for real, by
// asking the harness who it belongs to.
//
// `proxy` is Next 16's replacement for the `middleware` file convention.
//
// `/partner` and `/api/partner` are the supplier portal: suppliers are not
// harness users, and portal auth is a deliberately deferred step (Bhoumik,
// 2026-08-19), so for now the routes are open and scope themselves to the
// supplier id in the URL — LPS Partners only, customer details only
// where `share_customer_details` says so. Revisit this line when auth lands.
const PUBLIC_PREFIXES = ['/login', '/api/auth', '/partner', '/api/partner']

// A published artifact is meant to be readable by anyone with the link — that
// is the whole point of its public flag — so this one path shape is exempt from
// the gate. Only `/public/`: the sibling `/a/<agent>/private/...` stays behind
// it, and the harness serves an artifact here only while it is flagged public.
const PUBLIC_ARTIFACT = /^\/a\/[a-z0-9][a-z0-9-]*\/public\/artifacts\/[a-z0-9][a-z0-9-]*$/

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (
    PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`)) ||
    PUBLIC_ARTIFACT.test(pathname)
  ) {
    return NextResponse.next()
  }

  const cookie = req.headers.get('cookie') ?? ''
  const user = req.cookies.has('pi_sid') ? await resolveUser(cookie) : null
  if (user) return NextResponse.next()

  // Don't redirect API calls into HTML — a fetch() following the redirect would
  // get the login page back instead of an error it can act on.
  if (pathname.startsWith('/api')) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const url = req.nextUrl.clone()
  url.pathname = '/login'
  return NextResponse.redirect(url)
}

export const config = {
  // Everything except Next internals and static asset files. The trailing
  // extension rule is load-bearing for PWA install: `/manifest.json`, `/sw.js`
  // and the icons must answer 200 to a signed-out browser, because Chrome's
  // installability check follows no redirect and reports no error — it simply
  // never fires `beforeinstallprompt`.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.[^/]+$).*)'],
}
