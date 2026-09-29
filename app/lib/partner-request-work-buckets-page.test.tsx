import assert from 'node:assert/strict'
import test, { afterEach, beforeEach } from 'node:test'
import React from 'react'
import { JSDOM } from 'jsdom'
import { act, cleanup, configure, fireEvent, render, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime'
import { PathParamsContext } from 'next/dist/shared/lib/hooks-client-context.shared-runtime'

import PartnerHomePage from '../app/partner/[id]/page.tsx'
import type { ARDetail } from './availability.ts'

let dom: JSDOM
let viewportWidth = 1440
let mediaListeners: Set<() => void>
let eventSources: FakeEventSource[]
let originalFetch: typeof fetch

// This mounts the complete portal frame rather than a leaf component; allow
// its effects room when the whole test corpus is sharing CPU.
configure({ asyncUtilTimeout: 5000 })

class FakeEventSource {
  onmessage: ((event: { data: string }) => void) | null = null
  onopen: (() => void) | null = null
  readonly url: string
  closed = false
  constructor(url: string) {
    this.url = url
    eventSources.push(this)
  }
  close() { this.closed = true }
  emit() { this.onmessage?.({ data: '{}' }) }
}

function mediaMatches(query: string) {
  if (query.includes('max-width: 899px')) return viewportWidth <= 899
  if (query.includes('min-width: 900px')) return viewportWidth >= 900
  if (query.includes('prefers-color-scheme')) return false
  return false
}

async function setWidth(width: number) {
  viewportWidth = width
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width })
  await act(async () => {
    for (const listener of mediaListeners) listener()
    await new Promise((resolve) => setTimeout(resolve, 5))
  })
}

beforeEach(() => {
  dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/partner/7' })
  viewportWidth = 1440
  mediaListeners = new Set()
  eventSources = []
  const win = dom.window
  Object.defineProperty(win, 'innerWidth', { configurable: true, value: viewportWidth })
  Object.defineProperty(win, 'matchMedia', {
    configurable: true,
    value: (query: string) => ({
      get matches() { return mediaMatches(query) },
      media: query,
      onchange: null,
      addEventListener(type: string, listener: () => void) { if (type === 'change') mediaListeners.add(listener) },
      removeEventListener(type: string, listener: () => void) { if (type === 'change') mediaListeners.delete(listener) },
      addListener(listener: () => void) { mediaListeners.add(listener) },
      removeListener(listener: () => void) { mediaListeners.delete(listener) },
      dispatchEvent: () => false,
    }),
  })
  Object.defineProperty(win, 'visualViewport', {
    configurable: true,
    value: {
      offsetTop: 0, height: 800,
      addEventListener() {}, removeEventListener() {},
    },
  })
  class FakeResizeObserver { observe() {} unobserve() {} disconnect() {} }
  class FakeIntersectionObserver { observe() {} unobserve() {} disconnect() {} }
  for (const [key, value] of Object.entries({
    window: win,
    self: win,
    document: win.document,
    navigator: win.navigator,
    HTMLElement: win.HTMLElement,
    HTMLInputElement: win.HTMLInputElement,
    HTMLTextAreaElement: win.HTMLTextAreaElement,
    HTMLSelectElement: win.HTMLSelectElement,
    Element: win.Element,
    Node: win.Node,
    MouseEvent: win.MouseEvent,
    KeyboardEvent: win.KeyboardEvent,
    CustomEvent: win.CustomEvent,
    DOMException: win.DOMException,
    EventSource: FakeEventSource,
    ResizeObserver: FakeResizeObserver,
    IntersectionObserver: FakeIntersectionObserver,
    getComputedStyle: win.getComputedStyle,
    requestAnimationFrame: (callback: FrameRequestCallback) => setTimeout(() => callback(Date.now()), 0),
    cancelAnimationFrame: (id: number) => clearTimeout(id),
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  Object.defineProperty(win.HTMLElement.prototype, 'getClientRects', {
    configurable: true,
    value() { return this.isConnected ? [{ width: 1, height: 1 }] : [] },
  })
  Object.defineProperty(win.HTMLElement.prototype, 'getBoundingClientRect', {
    configurable: true,
    value() { return { x: 0, y: 0, left: 0, top: 0, right: viewportWidth, bottom: 800, width: viewportWidth, height: 800, toJSON() {} } },
  })
  Object.defineProperty(win.HTMLElement.prototype, 'scrollTo', { configurable: true, value() {} })
  Object.defineProperty(win.HTMLElement.prototype, 'attachEvent', { configurable: true, value() {} })
  Object.defineProperty(win.HTMLElement.prototype, 'detachEvent', { configurable: true, value() {} })
  originalFetch = globalThis.fetch
})

afterEach(async () => {
  cleanup()
  await new Promise((resolve) => setTimeout(resolve, 0))
  globalThis.fetch = originalFetch
  dom.window.close()
})

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } })
}

function request(id: number, status: ARDetail['status']): ARDetail {
  return {
    id,
    jobRequestId: id + 100,
    jobName: `Job ${id}`,
    supplierId: 7,
    supplierName: 'Oak Hill Nursery',
    shareCustomerDetails: false,
    status,
    submittedAt: status === 'submitted' ? '2026-09-03T12:00:00.000Z' : null,
    createdAt: '2026-09-03T11:00:00.000Z',
    itemCount: 1,
    answeredCount: status === 'new' ? 0 : 1,
    noteForSupplier: null,
    customer: null,
    shipping: null,
    items: [{
      id: id + 1000,
      name: `Plant ${id}`,
      size: '15 G',
      demandedQuantity: 2,
      status: status === 'new' ? null : 'available',
      availableQuantity: status === 'new' ? null : 2,
      unitPrice: 10,
      noteForSupplier: null,
      noteFromSupplier: null,
    }],
  }
}

function payload(requests: ARDetail[], name = 'Oak Hill Nursery') {
  return { supplier: { name }, requests }
}

const router = {
  back() {}, forward() {}, refresh() {}, hmrRefresh() {},
  push() {}, replace() {}, prefetch: async () => undefined,
}

function renderPage(id = '7') {
  return render(
    <AppRouterContext.Provider value={router as never}>
      <PathParamsContext.Provider value={{ id }}>
        <PartnerHomePage />
      </PathParamsContext.Provider>
    </AppRouterContext.Provider>,
  )
}

function installFetch(getPartner: (url: string, init?: RequestInit) => Promise<Response> | Response) {
  let chatId = 1
  const calls: Array<{ url: string; init?: RequestInit }> = []
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    calls.push({ url, init })
    if (/^\/api\/partner\/\d+$/.test(url)) return getPartner(url, init)
    if (/^\/api\/partner\/\d+\/chat\?since=0&limit=1$/.test(url)) {
      return json({ messages: [{ id: chatId, at: Date.now(), role: 'agent', text: 'Reply' }], readId: 0 })
    }
    throw new Error(`Unexpected fetch: ${url}`)
  }) as typeof fetch
  return {
    calls,
    setChatId(id: number) { chatId = id },
    emitReply() {
      const source = eventSources.find((entry) => entry.url === '/api/partner/7/chat/events')
      assert.ok(source)
      source.emit()
    },
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

test('actual PartnerHomePage uses exact auth-scoped read, global counts, default active rows, closed separation and desktop bell', async () => {
  const api = installFetch(() => json(payload([
    request(1, 'new'), request(2, 'processing'), request(3, 'submitted'), request(4, 'closed'),
  ])))
  const view = renderPage()
  await view.findByRole('link', { name: 'New request: Job 1' })
  const buckets = view.getByRole('group', { name: 'Request work buckets' })

  assert.ok(within(buckets).getByRole('button', { name: 'New: 1 requests, selected' }))
  assert.ok(within(buckets).getByRole('button', { name: 'Processing: 1 requests, selected' }))
  assert.ok(within(buckets).getByRole('button', { name: 'Completed: 1 requests, not selected' }))
  assert.equal(within(buckets).getAllByRole('button').length, 3)
  assert.equal(view.getAllByRole('link', { name: /request: Job/ }).length, 2)
  assert.equal(view.queryByRole('link', { name: /Job 4/ }), null)
  assert.ok(view.getByRole('button', { name: /Notifications/ }))

  const read = api.calls.find((call) => call.url === '/api/partner/7')!
  assert.ok(read)
  assert.equal(read.init?.method, undefined)
  assert.equal(read.init?.cache, 'no-store')
  assert.ok(read.init?.signal instanceof AbortSignal)
  assert.equal(api.calls.some((call) => /closed|status|filter/.test(call.url)), false)
})

test('actual page controls remain reachable at 320/390/480/desktop and support keyboard, touch, multi-select and fresh remount defaults', async () => {
  installFetch(() => json(payload([request(1, 'new'), request(2, 'processing'), request(3, 'submitted')])))
  const user = userEvent.setup({ document })
  const view = renderPage()
  await view.findByRole('link', { name: 'New request: Job 1' })
  const group = view.getByRole('group', { name: 'Request work buckets' })
  assert.match(group.className, /overflow-x-auto/)

  for (const width of [320, 390, 480, 1440]) {
    await setWidth(width)
    const completed = within(group).getByRole('button', { name: /Completed:/ })
    act(() => completed.focus())
    assert.equal(document.activeElement, completed)
    assert.equal(document.querySelector('[data-request-row-status]')?.getAttribute('class')?.includes('min-w-['), false)
  }

  const completed = within(group).getByRole('button', { name: 'Completed: 1 requests, not selected' })
  act(() => completed.focus())
  await user.keyboard(' ')
  assert.ok(view.getByRole('link', { name: 'Completed request: Job 3' }))
  assert.equal(view.getAllByRole('link', { name: /request: Job/ }).length, 3)
  const processing = within(group).getByRole('button', { name: 'Processing: 1 requests, selected' })
  fireEvent.touchStart(processing)
  fireEvent.touchEnd(processing)
  fireEvent.click(processing)
  assert.equal(view.queryByRole('link', { name: 'Processing request: Job 2' }), null)
  act(() => processing.focus())
  await user.keyboard('{Enter}')
  assert.equal(view.getAllByRole('link', { name: /request: Job/ }).length, 3)

  view.unmount()
  const fresh = renderPage()
  await fresh.findByRole('link', { name: 'New request: Job 1' })
  assert.ok(fresh.getByRole('button', { name: 'Completed: 1 requests, not selected' }))
  assert.equal(fresh.queryByRole('link', { name: 'Completed request: Job 3' }), null)
})

test('actual fetched snapshots distinguish hidden selections, no selection and a genuinely empty active queue', async () => {
  let snapshot = [request(2, 'processing')]
  installFetch(() => json(payload(snapshot)))
  const user = userEvent.setup({ document })
  const view = renderPage()
  await view.findByRole('link', { name: 'Processing request: Job 2' })

  await user.click(view.getByRole('button', { name: 'Processing: 1 requests, selected' }))
  assert.match(view.getByRole('status').textContent ?? '', /Nothing in the selected buckets/)
  await user.click(view.getByRole('button', { name: 'New: 0 requests, selected' }))
  assert.match(view.getByRole('status').textContent ?? '', /No request buckets selected/)

  view.unmount()
  snapshot = [request(3, 'submitted')]
  const completedOnly = renderPage()
  await completedOnly.findByRole('button', { name: 'Completed: 1 requests, not selected' })
  assert.match(completedOnly.getByRole('status').textContent ?? '', /No New or Processing requests/)
})

test('actual back-return after Submit/Re-Submit resets defaults and a reopened New request returns to active work', async () => {
  let snapshot = [request(8, 'processing')]
  installFetch(() => json(payload(snapshot)))
  const initial = renderPage()
  await initial.findByRole('link', { name: 'Processing request: Job 8' })

  // The detail route's existing Submit writes `submitted`; returning mounts a
  // fresh home page, which must not retain a prior Completed selection.
  initial.unmount()
  snapshot = [request(8, 'submitted')]
  const afterSubmit = renderPage()
  await afterSubmit.findByRole('button', { name: 'Completed: 1 requests, not selected' })
  assert.equal(afterSubmit.queryByRole('link', { name: 'Completed request: Job 8' }), null)
  await userEvent.setup({ document }).click(afterSubmit.getByRole('button', { name: 'Completed: 1 requests, not selected' }))
  assert.ok(afterSubmit.getByRole('link', { name: 'Completed request: Job 8' }))

  // Re-Submit remains the same stored status, but another return is still a
  // fresh visit and therefore selects New + Processing again.
  afterSubmit.unmount()
  const afterResubmit = renderPage()
  await afterResubmit.findByRole('button', { name: 'Completed: 1 requests, not selected' })
  assert.equal(afterResubmit.queryByRole('link', { name: 'Completed request: Job 8' }), null)

  // The existing database line-add trigger reopens to `new`; no new client
  // status or write path is involved.
  afterResubmit.unmount()
  snapshot = [request(8, 'new')]
  const reopened = renderPage()
  assert.ok(await reopened.findByRole('link', { name: 'New request: Job 8' }))
})

test('actual page refresh is latest-wins across reverse Submit/Re-Submit and reopen snapshots', async () => {
  const refreshA = deferred<Response>()
  const refreshB = deferred<Response>()
  let partnerCall = 0
  const api = installFetch(() => {
    partnerCall += 1
    if (partnerCall === 1) return json(payload([request(8, 'processing')]))
    if (partnerCall === 2) return refreshA.promise
    if (partnerCall === 3) return refreshB.promise
    return json(payload([request(8, 'new')]))
  })
  const view = renderPage()
  await view.findByRole('link', { name: 'Processing request: Job 8' })
  await waitFor(() => assert.equal(api.calls.filter((call) => call.url.includes('/chat?')).length, 1))
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })

  api.setChatId(2)
  api.emitReply()
  await waitFor(() => assert.equal(partnerCall, 2))
  const firstRefresh = api.calls.filter((call) => call.url === '/api/partner/7')[1]
  api.setChatId(3)
  api.emitReply()
  await waitFor(() => assert.equal(partnerCall, 3))
  assert.equal(firstRefresh.init?.signal?.aborted, true)

  // Resolve B first, then let the aborted implementation deliver stale A
  // anyway. Both promises settle so React's test act queue is not held open.
  await act(async () => {
    refreshB.resolve(json(payload([request(8, 'submitted')])))
    await new Promise((resolve) => setTimeout(resolve, 0))
    refreshA.resolve(json(payload([request(99, 'new')])))
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
  assert.equal(view.queryByRole('link', { name: 'Completed request: Job 8' }), null)
  assert.ok(view.getByRole('button', { name: 'Completed: 1 requests, not selected' }))
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.equal(view.queryByRole('link', { name: /Job 99/ }), null)

  await userEvent.setup({ document }).click(view.getByRole('button', { name: 'Completed: 1 requests, not selected' }))
  assert.ok(view.getByRole('link', { name: 'Completed request: Job 8' }))
  api.setChatId(4)
  api.emitReply()
  await view.findByRole('link', { name: 'New request: Job 8' })
  assert.equal(view.queryByRole('alert'), null)
})

test('newer refresh failure beats stale success, retains truthful data, and Retry clears it', async () => {
  const stale = deferred<Response>()
  let partnerCall = 0
  const api = installFetch(() => {
    partnerCall += 1
    if (partnerCall === 1) return json(payload([request(6, 'new')]))
    if (partnerCall === 2) return stale.promise
    if (partnerCall === 3) return Promise.reject(new Error('offline'))
    return json(payload([request(6, 'submitted')]))
  })
  const view = renderPage()
  await view.findByRole('link', { name: 'New request: Job 6' })
  await waitFor(() => assert.equal(api.calls.filter((call) => call.url.includes('/chat?')).length, 1))
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })

  api.setChatId(2)
  api.emitReply()
  await waitFor(() => assert.equal(partnerCall, 2))
  api.setChatId(3)
  api.emitReply()
  const alert = await view.findByRole('alert')
  assert.match(alert.textContent ?? '', /last loaded list is still shown/i)
  assert.ok(view.getByRole('link', { name: 'New request: Job 6' }))

  await act(async () => {
    stale.resolve(json(payload([request(66, 'processing')])))
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
  assert.ok(view.getByRole('alert'))
  assert.ok(view.getByRole('link', { name: 'New request: Job 6' }))
  assert.equal(view.queryByRole('link', { name: /Job 66/ }), null)

  await userEvent.setup({ document }).click(within(alert).getByRole('button', { name: 'Retry' }))
  await waitFor(() => assert.equal(view.queryByRole('alert'), null))
  assert.equal(view.queryByRole('link', { name: 'New request: Job 6' }), null)
  assert.ok(view.getByRole('button', { name: 'Completed: 1 requests, not selected' }))
})

test('actual initial empty state is truthful and supplier switch/unmount abort and ignore stale reads', async () => {
  const first = deferred<Response>()
  const calls: Array<{ url: string; signal?: AbortSignal }> = []
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url.includes('/chat?')) return json({ messages: [], readId: 0 })
    if (/^\/api\/partner\/\d+$/.test(url)) {
      calls.push({ url, signal: init?.signal ?? undefined })
      if (url === '/api/partner/7') return first.promise
      return json(payload([], 'Pine Ridge'))
    }
    throw new Error(`Unexpected fetch: ${url}`)
  }) as typeof fetch

  const view = renderPage('7')
  await waitFor(() => assert.equal(calls.length, 1))
  view.rerender(
    <AppRouterContext.Provider value={router as never}>
      <PathParamsContext.Provider value={{ id: '8' }}><PartnerHomePage /></PathParamsContext.Provider>
    </AppRouterContext.Provider>,
  )
  await view.findByText('No open requests')
  assert.equal(calls[0].signal?.aborted, true)
  assert.equal(calls[1].url, '/api/partner/8')
  first.resolve(json(payload([request(77, 'new')], 'Stale Supplier')))
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.equal(view.queryByText('Job 77'), null)

  const second = deferred<Response>()
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).includes('/chat?')) return json({ messages: [], readId: 0 })
    calls.push({ url: String(input), signal: init?.signal ?? undefined })
    return second.promise
  }) as typeof fetch
  view.rerender(
    <AppRouterContext.Provider value={router as never}>
      <PathParamsContext.Provider value={{ id: '9' }}><PartnerHomePage /></PathParamsContext.Provider>
    </AppRouterContext.Provider>,
  )
  await waitFor(() => assert.equal(calls.at(-1)?.url, '/api/partner/9'))
  const unmounted = calls.at(-1)!
  view.unmount()
  assert.equal(unmounted.signal?.aborted, true)
  second.resolve(json(payload([request(88, 'new')])))
})
