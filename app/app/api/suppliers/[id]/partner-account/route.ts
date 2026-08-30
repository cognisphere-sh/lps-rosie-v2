import { NextResponse } from 'next/server'

import {
  createPartnerAccount,
  deletePartnerAccount,
  partnerAccounts,
  partnerScopeId,
  resetPartnerPassword,
} from '@/lib/auth'
import { resolveUser } from '@/lib/session'

/**
 * The supplier page's Portal access tab: who can sign into this company's
 * portal, and the writes that change it.
 *
 *   GET    — the company's accounts, and the id its portal URL is built from
 *   POST   — add an account
 *   PATCH  — reset one account's password
 *   DELETE — remove one account entirely
 *
 * The company's first account turns `suppliers.is_lps_partner` on and its last
 * one deleted turns it off, but nothing here does that: the flag is derived,
 * maintained by a trigger on `app_users` (migration 0084).
 *
 * Accounts belong to the **company**, never to one farm, so every call answers
 * for `partnerScopeId(id)` — the head branch — whichever branch page it came
 * from. A generated password is returned exactly once, in the reply to the
 * call that made it: Supabase stores a hash, and nothing here can read it back.
 *
 * Admin only. A partner session is already refused every non-portal path by
 * `proxy.ts`; this route says so itself rather than inheriting it, because
 * what it hands out is other people's credentials.
 */
async function requireAdmin(req: Request) {
  const user = await resolveUser(req.headers.get('cookie') ?? '')
  return user?.role === 'admin' ? user : null
}

function supplierId(raw: string): number | null {
  const id = Number.parseInt(raw, 10)
  return Number.isInteger(id) ? id : null
}

type Ctx = { params: Promise<{ id: string }> }

export async function GET(req: Request, { params }: Ctx) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  const id = supplierId((await params).id)
  if (id === null) return NextResponse.json({ error: 'bad id' }, { status: 400 })

  try {
    const [accounts, scopeId] = await Promise.all([partnerAccounts(id), partnerScopeId(id)])
    return NextResponse.json({ accounts, scopeId }, { headers: { 'cache-control': 'no-store' } })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function POST(req: Request, { params }: Ctx) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  const id = supplierId((await params).id)
  if (id === null) return NextResponse.json({ error: 'bad id' }, { status: 400 })

  const body = (await req.json().catch(() => ({}))) as { username?: unknown }
  const username = typeof body.username === 'string' ? body.username : ''
  if (!username.trim()) {
    return NextResponse.json({ error: 'a username is required' }, { status: 400 })
  }

  try {
    const created = await createPartnerAccount(id, username)
    const scopeId = await partnerScopeId(id)
    return NextResponse.json({ ...created, scopeId })
  } catch (e) {
    // These are all "you asked for something that can't be": a taken username,
    // an unknown supplier. The dialog prints the message as-is.
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}

export async function PATCH(req: Request, { params }: Ctx) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  const id = supplierId((await params).id)
  if (id === null) return NextResponse.json({ error: 'bad id' }, { status: 400 })

  const body = (await req.json().catch(() => ({}))) as { accountId?: unknown }
  const accountId = typeof body.accountId === 'string' ? body.accountId : ''
  if (!accountId) {
    return NextResponse.json({ error: 'accountId is required' }, { status: 400 })
  }

  try {
    const reset = await resetPartnerPassword(id, accountId)
    const scopeId = await partnerScopeId(id)
    return NextResponse.json({ ...reset, scopeId })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  const id = supplierId((await params).id)
  if (id === null) return NextResponse.json({ error: 'bad id' }, { status: 400 })

  const body = (await req.json().catch(() => ({}))) as { accountId?: unknown }
  const accountId = typeof body.accountId === 'string' ? body.accountId : ''
  if (!accountId) {
    return NextResponse.json({ error: 'accountId is required' }, { status: 400 })
  }

  try {
    return NextResponse.json(await deletePartnerAccount(id, accountId))
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}
