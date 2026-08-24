import { NextResponse } from 'next/server'

import { portalChatFetch, portalChatTarget } from '@/lib/portal-chat'

/**
 * The portal's chat with Local Plant Supply (rosie), on the supplier's own
 * thread. GET pages the portal-visible transcript; POST sends the supplier's
 * message. Public like the rest of the portal (supplier sign-in is a
 * deliberately deferred step); the harness side is server-to-server, authed
 * by WEBCHAT_APP_SECRET, and answers 404 here when the chat isn't wired.
 */

async function target(rawSupplier: string) {
  const supplierId = Number.parseInt(rawSupplier, 10)
  if (!Number.isInteger(supplierId)) return null
  return portalChatTarget(supplierId)
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ supplierId: string }> },
) {
  try {
    const t = await target((await params).supplierId)
    if (!t) return NextResponse.json({ error: 'chat unavailable' }, { status: 404 })
    const search = new URL(req.url).searchParams
    const qs = new URLSearchParams({ thread: t.threadId })
    for (const k of ['since', 'before', 'limit']) {
      const v = search.get(k)
      if (v) qs.set(k, v)
    }
    const res = await portalChatFetch(`api/app-messages?${qs.toString()}`)
    const body = (await res.json()) as Record<string, unknown>
    return NextResponse.json(
      res.ok ? { ...body, supplierName: t.supplierName } : body,
      { status: res.status },
    )
  } catch {
    return NextResponse.json({ error: 'chat unreachable' }, { status: 502 })
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ supplierId: string }> },
) {
  try {
    const t = await target((await params).supplierId)
    if (!t) return NextResponse.json({ error: 'chat unavailable' }, { status: 404 })
    const b = (await req.json().catch(() => ({}))) as { text?: string }
    const text = String(b.text ?? '').trim()
    if (!text) return NextResponse.json({ error: 'text required' }, { status: 400 })
    const res = await portalChatFetch('api/app-send', {
      method: 'POST',
      body: JSON.stringify({
        threadId: t.threadId,
        text,
        senderName: `${t.supplierName} (portal)`,
      }),
    })
    return NextResponse.json(await res.json(), { status: res.status })
  } catch {
    return NextResponse.json({ error: 'chat unreachable' }, { status: 502 })
  }
}
