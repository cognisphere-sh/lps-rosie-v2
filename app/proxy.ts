import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { resolveUser } from '@/lib/session'

// The app-wide gate. Since 2026-08-30 the app owns its own sign-in: a session
// is the `app_sid` cookie minted by `/api/auth/login` against Supabase Auth,
// verified here by signature (`lib/session.ts`) rather than by asking anyone.
//
// Two populations get through, and they see different halves of the app:
//
//   admin    — the internal team. Everything.
//   partner  — a supplier. The portal and nothing else, and within the portal
//              only their own company's suppliers.
//
// **That last clause is not enforced here.** This file sees a path, not the
// database, and a portal id may be any branch of the partner's company — a
// relation only `suppliers.head_branch_id` can resolve. So the gate below is
// the coarse half (a partner may only be under /partner and /api/partner) and
// `canAccessSupplier()` in `lib/auth.ts` is the real one, applied by every
// `/api/partner/:id` route against the id it is about to read. Both halves are
// needed: this one keeps suppliers out of the internal app, that one keeps
// them out of each other's portals.
const PUBLIC_PREFIXES = ['/login', '/api/auth']

// Where an account still on a generated password is sent, and the only page it
// may reach. `/api/auth` is already public, which is what lets the form post
// the change and the rail sign out from there.
const CHANGE_PASSWORD = '/change-password'

// Where a partner belongs, and the only thing they may reach.
const PARTNER_PREFIXES = ['/partner', '/api/partner']

// A published artifact is meant to be readable by anyone with the link — that
// is the whole point of its public flag — so this one path shape is exempt from
// the gate. Only `/public/`: the sibling `/a/<agent>/private/...` stays behind
// it, and the harness serves an artifact here only while it is flagged public.
const PUBLIC_AVAILABILITY = /^\/(?:api\/)?public\/availability\/[0-9a-f-]{36}$/i

const PUBLIC_ARTIFACT = /^\/a\/[a-z0-9][a-z0-9-]*\/public\/artifacts\/[a-z0-9][a-z0-9-]*$/

const under = (pathname: string, prefixes: string[]) =>
  prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`))

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (under(pathname, PUBLIC_PREFIXES) || PUBLIC_ARTIFACT.test(pathname) || PUBLIC_AVAILABILITY.test(pathname)) {
    return NextResponse.next()
  }

  const user = await resolveUser(req.headers.get('cookie') ?? '')

  if (!user) {
    // Don't redirect API calls into HTML — a fetch() following the redirect would
    // get the login page back instead of an error it can act on.
    if (pathname.startsWith('/api')) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.search = ''
    // So a shared deep link survives the sign-in it triggers.
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  // A portal login is handed over on a password we generated and read down a
  // phone, so it is not a secret yet: until they replace it the session reaches
  // nothing but the change-password page. The flag rides in the cookie
  // (`lib/session.ts`), and `/api/auth/password` re-mints it on success — this
  // file cannot ask the database, so the cookie is the whole state.
  if (user.mustChangePassword && pathname !== CHANGE_PASSWORD) {
    if (pathname.startsWith('/api')) {
      return NextResponse.json({ error: 'password change required' }, { status: 403 })
    }
    const url = req.nextUrl.clone()
    url.pathname = CHANGE_PASSWORD
    url.search = ''
    return NextResponse.redirect(url)
  }

  // `/change-password` is exempt: it is not under `/partner`, and bouncing a
  // partner off it would ping-pong against the check above forever.
  if (
    user.role === 'partner' &&
    pathname !== CHANGE_PASSWORD &&
    !under(pathname, PARTNER_PREFIXES)
  ) {
    if (pathname.startsWith('/api')) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }
    const url = req.nextUrl.clone()
    url.pathname = `/partner/${user.supplierId}`
    url.search = ''
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  // Everything except Next internals and static asset files. The trailing
  // extension rule is load-bearing for PWA install: `/manifest.json`, `/sw.js`
  // and the icons must answer 200 to a signed-out browser, because Chrome's
  // installability check follows no redirect and reports no error — it simply
  // never fires `beforeinstallprompt`.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.[^/]+$).*)'],
}
