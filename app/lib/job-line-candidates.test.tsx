import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test, { afterEach, beforeEach } from 'node:test'
import React from 'react'
import { cleanup, fireEvent, render, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { JSDOM } from 'jsdom'
import ts from 'typescript'

import { ARStatusPill } from '../components/workspace/availability.tsx'
import { RequestBody } from '../components/workspace/job-request.tsx'
import { RequestCard } from '../components/workspace/request-list-card.tsx'
import type { Candidate, JobRequestItem, JobRequestRow } from './rows.ts'

const require = createRequire(import.meta.url)
let dom: JSDOM
const originalFetch = globalThis.fetch

beforeEach(() => {
  dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/requests' })
  const win = dom.window
  Object.defineProperty(win.HTMLElement.prototype, 'attachEvent', { configurable: true, value() {} })
  Object.defineProperty(win.HTMLElement.prototype, 'detachEvent', { configurable: true, value() {} })
  for (const [key, value] of Object.entries({
    window: win, self: win, document: win.document, navigator: win.navigator,
    HTMLElement: win.HTMLElement, HTMLButtonElement: win.HTMLButtonElement, Node: win.Node,
    MouseEvent: win.MouseEvent, KeyboardEvent: win.KeyboardEvent, CustomEvent: win.CustomEvent,
    getComputedStyle: win.getComputedStyle,
    requestAnimationFrame: (callback: FrameRequestCallback) => setTimeout(callback, 0),
    IS_REACT_ACT_ENVIRONMENT: true,
  })) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
})

afterEach(() => {
  cleanup()
  Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: originalFetch })
  dom.window.close()
})

const candidate = (changes: Partial<Candidate>): Candidate => ({
  id: 1, supplierId: 1, supplierName: 'Austin Plant Supply',
  name: 'Live Oak', size: '15 G', description: null, isOriginal: false,
  unitPrice: 0, availableQuantity: null, status: null, arId: null, arStatus: null,
  noteForSupplier: null, noteFromSupplier: null, noteForCustomer: null, ...changes,
})

// One of each status: No price, Pending (unasked and on a draft), AR sent,
// an answer on an open AR, a submitted answer, and the selected candidate.
const oak: JobRequestItem = {
  id: 51, name: 'Live Oak', size: '30 G', quantity: 12, availableQuantity: null, unitPrice: 210, total: null,
  status: 'pending', notes: [], noteForCustomer: '15 G NA, only 30 G', noteInternal: null, updatedAt: null,
  selectedCandidateId: 2,
  candidates: [
    candidate({ id: 1, isOriginal: true }),
    candidate({ id: 2, size: '30 G', description: '30 G Live Oak', unitPrice: 210, noteForCustomer: '15 G NA, only 30 G' }),
    candidate({ id: 4, size: '45 G', unitPrice: 300, arId: 40, arStatus: 'draft' }),
    candidate({ id: 5, size: '65 G', unitPrice: 520, arId: 41, arStatus: 'new' }),
    candidate({ id: 3, supplierId: 2, supplierName: 'Acosta Farms', unitPrice: 0,
      arId: 43, arStatus: 'submitted', status: 'unavailable', noteFromSupplier: 'Sold out' }),
    candidate({ id: 7, supplierId: 2, supplierName: 'Acosta Farms', size: '45 G', unitPrice: 310,
      arId: 44, arStatus: 'processing', status: 'available' }),
  ],
}
const elm: JobRequestItem = {
  id: 52, name: 'Cedar Elm', size: '15 G', quantity: 4, availableQuantity: null, unitPrice: null, total: null,
  status: 'pending', notes: [], noteForCustomer: null, noteInternal: null, updatedAt: null, selectedCandidateId: null,
  candidates: [candidate({ id: 6, name: 'Cedar Elm', unitPrice: 80 })],
}

const request = (): JobRequestRow => ({
  id: 19, name: 'Oak Grove', status: 'quoted', customer: null,
  billing: { address: null, city: null, state: null, zip: null },
  shipping: { address: null, city: null, state: null, zip: null },
  noteForCustomer: null, notes: [], noteInternal: null, itemCount: 2, statusCounts: {}, lineTotal: 0,
  supplierLinks: [
    { supplierId: 1, name: 'Austin Plant Supply', lpsPartner: true, rosieThreadId: null,
      availabilityRequests: [{ id: 41, status: 'new' }, { id: 40, status: 'draft' }, { id: 39, status: 'closed' }] },
    { supplierId: 2, name: 'Acosta Farms', lpsPartner: false, rosieThreadId: null,
      availabilityRequests: [{ id: 43, status: 'submitted' }] },
  ],
  items: [oak, elm], createdAt: null, updatedAt: null,
})

/** A DataTransfer stand-in that remembers what the pill put on it. */
function transfer() {
  const data = new Map<string, string>()
  return {
    setData: (type: string, value: string) => { data.set(type, value) },
    getData: (type: string) => data.get(type) ?? '',
    get types() { return [...data.keys()] },
    effectAllowed: 'move', dropEffect: 'move',
  }
}

type Call = { url: string; method: string; body: unknown }

function setup() {
  const calls: Call[] = []
  globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
    const path = String(url)
    if (path === '/api/availability-requests/suppliers') {
      return Response.json({ suppliers: [{ id: 2, name: 'Acosta Farms' }, { id: 1, name: 'Austin Plant Supply' }] })
    }
    if (init?.method && init.method !== 'GET') {
      calls.push({ url: path, method: init.method, body: init.body ? JSON.parse(String(init.body)) : null })
      return Response.json({ ok: true, id: 77 })
    }
    return Response.json({})
  }) as typeof fetch
  let saved = 0
  const view = render(<RequestCard request={request()} expanded mobile={false} selected={new Set()} version={0}
    onToggle={() => {}} onSelect={() => {}} onDelete={() => {}} onDeleteItem={() => {}} onSaved={() => { saved += 1 }} />)
  const pill = (id: number) => view.container.querySelector<HTMLElement>(`[data-candidate="${id}"]`)!
  return { view, calls, pill, saved: () => saved }
}

test('pills show only description and price; supplier, notes and status are colour and hover', () => {
  const { view, pill } = setup()
  const list = view.getByRole('list', { name: 'Candidates for Live Oak' })
  assert.equal(within(list).queryByText('APS'), null, 'no supplier labels in the table')
  assert.equal(within(list).queryByText('Acosta Farms'), null)
  assert.deepEqual([...list.querySelectorAll('[data-candidate]')].map((p) => p.getAttribute('data-candidate')),
    ['1', '4', '5', '3', '7'], 'grouped by supplier')

  assert.equal(pill(1).textContent, '15 G Live OakNo price', 'description falls back to size + name')
  assert.equal(pill(5).textContent, '65 G Live Oak$520.00')
  assert.equal(pill(3).textContent, '15 G Live OakNo price', 'notes stay off the pill')
  assert.match(pill(3).title, /Acosta Farms/)
  assert.match(pill(3).title, /Supplier reply: Sold out/)
  for (const id of [1, 3, 4, 5]) assert.doesNotMatch(pill(id).textContent!, /Pending|AR sent|Unavailable/)

  const status = (id: number) => pill(id).title.match(/Status: ([^\n]*)/)![1]
  assert.equal(status(1), 'No price')
  assert.equal(status(4), 'Pending (AR-40)', 'a candidate on an unsent draft is still Pending')
  assert.equal(status(5), 'AR sent (AR-41)')
  assert.equal(status(3), 'Unavailable (AR-43)', 'an answer wins over its zero price')
  assert.equal(status(7), 'Available (AR-44)')
  assert.match(pill(1).title, /Original request/)
  assert.ok(pill(1).querySelector('[data-original-dot]'), 'the original request carries a dot')
  for (const id of [3, 4, 5, 7]) assert.equal(pill(id).querySelector('[data-original-dot]'), null)
  for (const id of [1, 3, 4]) assert.doesNotMatch(pill(id).className, /border-dotted/, 'not sent, or submitted: solid')
  for (const id of [5, 7]) assert.match(pill(id).className, /border-dotted/, 'out with the supplier: dotted')
  const tone = (id: number) => pill(id).style.background
  assert.equal(tone(5), tone(4), 'AR sent stays grey like Pending')
  assert.equal(tone(1), tone(4), 'No price is grey too; the price cell says it')
  assert.notEqual(tone(7), tone(5), 'an answer on an open AR takes its colour')
  assert.notEqual(tone(3), tone(4))
})

test('the selected candidate appears only in the Selected column', () => {
  const { view } = setup()
  const selectedCell = view.getByLabelText('Selected candidate for Live Oak')
  const pills = selectedCell.querySelectorAll('[data-candidate]')
  assert.deepEqual([...pills].map((p) => p.getAttribute('data-candidate')), ['2'])
  assert.equal(pills[0].textContent, '30 G Live Oak$210.00', 'the same description + price pill')
  assert.match((pills[0] as HTMLElement).title, /Note for customer: 15 G NA, only 30 G/)
  assert.equal(within(view.getByRole('list', { name: 'Candidates for Live Oak' }))
    .queryByText('30 G Live Oak'), null)
  assert.ok(within(view.getByLabelText('Selected candidate for Cedar Elm')).getByText('Drop a candidate'))
})

test('drop on Selected selects; another line\'s pill is refused; the bin deletes while dragging', async () => {
  const { view, calls, pill, saved } = setup()
  const dt = transfer()
  fireEvent.dragStart(pill(1), { dataTransfer: dt })
  assert.deepEqual(JSON.parse(dt.getData('application/x-lps-candidate')), { id: 1, itemId: 51, supplierId: 1 })
  assert.ok(dt.types.includes('application/x-lps-supplier-1'))
  fireEvent.drop(view.getByLabelText('Selected candidate for Cedar Elm'), { dataTransfer: dt })
  assert.deepEqual(calls, [], 'a pill cannot be selected on another line')
  fireEvent.drop(view.getByLabelText('Selected candidate for Live Oak'), { dataTransfer: dt })
  await waitFor(() => assert.equal(saved(), 1))
  assert.deepEqual(calls, [{ url: '/api/requests/19/items/51/candidates/1', method: 'POST', body: { action: 'select' } }])
  fireEvent.dragEnd(pill(1), { dataTransfer: dt })

  assert.equal(view.queryByLabelText('Delete candidate from Live Oak'), null)
  const drag = transfer()
  fireEvent.dragStart(pill(3), { dataTransfer: drag })
  assert.equal(view.queryByLabelText('Delete candidate from Cedar Elm'), null, 'only the dragged pill\'s line shows a bin')
  fireEvent.drop(view.getByLabelText('Delete candidate from Live Oak'), { dataTransfer: drag })
  await waitFor(() => assert.equal(calls.length, 2))
  assert.deepEqual(calls[1], { url: '/api/requests/19/items/51/candidates/3', method: 'DELETE', body: null })
  fireEvent.dragEnd(pill(3), { dataTransfer: drag })
  assert.equal(view.queryByLabelText('Delete candidate from Live Oak'), null)
})

test('dropping a candidate on its supplier in the header adds it to their newest open AR', async () => {
  const { view, calls, pill } = setup()
  const aps = view.container.querySelector<HTMLElement>('[data-supplier-pill="1"]')!
  const acosta = view.container.querySelector<HTMLElement>('[data-supplier-pill="2"]')!

  const other = transfer()
  fireEvent.dragStart(pill(3), { dataTransfer: other })
  assert.equal(fireEvent.dragOver(aps, { dataTransfer: other }), true, 'another supplier\'s pill is not accepted')
  fireEvent.drop(aps, { dataTransfer: other })
  assert.deepEqual(calls, [])
  // Acosta's only AR is submitted: it still takes the candidate (and reopens as New).
  assert.equal(fireEvent.dragOver(acosta, { dataTransfer: other }), false)
  fireEvent.drop(acosta, { dataTransfer: other })
  await waitFor(() => assert.equal(calls.length, 1))
  assert.deepEqual(calls[0], { url: '/api/requests/19/items/51/candidates/3', method: 'POST', body: { action: 'add', arId: 43 } })
  fireEvent.dragEnd(pill(3), { dataTransfer: other })

  const same = transfer()
  fireEvent.dragStart(pill(6), { dataTransfer: same })
  assert.equal(fireEvent.dragOver(aps, { dataTransfer: same }), false, 'same supplier: dragover accepted')
  fireEvent.drop(aps, { dataTransfer: same })
  await waitFor(() => assert.equal(calls.length, 2))
  assert.deepEqual(calls[1], { url: '/api/requests/19/items/52/candidates/6', method: 'POST', body: { action: 'add', arId: 41 } },
    'the newest AR that is not closed')
  assert.equal(view.container.querySelector('[data-job-ar-strip]'), null, 'no AR row above the table')
  assert.equal(view.queryByRole('button', { name: 'Create AR' }), null)
})

test('supplier AR tabs: one per AR, colour-coded by status, and take that supplier\'s candidates', async () => {
  const { view: card, calls } = setup()
  card.unmount()
  const view = render(<RequestBody request={request()} version={0} detailsOpen={false} onToggleDetails={() => {}}
    compactJobDetails supplierTabs onSaved={() => {}} />)
  const tabs = within(view.getByRole('tablist', { name: 'Job request' })).getAllByRole('tab')
  assert.deepEqual(tabs.map((tab) => tab.getAttribute('aria-label') ?? tab.textContent), [
    'Request items', 'Orders',
    'AR-43 · Acosta Farms — Completed',
    'AR-41 · Austin Plant Supply — New', 'AR-40 · Austin Plant Supply — Draft', 'AR-39 · Austin Plant Supply — Closed',
  ], 'most recently engaged supplier first')
  const dot = (tab: HTMLElement) => tab.querySelector<HTMLElement>('[aria-hidden="true"]')!.style.background
  assert.equal(dot(tabs[2]), 'var(--lps-tone-green-dot)')
  assert.equal(dot(tabs[3]), 'var(--lps-tone-amber-dot)')
  assert.equal(dot(tabs[4]), 'var(--lps-tone-grey-dot)')

  const acosta = transfer()
  fireEvent.dragStart(view.container.querySelector<HTMLElement>('[data-candidate="3"]')!, { dataTransfer: acosta })
  assert.equal(fireEvent.dragOver(tabs[3], { dataTransfer: acosta }), true, 'another supplier\'s tab is not accepted')
  assert.equal(fireEvent.dragOver(tabs[2], { dataTransfer: acosta }), false)
  fireEvent.drop(tabs[2], { dataTransfer: acosta })
  await waitFor(() => assert.equal(calls.length, 1))
  assert.deepEqual(calls[0], { url: '/api/requests/19/items/51/candidates/3', method: 'POST', body: { action: 'add', arId: 43 } })

  const closed = transfer()
  fireEvent.dragStart(view.container.querySelector<HTMLElement>('[data-candidate="6"]')!, { dataTransfer: closed })
  fireEvent.drop(tabs[5], { dataTransfer: closed })
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.equal(calls.length, 1, 'a closed AR must be reopened before it takes candidates')
})

test('a draft AR uses Publish; published status pickers allow returning to Draft', () => {
  const draft = render(<ARStatusPill status="draft" onChange={() => {}} />)
  assert.equal(draft.queryByRole('combobox'), null)
  assert.ok(draft.getByText('Draft'))
  draft.unmount()
  const open = render(<ARStatusPill status="new" onChange={() => {}} />)
  assert.deepEqual([...open.getByRole('combobox').querySelectorAll('option')].map((o) => o.getAttribute('value')),
    ['draft', 'new', 'processing', 'submitted', 'closed'])
})

function loadRoute(path: string, mocks: Record<string, unknown>) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } })
  const module = { exports: {} as Record<string, (req: Request, ctx: unknown) => Promise<Response>> }
  const all: Record<string, unknown> = { 'next/server': { NextResponse: Response }, ...mocks }
  new Function('require', 'module', 'exports', outputText)((name: string) => name in all ? all[name] : require(name), module, module.exports)
  return module.exports
}

const jsonRequest = (method: string, body?: unknown) =>
  new Request('https://lps.example/x', { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })

test('candidate route validates ids and actions and maps results to statuses', async () => {
  const calls: unknown[][] = []
  let result: unknown = true
  const record = (name: string) => async (...args: number[]) => {
    calls.push([name, ...args])
    if (result instanceof Error) throw result
    return result
  }
  const { POST, DELETE } = loadRoute('../app/api/requests/[id]/items/[itemId]/candidates/[candidateId]/route.ts', {
    '@/lib/job-request-queries': { selectCandidate: record('select'), addCandidateToRequest: record('add'), deleteCandidate: record('delete') },
  })
  const ctx = (candidateId = '7') => ({ params: Promise.resolve({ id: '19', itemId: '51', candidateId }) })
  for (const [body, id] of [[{ action: 'select' }, 'abc'], [{ action: 'request' }], [{ action: 'add' }], [{ action: 'add', arId: 'x' }], [{}]] as const) {
    assert.equal((await POST(jsonRequest('POST', body), ctx(id))).status, 400)
  }
  assert.deepEqual(calls, [])
  assert.equal((await POST(jsonRequest('POST', { action: 'select' }), ctx())).status, 200)
  assert.equal((await POST(jsonRequest('POST', { action: 'add', arId: 40 }), ctx())).status, 200)
  result = false
  assert.equal((await POST(jsonRequest('POST', { action: 'add', arId: 40 }), ctx())).status, 404)
  result = new Error('Candidate supplier must match the request supplier')
  const failed = await POST(jsonRequest('POST', { action: 'add', arId: 40 }), ctx())
  assert.equal(failed.status, 500)
  assert.match((await failed.json()).error, /must match/)
  result = true
  assert.equal((await DELETE(jsonRequest('DELETE'), ctx())).status, 200)
  result = false
  assert.equal((await DELETE(jsonRequest('DELETE'), ctx())).status, 404)
  assert.equal((await DELETE(jsonRequest('DELETE'), ctx('x'))).status, 400)
  assert.deepEqual(calls.slice(0, 2), [['select', 19, 51, 7], ['add', 19, 51, 7, 40]])
})
