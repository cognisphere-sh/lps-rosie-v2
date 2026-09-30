import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import ts from 'typescript'
import { NextRequest } from 'next/server'

import { JOB_REALTIME_TABLES } from './job-events.ts'
import proxy from '../proxy.ts'
import { createSession, SESSION_COOKIE } from './session.ts'

const require = createRequire(import.meta.url)
function load(file: string, mocks: Record<string, unknown>) {
  const source = readFileSync(new URL(file, import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } })
  const module = { exports: {} as Record<string, (...args: any[]) => any> }
  new Function('require', 'module', 'exports', outputText)((name: string) => name in mocks ? mocks[name] : require(name), module, module.exports)
  return module.exports
}

test('one server channel emits data-free job invalidations for every write and upstream reconnect', () => {
  const callbacks = new Map<string, (value: unknown) => void>()
  let subscribed!: (status: string) => void
  let channels = 0
  const channel = {
    on(_kind: string, filter: { table: string; event: string }, cb: (value: unknown) => void) {
      assert.equal(filter.event, '*')
      callbacks.set(filter.table, cb)
      return channel
    },
    subscribe(cb: typeof subscribed) { subscribed = cb; return channel },
  }
  const globals = globalThis as unknown as Record<string, unknown>
  delete globals.__lps_chat_realtime_v2
  const { onThreadEvent, onJobEvent } = load('./chat-realtime.ts', {
    'server-only': {},
    '@/lib/job-events': { JOB_REALTIME_TABLES },
    '@/lib/supabase': { supabase: { channel() { channels++; return channel } } },
  })
  const jobs: unknown[] = [], threads: unknown[] = []
  const offThread = onThreadEvent((event: unknown) => threads.push(event))
  const offJob = onJobEvent((event: unknown) => jobs.push(event))
  try {
    assert.equal(channels, 1)
    for (const table of JOB_REALTIME_TABLES) {
      for (const eventType of ['INSERT', 'UPDATE', 'DELETE']) {
        callbacks.get(table)!({ eventType, old: { id: 1 }, new: { name: 'private', public_token: 'secret' } })
      }
    }
    assert.equal(jobs.length, JOB_REALTIME_TABLES.length * 3)
    assert.ok(jobs.every((event) => JSON.stringify(event) === '{"type":"jobs"}'))
    assert.equal(threads.length, 0)
    subscribed('SUBSCRIBED')
    subscribed('CHANNEL_ERROR')
    subscribed('SUBSCRIBED')
    assert.equal(jobs.length, JOB_REALTIME_TABLES.length * 3 + 2)
    callbacks.get('threads')!({ new: { agent: 'rosie', thread_id: 'jr-1', last_seq: 4 } })
    assert.equal(threads.length, 1)
    offJob()
    callbacks.get('job_requests')!({ eventType: 'DELETE', old: { id: 1 } })
    assert.equal(jobs.length, JOB_REALTIME_TABLES.length * 3 + 2)
  } finally {
    offThread(); offJob(); delete globals.__lps_chat_realtime_v2
  }
})

test('SSE flushes immediately, disables buffering and releases listeners on abort or cancellation', async () => {
  const { sseResponse } = load('./chat-realtime.ts', {
    'server-only': {}, '@/lib/job-events': { JOB_REALTIME_TABLES }, '@/lib/supabase': { supabase: {} },
  })
  for (const mode of ['abort', 'cancel', 'already-aborted']) {
    const controller = new AbortController()
    if (mode === 'already-aborted') controller.abort()
    let stopped = 0
    const response = sseResponse(new Request('https://example.com/api/chat/events', { signal: controller.signal }), () => () => { stopped++ }) as Response
    assert.equal(response.headers.get('x-accel-buffering'), 'no')
    const reader = response.body!.getReader()
    const first = await reader.read()
    assert.equal(new TextDecoder().decode(first.value), ': connected\n\n')
    if (mode === 'cancel') await reader.cancel()
    else controller.abort()
    assert.equal(stopped, 1)
    assert.equal((await reader.read()).done, true)
  }
})

test('the internal endpoint relays jobs and chat and unsubscribes both', () => {
  let jobs!: (event: unknown) => void, threads!: (event: any) => void
  let cleanup!: () => void
  let stopped = 0
  const events: unknown[] = []
  const { GET } = load('../app/api/chat/events/route.ts', {
    '@/lib/agents': { CHAT_AGENTS: [{ id: 'rosie' }] },
    '@/lib/chat-realtime': {
      sseResponse(_req: Request, subscribe: (send: (event: unknown) => void) => () => void) {
        cleanup = subscribe((event) => events.push(event))
      },
      onThreadEvent(cb: typeof threads) { threads = cb; return () => { stopped++ } },
      onJobEvent(cb: typeof jobs) { jobs = cb; return () => { stopped++ } },
    },
  })
  GET(new Request('https://example.com/api/chat/events'))
  jobs({ type: 'jobs' })
  threads({ type: 'thread', agent: 'rosie' })
  threads({ type: 'thread', agent: 'unlisted' })
  assert.deepEqual(events, [{ type: 'jobs' }, { type: 'thread', agent: 'rosie' }])
  cleanup()
  assert.equal(stopped, 2)
})

test('job stream requires an internal session; anonymous and partner callers are rejected', async () => {
  const previous = process.env.APP_SESSION_SECRET
  process.env.APP_SESSION_SECRET = 'test-job-realtime-session-secret'
  try {
    const url = 'https://example.com/api/chat/events'
    assert.equal((await proxy(new NextRequest(url))).status, 401)
    for (const role of ['partner', 'admin'] as const) {
      const token = await createSession({ id: 'test', username: 'test', role, supplierId: role === 'partner' ? 7 : null, mustChangePassword: false })
      const result = await proxy(new NextRequest(url, { headers: { cookie: `${SESSION_COOKIE}=${token}` } }))
      assert.equal(result.status, role === 'partner' ? 403 : 200)
      if (role === 'admin') assert.equal(result.headers.get('x-middleware-next'), '1')
    }
  } finally {
    if (previous === undefined) delete process.env.APP_SESSION_SECRET
    else process.env.APP_SESSION_SECRET = previous
  }
})

test('partner data stream checks supplier access before subscribing and sends only invalidations', async () => {
  for (const status of [401, 404, 200]) {
    let listener!: (event: unknown) => void
    let cleanup!: () => void
    let subscriptions = 0, stopped = 0
    const events: unknown[] = []
    const { GET } = load('../app/api/partner/[id]/events/route.ts', {
      '@/lib/partner-auth': {
        async requirePartnerAccess(_req: Request, id: string) {
          assert.equal(id, '7')
          return status === 200 ? { ok: true, supplierId: 7 } : { ok: false, res: new Response(null, { status }) }
        },
      },
      '@/lib/chat-realtime': {
        onJobEvent(cb: typeof listener) { subscriptions++; listener = cb; return () => { stopped++ } },
        sseResponse(_req: Request, subscribe: (send: (event: unknown) => void) => () => void) {
          cleanup = subscribe((event) => events.push(event))
          return new Response(null)
        },
      },
    })
    const response = await GET(new Request('https://example.com/api/partner/7/events'), { params: Promise.resolve({ id: '7' }) })
    assert.equal(response.status, status)
    assert.equal(subscriptions, status === 200 ? 1 : 0)
    if (status !== 200) continue
    listener({ type: 'jobs' })
    assert.deepEqual(events, [{ type: 'jobs' }])
    cleanup()
    assert.equal(stopped, 1)
  }
})
