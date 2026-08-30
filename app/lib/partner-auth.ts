import 'server-only'

import { NextResponse } from 'next/server'

import { canAccessSupplier } from '@/lib/auth'
import { resolveUser, type SessionUser } from '@/lib/session'

/**
 * The gate on every `/api/partner/:id` route — the half `proxy.ts` cannot do.
 *
 * `proxy.ts` only sees the shape of a path, so all it can say is "a partner
 * may be under /partner". Which *supplier* a partner may read is a database
 * question: their account hangs off a company (the head branch) and covers
 * every branch of it, a relation only `suppliers.head_branch_id` resolves.
 * So each route asks here, about the exact id it is about to read.
 *
 * The portal was public until 2026-08-30 — "portal auth is a deliberately
 * deferred step" — and the id in the URL was the only scoping. It is now a
 * real gate: a partner sees their own company and 404s on everyone else's,
 * and the internal admin sees them all.
 */
export type PartnerGate =
  | { ok: true; supplierId: number; user: SessionUser }
  | { ok: false; res: NextResponse }

export async function requirePartnerAccess(req: Request, rawId: string): Promise<PartnerGate> {
  const supplierId = Number.parseInt(rawId, 10)
  if (!Number.isInteger(supplierId)) {
    return { ok: false, res: NextResponse.json({ error: 'bad id' }, { status: 400 }) }
  }

  const user = await resolveUser(req.headers.get('cookie') ?? '')
  if (!user) {
    return { ok: false, res: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) }
  }

  if (!(await canAccessSupplier(user, supplierId))) {
    // 404, not 403: answering "forbidden" would confirm that this supplier id
    // exists, which is exactly what one partner should not learn about another.
    return { ok: false, res: NextResponse.json({ error: 'not found' }, { status: 404 }) }
  }

  return { ok: true, supplierId, user }
}
