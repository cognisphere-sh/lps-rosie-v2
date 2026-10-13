import { NextResponse } from 'next/server'

import { changeOwnPassword } from '@/lib/auth'
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  createSession,
  resolveUser,
} from '@/lib/session'

/**
 * Change your own password — the only self-service password write there is.
 *
 * The account is the caller's own, taken from the signed cookie and never from
 * the body, so this cannot reach anyone else's login; the current password is
 * still required, because a borrowed browser should not be enough to lock the
 * owner out of their portal.
 *
 * On success it re-mints the cookie. That is not a detail: `mustChangePassword`
 * rides in the session, and the forced-change gate in `proxy.ts` reads the
 * cookie rather than the database, so leaving the old one in place would send
 * the person straight back to the form they just completed.
 */
export async function POST(req: Request) {
  const user = await resolveUser(req.headers.get('cookie') ?? '')
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let body: { currentPassword?: unknown; newPassword?: unknown }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'bad request' }, { status: 400 })
  }

  const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : ''
  const newPassword = typeof body.newPassword === 'string' ? body.newPassword : ''
  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: 'both passwords are required' }, { status: 400 })
  }

  let updated
  try {
    updated = await changeOwnPassword(user, currentPassword, newPassword)
  } catch (e) {
    // Everything `changeOwnPassword` throws is something the person can act on
    // — a wrong current password, a new one that is too short or unchanged — so
    // the message goes back as-is for the form to print. It names no account
    // but the caller's own.
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }

  const res = NextResponse.json({
    next: updated.role === 'partner' ? `/partner/${updated.supplierId}` : '/requests',
  })
  res.cookies.set(SESSION_COOKIE, await createSession(updated), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  })
  return res
}
