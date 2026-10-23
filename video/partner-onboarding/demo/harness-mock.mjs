// Stand-in for the cognisphere harness while recording the onboarding video.
// Serves only what the partner portal calls: rosie's webchat app endpoints
// (transcript in the local demo Supabase, so its realtime ping fires) and the
// supplier-events notify hook. Replies come from replies.json, after a delay.
// ponytail: no auth beyond the shared secret, local demo only.
import http from 'node:http'
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises'
import { join, extname } from 'node:path'
import { randomBytes } from 'node:crypto'

const PORT = Number(process.env.PORT ?? 4799)
const SECRET = process.env.WEBCHAT_APP_SECRET ?? 'demo-secret'
const REST = `${process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321'}/rest/v1`
const KEY = process.env.SUPABASE_SECRET_KEY
const FILES = process.env.CHAT_FILES ?? new URL('./chat-files/', import.meta.url).pathname
const REPLY_DELAY = Number(process.env.REPLY_DELAY_MS ?? 2600)
let replies = JSON.parse(await readFile(new URL('./replies.json', import.meta.url), 'utf8'))
const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.pdf': 'application/pdf', '.webm': 'audio/webm', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg', '.wav': 'audio/wav' }
await mkdir(FILES, { recursive: true })

async function db(path, init = {}) {
  const res = await fetch(`${REST}/${path}`, {
    ...init,
    headers: { apikey: KEY, authorization: `Bearer ${KEY}`, 'content-type': 'application/json', prefer: 'return=representation', ...init.headers },
  })
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`)
  return res.status === 204 ? null : res.json()
}

async function thread(threadId) {
  const [t] = await db(`threads?agent=eq.rosie&thread_id=eq.${encodeURIComponent(threadId)}&select=*`)
  return t ?? (await db('threads', { method: 'POST', body: JSON.stringify({ agent: 'rosie', thread_id: threadId }) }))[0]
}

async function append(t, row) {
  const [last] = await db(`thread_messages?thread_id=eq.${t.id}&select=seq&order=seq.desc&limit=1`)
  const seq = (last?.seq ?? 0) + 1
  await db('thread_messages', { method: 'POST', body: JSON.stringify({ thread_id: t.id, seq, portal: true, ...row }) })
  return seq
}

const fromRow = (r) => ({
  id: r.seq, at: Date.parse(r.created_at), role: r.role, text: r.text, files: r.files ?? [],
  senderKind: r.sender_kind ?? (r.role === 'agent' ? 'agent' : 'supplier'),
  ...(r.sender_name ? { senderName: r.sender_name } : {}),
  portal: true,
  ...(r.job_request_id != null ? { jobRequestId: Number(r.job_request_id) } : {}),
})

function reply(text, files) {
  const hay = `${text} ${files.map((f) => f.mime).join(' ')}`.toLowerCase()
  return replies.find((r) => new RegExp(r.match, 'i').test(hay)) ?? replies[replies.length - 1]
}

// The job a message is about, from the portal page it was sent on (as rosie's router would tag it).
async function jobOf(path = '') {
  const m = /\/(orders|requests)\/(\d+)/.exec(path)
  if (!m) return null
  const table = m[1] === 'orders' ? 'orders' : 'availability_requests'
  const [row] = await db(`${table}?id=eq.${m[2]}&select=job_request_id`)
  return row?.job_request_id ?? null
}

const json = (res, code, body) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)) }
const body = async (req) => { const c = []; for await (const x of req) c.push(x); return Buffer.concat(c) }

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x')
  const path = url.pathname.replace(/^\/webhook\/rosie\/webchat/, '')
  try {
    if (url.pathname === '/webhook/rosie/supplier-events/notify') {
      console.log('supplier event', (await body(req)).toString())
      return json(res, 200, { ok: true })
    }
    if (req.headers['x-app-secret'] !== SECRET) return json(res, 401, { error: 'bad secret' })
    // Recording cue: replace the scripted auto-replies. [{match, reply}]
    if (req.method === 'POST' && url.pathname === '/demo/replies') {
      replies = JSON.parse((await body(req)).toString())
      return json(res, 200, { ok: true, count: replies.length })
    }
    // Recording cue: post an LPS reply now. {threadId, text, path?}
    if (req.method === 'POST' && url.pathname === '/demo/reply') {
      const b = JSON.parse((await body(req)).toString() || '{}')
      const seq = await append(await thread(b.threadId), { role: 'agent', text: b.text, files: [], sender_kind: 'agent', job_request_id: await jobOf(b.path) })
      return json(res, 200, { ok: true, id: seq })
    }
    const threadId = String(url.searchParams.get('thread') ?? '')

    if (req.method === 'GET' && path === '/api/app-messages') {
      const t = await thread(threadId)
      const rows = (await db(`thread_messages?thread_id=eq.${t.id}&portal=is.true&select=*&order=seq.asc`)).map(fromRow)
      const since = Number(url.searchParams.get('since') ?? 0), before = Number(url.searchParams.get('before') ?? 0), limit = Number(url.searchParams.get('limit') ?? 0)
      const win = before > 0 ? rows.filter((m) => m.id < before) : rows.filter((m) => m.id > since)
      const messages = limit > 0 ? win.slice(-limit) : win
      const cursor = rows.at(-1)?.id ?? 0
      if (url.searchParams.get('read') === '1' && cursor > t.portal_read_id)
        await db(`threads?id=eq.${t.id}`, { method: 'PATCH', body: JSON.stringify({ portal_read_id: cursor }) })
      return json(res, 200, { messages, hasMore: messages.length < win.length, cursor, readId: url.searchParams.get('read') === '1' ? cursor : t.portal_read_id, pending: false })
    }

    if (req.method === 'POST' && path === '/api/app-upload') {
      const label = decodeURIComponent(String(req.headers['x-file-name'] ?? 'upload'))
      const ext = extname(label).toLowerCase() || '.bin'
      const data = await body(req)
      const name = `portal-${Date.now()}-${randomBytes(12).toString('hex')}${ext}`
      await writeFile(join(FILES, name), data)
      return json(res, 200, { name, label, size: data.length, mime: MIME[ext] ?? req.headers['content-type'] ?? 'application/octet-stream', ticket: 'demo' })
    }

    if (req.method === 'POST' && path === '/api/app-send') {
      const b = JSON.parse((await body(req)).toString() || '{}')
      const t = await thread(b.threadId)
      const files = (b.attachments ?? []).map((a) => ({ name: a.name, label: a.label, mime: a.mime, size: a.size, dir: 'inbox' }))
      const job = await jobOf(b.page?.path)
      const id = await append(t, { role: 'user', text: b.text ?? '', files, sender_name: b.senderName, sender_kind: 'supplier', job_request_id: job })
      const r = reply(b.text ?? '', files)
      if (!process.env.NO_AUTO_REPLY) setTimeout(() => append(t, { role: 'agent', text: r.reply, files: [], sender_kind: 'agent', job_request_id: job }).catch(console.error), REPLY_DELAY)
      return json(res, 200, { ok: true, id })
    }

    if (req.method === 'GET' && path === '/api/app-file') {
      const name = String(url.searchParams.get('name') ?? '').replace(/[^\w.-]/g, '')
      const file = join(FILES, name)
      const { size } = await stat(file)
      res.writeHead(200, { 'content-type': MIME[extname(name).toLowerCase()] ?? 'application/octet-stream', 'content-length': size, 'accept-ranges': 'none' })
      return res.end(await readFile(file))
    }
    json(res, 404, { error: 'not in the demo harness' })
  } catch (e) {
    console.error(e)
    json(res, 500, { error: String(e.message ?? e) })
  }
}).listen(PORT, '127.0.0.1', () => console.log(`demo harness on :${PORT}`))
