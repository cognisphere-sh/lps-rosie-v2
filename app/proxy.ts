import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

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
const PUBLIC_PREFIXES = ['/login', '/api/auth']

const HARNESS_URL = process.env.HARNESS_URL ?? 'http://127.0.0.1:3142'

async function resolveUser(cookie: string): Promise<string | null> {
  try {
    const res = await fetch(`${HARNESS_URL}/api/auth/me`, {
      headers: { cookie },
      cache: 'no-store',
    })
    if (!res.ok) return null
    // /me answers 200 with { user: null } when the session is bad — the status
    // alone is not the answer.
    const body = (await res.json()) as { user?: string | null }
    return body.user ?? null
  } catch {
    // Harness unreachable: fail closed. An outage must not open the database.
    return null
  }
}

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
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
  // Everything except Next internals and static asset files.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.[^/]+$).*)'],
}
