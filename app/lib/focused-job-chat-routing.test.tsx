import assert from 'node:assert/strict'
import test, { afterEach, beforeEach } from 'node:test'
import React from 'react'
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { JSDOM } from 'jsdom'
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime'

import { AgentChat, chatDestinationLabel } from '../components/workspace/chat.tsx'
import { FocusedJobHeader } from '../components/workspace/focused-job-header.tsx'
import { Shell } from '../components/workspace/shell.tsx'
import { DEFAULT_CHAT_APPEARANCE } from './chat-appearance.ts'
import { openChat } from './chat-bus.ts'
import type { JobRequestRow } from './rows.ts'

let dom: JSDOM
let sends: Array<{ url: string; body: Record<string, unknown> }>
let deferredThirty: { resolve: (value: Response) => void; promise: Promise<Response> }

class FakeEventSource {
  static instances: FakeEventSource[] = []
  onmessage: ((event: MessageEvent) => void) | null = null
  onopen: (() => void) | null = null
  constructor(_url: string) { FakeEventSource.instances.push(this) }
  close() {}
}

const messages = (text?: string) => new Response(JSON.stringify({
  messages: text ? [{ id: 30, at: 1, role: 'agent', text, files: [] }] : [],
  hasMore: false,
  pending: false,
  cursor: text ? 30 : 0,
}), { status: 200, headers: { 'content-type': 'application/json' } })

beforeEach(() => {
  dom = new JSDOM('<!doctype html><html><head><title>JR-31</title></head><body></body></html>', {
    url: 'http://localhost/jobs?jr=31',
  })
  const win = dom.window
  Object.defineProperty(win, 'innerWidth', { configurable: true, value: 1200 })
  Object.defineProperty(win, 'matchMedia', { configurable: true, value: (query: string) => ({
    matches: query.includes('min-width'), media: query, onchange: null,
    addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false,
  }) })
  Object.defineProperties(win.HTMLElement.prototype, {
    scrollTo: { configurable: true, value() {} },
    getBoundingClientRect: { configurable: true, value: () => ({
      left: 20, right: 64, top: 20, bottom: 64, width: 44, height: 44,
      x: 20, y: 20, toJSON: () => ({}),
    }) },
    attachEvent: { configurable: true, value() {} },
    detachEvent: { configurable: true, value() {} },
  })
  for (const [key, value] of Object.entries({
    window: win,
    self: win,
    document: win.document,
    navigator: win.navigator,
    HTMLElement: win.HTMLElement,
    HTMLInputElement: win.HTMLInputElement,
    HTMLTextAreaElement: win.HTMLTextAreaElement,
    Node: win.Node,
    MouseEvent: win.MouseEvent,
    CustomEvent: win.CustomEvent,
    EventSource: FakeEventSource,
    getComputedStyle: win.getComputedStyle,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })

  sends = []
  FakeEventSource.instances = []
  let resolve!: (value: Response) => void
  const promise = new Promise<Response>((done) => { resolve = done })
  deferredThirty = { resolve, promise }
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url.includes('/messages?') && url.includes('thread=jr-30')) return deferredThirty.promise
    if (url.includes('/messages?')) return messages(url.includes('thread=jr-31') ? 'JR-31 history' : undefined)
    if (url.endsWith('/send')) {
      sends.push({ url, body: JSON.parse(String(init?.body)) as Record<string, unknown> })
      return new Response(JSON.stringify({ id: 101 }), { status: 200 })
    }
    return new Response(JSON.stringify({}), { status: 200 })
  }) as typeof fetch
})

afterEach(() => {
  cleanup()
  dom.window.close()
})

function request(id: number, name: string): JobRequestRow {
  return {
    id, name, status: 'sourcing', customer: null,
    billing: { address: null, city: null, state: null, zip: null },
    shipping: { address: null, city: null, state: null, zip: null },
    customerNotes: null, notes: [], externalNotes: null, sourcingNotes: null,
    itemCount: 0, statusCounts: {}, lineTotal: 0, supplierLinks: [], items: [],
    createdAt: '2026-08-31T00:00:00Z', updatedAt: '2026-08-31T00:00:00Z',
  }
}

const chat = <AgentChat isMobile={false} mobileOpen={false} appearance={DEFAULT_CHAT_APPEARANCE} />

function renderedHandler<T>(element: Element, name: string): T {
  const key = Object.keys(element).find((candidate) => candidate.startsWith('__reactProps$'))
  assert.ok(key, `rendered React props missing for ${name}`)
  const handler = (element as unknown as Record<string, Record<string, unknown>>)[key][name]
  assert.equal(typeof handler, 'function', `rendered ${name} handler missing`)
  return handler as T
}

test('focused Job avatar action rebinds retained JR-30 before send and visibly names canonical JR-31', async () => {
  const view = render(<><FocusedJobHeader request={request(31, 'Courtyard')} mobile projectDate={null} status={<span>Sourcing</span>} preview={null} />{chat}</>)
  act(() => openChat({ agentId: 'rosie', threadId: 'jr-30', label: 'Old patio' }))
  await waitFor(() => assert.ok(view.getByText('JR-30 · Old patio')))

  // Prove the real anchored Job option enters AgentChat, then return to the
  // retained route to exercise both stale composer event paths in one batch.
  fireEvent.click(view.getByRole('button', { name: 'Choose a Rosie chat for JR-31' }))
  fireEvent.click(view.getByRole('menuitem', { name: 'Job chat · JR-31' }))
  await waitFor(() => assert.ok(view.getByText('JR-31 · Courtyard')))
  act(() => openChat({ agentId: 'rosie', threadId: 'jr-30', label: 'Old patio' }))
  await waitFor(() => assert.ok(view.getByText('JR-30 · Old patio')))

  const user = userEvent.setup({ document })
  const target = { agentId: 'rosie', threadId: 'jr-31', label: 'Courtyard' }

  // Invoke both handlers captured by the mounted JR-30 controls in the same
  // React batch as the bind. This avoids JSDOM's detached-input polyfill while
  // still exercising the callbacks on the real rendered textarea and button.
  const oldComposer = view.getByPlaceholderText('Ask Rosie…')
  fireEvent.change(oldComposer, { target: { value: 'wrong retained draft' } })
  const oldSend = view.getByRole('button', { name: 'Send' })
  const oldFieldset = oldComposer.closest('fieldset')!
  const staleEnter = renderedHandler<(event: { key: string; shiftKey: boolean; preventDefault(): void }) => void>(oldComposer, 'onKeyDown')
  const staleClick = renderedHandler<() => void>(oldSend, 'onClick')
  act(() => {
    openChat(target)
    staleClick()
    staleEnter({ key: 'Enter', shiftKey: false, preventDefault() {} })
    assert.equal(sends.length, 0)
    assert.equal(oldFieldset.getAttribute('aria-disabled'), 'true')
  })
  await waitFor(() => assert.ok(view.getByText('JR-31 · Courtyard')))

  const composer = view.getByPlaceholderText('Ask Rosie…')
  assert.equal(composer.closest('fieldset')?.getAttribute('aria-disabled'), 'false')
  assert.equal((composer as HTMLTextAreaElement).value, '')
  await user.type(composer, 'Update pricing!!!')
  await user.click(view.getByRole('button', { name: 'Send' }))

  await waitFor(() => assert.equal(sends.length, 1))
  assert.equal(sends[0].url, '/api/chat/rosie/send')
  assert.equal(sends[0].body.threadId, 'jr-31')
  assert.deepEqual(sends[0].body.page, { path: '/jobs?jr=31', title: 'JR-31' })
})

test('rapid exact switches ignore a stale JR-30 transcript and preserve alternate destinations', async () => {
  const view = render(chat)
  act(() => openChat({ agentId: 'rosie', threadId: 'jr-30', label: 'Old patio' }))
  await waitFor(() => assert.ok(view.getByText('JR-30 · Old patio')))
  act(() => openChat({ agentId: 'rosie', threadId: 'jr-31', label: 'Courtyard' }))
  await waitFor(() => assert.ok(view.getByText('JR-31 · Courtyard')))
  await act(async () => deferredThirty.resolve(messages('STALE JR-30 HISTORY')))
  assert.equal(view.queryByText('STALE JR-30 HISTORY'), null)
  assert.ok(view.getByText('JR-31 history'))

  act(() => openChat({ agentId: 'rosie', threadId: 'supplier-oak', label: 'Oak Nursery' }))
  await waitFor(() => assert.ok(view.getByText('Oak Nursery')))
  act(() => openChat({ agentId: 'rosie', threadId: 'customer-fern', label: 'Fern Customer' }))
  await waitFor(() => assert.ok(view.getByText('Fern Customer')))
  act(() => openChat({ agentId: 'daisy', threadId: 'supplier-oak', label: 'Oak Nursery' }))
  await waitFor(() => assert.ok(view.getByText('Daisy')))
  assert.ok(view.getByText('Oak Nursery'))
  act(() => openChat({ agentId: 'rosie', threadId: 'main', label: 'Main' }))
  await waitFor(() => assert.ok(view.getByText('Main')))
})

test('stored exact destination hydrates through the same revision-bound lifecycle', async () => {
  window.localStorage.setItem('lps.chat.v1', JSON.stringify({
    open: true, width: 330, agent: 'rosie',
    thread: { agent: 'rosie', id: 'jr-31', label: 'Stored courtyard' },
  }))
  const view = render(chat)
  await waitFor(() => assert.ok(view.getByText('JR-31 · Stored courtyard')))
  const user = userEvent.setup({ document })
  await user.type(view.getByPlaceholderText('Ask Rosie…'), 'hydrated exact')
  await user.click(view.getByRole('button', { name: 'Send' }))
  await waitFor(() => assert.equal(sends.length, 1))
  assert.equal(sends[0].body.threadId, 'jr-31')
})

test('desktop focused action also commits JR-31 before its composer can post', async () => {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url.includes('/messages?')) return messages()
    if (url.endsWith('/send')) {
      sends.push({ url, body: JSON.parse(String(init?.body)) as Record<string, unknown> })
      return new Response(JSON.stringify({ id: 202 }), { status: 200 })
    }
    return new Response(JSON.stringify({}), { status: 200 })
  }) as typeof fetch
  const view = render(<><FocusedJobHeader request={request(31, 'Courtyard')} mobile={false} projectDate={null} status={<span>Sourcing</span>} preview={null} />{chat}</>)
  act(() => openChat({ agentId: 'rosie', threadId: 'jr-30', label: 'Old patio' }))
  await waitFor(() => assert.ok(view.getByText('JR-30 · Old patio')))
  fireEvent.click(view.getByRole('button', { name: 'Chat with Rosie' }))
  await waitFor(() => assert.ok(view.getByText('JR-31 · Courtyard')))
  const user = userEvent.setup({ document })
  await user.type(view.getByPlaceholderText('Ask Rosie…'), 'desktop exact')
  await user.click(view.getByRole('button', { name: 'Send' }))
  await waitFor(() => assert.equal(sends.length, 1))
  assert.equal(sends[0].body.threadId, 'jr-31')
})

test('new destination can never paint over the retained transcript lifecycle', async () => {
  let resolveThirtyOne!: (response: Response) => void
  const thirtyOne = new Promise<Response>((resolve) => { resolveThirtyOne = resolve })
  globalThis.fetch = ((input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('/messages?') && url.includes('thread=jr-30')) return Promise.resolve(messages('OLD JR-30 TRANSCRIPT'))
    if (url.includes('/messages?') && url.includes('thread=jr-31')) return thirtyOne
    if (url.includes('/messages?')) return Promise.resolve(messages())
    return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }))
  }) as typeof fetch
  const view = render(chat)
  act(() => openChat({ agentId: 'rosie', threadId: 'jr-30', label: 'Thirty' }))
  await waitFor(() => assert.ok(view.getByText('OLD JR-30 TRANSCRIPT')))
  const oldFieldset = view.getByPlaceholderText('Ask Rosie…').closest('fieldset')!
  act(() => {
    openChat({ agentId: 'rosie', threadId: 'jr-31', label: 'Thirty one' })
    assert.equal(oldFieldset.getAttribute('aria-disabled'), 'true')
  })
  assert.ok(view.getByText('JR-31 · Thirty one'))
  assert.equal(view.queryByText('OLD JR-30 TRANSCRIPT'), null)
  const currentFieldset = view.getByPlaceholderText('Ask Rosie…').closest('fieldset')!
  assert.equal(currentFieldset.getAttribute('aria-disabled'), 'false')
  await act(async () => resolveThirtyOne(messages('NEW JR-31 TRANSCRIPT')))
  assert.ok(view.getByText('NEW JR-31 TRANSCRIPT'))
})

test('mobile Shell agent handoff and actual AgentChat branch preserve only exact final intent', async () => {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url.includes('/messages?')) return messages()
    if (url.endsWith('/send')) {
      sends.push({ url, body: JSON.parse(String(init?.body)) as Record<string, unknown> })
      return new Response(JSON.stringify({ id: 250 }), { status: 200 })
    }
    return new Response(JSON.stringify({}), { status: 200 })
  }) as typeof fetch

  const view = render(<AgentChat isMobile mobileOpen mobileAgentId="rosie" appearance={DEFAULT_CHAT_APPEARANCE} />)
  await waitFor(() => assert.ok(view.getByText('Rosie')))
  assert.ok(view.getByText(/Main/))

  // A chat-bus action and Shell's subsequent prop update are one explicit
  // handoff: Daisy's supplier thread survives, rather than a stale flag
  // resetting it to Main.
  act(() => openChat({ agentId: 'daisy', threadId: 'supplier-oak', label: 'Oak Nursery' }))
  view.rerender(<AgentChat isMobile mobileOpen mobileAgentId="daisy" appearance={DEFAULT_CHAT_APPEARANCE} />)
  await waitFor(() => assert.ok(view.getByText('Daisy')))
  assert.ok(view.getByText(/Oak Nursery/))

  // A real Agents-list prop change without a bus handoff intentionally means
  // the selected agent's Main conversation.
  view.rerender(<AgentChat isMobile mobileOpen mobileAgentId="rosie" appearance={DEFAULT_CHAT_APPEARANCE} />)
  await waitFor(() => assert.ok(view.getByText('Rosie')))
  assert.ok(view.getByText(/Main/))

  // Same-batch Rosie → Daisy → Rosie must consume only the final intent.
  act(() => {
    openChat({ agentId: 'rosie', threadId: 'jr-30', label: 'Thirty' })
    openChat({ agentId: 'daisy', threadId: 'supplier-oak', label: 'Oak' })
    openChat({ agentId: 'rosie', threadId: 'jr-31', label: 'Thirty one' })
  })
  await waitFor(() => assert.ok(view.getByText(/JR-31 · Thirty one/)))
  const user = userEvent.setup({ document })
  await user.type(view.getByPlaceholderText('Ask Rosie…'), 'mobile exact')
  await user.click(view.getByRole('button', { name: 'Send' }))
  await waitFor(() => assert.equal(sends.length, 1))
  assert.equal(sends[0].url, '/api/chat/rosie/send')
  assert.equal(sends[0].body.threadId, 'jr-31')
})

test('actual mobile Shell Agents list drives AgentChat to the selected Main destination', async () => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 })
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: (query: string) => ({
    matches: query.includes('max-width') || !query.includes('min-width'), media: query, onchange: null,
    addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false,
  }) })
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url.includes('/messages?')) return messages()
    if (url.endsWith('/threads')) return new Response(JSON.stringify({ threads: [] }), { status: 200 })
    if (url.endsWith('/send')) {
      sends.push({ url, body: JSON.parse(String(init?.body)) as Record<string, unknown> })
      return new Response(JSON.stringify({ id: 275 }), { status: 200 })
    }
    return new Response(JSON.stringify({}), { status: 200 })
  }) as typeof fetch

  const router = {
    back() {}, forward() {}, refresh() {}, hmrRefresh() {},
    push() {}, replace() {}, prefetch: async () => undefined,
  }
  const view = render(
    <AppRouterContext.Provider value={router as never}>
      <Shell page="requests" title="Jobs"><div>Jobs page</div></Shell>
    </AppRouterContext.Provider>,
  )
  const agents = await view.findByRole('button', { name: 'Agents' })
  fireEvent.click(agents)
  const daisy = await view.findByRole('button', { name: /Daisy/ })
  fireEvent.click(daisy)
  await waitFor(() => assert.ok(view.getByText('Daisy')))
  assert.ok(view.getByText(/Main/))
  const user = userEvent.setup({ document })
  await user.type(view.getByPlaceholderText('Ask Daisy…'), 'shell mobile exact')
  await user.click(view.getByRole('button', { name: 'Send' }))
  await waitFor(() => assert.equal(sends.length, 1))
  assert.equal(sends[0].url, '/api/chat/daisy/send')
  assert.equal(sends[0].body.threadId, 'main')

  // Exercise both real Shell and AgentChat chat-bus listeners in one batch;
  // only the final Rosie intent/revision may survive the prop handoff.
  act(() => {
    openChat({ agentId: 'daisy', threadId: 'supplier-oak', label: 'Oak' })
    openChat({ agentId: 'rosie', threadId: 'jr-30', label: 'Thirty' })
    openChat({ agentId: 'daisy', threadId: 'supplier-pine', label: 'Pine' })
    openChat({ agentId: 'rosie', threadId: 'jr-31', label: 'Thirty one' })
  })
  await waitFor(() => assert.ok(view.getByText(/JR-31 · Thirty one/)))
  await user.type(view.getByPlaceholderText('Ask Rosie…'), 'shell handoff exact')
  await user.click(view.getByRole('button', { name: 'Send' }))
  await waitFor(() => assert.equal(sends.length, 2))
  assert.equal(sends[1].url, '/api/chat/rosie/send')
  assert.equal(sends[1].body.threadId, 'jr-31')
})

test('same-route and ABA revisions reject stale and reverse-order poll completions', async () => {
  type Pending = { url: string; resolve: (response: Response) => void }
  const pending: Pending[] = []
  globalThis.fetch = ((input: RequestInfo | URL) => {
    const url = String(input)
    if (!url.includes('/messages?')) return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }))
    return new Promise<Response>((resolve) => pending.push({ url, resolve }))
  }) as typeof fetch
  const response = (id: number, text: string) => new Response(JSON.stringify({
    messages: [{ id, at: id, role: 'agent', text, files: [] }], hasMore: false, pending: false, cursor: id,
  }), { status: 200 })

  const view = render(chat)
  act(() => openChat({ agentId: 'rosie', threadId: 'jr-30', label: 'Thirty' }))
  await waitFor(() => assert.equal(pending.filter((item) => item.url.includes('thread=jr-30')).length, 1))
  const first = pending.filter((item) => item.url.includes('thread=jr-30'))[0]
  act(() => openChat({ agentId: 'rosie', threadId: 'jr-30', label: 'Thirty rebound' }))
  await waitFor(() => assert.equal(pending.filter((item) => item.url.includes('thread=jr-30')).length, 2))
  const rebound = pending.filter((item) => item.url.includes('thread=jr-30'))[1]
  await act(async () => first.resolve(response(10, 'STALE SAME ROUTE')))
  await act(async () => rebound.resolve(response(20, 'current rebound')))
  assert.equal(view.queryByText('STALE SAME ROUTE'), null)
  assert.ok(view.getByText('current rebound'))

  // Two same-revision refreshes complete newest first; the older result cannot
  // append, rewind the cursor, or overwrite the accepted transcript.
  act(() => {
    const source = FakeEventSource.instances.at(-1)
    source?.onopen?.()
    source?.onopen?.()
  })
  await waitFor(() => assert.equal(pending.filter((item) => item.url.includes('thread=jr-30')).length, 4))
  const refreshes = pending.filter((item) => item.url.includes('thread=jr-30')).slice(-2)
  await act(async () => refreshes[1].resolve(response(40, 'newest poll')))
  await act(async () => refreshes[0].resolve(response(30, 'older poll')))
  assert.ok(view.getByText('newest poll'))
  assert.equal(view.queryByText('older poll'), null)

  act(() => openChat({ agentId: 'rosie', threadId: 'jr-31', label: 'Thirty one' }))
  act(() => openChat({ agentId: 'rosie', threadId: 'jr-30', label: 'Thirty ABA' }))
  await waitFor(() => assert.ok(view.getByText('JR-30 · Thirty ABA')))
  const aba = pending.filter((item) => item.url.includes('thread=jr-30')).at(-1)!
  await act(async () => aba.resolve(response(50, 'ABA current')))
  assert.ok(view.getByText('ABA current'))
  assert.equal(view.queryByText('current rebound'), null)
  view.unmount()
  for (const request of pending) request.resolve(response(99, 'after unmount'))
})

test('stale load-more and reset completions cannot mutate a newly bound transcript', async () => {
  let resolveLoad!: (response: Response) => void
  const load = new Promise<Response>((resolve) => { resolveLoad = resolve })
  let resolveReset!: (response: Response) => void
  const reset = new Promise<Response>((resolve) => { resolveReset = resolve })
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url.includes('/messages?before=')) return load
    if (url.endsWith('/reset')) return reset
    if (url.includes('/messages?')) {
      const thread = new URL(url, 'https://local.test').searchParams.get('thread')
      const id = thread === 'jr-30' ? 100 : 200
      return Promise.resolve(new Response(JSON.stringify({
        messages: [{ id, at: id, role: 'agent', text: `${thread} current`, files: [] }],
        hasMore: thread === 'jr-30', pending: false, cursor: id,
      }), { status: 200 }))
    }
    return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }))
  }) as typeof fetch

  const view = render(chat)
  act(() => openChat({ agentId: 'rosie', threadId: 'jr-30', label: 'Thirty' }))
  await waitFor(() => assert.ok(view.getByText('jr-30 current')))
  fireEvent.click(view.getByRole('button', { name: 'Load earlier messages' }))
  await waitFor(() => assert.ok(view.getByRole('button', { name: 'Loading…' })))
  act(() => openChat({ agentId: 'rosie', threadId: 'jr-31', label: 'Thirty one' }))
  await waitFor(() => assert.ok(view.getByText('jr-31 current')))
  await act(async () => resolveLoad(new Response(JSON.stringify({
    messages: [{ id: 50, at: 50, role: 'agent', text: 'STALE EARLIER', files: [] }], hasMore: false,
  }), { status: 200 })))
  assert.equal(view.queryByText('STALE EARLIER'), null)
  assert.ok(view.getByText('jr-31 current'))

  fireEvent.click(view.getByRole('button', { name: 'Conversation options' }))
  fireEvent.click(view.getByRole('button', { name: 'Clear conversation' }))
  act(() => openChat({ agentId: 'rosie', threadId: 'jr-30', label: 'Thirty rebound' }))
  await waitFor(() => assert.ok(view.getByText('jr-30 current')))
  await act(async () => resolveReset(new Response(JSON.stringify({ ok: true }), { status: 200 })))
  assert.ok(view.getByText('jr-30 current'))
})

test('the first post-reset poll may report and then recover from a network error', async () => {
  let jrPoll = 0
  globalThis.fetch = ((input: RequestInfo | URL) => {
    const url = String(input)
    if (url.endsWith('/reset')) return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }))
    if (url.includes('/messages?') && url.includes('thread=jr-31')) {
      jrPoll += 1
      if (jrPoll === 2) return Promise.reject(new Error('offline after reset'))
      return Promise.resolve(new Response(JSON.stringify({
        messages: jrPoll === 1 ? [{ id: 1, at: 1, role: 'agent', text: 'before reset', files: [] }] : [{ id: 2, at: 2, role: 'agent', text: 'recovered', files: [] }],
        hasMore: false, pending: false, cursor: jrPoll,
      }), { status: 200 }))
    }
    if (url.includes('/messages?')) return Promise.resolve(messages())
    return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }))
  }) as typeof fetch

  const view = render(chat)
  act(() => openChat({ agentId: 'rosie', threadId: 'jr-31', label: 'Thirty one' }))
  await waitFor(() => assert.ok(view.getByText('before reset')))
  fireEvent.click(view.getByRole('button', { name: 'Conversation options' }))
  fireEvent.click(view.getByRole('button', { name: 'Clear conversation' }))
  await waitFor(() => assert.ok(view.getByText('Can’t reach the agent.')))
  act(() => FakeEventSource.instances.at(-1)?.onopen?.())
  await waitFor(() => assert.ok(view.getByText('recovered')))
  assert.equal(view.queryByText('Can’t reach the agent.'), null)
})

test('uploads are owned by exact agent/thread/revision, stale completions and staged files clear on bind', async () => {
  let resolveFirstUpload!: (response: Response) => void
  const firstUpload = new Promise<Response>((resolve) => { resolveFirstUpload = resolve })
  let resolveThirdUpload!: (response: Response) => void
  const thirdUpload = new Promise<Response>((resolve) => { resolveThirdUpload = resolve })
  const uploads: string[] = []
  const uploadSignals: AbortSignal[] = []
  let uploadCount = 0
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url.includes('/messages?')) return messages()
    if (url.endsWith('/upload')) {
      uploads.push(url)
      uploadSignals.push(init?.signal as AbortSignal)
      uploadCount += 1
      if (uploadCount === 1) return firstUpload
      if (uploadCount === 3) return thirdUpload
      return new Response(JSON.stringify({ name: `stored-${uploadCount}`, label: `file-${uploadCount}.txt`, mime: 'text/plain', size: 1 }), { status: 200 })
    }
    if (url.endsWith('/send')) {
      sends.push({ url, body: JSON.parse(String(init?.body)) as Record<string, unknown> })
      return new Response(JSON.stringify({ id: 303 }), { status: 200 })
    }
    return new Response(JSON.stringify({}), { status: 200 })
  }) as typeof fetch

  const view = render(chat)
  act(() => openChat({ agentId: 'daisy', threadId: 'main', label: 'Main' }))
  await waitFor(() => assert.ok(view.getByText('Daisy')))
  const input = view.container.querySelector<HTMLInputElement>('input[type="file"]')!
  fireEvent.change(input, { target: { files: [new dom.window.File(['a'], 'old.txt', { type: 'text/plain' })] } })
  await waitFor(() => assert.equal(uploads.length, 1))
  assert.equal(uploads[0], '/api/chat/daisy/upload')
  act(() => openChat({ agentId: 'rosie', threadId: 'jr-30', label: 'Thirty' }))
  assert.equal(uploadSignals[0].aborted, true)
  await act(async () => resolveFirstUpload(new Response(JSON.stringify({ name: 'stale', label: 'old.txt', mime: 'text/plain', size: 1 }), { status: 200 })))
  assert.equal(view.queryByText('old.txt'), null)

  const currentInput = view.container.querySelector<HTMLInputElement>('input[type="file"]')!
  fireEvent.change(currentInput, { target: { files: [new dom.window.File(['b'], 'file-2.txt', { type: 'text/plain' })] } })
  await waitFor(() => assert.ok(view.getByText('file-2.txt')))
  assert.equal(uploads.at(-1), '/api/chat/rosie/upload')
  act(() => openChat({ agentId: 'rosie', threadId: 'jr-31', label: 'Thirty one' }))
  await waitFor(() => assert.equal(view.queryByText('file-2.txt'), null))

  // An upload from the same textual destination is still stale after an
  // away/back ABA switch because each bind owns a distinct revision.
  fireEvent.change(view.container.querySelector<HTMLInputElement>('input[type="file"]')!, { target: { files: [new dom.window.File(['c'], 'file-3.txt', { type: 'text/plain' })] } })
  await waitFor(() => assert.equal(uploads.length, 3))
  act(() => openChat({ agentId: 'rosie', threadId: 'jr-30', label: 'Thirty' }))
  act(() => openChat({ agentId: 'rosie', threadId: 'jr-31', label: 'Thirty one ABA' }))
  assert.equal(uploadSignals[2].aborted, true)
  await act(async () => resolveThirdUpload(new Response(JSON.stringify({ name: 'stored-3', label: 'file-3.txt', mime: 'text/plain', size: 1 }), { status: 200 })))
  assert.equal(view.queryByText('file-3.txt'), null)

  fireEvent.change(view.container.querySelector<HTMLInputElement>('input[type="file"]')!, { target: { files: [new dom.window.File(['d'], 'file-4.txt', { type: 'text/plain' })] } })
  await waitFor(() => assert.ok(view.getByText('file-4.txt')))
  await userEvent.setup({ document }).click(view.getByRole('button', { name: 'Send' }))
  await waitFor(() => assert.equal(sends.length, 1))
  assert.equal(sends[0].body.threadId, 'jr-31')
  assert.deepEqual(sends[0].body.attachments, [{ name: 'stored-4', label: 'file-4.txt', mime: 'text/plain', size: 1 }])
})

test('concurrent uploads keep busy until all settle and isolate failures', async () => {
  const uploadResolvers: Array<(response: Response) => void> = []
  globalThis.fetch = ((input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('/messages?')) return Promise.resolve(messages())
    if (url.endsWith('/upload')) return new Promise<Response>((resolve) => uploadResolvers.push(resolve))
    return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }))
  }) as typeof fetch
  const view = render(chat)
  act(() => openChat({ agentId: 'rosie', threadId: 'jr-31', label: 'Thirty one' }))
  await waitFor(() => assert.ok(view.getByText('JR-31 · Thirty one')))
  const input = view.container.querySelector<HTMLInputElement>('input[type="file"]')!
  fireEvent.change(input, { target: { files: [new dom.window.File(['a'], 'a.txt', { type: 'text/plain' })] } })
  fireEvent.change(input, { target: { files: [new dom.window.File(['b'], 'b.txt', { type: 'text/plain' })] } })
  await waitFor(() => assert.equal(uploadResolvers.length, 2))
  assert.ok(view.getByPlaceholderText('Uploading…'))
  await act(async () => uploadResolvers[0](new Response(JSON.stringify({ name: 'stored-a', label: 'a.txt', mime: 'text/plain', size: 1 }), { status: 200 })))
  await waitFor(() => assert.ok(view.getByText('a.txt')))
  assert.ok(view.getByPlaceholderText('Uploading…'))
  await act(async () => uploadResolvers[1](new Response(JSON.stringify({ error: 'failed' }), { status: 500 })))
  await waitFor(() => assert.ok(view.getByText('Couldn’t upload b.txt.')))
  assert.ok(view.getByPlaceholderText('Ask Rosie…'))
  assert.equal(view.queryByText('b.txt'), null)
})

test('old delayed recording callbacks cannot affect an immediate new recording', async () => {
  const uploaded: string[] = []
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('/messages?')) return messages()
    if (url.endsWith('/upload')) {
      uploaded.push(url)
      return new Response(JSON.stringify({ name: `voice-${uploaded.length}`, label: 'voice-note.webm', mime: 'audio/webm', size: 5 }), { status: 200 })
    }
    return new Response(JSON.stringify({}), { status: 200 })
  }) as typeof fetch

  let stoppedTracks = 0
  const streams = Array.from({ length: 2 }, () => ({
    getTracks: () => [{ stop() { stoppedTracks += 1 } }],
  }))
  let streamIndex = 0
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: async () => streams[streamIndex++] } })
  class FakeAudioContext {
    state = 'running'
    createAnalyser() { return { fftSize: 0, frequencyBinCount: 1, getByteTimeDomainData(array: Uint8Array) { array[0] = 128 } } }
    createMediaStreamSource() { return { connect() {}, disconnect() {} } }
    async resume() {}
  }
  class DelayedRecorder {
    static instances: DelayedRecorder[] = []
    static isTypeSupported() { return true }
    state: 'inactive' | 'recording' = 'inactive'
    mimeType = 'audio/webm'
    ondataavailable: ((event: { data: Blob }) => void) | null = null
    onstop: (() => void | Promise<void>) | null = null
    pendingStop: (() => void | Promise<void>) | null = null
    constructor(_stream: unknown, _options?: unknown) { DelayedRecorder.instances.push(this) }
    start() { this.state = 'recording' }
    stop() { this.state = 'inactive'; this.pendingStop = this.onstop }
    data() { this.ondataavailable?.({ data: new dom.window.Blob(['voice'], { type: 'audio/webm' }) }) }
  }
  Object.defineProperty(window, 'AudioContext', { configurable: true, value: FakeAudioContext })
  Object.defineProperty(globalThis, 'MediaRecorder', { configurable: true, writable: true, value: DelayedRecorder })

  const view = render(chat)
  act(() => openChat({ agentId: 'rosie', threadId: 'jr-30', label: 'Thirty' }))
  fireEvent.click(view.getByRole('button', { name: 'Record a voice note' }))
  await waitFor(() => assert.equal(DelayedRecorder.instances.length, 1))
  const old = DelayedRecorder.instances[0]
  old.data()
  const queuedOldStop = old.onstop!

  act(() => openChat({ agentId: 'rosie', threadId: 'jr-31', label: 'Thirty one' }))
  assert.ok(stoppedTracks >= 1)
  fireEvent.click(view.getByRole('button', { name: 'Record a voice note' }))
  await waitFor(() => assert.equal(DelayedRecorder.instances.length, 2))
  assert.ok(view.getByRole('button', { name: 'Stop recording and attach' }))
  await act(async () => { await queuedOldStop() })
  assert.equal(uploaded.length, 0)
  assert.ok(view.getByRole('button', { name: 'Stop recording and attach' }))

  const current = DelayedRecorder.instances[1]
  current.data()
  fireEvent.click(view.getByRole('button', { name: 'Stop recording and attach' }))
  await act(async () => { await current.pendingStop?.() })
  await waitFor(() => assert.ok(view.getByText('voice-note.webm')))
  assert.deepEqual(uploaded, ['/api/chat/rosie/upload'])
})

test('recording setup failures clean resources and permit immediate retry', async () => {
  globalThis.fetch = (async (input: RequestInfo | URL) =>
    String(input).includes('/messages?') ? messages() : new Response('{}', { status: 200 })) as typeof fetch
  let stage: 'context' | 'analyser' | 'recorder' | 'start' | 'none' = 'none'
  let stopped = 0
  let closed = 0
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: {
    getUserMedia: async () => ({ getTracks: () => [{ stop() { stopped += 1 } }] }),
  } })
  class SetupAudioContext {
    state = 'running'
    constructor() { if (stage === 'context') throw new Error('context') }
    createAnalyser() {
      if (stage === 'analyser') throw new Error('analyser')
      return { fftSize: 0, frequencyBinCount: 1, getByteTimeDomainData(array: Uint8Array) { array[0] = 128 } }
    }
    createMediaStreamSource() { return { connect() {}, disconnect() {} } }
    async resume() {}
    async close() { closed += 1 }
  }
  class SetupRecorder {
    static isTypeSupported() { return true }
    state: 'inactive' | 'recording' = 'inactive'
    mimeType = 'audio/webm'
    ondataavailable: ((event: { data: Blob }) => void) | null = null
    onstop: (() => void | Promise<void>) | null = null
    constructor(_stream: unknown, _options?: unknown) { if (stage === 'recorder') throw new Error('recorder') }
    start() { if (stage === 'start') throw new Error('start'); this.state = 'recording' }
    stop() { this.state = 'inactive'; void this.onstop?.() }
  }
  Object.defineProperty(window, 'AudioContext', { configurable: true, value: SetupAudioContext })
  Object.defineProperty(globalThis, 'MediaRecorder', { configurable: true, writable: true, value: SetupRecorder })

  for (const failure of ['context', 'analyser', 'recorder', 'start'] as const) {
    stage = failure
    const beforeStopped = stopped
    const view = render(chat)
    act(() => openChat({ agentId: 'rosie', threadId: 'jr-31', label: 'Thirty one' }))
    fireEvent.click(view.getByRole('button', { name: 'Record a voice note' }))
    await waitFor(() => assert.ok(view.getByText('Could not start recording.')))
    assert.ok(stopped > beforeStopped)
    assert.ok(view.getByRole('button', { name: 'Record a voice note' }))

    stage = 'none'
    fireEvent.click(view.getByRole('button', { name: 'Record a voice note' }))
    await waitFor(() => assert.ok(view.getByRole('button', { name: 'Stop recording and attach' })))
    const stoppedBeforeUnmount = stopped
    view.unmount()
    assert.ok(stopped > stoppedBeforeUnmount)
  }
  assert.ok(closed >= 6) // analyser/start failures plus every successful retry/unmount
})

test('recording teardown owns delayed and never-settling AudioContext resume before its await', async () => {
  globalThis.fetch = (async (input: RequestInfo | URL) =>
    String(input).includes('/messages?') ? messages() : new Response('{}')) as typeof fetch
  const resumes: Array<{ promise: Promise<void>; resolve: () => void }> = []
  let stopped = 0
  let closed = 0
  let graphs = 0
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: {
    getUserMedia: async () => ({ getTracks: () => [{ stop() { stopped += 1 } }] }),
  } })
  class DelayedAudioContext {
    state = 'suspended'
    private pending: { promise: Promise<void>; resolve: () => void }
    constructor() {
      let resolve!: () => void
      const promise = new Promise<void>((done) => { resolve = done })
      this.pending = { promise, resolve }
      resumes.push(this.pending)
    }
    resume() { return this.pending.promise }
    close() { closed += 1; return Promise.resolve() }
    createAnalyser() { graphs += 1; return { fftSize: 0, frequencyBinCount: 1, getByteTimeDomainData() {} } }
    createMediaStreamSource() { return { connect() {}, disconnect() {} } }
  }
  class ResumeRecorder {
    static isTypeSupported() { return true }
    state: 'inactive' | 'recording' = 'inactive'
    mimeType = 'audio/webm'
    ondataavailable = null
    onstop = null
    constructor(_stream: unknown) {}
    start() { this.state = 'recording' }
    stop() { this.state = 'inactive' }
  }
  Object.defineProperty(window, 'AudioContext', { configurable: true, value: DelayedAudioContext })
  Object.defineProperty(globalThis, 'MediaRecorder', { configurable: true, writable: true, value: ResumeRecorder })

  const view = render(chat)
  act(() => openChat({ agentId: 'rosie', threadId: 'jr-30', label: 'Thirty' }))
  fireEvent.click(view.getByRole('button', { name: 'Record a voice note' }))
  await waitFor(() => assert.equal(resumes.length, 1))
  act(() => openChat({ agentId: 'rosie', threadId: 'jr-31', label: 'Thirty one' }))
  assert.equal(stopped, 1)
  assert.equal(closed, 1)
  await act(async () => { resumes[0].resolve(); await resumes[0].promise })
  assert.equal(stopped, 1)
  assert.equal(closed, 1)
  assert.equal(graphs, 0)

  fireEvent.click(view.getByRole('button', { name: 'Record a voice note' }))
  await waitFor(() => assert.equal(resumes.length, 2))
  view.unmount() // the second resume deliberately never settles
  assert.equal(stopped, 2)
  assert.equal(closed, 2)
  assert.equal(graphs, 0)
})

test('delayed getUserMedia after unmount stops its stream without creating a graph', async () => {
  globalThis.fetch = (async (input: RequestInfo | URL) =>
    String(input).includes('/messages?') ? messages() : new Response('{}')) as typeof fetch
  let resolveStream!: (stream: unknown) => void
  const permission = new Promise<unknown>((resolve) => { resolveStream = resolve })
  let stopped = 0
  let contexts = 0
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: () => permission } })
  class ShouldNotConstructAudioContext { constructor() { contexts += 1 } }
  class PermissionRecorder { static isTypeSupported() { return true } }
  Object.defineProperty(window, 'AudioContext', { configurable: true, value: ShouldNotConstructAudioContext })
  Object.defineProperty(globalThis, 'MediaRecorder', { configurable: true, writable: true, value: PermissionRecorder })
  const view = render(chat)
  act(() => openChat({ agentId: 'rosie', threadId: 'jr-31', label: 'Thirty one' }))
  fireEvent.click(view.getByRole('button', { name: 'Record a voice note' }))
  view.unmount()
  await act(async () => {
    resolveStream({ getTracks: () => [{ stop() { stopped += 1 } }] })
    await permission
  })
  assert.equal(stopped, 1)
  assert.equal(contexts, 0)
})

test('synchronous MediaRecorder.stop failure still tears down and permits immediate retry', async () => {
  globalThis.fetch = (async (input: RequestInfo | URL) =>
    String(input).includes('/messages?') ? messages() : new Response('{}')) as typeof fetch
  let stopped = 0
  let closed = 0
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: {
    getUserMedia: async () => ({ getTracks: () => [{ stop() { stopped += 1 } }] }),
  } })
  class StopAudioContext {
    state = 'running'
    createAnalyser() { return { fftSize: 0, frequencyBinCount: 1, getByteTimeDomainData() {} } }
    createMediaStreamSource() { return { connect() {}, disconnect() {} } }
    close() { closed += 1; return Promise.resolve() }
  }
  class ThrowingStopRecorder {
    static instances = 0
    static isTypeSupported() { return true }
    state: 'inactive' | 'recording' = 'inactive'
    mimeType = 'audio/webm'
    ondataavailable = null
    onstop = null
    readonly number = ++ThrowingStopRecorder.instances
    constructor(_stream: unknown) {}
    start() { this.state = 'recording' }
    stop() { if (this.number === 1) throw new Error('stop failed'); this.state = 'inactive' }
  }
  Object.defineProperty(window, 'AudioContext', { configurable: true, value: StopAudioContext })
  Object.defineProperty(globalThis, 'MediaRecorder', { configurable: true, writable: true, value: ThrowingStopRecorder })
  const view = render(chat)
  act(() => openChat({ agentId: 'rosie', threadId: 'jr-30', label: 'Thirty' }))
  fireEvent.click(view.getByRole('button', { name: 'Record a voice note' }))
  await waitFor(() => assert.ok(view.getByRole('button', { name: 'Stop recording and attach' })))
  act(() => openChat({ agentId: 'rosie', threadId: 'jr-31', label: 'Thirty one' }))
  assert.equal(stopped, 1)
  assert.equal(closed, 1)
  fireEvent.click(view.getByRole('button', { name: 'Record a voice note' }))
  await waitFor(() => assert.equal(ThrowingStopRecorder.instances, 2))
  assert.ok(view.getByRole('button', { name: 'Stop recording and attach' }))
})

test('voice upload started on JR-30 cannot reattach after a JR-31 bind', async () => {
  let resolveUpload!: (response: Response) => void
  const upload = new Promise<Response>((resolve) => { resolveUpload = resolve })
  const uploadUrls: string[] = []
  let voiceSignal: AbortSignal | undefined
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url.includes('/messages?')) return Promise.resolve(messages())
    if (url.endsWith('/upload')) { uploadUrls.push(url); voiceSignal = init?.signal as AbortSignal; return upload }
    return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }))
  }) as typeof fetch

  const track = { stop() {} }
  const stream = { getTracks: () => [track] }
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: async () => stream } })
  class FakeAudioContext {
    state = 'running'
    createAnalyser() { return { fftSize: 0, frequencyBinCount: 1, getByteTimeDomainData(array: Uint8Array) { array[0] = 128 } } }
    createMediaStreamSource() { return { connect() {}, disconnect() {} } }
    async resume() {}
  }
  class FakeRecorder {
    static isTypeSupported() { return true }
    state: 'inactive' | 'recording' = 'inactive'
    mimeType = 'audio/webm'
    ondataavailable: ((event: { data: Blob }) => void) | null = null
    onstop: (() => void) | null = null
    constructor(_stream: unknown, _options?: unknown) {}
    start() { this.state = 'recording' }
    stop() {
      this.state = 'inactive'
      this.ondataavailable?.({ data: new dom.window.Blob(['voice'], { type: 'audio/webm' }) })
      this.onstop?.()
    }
  }
  Object.defineProperty(window, 'AudioContext', { configurable: true, value: FakeAudioContext })
  Object.defineProperty(globalThis, 'MediaRecorder', { configurable: true, writable: true, value: FakeRecorder })

  const view = render(chat)
  act(() => openChat({ agentId: 'rosie', threadId: 'jr-30', label: 'Thirty' }))
  await waitFor(() => assert.ok(view.getByText('JR-30 · Thirty')))
  fireEvent.click(view.getByRole('button', { name: 'Record a voice note' }))
  await waitFor(() => assert.ok(view.getByRole('button', { name: 'Stop recording and attach' })))
  fireEvent.click(view.getByRole('button', { name: 'Stop recording and attach' }))
  await waitFor(() => assert.equal(uploadUrls.length, 1))
  assert.equal(uploadUrls[0], '/api/chat/rosie/upload')
  act(() => openChat({ agentId: 'rosie', threadId: 'jr-31', label: 'Thirty one' }))
  assert.equal(voiceSignal?.aborted, true)
  await act(async () => resolveUpload(new Response(JSON.stringify({ name: 'voice', label: 'voice-note.webm', mime: 'audio/webm', size: 5 }), { status: 200 })))
  assert.equal(view.queryByText('voice-note.webm'), null)
})

test('poll-before-send and send-before-poll each leave one canonical message', async () => {
  let jrPoll = 0
  let resolveFirstSend!: (response: Response) => void
  const firstSend = new Promise<Response>((resolve) => { resolveFirstSend = resolve })
  let sendCount = 0
  globalThis.fetch = ((input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('/messages?')) {
      if (!url.includes('thread=jr-31')) return Promise.resolve(messages())
      jrPoll += 1
      const canonical = jrPoll === 2
        ? [{ id: 501, at: 501, role: 'user', text: 'poll won race', files: [] }]
        : jrPoll >= 3
          ? [{ id: 502, at: 502, role: 'user', text: 'send won race', files: [] }]
          : []
      return Promise.resolve(new Response(JSON.stringify({
        messages: canonical, hasMore: false, pending: false,
        cursor: canonical.at(-1)?.id ?? 0,
      }), { status: 200 }))
    }
    if (url.endsWith('/send')) {
      sendCount += 1
      return sendCount === 1
        ? firstSend
        : Promise.resolve(new Response(JSON.stringify({ id: 502 }), { status: 200 }))
    }
    return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }))
  }) as typeof fetch

  const view = render(chat)
  act(() => openChat({ agentId: 'rosie', threadId: 'jr-31', label: 'Thirty one' }))
  await waitFor(() => assert.equal(jrPoll, 1))
  const user = userEvent.setup({ document })
  await user.type(view.getByPlaceholderText('Ask Rosie…'), 'poll won race')
  await user.click(view.getByRole('button', { name: 'Send' }))
  act(() => FakeEventSource.instances.at(-1)?.onopen?.())
  await waitFor(() => assert.equal(view.getAllByText('poll won race').length, 2))
  await act(async () => resolveFirstSend(new Response(JSON.stringify({ id: 501 }), { status: 200 })))
  await waitFor(() => assert.equal(view.getAllByText('poll won race').length, 1))

  await user.type(view.getByPlaceholderText('Ask Rosie…'), 'send won race')
  await user.click(view.getByRole('button', { name: 'Send' }))
  await waitFor(() => assert.equal(view.getAllByText('send won race').length, 1))
  act(() => FakeEventSource.instances.at(-1)?.onopen?.())
  await waitFor(() => assert.ok(jrPoll >= 3))
  // Repeated canonical merges remain idempotent even if the event refreshes
  // more than once or returns the same row again.
  act(() => FakeEventSource.instances.at(-1)?.onopen?.())
  await waitFor(() => assert.ok(jrPoll >= 4))
  assert.equal(view.getAllByText('send won race').length, 1)
})

test('reset waits for same-revision send, blocks new sends, and wins after success or failure', async () => {
  const sendResolvers: Array<(response: Response) => void> = []
  const resetResolvers: Array<(response: Response) => void> = []
  let resetCalls = 0
  globalThis.fetch = ((input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('/messages?')) return Promise.resolve(messages())
    if (url.endsWith('/send')) return new Promise<Response>((resolve) => sendResolvers.push(resolve))
    if (url.endsWith('/reset')) {
      resetCalls += 1
      return new Promise<Response>((resolve) => resetResolvers.push(resolve))
    }
    return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }))
  }) as typeof fetch

  const view = render(chat)
  act(() => openChat({ agentId: 'rosie', threadId: 'jr-31', label: 'Thirty one' }))
  await waitFor(() => assert.ok(view.getByText('JR-31 · Thirty one')))
  const user = userEvent.setup({ document })
  await user.type(view.getByPlaceholderText('Ask Rosie…'), 'must clear')
  const staleSend = renderedHandler<() => void>(view.getByRole('button', { name: 'Send' }), 'onClick')
  await user.click(view.getByRole('button', { name: 'Send' }))
  await waitFor(() => assert.equal(sendResolvers.length, 1))
  fireEvent.click(view.getByRole('button', { name: 'Conversation options' }))
  fireEvent.click(view.getByRole('button', { name: 'Clear conversation' }))
  assert.equal(resetCalls, 0)
  act(() => staleSend())
  assert.equal(sendResolvers.length, 1)
  assert.equal(view.getByPlaceholderText('Ask Rosie…').closest('fieldset')?.getAttribute('aria-disabled'), 'true')

  await act(async () => sendResolvers[0](new Response(JSON.stringify({ id: 601 }), { status: 200 })))
  await waitFor(() => assert.equal(resetCalls, 1))
  await act(async () => resetResolvers[0](new Response(JSON.stringify({ ok: true }), { status: 200 })))
  await waitFor(() => assert.equal(view.queryByText('must clear'), null))

  // A failed send also settles before reset is issued; reset still runs last.
  await user.type(view.getByPlaceholderText('Ask Rosie…'), 'failed then clear')
  await user.click(view.getByRole('button', { name: 'Send' }))
  fireEvent.click(view.getByRole('button', { name: 'Conversation options' }))
  fireEvent.click(view.getByRole('button', { name: 'Clear conversation' }))
  assert.equal(resetCalls, 1)
  await act(async () => sendResolvers[1](new Response(JSON.stringify({ error: 'failed' }), { status: 500 })))
  await waitFor(() => assert.equal(resetCalls, 2))
  await act(async () => resetResolvers[1](new Response(JSON.stringify({ ok: true }), { status: 200 })))
  await waitFor(() => assert.equal(view.queryByText('failed then clear'), null))

  // A reset failure restores this exact lifecycle and unlocks its composer.
  fireEvent.click(view.getByRole('button', { name: 'Conversation options' }))
  fireEvent.click(view.getByRole('button', { name: 'Clear conversation' }))
  await waitFor(() => assert.equal(resetCalls, 3))
  await act(async () => resetResolvers[2](new Response(JSON.stringify({ error: 'reset failed' }), { status: 500 })))
  await waitFor(() => assert.ok(view.getByText('Couldn’t clear the conversation. Try again.')))
  assert.equal(view.getByPlaceholderText('Ask Rosie…').closest('fieldset')?.getAttribute('aria-disabled'), 'false')
  await user.type(view.getByPlaceholderText('Ask Rosie…'), 'after reset failure')
  await user.click(view.getByRole('button', { name: 'Send' }))
  await waitFor(() => assert.equal(sendResolvers.length, 3))
  await act(async () => sendResolvers[2](new Response(JSON.stringify({ id: 602 }), { status: 200 })))
  assert.ok(view.getByText('after reset failure'))
})

test('reset failure completed while away persists on its canonical destination and retry clears it', async () => {
  const resetResolvers: Array<(response: Response) => void> = []
  const order: string[] = []
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url.includes('/messages?')) return Promise.resolve(messages())
    if (url.endsWith('/reset')) {
      const threadId = (JSON.parse(String(init?.body)) as { threadId: string }).threadId
      order.push(`reset:${threadId}`)
      return new Promise<Response>((resolve) => resetResolvers.push(resolve))
    }
    if (url.endsWith('/send')) {
      const threadId = (JSON.parse(String(init?.body)) as { threadId: string }).threadId
      order.push(`send:${threadId}`)
      return Promise.resolve(new Response(JSON.stringify({ id: 990 }), { status: 200 }))
    }
    return Promise.resolve(new Response('{}'))
  }) as typeof fetch
  const view = render(chat)
  act(() => openChat({ agentId: 'rosie', threadId: 'jr-31', label: 'Thirty one' }))
  fireEvent.click(view.getByRole('button', { name: 'Conversation options' }))
  fireEvent.click(view.getByRole('button', { name: 'Clear conversation' }))
  await waitFor(() => assert.deepEqual(order, ['reset:jr-31']))
  act(() => openChat({ agentId: 'rosie', threadId: 'jr-30', label: 'Thirty' }))
  await act(async () => resetResolvers[0](new Response('{"error":"no"}', { status: 500 })))
  assert.equal(view.queryByText('Couldn’t clear the conversation. Try again.'), null)

  act(() => openChat({ agentId: 'rosie', threadId: 'jr-31', label: 'Thirty one' }))
  await waitFor(() => assert.ok(view.getByText('Couldn’t clear the conversation. Try again.')))
  fireEvent.click(view.getByRole('button', { name: 'Conversation options' }))
  fireEvent.click(view.getByRole('button', { name: 'Clear conversation' }))
  await waitFor(() => assert.deepEqual(order, ['reset:jr-31', 'reset:jr-31']))
  assert.equal(view.queryByText('Couldn’t clear the conversation. Try again.'), null)
  await act(async () => resetResolvers[1](new Response('{}', { status: 200 })))
  await waitFor(() => assert.equal(view.queryByText('Couldn’t clear the conversation. Try again.'), null))
  act(() => openChat({ agentId: 'rosie', threadId: 'jr-30', label: 'Thirty' }))
  act(() => openChat({ agentId: 'rosie', threadId: 'jr-31', label: 'Thirty one returned' }))
  assert.equal(view.queryByText('Couldn’t clear the conversation. Try again.'), null)
  const user = userEvent.setup({ document })
  await user.type(view.getByPlaceholderText('Ask Rosie…'), 'after retry')
  await user.click(view.getByRole('button', { name: 'Send' }))
  await waitFor(() => assert.deepEqual(order, ['reset:jr-31', 'reset:jr-31', 'send:jr-31']))
})

test('canonical reset banner dominates send, history, and poll outcomes until reset retry succeeds', async () => {
  const resetResolvers: Array<(response: Response) => void> = []
  let sendCalls = 0
  let loadCalls = 0
  let pollCalls = 0
  let failPoll = false
  const resetMessage = 'Couldn’t clear the conversation. Try again.'
  const transcript = (id: number, text: string, hasMore = true) => new Response(JSON.stringify({
    messages: [{ id, at: id, role: 'agent', text, files: [] }],
    hasMore,
    pending: false,
    cursor: id,
  }), { status: 200, headers: { 'content-type': 'application/json' } })

  globalThis.fetch = ((input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('/messages?before=')) {
      loadCalls += 1
      return loadCalls === 1
        ? Promise.resolve(transcript(20, 'older row'))
        : Promise.reject(new Error('history unavailable'))
    }
    if (url.includes('/messages?')) {
      pollCalls += 1
      if (failPoll && url.includes('thread=jr-31')) return Promise.reject(new Error('poll unavailable'))
      return Promise.resolve(url.includes('thread=jr-31') ? transcript(30, 'current row') : messages())
    }
    if (url.endsWith('/send')) {
      sendCalls += 1
      return Promise.resolve(sendCalls === 1
        ? new Response(JSON.stringify({ id: 801 }), { status: 200 })
        : new Response(JSON.stringify({ error: 'send failed' }), { status: 500 }))
    }
    if (url.endsWith('/reset')) return new Promise<Response>((resolve) => resetResolvers.push(resolve))
    return Promise.resolve(new Response('{}'))
  }) as typeof fetch

  const view = render(chat)
  act(() => openChat({ agentId: 'rosie', threadId: 'jr-31', label: 'Thirty one' }))
  await waitFor(() => assert.ok(view.getByText('current row')))
  fireEvent.click(view.getByRole('button', { name: 'Conversation options' }))
  fireEvent.click(view.getByRole('button', { name: 'Clear conversation' }))
  await waitFor(() => assert.equal(resetResolvers.length, 1))
  act(() => openChat({ agentId: 'rosie', threadId: 'jr-30', label: 'Thirty' }))
  await act(async () => resetResolvers[0](new Response('{"error":"no"}', { status: 500 })))
  assert.equal(view.queryByText(resetMessage), null)
  act(() => openChat({ agentId: 'rosie', threadId: 'jr-31', label: 'Thirty one returned' }))
  await waitFor(() => assert.equal(view.getByRole('alert').textContent, resetMessage))

  const user = userEvent.setup({ document })
  await user.type(view.getByPlaceholderText('Ask Rosie…'), 'successful send')
  await user.click(view.getByRole('button', { name: 'Send' }))
  await waitFor(() => assert.ok(view.getByText('successful send')))
  assert.equal(view.getByRole('alert').textContent, resetMessage)

  await user.type(view.getByPlaceholderText('Ask Rosie…'), 'failed send')
  await user.click(view.getByRole('button', { name: 'Send' }))
  await waitFor(() => assert.equal(sendCalls, 2))
  assert.equal(view.queryByText('Message failed to send.'), null)
  assert.equal(view.getByRole('alert').textContent, resetMessage)

  await user.click(view.getByRole('button', { name: 'Load earlier messages' }))
  await waitFor(() => assert.ok(view.getByText('older row')))
  assert.equal(view.getByRole('alert').textContent, resetMessage)
  await user.click(view.getByRole('button', { name: 'Load earlier messages' }))
  await waitFor(() => assert.equal(loadCalls, 2))
  assert.equal(view.queryByText('Can’t load earlier messages.'), null)
  assert.equal(view.getByRole('alert').textContent, resetMessage)

  const beforeSuccessPoll = pollCalls
  act(() => FakeEventSource.instances.at(-1)?.onopen?.())
  await waitFor(() => assert.ok(pollCalls > beforeSuccessPoll))
  assert.equal(view.getByRole('alert').textContent, resetMessage)
  failPoll = true
  const beforeFailedPoll = pollCalls
  act(() => FakeEventSource.instances.at(-1)?.onopen?.())
  await waitFor(() => assert.ok(pollCalls > beforeFailedPoll))
  assert.equal(view.queryByText('Can’t reach the agent.'), null)
  assert.equal(view.getByRole('alert').textContent, resetMessage)
  failPoll = false

  // Failed retry temporarily clears the old banner for progress, then restores
  // the same canonical reset failure rather than any transient error.
  fireEvent.click(view.getByRole('button', { name: 'Conversation options' }))
  fireEvent.click(view.getByRole('button', { name: 'Clear conversation' }))
  await waitFor(() => assert.equal(resetResolvers.length, 2))
  assert.equal(view.queryByText(resetMessage), null)
  await act(async () => resetResolvers[1](new Response('{"error":"still no"}', { status: 500 })))
  await waitFor(() => assert.equal(view.getByRole('alert').textContent, resetMessage))

  fireEvent.click(view.getByRole('button', { name: 'Conversation options' }))
  fireEvent.click(view.getByRole('button', { name: 'Clear conversation' }))
  await waitFor(() => assert.equal(resetResolvers.length, 3))
  await act(async () => resetResolvers[2](new Response('{}', { status: 200 })))
  await waitFor(() => assert.equal(view.queryByText(resetMessage), null))
  assert.equal(view.queryByRole('alert'), null)
})

test('never-settling send is bounded so reset and composer recover', async (context) => {
  let resetCalls = 0
  globalThis.fetch = ((input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('/messages?')) return Promise.resolve(messages())
    if (url.endsWith('/send')) return new Promise<Response>(() => {})
    if (url.endsWith('/reset')) { resetCalls += 1; return Promise.resolve(new Response('{}', { status: 200 })) }
    return Promise.resolve(new Response('{}', { status: 200 }))
  }) as typeof fetch
  const view = render(chat)
  act(() => openChat({ agentId: 'rosie', threadId: 'jr-31', label: 'Thirty one' }))
  fireEvent.change(view.getByPlaceholderText('Ask Rosie…'), { target: { value: 'never settles' } })
  context.mock.timers.enable({ apis: ['setTimeout'] })
  fireEvent.click(view.getByRole('button', { name: 'Send' }))
  fireEvent.click(view.getByRole('button', { name: 'Conversation options' }))
  fireEvent.click(view.getByRole('button', { name: 'Clear conversation' }))
  await act(async () => {
    context.mock.timers.tick(20_001)
    await Promise.resolve()
    await Promise.resolve()
  })
  context.mock.timers.reset()
  await waitFor(() => assert.equal(resetCalls, 1))
  await waitFor(() => assert.equal(view.getByPlaceholderText('Ask Rosie…').closest('fieldset')?.getAttribute('aria-disabled'), 'false'))
  assert.equal(view.queryByText('never settles'), null)
})

test('never-settling reset times out, reloads coherently, and exposes retry', async (context) => {
  let resetCalls = 0
  globalThis.fetch = ((input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('/messages?')) return Promise.resolve(messages('coherent transcript'))
    if (url.endsWith('/reset')) { resetCalls += 1; return new Promise<Response>(() => {}) }
    return Promise.resolve(new Response('{}', { status: 200 }))
  }) as typeof fetch
  const view = render(chat)
  act(() => openChat({ agentId: 'rosie', threadId: 'jr-31', label: 'Thirty one' }))
  await waitFor(() => assert.ok(view.getByText('coherent transcript')))
  context.mock.timers.enable({ apis: ['setTimeout'] })
  fireEvent.click(view.getByRole('button', { name: 'Conversation options' }))
  fireEvent.click(view.getByRole('button', { name: 'Clear conversation' }))
  await act(async () => { await Promise.resolve() })
  await act(async () => {
    context.mock.timers.tick(20_001)
    await Promise.resolve()
    await Promise.resolve()
  })
  context.mock.timers.reset()
  assert.equal(resetCalls, 1)
  await waitFor(() => assert.ok(view.getByText('Couldn’t clear the conversation. Try again.')))
  assert.ok(view.getByText('coherent transcript'))
  assert.equal(view.getByPlaceholderText('Ask Rosie…').closest('fieldset')?.getAttribute('aria-disabled'), 'false')
  fireEvent.click(view.getByRole('button', { name: 'Conversation options' }))
  assert.ok(view.getByRole('button', { name: 'Clear conversation' }))
})

test('canonical reset lock survives same-route and away/back while other destination stays usable', async () => {
  let resolveReset!: (response: Response) => void
  const reset = new Promise<Response>((resolve) => { resolveReset = resolve })
  const order: string[] = []
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url.includes('/messages?')) return Promise.resolve(messages())
    if (url.endsWith('/reset')) { order.push('reset:start'); return reset }
    if (url.endsWith('/send')) {
      const body = JSON.parse(String(init?.body)) as { threadId: string }
      order.push(`send:${body.threadId}`)
      return Promise.resolve(new Response(JSON.stringify({ id: order.length + 800 }), { status: 200 }))
    }
    return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }))
  }) as typeof fetch
  const view = render(chat)
  act(() => openChat({ agentId: 'rosie', threadId: 'jr-31', label: 'Thirty one' }))
  await waitFor(() => assert.ok(view.getByText('JR-31 · Thirty one')))
  fireEvent.click(view.getByRole('button', { name: 'Conversation options' }))
  fireEvent.click(view.getByRole('button', { name: 'Clear conversation' }))
  await waitFor(() => assert.deepEqual(order, ['reset:start']))

  act(() => openChat({ agentId: 'rosie', threadId: 'jr-31', label: 'Thirty one rebound' }))
  assert.equal(view.getByPlaceholderText('Ask Rosie…').closest('fieldset')?.getAttribute('aria-disabled'), 'true')
  act(() => openChat({ agentId: 'rosie', threadId: 'jr-30', label: 'Thirty' }))
  const user = userEvent.setup({ document })
  await user.type(view.getByPlaceholderText('Ask Rosie…'), 'other destination works')
  await user.click(view.getByRole('button', { name: 'Send' }))
  await waitFor(() => assert.deepEqual(order, ['reset:start', 'send:jr-30']))

  act(() => openChat({ agentId: 'rosie', threadId: 'jr-31', label: 'Thirty one ABA' }))
  const lockedComposer = view.getByPlaceholderText('Ask Rosie…')
  assert.equal(lockedComposer.closest('fieldset')?.getAttribute('aria-disabled'), 'true')
  fireEvent.change(lockedComposer, { target: { value: 'must wait' } })
  const lockedSend = renderedHandler<() => void>(view.getByRole('button', { name: 'Send' }), 'onClick')
  act(() => lockedSend())
  assert.deepEqual(order, ['reset:start', 'send:jr-30'])

  order.push('reset:end')
  await act(async () => resolveReset(new Response(JSON.stringify({ ok: true }), { status: 200 })))
  await waitFor(() => assert.equal(view.getByPlaceholderText('Ask Rosie…').closest('fieldset')?.getAttribute('aria-disabled'), 'false'))
  await user.type(view.getByPlaceholderText('Ask Rosie…'), 'after reset')
  await user.click(view.getByRole('button', { name: 'Send' }))
  await waitFor(() => assert.deepEqual(order, ['reset:start', 'send:jr-30', 'reset:end', 'send:jr-31']))
})

test('bind-away keeps canonical reset intent while current destination remains untouched', async () => {
  let resolveSend!: (response: Response) => void
  const send = new Promise<Response>((resolve) => { resolveSend = resolve })
  let resetCalls = 0
  globalThis.fetch = ((input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('/messages?')) return Promise.resolve(messages(url.includes('thread=jr-31') ? 'new transcript' : undefined))
    if (url.endsWith('/send')) return send
    if (url.endsWith('/reset')) { resetCalls += 1; return Promise.resolve(new Response('{}', { status: 200 })) }
    return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }))
  }) as typeof fetch
  const view = render(chat)
  act(() => openChat({ agentId: 'rosie', threadId: 'jr-30', label: 'Thirty' }))
  const user = userEvent.setup({ document })
  await user.type(view.getByPlaceholderText('Ask Rosie…'), 'old send')
  await user.click(view.getByRole('button', { name: 'Send' }))
  fireEvent.click(view.getByRole('button', { name: 'Conversation options' }))
  fireEvent.click(view.getByRole('button', { name: 'Clear conversation' }))
  act(() => openChat({ agentId: 'rosie', threadId: 'jr-31', label: 'Thirty one' }))
  await waitFor(() => assert.ok(view.getByText('new transcript')))
  await act(async () => resolveSend(new Response(JSON.stringify({ id: 701 }), { status: 200 })))
  await waitFor(() => assert.equal(resetCalls, 1))
  assert.ok(view.getByText('new transcript'))
  assert.equal(view.queryByText('old send'), null)
})

test('same-revision send completion ordering preserves newer success and ignores older failure', async () => {
  const sendResolvers: Array<(response: Response) => void> = []
  globalThis.fetch = ((input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('/messages?')) return Promise.resolve(messages())
    if (url.endsWith('/send')) return new Promise<Response>((resolve) => sendResolvers.push(resolve))
    return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }))
  }) as typeof fetch
  const view = render(chat)
  act(() => openChat({ agentId: 'rosie', threadId: 'jr-31', label: 'Courtyard' }))
  await waitFor(() => assert.ok(view.getByText('JR-31 · Courtyard')))
  const user = userEvent.setup({ document })
  const composer = view.getByPlaceholderText('Ask Rosie…')
  await user.type(composer, 'first fails')
  await user.click(view.getByRole('button', { name: 'Send' }))
  await user.type(composer, 'second succeeds')
  await user.click(view.getByRole('button', { name: 'Send' }))
  await waitFor(() => assert.equal(sendResolvers.length, 2))
  await act(async () => sendResolvers[1](new Response(JSON.stringify({ id: 402 }), { status: 200 })))
  await act(async () => sendResolvers[0](new Response(JSON.stringify({ error: 'no' }), { status: 500 })))
  assert.ok(view.getByText('second succeeds'))
  assert.equal(view.queryByText('first fails'), null)
  assert.equal(view.queryByText('Message failed to send.'), null)
})

test('destination label always exposes canonical Job identity', () => {
  assert.equal(chatDestinationLabel({ id: 'jr-31', label: 'Courtyard' }), 'JR-31 · Courtyard')
  assert.equal(chatDestinationLabel({ id: 'jr-31', label: 'JR-31' }), 'JR-31')
  assert.equal(chatDestinationLabel({ id: 'supplier-oak', label: 'Oak Nursery' }), 'Oak Nursery')
  assert.equal(chatDestinationLabel({ id: 'main', label: 'Main' }), 'Main')
})
