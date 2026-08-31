import assert from 'node:assert/strict'
import test, { afterEach } from 'node:test'

import { GET, POST, CHAT_UPSTREAM_TIMEOUT_MS, THREAD_ID_MAX_CHARS, THREAD_ID_MAX_UTF8_BYTES } from '../app/api/chat/[...path]/route'
import {
  CANONICAL_QUEUE_LIMITS,
  canonicalQueueSnapshot,
  resetCanonicalQueueForTests,
} from './chat-canonical-queue'
import { createSession, SESSION_COOKIE, type SessionUser } from './session'

process.env.APP_SESSION_SECRET = 'route-test-session-secret-that-is-long-enough'
process.env.HARNESS_APP_SECRET = 'route-test-harness-secret'

const admin: SessionUser = {
  id: 'admin-1', username: 'route-admin', role: 'admin', supplierId: null, mustChangePassword: false,
}

let adminCookie: Promise<string> | null = null
async function cookie(): Promise<string> {
  adminCookie ??= createSession(admin).then((token) => `${SESSION_COOKIE}=${token}`)
  return adminCookie
}

async function request(
  action: string,
  body?: string,
  options: { agentId?: unknown; authenticated?: boolean; signal?: AbortSignal; method?: 'GET' | 'POST' } = {},
): Promise<Response> {
  const method = options.method ?? 'POST'
  const headers = new Headers()
  if (options.authenticated !== false) headers.set('cookie', await cookie())
  if (body !== undefined) headers.set('content-type', 'application/json')
  const req = new Request(`https://app.test/api/chat/${String(options.agentId ?? 'rosie')}/${action}?keep=yes`, {
    method,
    headers,
    body: method === 'GET' ? undefined : body,
    signal: options.signal,
  })
  const context = { params: Promise.resolve({ path: [options.agentId ?? 'rosie', action] as string[] }) }
  return method === 'GET' ? GET(req, context) : POST(req, context)
}

const jsonBody = (threadId: unknown, extra: Record<string, unknown> = {}) =>
  JSON.stringify({ threadId, ...extra })

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (cause?: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

async function turns(count = 4): Promise<void> {
  for (let index = 0; index < count; index += 1) await Promise.resolve()
}

async function until(predicate: () => boolean, label: string): Promise<void> {
  const deadline = Date.now() + 5_000
  while (Date.now() < deadline) {
    if (predicate()) return
    // setImmediate is intentionally outside the mocked setTimeout clock used
    // by the upstream-timeout case, while still yielding under full-suite load.
    await new Promise<void>((resolve) => setImmediate(resolve))
  }
  assert.fail(`timed out waiting for ${label}`)
}

afterEach(() => {
  assert.deepEqual(canonicalQueueSnapshot(), { activeKeys: 0, totalOperations: 0, depths: [] })
  resetCanonicalQueueForTests()
})

test('actual chat route authenticates before parsing, enqueueing, or fetching and allows only chat agents', async () => {
  let fetches = 0
  globalThis.fetch = (async () => { fetches += 1; return new Response('{}') }) as typeof fetch

  const forbidden = await request('send', '{broken', { authenticated: false })
  assert.equal(forbidden.status, 403)
  assert.equal(fetches, 0)
  assert.equal(canonicalQueueSnapshot().totalOperations, 0)

  const unknown = await request('send', jsonBody('main'), { agentId: 'lily' })
  assert.equal(unknown.status, 404)
  assert.equal(fetches, 0)
  const invented = await request('send', jsonBody('main'), { agentId: 'not-an-agent' })
  assert.equal(invented.status, 404)
  const nonstring = await request('send', jsonBody('main'), { agentId: 31 })
  assert.equal(nonstring.status, 404)
  assert.equal(fetches, 0)
})

test('actual chat route rejects malformed and noncanonical thread ids without coercion or allocation', async () => {
  let fetches = 0
  globalThis.fetch = (async () => { fetches += 1; return new Response('{}') }) as typeof fetch
  const invalid: unknown[] = [
    undefined, null, 31, true, {}, [], '', ' main', 'main ', 'MAIN', 'jr-0', 'jr-01', 'jr-one',
    'supplier--oak', 'supplier-É', 'supplier-cafe\u0301', 'customer-acme/',
    'customer-acme\0bad', 'customer-acme\u0085bad',
    `supplier-${'a'.repeat(THREAD_ID_MAX_CHARS)}`,
    `supplier-${'é'.repeat(Math.floor(THREAD_ID_MAX_UTF8_BYTES / 2))}`,
  ]
  for (const threadId of invalid) {
    const response = await request('send', jsonBody(threadId))
    assert.equal(response.status, 400, `accepted ${JSON.stringify(threadId)}`)
  }
  assert.equal((await request('send', '{broken')).status, 400)
  assert.equal((await request('send', '[]')).status, 400)
  assert.equal(fetches, 0)
  assert.equal(canonicalQueueSnapshot().totalOperations, 0)

  const valid = [
    'main', 'jr-31', 'supplier-live-oak', 'customer-acme_42', 'supplier-café',
    `supplier-${'a'.repeat(THREAD_ID_MAX_CHARS - 'supplier-'.length)}`,
    `supplier-${'é'.repeat(123)}a`, // exactly 256 UTF-8 bytes
  ]
  for (const threadId of valid) {
    assert.equal((await request('send', jsonBody(threadId))).status, 200, threadId)
  }
  assert.equal(fetches, valid.length)
})

test('actual route serializes same-key send/reset FIFO while independent keys run in parallel', async () => {
  const held = deferred<Response>()
  const calls: string[] = []
  globalThis.fetch = (async (input, init) => {
    const action = new URL(String(input)).pathname.split('/').at(-1)
    const body = JSON.parse(String(init?.body)) as { threadId: string }
    calls.push(`${body.threadId}:${action}`)
    if (body.threadId === 'jr-31' && action === 'send') return held.promise
    return new Response(JSON.stringify({ action, thread: body.threadId }), { status: 200 })
  }) as typeof fetch

  const send = request('send', jsonBody('jr-31', { text: 'first' }))
  const reset = request('reset', jsonBody('jr-31'))
  const other = request('send', jsonBody('jr-32', { text: 'parallel' }))
  await until(() => calls.length === 2, 'parallel upstream starts')
  assert.deepEqual(calls, ['jr-31:send', 'jr-32:send'])
  assert.equal((await other).status, 200)
  held.resolve(new Response(JSON.stringify({ id: 1 }), { status: 201 }))
  assert.equal((await send).status, 201)
  assert.equal((await reset).status, 200)
  assert.deepEqual(calls, ['jr-31:send', 'jr-32:send', 'jr-31:reset'])
})

test('disconnecting the browser does not let its already-reserved canonical turn reorder', async () => {
  const held = deferred<Response>()
  const calls: string[] = []
  globalThis.fetch = (async (input) => {
    const action = new URL(String(input)).pathname.split('/').at(-1)!
    calls.push(action)
    return action === 'send' ? held.promise : new Response('{}')
  }) as typeof fetch
  const controller = new AbortController()
  const send = request('send', jsonBody('jr-40'), { signal: controller.signal })
  await until(() => calls.length === 1, 'disconnected send start')
  controller.abort()
  const reset = request('reset', jsonBody('jr-40'))
  await until(() => canonicalQueueSnapshot().totalOperations === 2, 'reset reservation')
  assert.deepEqual(calls, ['send'])
  held.resolve(new Response('{}'))
  assert.equal((await send).status, 200)
  assert.equal((await reset).status, 200)
  assert.deepEqual(calls, ['send', 'reset'])
})

test('actual route times out hung upstream work as 504 and releases the canonical queue', async (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] })
  try {
    const captured: { signal?: AbortSignal } = {}
    globalThis.fetch = ((_input: RequestInfo | URL, init?: RequestInit) => {
      captured.signal = init?.signal as AbortSignal | undefined
      return new Promise<Response>(() => {})
    }) as typeof fetch
    const hung = request('send', jsonBody('jr-50'))
    await until(() => canonicalQueueSnapshot().totalOperations === 1, 'hung upstream start')
    context.mock.timers.tick(CHAT_UPSTREAM_TIMEOUT_MS + 1)
    await turns(4)
    const response = await hung
    assert.equal(response.status, 504)
    assert.equal(captured.signal?.aborted, true)
    assert.deepEqual(await response.json(), { error: 'agent request timed out' })
    assert.equal(canonicalQueueSnapshot().totalOperations, 0)
  } finally {
    context.mock.timers.reset()
  }
  globalThis.fetch = (async () => new Response('retry', { status: 200 })) as typeof fetch
  assert.equal((await request('send', jsonBody('jr-50'))).status, 200)
})

test('actual route maps transport failure to 502 and forwards upstream status, headers, and body', async () => {
  globalThis.fetch = (async () => { throw new Error('offline') }) as typeof fetch
  const bad = await request('send', jsonBody('jr-60'))
  assert.equal(bad.status, 502)
  assert.deepEqual(await bad.json(), { error: 'agent unreachable' })

  globalThis.fetch = (async () => new Response('upstream body', {
    status: 206,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'content-disposition': 'attachment; filename="note.txt"',
      'x-not-forwarded': 'secret',
    },
  })) as typeof fetch
  const forwarded = await request('reset', jsonBody('jr-60'))
  assert.equal(forwarded.status, 206)
  assert.equal(forwarded.headers.get('content-type'), 'text/plain; charset=utf-8')
  assert.equal(forwarded.headers.get('content-disposition'), 'attachment; filename="note.txt"')
  assert.equal(forwarded.headers.get('x-not-forwarded'), null)
  assert.equal(await forwarded.text(), 'upstream body')
})

test('actual route enforces per-key capacity with typed 429 and deletes state after recovery', async () => {
  const gate = deferred<void>()
  globalThis.fetch = (async () => { await gate.promise; return new Response('{}') }) as typeof fetch
  const accepted = Array.from({ length: CANONICAL_QUEUE_LIMITS.perKeyOperations }, () =>
    request('send', jsonBody('jr-70')))
  await until(
    () => canonicalQueueSnapshot().totalOperations === CANONICAL_QUEUE_LIMITS.perKeyOperations,
    'per-key reservations',
  )
  const saturated = await request('reset', jsonBody('jr-70'))
  assert.equal(saturated.status, 429)
  assert.deepEqual(await saturated.json(), { error: 'conversation busy; try again' })
  assert.equal(canonicalQueueSnapshot().depths[0], CANONICAL_QUEUE_LIMITS.perKeyOperations)
  gate.resolve()
  assert.ok((await Promise.all(accepted)).every(({ status }) => status === 200))
  assert.deepEqual(canonicalQueueSnapshot(), { activeKeys: 0, totalOperations: 0, depths: [] })
  assert.equal((await request('reset', jsonBody('jr-70'))).status, 200)
})

test('actual route bounds distinct active keys and global queued operations, then recovers without retention', async () => {
  let gate = deferred<void>()
  globalThis.fetch = (async () => { await gate.promise; return new Response('{}') }) as typeof fetch
  const active = Array.from({ length: CANONICAL_QUEUE_LIMITS.activeKeys }, (_, index) =>
    request('send', jsonBody(`jr-${1000 + index}`)))
  await until(
    () => canonicalQueueSnapshot().activeKeys === CANONICAL_QUEUE_LIMITS.activeKeys,
    'active-key saturation',
  )
  assert.equal(canonicalQueueSnapshot().activeKeys, CANONICAL_QUEUE_LIMITS.activeKeys)
  assert.equal((await request('send', jsonBody('jr-9999'))).status, 429)
  gate.resolve()
  await Promise.all(active)
  assert.deepEqual(canonicalQueueSnapshot(), { activeKeys: 0, totalOperations: 0, depths: [] })

  gate = deferred<void>()
  const globallyQueued = Array.from({ length: CANONICAL_QUEUE_LIMITS.activeKeys }, (_, index) => [
    request('send', jsonBody(`jr-${2000 + index}`)),
    request('reset', jsonBody(`jr-${2000 + index}`)),
  ]).flat()
  await until(
    () => canonicalQueueSnapshot().totalOperations === CANONICAL_QUEUE_LIMITS.totalOperations,
    'global operation saturation',
  )
  assert.equal(canonicalQueueSnapshot().totalOperations, CANONICAL_QUEUE_LIMITS.totalOperations)
  assert.equal((await request('send', jsonBody('jr-2000'))).status, 429)
  gate.resolve()
  await Promise.all(globallyQueued)
  assert.deepEqual(canonicalQueueSnapshot(), { activeKeys: 0, totalOperations: 0, depths: [] })
  assert.equal((await request('send', jsonBody('jr-9999'))).status, 200)
})

test('unrelated actual route actions bypass canonical queue and preserve pass-through behavior', async () => {
  const held = deferred<Response>()
  let calls = 0
  globalThis.fetch = (async (input) => {
    calls += 1
    if (new URL(String(input)).pathname.endsWith('/messages')) return held.promise
    return new Response('read-ok', { status: 202, headers: { 'content-type': 'text/plain' } })
  }) as typeof fetch
  const first = request('messages', undefined, { method: 'GET' })
  const second = request('read', JSON.stringify({ threadId: { deliberately: 'opaque' } }))
  await until(() => calls === 2, 'unrelated parallel starts')
  assert.equal(calls, 2)
  assert.equal((await second).status, 202)
  held.resolve(new Response('messages-ok'))
  assert.equal(await (await first).text(), 'messages-ok')
  assert.equal(canonicalQueueSnapshot().totalOperations, 0)
})
