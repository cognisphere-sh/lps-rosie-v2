import { NextResponse } from 'next/server'

import { verifyCredentials } from '@/lib/auth'
import { SESSION_COOKIE, SESSION_MAX_AGE, createSession } from '@/lib/session'

/**
 * Sign in. Until 2026-08-30 `/api/auth/*` was rewritten straight to the
 * harness in `next.config.ts`; the app owns it now, and the rewrite is gone.
 *
 * The reply carries only where to go next — never the role or the supplier id
 * beyond that, and never anything that would let a caller enumerate accounts:
 * a bad username and a bad password fail identically.
 */
export async function POST(req: Request) {
  let body: { username?: unknown; password?: unknown }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'bad request' }, { status: 400 })
  }

  const username = typeof body.username === 'string' ? body.username : ''
  const password = typeof body.password === 'string' ? body.password : ''

  let user
  try {
    user = await verifyCredentials(username, password)
  } catch (e) {
    // A Supabase outage is not a failed password — say so, so the sign-in page
    // can tell the difference and nobody hunts for a typo that isn't there.
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
  if (!user) {
    return NextResponse.json({ error: 'invalid username or password' }, { status: 401 })
  }

  const res = NextResponse.json({
    // Still on the password we generated for them: `proxy.ts` would bounce
    // them there from anywhere else, so send them straight to it.
    next: user.mustChangePassword
      ? '/change-password'
      : user.role === 'partner'
        ? `/partner/${user.supplierId}`
        : '/suppliers',
  })
  res.cookies.set(SESSION_COOKIE, await createSession(user), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  })
  return res
}
