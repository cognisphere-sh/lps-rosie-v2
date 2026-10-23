import assert from 'node:assert/strict'
import test, { beforeEach, afterEach } from 'node:test'
import React from 'react'
import { JSDOM } from 'jsdom'
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { AREditorBody, useAREditor, type AREditor } from '../components/workspace/ar-editor'
import type { ARDetail } from './availability'

export const fixture = (id = 84, shared = false, status = 'processing'): ARDetail => ({
  id, recordName: `AR-${id}`, jobRequestId: 31, jobRequestIds: [31],
  jobName: 'Synthetic courtyard project with a deliberately long job name',
  supplierId: 7, supplierName: 'Example Valley Growers and Landscape Supply — North Branch', status,
  shareCustomerDetails: shared, submittedAt: null, createdAt: '2026-10-01T15:00:00Z',
  itemCount: 0, answeredCount: 0, noteForSupplier: null, customer: null, shipping: null, items: [],
})
let dom: JSDOM
const originalFetch = globalThis.fetch
let saved: ARDetail
let calls: { path: string; body?: Record<string, unknown> }[]
let patch: (body: Record<string, unknown>) => Promise<Response>
let read: () => Promise<Response>
let editor: AREditor
function Harness({ id = 84, summaryCard = false }: { id?: number; summaryCard?: boolean }) {
  editor = useAREditor(id)
  return <AREditorBody editor={editor} mobile summaryCard={summaryCard} />
}
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
beforeEach(() => {
  dom = new JSDOM('<html><body></body></html>', { url: 'http://localhost/jobs?jr=31', pretendToBeVisual: true })
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document,
    navigator: dom.window.navigator, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node,
    getComputedStyle: dom.window.getComputedStyle, IS_REACT_ACT_ENVIRONMENT: true })) {
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  saved = fixture()
  calls = []
  patch = async body => { saved = { ...saved, shareCustomerDetails: body.shareCustomerDetails as boolean }; return Response.json({ ok: true }) }
  read = async () => Response.json({ request: saved })
  globalThis.fetch = async (input, init) => {
    const path = String(input)
    assert.match(path, /^\/api\/availability-requests\/\d+$/)
    const body = init?.method === 'PATCH' ? JSON.parse(String(init.body)) : undefined
    calls.push({ path, body })
    return body ? patch(body) : read()
  }
})
afterEach(() => { cleanup(); globalThis.fetch = originalFetch; dom.window.close() })
const toggle = (view: ReturnType<typeof render>) => view.getByRole('button', { name: /^Share customer info for/ }) as HTMLButtonElement
const ready = async (view: ReturnType<typeof render>, on = false) => {
  await waitFor(() => {
    assert.equal(toggle(view).getAttribute('aria-pressed'), String(on))
    assert.match(view.getByRole('status').textContent ?? '', on ? /Saved on/ : /Saved off/)
  })
}
const writes = () => calls.filter(call => call.body)

test('initial authoritative on/off; scoped accessible CI, keyboard and explanation; no publication or duplicate checkbox', async () => {
  const view = render(<Harness />)
  await ready(view)
  assert.equal(view.queryByRole('checkbox'), null)
  assert.match(toggle(view).getAttribute('aria-label')!, /AR-84.*Example Valley/)
  assert.ok(toggle(view).className.includes('min-h-11'))
  const user = userEvent.setup({ document: dom.window.document })
  toggle(view).focus()
  await user.keyboard(' ')
  await ready(view, true)
  assert.match(toggle(view).className, /emerald/)
  assert.ok(toggle(view).querySelector('.lucide-check'))
  assert.deepEqual(writes().map(call => call.body), [{ shareCustomerDetails: true }])
  fireEvent.click(view.getByText('What does CI share?'))
  assert.match(view.container.textContent!, /contact and delivery details.*already-valid public link/)
  assert.match(view.container.textContent!, /Off does not hide names or notes/)
  await user.keyboard('{Enter}')
  await ready(view)
  assert.deepEqual(writes().map(call => call.body), [{ shareCustomerDetails: true }, { shareCustomerDetails: false }])
})

test('pending write AND confirming read are neutral, rapid presses cannot abort/repeat disclosure', async () => {
  const view = render(<Harness />)
  await ready(view)
  const pendingWrite = deferred<Response>()
  patch = () => pendingWrite.promise
  fireEvent.click(toggle(view))
  fireEvent.click(toggle(view))
  await waitFor(() => assert.equal(writes().length, 1))
  assert.equal(toggle(view).disabled, true)
  assert.doesNotMatch(toggle(view).className, /emerald/)
  assert.match(view.getByRole('status').textContent!, /Saving on.*Last confirmed off/)
  const pendingRead = deferred<Response>()
  read = () => pendingRead.promise
  await act(async () => pendingWrite.resolve(Response.json({ ok: true })))
  assert.equal(toggle(view).getAttribute('aria-pressed'), 'false')
  assert.doesNotMatch(toggle(view).className, /emerald/)
  await act(async () => pendingRead.resolve(Response.json({ request: fixture(84, true) })))
  await ready(view, true)
})

test('failed off preserves authoritative on; refusal is announced and recoverable without an automatic write', async () => {
  saved = fixture(84, true)
  const view = render(<Harness />)
  await ready(view, true)
  patch = async () => Response.json({ error: 'Closed by another editor' }, { status: 409 })
  fireEvent.click(toggle(view))
  await waitFor(() => assert.match(view.getByRole('alert').textContent!, /Closed by another editor/))
  await ready(view, true)
  fireEvent.click(view.getByRole('button', { name: 'Check saved state' }))
  await waitFor(() => assert.equal(view.queryByRole('alert'), null))
  assert.equal(writes().length, 1)
})

test('write success/read failure is unknown, keeps intent and last confirmation, explicit recovery only reads', async () => {
  const view = render(<Harness />)
  await ready(view)
  read = async () => { throw new Error('offline') }
  fireEvent.click(toggle(view))
  await waitFor(() => assert.match(view.getByRole('status').textContent!, /unknown.*Last confirmed off/))
  assert.equal(editor.customerInfo.intent, true)
  assert.equal(toggle(view).disabled, true)
  assert.doesNotMatch(toggle(view).className, /emerald/)
  fireEvent.click(view.getByRole('button', { name: 'Check saved state' }))
  await waitFor(() => assert.match(view.getByRole('status').textContent!, /unknown/))
  assert.equal(writes().length, 1)
  read = async () => Response.json({ request: saved })
  fireEvent.click(view.getByRole('button', { name: 'Check saved state' }))
  await ready(view, true)
  assert.equal(writes().length, 1)
})

test('network write outcome stays unknown even if immediate read succeeds; live refresh does not silently reconcile', async () => {
  const view = render(<Harness />)
  await ready(view)
  patch = async () => { saved = fixture(84, true); throw new Error('connection lost after commit') }
  fireEvent.click(toggle(view))
  await waitFor(() => assert.match(view.getByRole('status').textContent!, /unknown.*Last confirmed on/))
  fireEvent(window, new dom.window.Event('focus'))
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 250)) })
  assert.equal(toggle(view).disabled, true)
  assert.doesNotMatch(toggle(view).className, /emerald/)
  fireEvent.click(view.getByRole('button', { name: 'Check saved state' }))
  await ready(view, true)
  assert.equal(writes().length, 1)
})

test('live refresh reflects saved changes without writes; older pre-write read cannot replace new intent/confirmation', async () => {
  const view = render(<Harness />)
  await ready(view)
  saved = fixture(84, true)
  fireEvent(window, new dom.window.Event('focus'))
  await waitFor(() => assert.match(view.getByRole('status').textContent!, /Saved on/))
  const stale = deferred<Response>()
  read = () => stale.promise
  fireEvent(window, new dom.window.Event('focus'))
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 250)) })
  read = async () => Response.json({ request: saved })
  fireEvent.click(toggle(view))
  await ready(view)
  await act(async () => stale.resolve(Response.json({ request: fixture(84, true) })))
  await ready(view)
  assert.equal(writes().length, 1)
})

test('a newer explicit intent after completion cannot be replaced by a late previous read', async () => {
  const view = render(<Harness />)
  await ready(view)
  fireEvent.click(toggle(view))
  await ready(view, true)
  fireEvent.click(toggle(view))
  await ready(view)
  assert.deepEqual(writes().map(call => call.body), [{ shareCustomerDetails: true }, { shareCustomerDetails: false }])
})

test('AR A→B→A keyed sessions reject old writes/reads, even when transport ignores abort', async () => {
  const view = render(<Harness key="jobA-ar84-session1" />)
  await ready(view)
  const oldWrite = deferred<Response>()
  patch = () => oldWrite.promise
  fireEvent.click(toggle(view))
  await waitFor(() => assert.equal(writes().length, 1))
  saved = fixture(85, true)
  view.rerender(<Harness key="jobB-ar85" id={85} />)
  await ready(view, true)
  assert.match(toggle(view).getAttribute('aria-label')!, /AR-85/)
  saved = fixture(84, false)
  view.rerender(<Harness key="jobA-ar84-session2" />)
  await ready(view)
  const before = calls.length
  await act(async () => oldWrite.resolve(Response.json({ ok: true })))
  assert.equal(calls.length, before, 'disposed writer must not even start its confirmation read')
  await ready(view)
  assert.equal(writes().length, 1)
})

test('Closed is noneditable, draft is only a preference; summary drawer has no new toggle; unloaded/invalid AR has none', async () => {
  saved = fixture(84, true, 'closed')
  const view = render(<Harness />)
  await ready(view, true)
  assert.equal(toggle(view).disabled, true)
  assert.match(view.getByRole('status').textContent!, /Closed.*read-only/)
  assert.equal(writes().length, 0)
  view.unmount()
  saved = fixture(84, true, 'draft')
  const draft = render(<Harness />)
  await waitFor(() => assert.ok(draft.getByText(/Draft preference, not published/)))
  assert.equal(draft.queryByRole('button', { name: 'Share' }), null)
  draft.unmount()
  const drawer = render(<Harness summaryCard />)
  await waitFor(() => assert.ok(drawer.getByRole('region', { name: 'Request summary' })))
  assert.equal(drawer.queryByRole('button', { name: /^Share customer info/ }), null)
  drawer.unmount()
  const loading = deferred<Response>()
  read = () => loading.promise
  const invalid = render(<Harness />)
  assert.equal(invalid.queryByRole('button', { name: /^Share customer info/ }), null)
  await act(async () => loading.resolve(Response.json({ request: fixture(85, true) })))
  await waitFor(() => assert.match(invalid.getByRole('alert').textContent!, /Invalid availability request/))
  assert.equal(invalid.queryByRole('button', { name: /^Share customer info/ }), null)
})
