import assert from 'node:assert/strict'
import test from 'node:test'
import { purgeDeletedJobChats } from '../../harness/plugins/webchat/deleted-job-chats'

function database(rows: { thread_id: string; purged_at: string | null }[]) {
  return { from() {
    let target = ''
    let patch: { purged_at: string } | undefined
    const query = {
      select() { return query }, order() { return query },
      eq(column: string, value: string) { if (column === 'thread_id') target = value; return query },
      update(value: { purged_at: string }) { patch = value; return query },
      async range(from: number, to: number) { return { data: rows.slice(from, to + 1), error: null } },
      then(resolve: (value: unknown) => unknown) {
        if (patch) rows.find((row) => row.thread_id === target)!.purged_at = patch.purged_at
        return Promise.resolve(resolve({ error: null }))
      },
    }
    return query
  } }
}

test('deleted chat is hidden immediately, busy harness reset is retried, and restart remembers deletion', async () => {
  const rows = [{ thread_id: 'jr-1', purged_at: null as string | null }]
  const db = database(rows)
  const deleted = new Set<string>()
  const cached = new Set(['jr-1', 'supplier-1'])
  let busy = true
  let resets = 0
  const run = () => purgeDeletedJobChats({ db, agent: 'rosie', deleted, forget: (id) => { cached.delete(id) },
    reset: () => { resets++; if (busy) throw new Error('thread is busy') } })
  await run()
  assert.equal(deleted.has('jr-1'), true)
  assert.deepEqual([...cached], ['supplier-1'])
  assert.equal(rows[0].purged_at, null)
  busy = false
  await run()
  assert.ok(rows[0].purged_at)
  await run()
  assert.equal(resets, 2)
  const restarted = new Set<string>()
  await purgeDeletedJobChats({ db, agent: 'rosie', deleted: restarted, forget() {}, reset() { throw new Error('must not reset again') } })
  assert.equal(restarted.has('jr-1'), true)
})

test('deletion reconciliation pages beyond 1000 rows and leaves other agents untouched', async () => {
  const rows = Array.from({ length: 1001 }, (_, index) => ({ thread_id: `jr-${index}`, purged_at: 'already reset' }))
  const deleted = new Set<string>()
  await purgeDeletedJobChats({ db: database(rows), agent: 'rosie', deleted, forget() {}, reset() {} })
  assert.equal(deleted.size, 1001)
  await purgeDeletedJobChats({ db: { from() { throw new Error('must not query') } }, agent: 'daisy', deleted, forget() {}, reset() {} })
})

test('webchat starts, purges a deleted thread, rejects stale reads, and restarts cleanly', async () => {
  const { mkdtemp, rm } = await import('node:fs/promises')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const { Readable } = await import('node:stream')
  const { default: WebchatPlugin } = await import('../../harness/plugins/webchat/index')
  const dir = await mkdtemp(join(tmpdir(), 'deleted-chat-lifecycle-'))
  const originalFetch = globalThis.fetch
  let purgedAt: string | null = null
  let resets = 0
  let busy = true
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input))
    const table = url.pathname.split('/').pop()
    if (table === 'deleted_job_threads') {
      if (init?.method === 'PATCH') {
        purgedAt = JSON.parse(String(init.body)).purged_at
        return Response.json([])
      }
      return Response.json([{ thread_id: 'jr-1', purged_at: purgedAt }])
    }
    return Response.json([])
  }
  const context = {
    agentId: 'rosie', config: { threadId: 'main', historyLimit: 50 },
    stateDir: dir, inboxDir: join(dir, 'inbox'), httpBaseUrl: 'http://localhost/webhook/rosie/webchat',
    secrets: { WEBCHAT_SUPABASE_URL: 'http://localhost', WEBCHAT_SUPABASE_SECRET_KEY: 'test-only-key' },
    log: { info() {}, error() {} },
    resetThread(channel: string, id: string) { assert.equal(channel, 'web'); assert.equal(id, 'jr-1'); resets++; if (busy) throw new Error('busy') },
  }
  let plugin = new WebchatPlugin()
  try {
    await plugin.start(context)
    assert.equal(purgedAt, null)
    Object.assign(plugin, { sessionUser: async () => 'Chris' })
    busy = false
    let status = 0
    const req = Object.assign(Readable.from([]), { method: 'GET', url: '/api/messages?thread=jr-1', headers: {} })
    await plugin.handleHttpRequest(req, { writeHead(code: number) { status = code }, end() {} })
    assert.equal(status, 410)
    assert.ok(purgedAt)
    await plugin.stop()
    const previousResets = resets
    plugin = new WebchatPlugin()
    await plugin.start(context)
    assert.equal(resets, previousResets)
  } finally {
    await plugin.stop()
    globalThis.fetch = originalFetch
    await rm(dir, { recursive: true, force: true })
  }
})
