import assert from 'node:assert/strict'
import test, { afterEach, beforeEach } from 'node:test'
import { JSDOM } from 'jsdom'
import { act, cleanup, renderHook } from '@testing-library/react'
import { usePartnerChat } from '../components/workspace/partner'

let dom: JSDOM
let requests: { url: string; resolve: (response: Response) => void }[]
const originalFetch = globalThis.fetch
const originalEventSource = globalThis.EventSource
class FakeEventSource {
  onmessage = null
  onopen = null
  close() {}
}
beforeEach(() => {
  dom = new JSDOM('', { url: 'http://localhost/partner/7' })
  for (const [key, value] of Object.entries({
    window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
    IS_REACT_ACT_ENVIRONMENT: true, EventSource: FakeEventSource,
  })) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  requests = []
  globalThis.fetch = (input) => new Promise((resolve) => requests.push({ url: String(input), resolve }))
})
afterEach(() => {
  cleanup()
  dom.window.close()
  globalThis.fetch = originalFetch
  globalThis.EventSource = originalEventSource
})
const message = (id: number) => ({ id, at: id * 1000, role: 'agent', text: 'Same reply', files: [] })
async function reply(index: number, messages: ReturnType<typeof message>[], hasMore = false) {
  await act(async () => requests[index].resolve(Response.json({ messages, hasMore, pending: false })))
}

test('overlapping polls arriving out of order render each server ID once and keep the cursor forward', async () => {
  const { result } = renderHook(() => usePartnerChat(7))
  act(() => { void result.current.refresh() })
  await reply(1, [message(10), message(11)])
  await reply(0, [message(10)])
  assert.deepEqual(result.current.messages.map((m) => m.id), [10, 11])
  act(() => { void result.current.refresh() })
  assert.match(requests[2].url, /since=11/)
  await reply(2, [message(12)])
  // Equal text with distinct IDs is a legitimate repeated message.
  assert.deepEqual(result.current.messages.map((m) => m.id), [10, 11, 12])
})

test('overlapping history pages render once in transcript order', async () => {
  const { result } = renderHook(() => usePartnerChat(7))
  await reply(0, [message(10)], true)
  act(() => { void result.current.loadMore(); void result.current.loadMore() })
  await reply(2, [message(8), message(9)])
  await reply(1, [message(8), message(9)])
  assert.deepEqual(result.current.messages.map((m) => m.id), [8, 9, 10])
})

for (const pollFirst of [true, false]) {
  test(`send confirmation reconciles with live read (poll first: ${pollFirst})`, async () => {
    const { result } = renderHook(() => usePartnerChat(7))
    await reply(0, [message(10)])
    act(() => { void result.current.send('Hello', []) })
    act(() => { void result.current.refresh() })
    const confirm = () => act(async () => requests[1].resolve(Response.json({ id: 12 })))
    if (pollFirst) await reply(2, [message(11), message(12)])
    await confirm()
    if (!pollFirst) {
      // Acknowledging our send must not skip the unseen reply with ID 11.
      assert.match(requests[3].url, /since=10/)
      await reply(2, [message(11), message(12)])
    }
    await reply(3, [message(11), message(12)])
    assert.deepEqual(result.current.messages.map((m) => m.id), [10, 11, 12])
    assert.equal(result.current.messages[2].text, 'Same reply')
  })
}
