import { NextResponse } from 'next/server'

import { SESSION_COOKIE } from '@/lib/session'

/** Sign out: drop the cookie. The token is stateless, so this is the whole of it. */
export async function POST() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set(SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 })
  return res
}
