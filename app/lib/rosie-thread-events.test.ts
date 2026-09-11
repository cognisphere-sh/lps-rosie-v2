import assert from 'node:assert/strict'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { Readable } from 'node:stream'
import test from 'node:test'

import SupplierEventsPlugin from '../../harness/plugins/supplier-events/index'
import WebchatPlugin from '../../harness/plugins/webchat/index'

type DeliveredEvent = { name: string; payload: Record<string, unknown> }

async function post(
  plugin: { handleHttpRequest(req: IncomingMessage, res: ServerResponse): Promise<void> },
  path: string,
  body: unknown,
  secret = 'test-secret',
) {
  const req = Object.assign(Readable.from([JSON.stringify(body)]), {
    method: 'POST', url: path, headers: { 'x-app-secret': secret },
  }) as unknown as IncomingMessage
  let status = 0
  let response = ''
  const res = {
    writeHead(code: number) { status = code },
    end(value: string) { response = value },
  } as unknown as ServerResponse
  await plugin.handleHttpRequest(req, res)
  return { status, body: JSON.parse(response) as Record<string, unknown> }
}

async function supplierPlugin() {
  const events: DeliveredEvent[] = []
  const plugin = new SupplierEventsPlugin()
  await plugin.start({
    agentId: 'rosie',
    secrets: { SUPPLIER_EVENTS_APP_SECRET: 'test-secret' },
    notify(name, payload) { events.push({ name, payload }) },
    log: { info() {} },
  })
  return { plugin, events }
}

const availabilityEvent = {
  supplierId: 42, supplierName: 'Austin Plant Supply',
  availabilityRequestId: 12, jobRequestId: 7, threadId: 'supplier-aps',
}

test('supplier answer saves and submissions are distinct events on the supplier thread', async () => {
  const { plugin, events } = await supplierPlugin()
  for (const type of ['availability_updated', 'availability_submitted']) {
    const result = await post(plugin, '/notify', { ...availabilityEvent, type })
    assert.equal(result.status, 200)
  }
  assert.deepEqual(events.map(({ name }) => name), ['availability_updated', 'availability_submitted'])
  for (const { name, payload } of events) {
    assert.equal(payload.threadIdOverride, 'supplier-aps')
    assert.deepEqual(payload.metadata, {
      EventType: name, SupplierId: 42, SupplierName: 'Austin Plant Supply',
      AvailabilityRequestId: 12, JobRequestId: 7,
    })
  }
  assert.match(String(events[0].payload.text), /without submitting/)
  assert.match(String(events[1].payload.text), /submitted their answers/)
})

test('missing supplier conversation wakes main for a canonical handoff', async () => {
  const { plugin, events } = await supplierPlugin()
  const result = await post(plugin, '/notify', {
    ...availabilityEvent, type: 'availability_updated', threadId: null,
  })
  assert.equal(result.status, 200)
  assert.equal(events[0].payload.threadIdOverride, 'main')
})

test('invalid supplier event identifiers and unauthenticated requests never wake Rosie', async () => {
  const { plugin, events } = await supplierPlugin()
  const valid = { ...availabilityEvent, type: 'availability_submitted' }
  for (const body of [null, [], { ...valid, type: 'other' }, { ...valid, supplierId: 0 },
    { ...valid, supplierName: ' ' }, { ...valid, availabilityRequestId: '12' },
    { ...valid, jobRequestId: -1 }, { ...valid, threadId: {} }]) {
    assert.equal((await post(plugin, '/notify', body)).status, 400)
  }
  assert.equal((await post(plugin, '/notify', valid, 'wrong-secret')).status, 401)
  assert.equal(events.length, 0)
})

function webchatPlugin() {
  const events: DeliveredEvent[] = []
  const transcript: { threadId: string; message: Record<string, unknown> }[] = []
  const plugin = new WebchatPlugin()
  // Replace persistence/auth integration boundaries; exercise the real HTTP
  // handler, transcript delivery and event shaping without a database/server.
  Object.assign(plugin, {
    cfg: { threadId: 'main' },
    ctx: {
      secrets: { WEBCHAT_APP_SECRET: 'test-secret' },
      notify(name: string, payload: Record<string, unknown>) { events.push({ name, payload }) },
      log: { error() {} },
    },
    record: async (threadId: string, message: Record<string, unknown>) => {
      transcript.push({ threadId, message })
      return { id: transcript.length, ...message }
    },
    sessionUser: async () => 'Chris',
    setPending() {},
    markRead() {},
    cleanupPortalOrphans: async () => ({ count: 0, bytes: 0 }),
  })
  return { plugin, events, transcript }
}

test('internal web messages carry their actual origin through future handoffs', async () => {
  const { plugin, events, transcript } = webchatPlugin()
  const result = await post(plugin, '/api/send', {
    threadId: 'jr-7', text: 'Draft the supplier request', originThreadId: 'main',
    supplierId: 99, supplierName: 'Untrusted identity',
  })
  assert.equal(result.status, 200)
  const metadata = events[0].payload.metadata as Record<string, unknown>
  assert.equal(metadata.originThreadId, 'jr-7')
  assert.equal(metadata.originChannel, 'web')
  assert.equal(metadata.senderName, 'Chris')
  assert.equal(metadata.supplierId, undefined)
  assert.equal(transcript[0].message.portal, undefined)
})

test('portal messages stay in supplier chat with supplier identity and no internal approval origin', async () => {
  const { plugin, events, transcript } = webchatPlugin()
  const result = await post(plugin, '/api/app-send', {
    threadId: 'supplier-aps', text: 'AR-12 has 10 trees available',
    supplierId: 42, supplierName: 'Austin Plant Supply', senderName: 'APS (portal)',
    originThreadId: 'main', originChannel: 'web',
  })
  assert.equal(result.status, 200)
  assert.equal(events[0].payload.threadIdOverride, 'supplier-aps')
  assert.equal(events[0].payload.channelId, 'portal')
  const metadata = events[0].payload.metadata as Record<string, unknown>
  assert.equal(metadata.supplierId, 42)
  assert.equal(metadata.supplierName, 'Austin Plant Supply')
  assert.equal(metadata.originThreadId, undefined)
  assert.equal(metadata.originChannel, undefined)
  assert.equal(transcript[0].message.portal, true)
})

test('portal communication requires supplier identity before recording or delivering', async () => {
  const { plugin, events, transcript } = webchatPlugin()
  const result = await post(plugin, '/api/app-send', {
    threadId: 'supplier-aps', text: 'Hello', senderName: 'APS (portal)',
  })
  assert.equal(result.status, 400)
  assert.equal(transcript.length, 0)
  assert.equal(events.length, 0)
})
