import { NextResponse } from 'next/server'

import { partnerChatFetch, partnerChatTarget } from '@/lib/partner-chat'

/**
 * The portal's chat with Local Plant Supply (rosie), on the supplier's own
 * thread. GET pages the portal-visible transcript or streams one scoped file;
 * POST uploads a file or sends the supplier's text/attachments. Public like
 * the rest of the portal (supplier sign-in is a
 * deliberately deferred step); the harness side is server-to-server, authed
 * by WEBCHAT_APP_SECRET, and answers 404 here when the chat isn't wired.
 */

async function target(rawSupplier: string) {
  const supplierId = Number.parseInt(rawSupplier, 10)
  if (!Number.isInteger(supplierId)) return null
  return partnerChatTarget(supplierId)
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const t = await target((await params).id)
    if (!t) return NextResponse.json({ error: 'chat unavailable' }, { status: 404 })
    const search = new URL(req.url).searchParams
    const file = search.get('file')
    if (file) {
      const qs = new URLSearchParams({ thread: t.threadId, name: file })
      const range = req.headers.get('range')
      const res = await partnerChatFetch(`api/app-file?${qs.toString()}`, {
        headers: range ? { range } : undefined,
        signal: req.signal,
      })
      return new Response(res.body, {
        status: res.status,
        headers: {
          'content-type': res.headers.get('content-type') ?? 'application/octet-stream',
          ...(res.headers.get('content-length')
            ? { 'content-length': res.headers.get('content-length')! }
            : {}),
          ...(res.headers.get('content-disposition')
            ? { 'content-disposition': res.headers.get('content-disposition')! }
            : {}),
          ...(res.headers.get('accept-ranges')
            ? { 'accept-ranges': res.headers.get('accept-ranges')! }
            : {}),
          ...(res.headers.get('content-range')
            ? { 'content-range': res.headers.get('content-range')! }
            : {}),
          'x-content-type-options': 'nosniff',
        },
      })
    }

    const qs = new URLSearchParams({ thread: t.threadId })
    for (const k of ['since', 'before', 'limit', 'read']) {
      const v = search.get(k)
      if (v) qs.set(k, v)
    }
    const res = await partnerChatFetch(`api/app-messages?${qs.toString()}`)
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
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const t = await target((await params).id)
    if (!t) return NextResponse.json({ error: 'chat unavailable' }, { status: 404 })
    const search = new URL(req.url).searchParams
    if (search.get('upload') === '1') {
      const label = req.headers.get('x-file-name')?.trim()
      if (!label || !req.body) return NextResponse.json({ error: 'file required' }, { status: 400 })
      const qs = new URLSearchParams({ thread: t.threadId })
      const res = await partnerChatFetch(`api/app-upload?${qs.toString()}`, {
        method: 'POST',
        headers: {
          'content-type': req.headers.get('content-type') ?? 'application/octet-stream',
          'x-file-name': label,
        },
        body: req.body,
        signal: req.signal,
      })
      return NextResponse.json(await res.json(), { status: res.status })
    }

    const b = (await req.json().catch(() => ({}))) as {
      text?: string
      attachments?: { name: string; label: string; mime: string; size: number; ticket: string }[]
      page?: { path?: string; title?: string }
    }
    const text = String(b.text ?? '').trim()
    const attachments = Array.isArray(b.attachments) ? b.attachments : []
    if (!text && attachments.length === 0) {
      return NextResponse.json({ error: 'text or attachments required' }, { status: 400 })
    }
    const res = await partnerChatFetch('api/app-send', {
      method: 'POST',
      body: JSON.stringify({
        threadId: t.threadId,
        text,
        attachments,
        senderName: `${t.supplierName} (portal)`,
        ...(b.page && typeof b.page === 'object' ? { page: b.page } : {}),
      }),
    })
    return NextResponse.json(await res.json(), { status: res.status })
  } catch {
    return NextResponse.json({ error: 'chat unreachable' }, { status: 502 })
  }
}
