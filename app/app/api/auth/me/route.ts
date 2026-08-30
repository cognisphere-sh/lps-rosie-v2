import { NextResponse } from 'next/server'

import { resolveUser } from '@/lib/session'

/**
 * Who is signed in — for the nav rail's avatar and menu (`useSessionUser` in
 * `shell.tsx`), and for anything else that wants to ask the browser's own
 * session about itself.
 *
 * Same `{ user }` shape the harness's `/api/auth/me` answered while this path
 * was rewritten to it, so the callers did not change; `role` and `supplierId`
 * are added because the app now has two kinds of user and the chrome differs.
 * Answers 200 with `{ user: null }` for no session rather than 401 — the rail
 * asks on every page, including ones where being signed out is fine.
 */
export async function GET(req: Request) {
  const user = await resolveUser(req.headers.get('cookie') ?? '')
  return NextResponse.json(
    user
      ? { user: user.username, role: user.role, supplierId: user.supplierId }
      : { user: null },
    { headers: { 'cache-control': 'no-store' } },
  )
}
