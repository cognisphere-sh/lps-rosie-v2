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
  unitPrice: null, availableQuantity: null, status: null, arId: null, arStatus: null,
  noteForSupplier: null, noteFromSupplier: null, noteForCustomer: null, ...changes,
})

// One of each status: No price, Pending (unasked and on a draft), AR sent,
// an answer on an open AR, a submitted answer, and the selected candidate.
// Candidate 1 is the line's default (0130).
const oak: JobRequestItem = {
  id: 51, name: 'Live Oak', size: '15 G', quantity: 12, availableQuantity: null, unitPrice: 210, total: null,
  status: 'pending', notes: [], noteForCustomer: '15 G NA, only 30 G', noteInternal: null, updatedAt: null,
  selectedCandidateId: 2, defaultCandidateId: 1,
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
  status: 'pending', notes: [], noteForCustomer: null, noteInternal: null, updatedAt: null, selectedCandidateId: 6,
  defaultCandidateId: 6, candidates: [candidate({ id: 6, name: 'Cedar Elm', isOriginal: true, unitPrice: 80 })],
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

function setup(req = request()) {
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
  const view = render(<RequestCard request={req} expanded mobile={false} selected={new Set()} version={0}
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
  assert.equal(pill(3).textContent, '15 G Live Oak$0.00', 'notes stay off the pill; $0 is a price (0143)')
  assert.match(pill(3).title, /Acosta Farms/)
  assert.match(pill(3).title, /Supplier reply: Sold out/)
  assert.match(pill(3).title, /Note for customer: Sold out\n/, 'with no override, the customer sees the supplier\'s reply')
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
  assert.match((pills[0] as HTMLElement).title, /Note for customer: 15 G NA, only 30 G \(ours\)/)
  assert.equal(within(view.getByRole('list', { name: 'Candidates for Live Oak' }))
    .queryByText('30 G Live Oak'), null)
  assert.deepEqual([...view.getByLabelText('Selected candidate for Cedar Elm').querySelectorAll('[data-candidate]')]
    .map((p) => p.getAttribute('data-candidate')), ['6'], 'an unpicked line shows its default')
})

test('the default candidate is never hidden or binned; dragging a selection off falls back to it', async () => {
  const { view, calls, pill } = setup()
  const dt = transfer()
  fireEvent.dragStart(pill(1), { dataTransfer: dt })
  assert.equal(view.queryByLabelText('Hide candidate on Live Oak'), null)
  assert.equal(view.queryByLabelText('Delete candidate from Live Oak'), null)
  assert.doesNotMatch(pill(1).title, /Hide|bin/)
  fireEvent.dragEnd(pill(1), { dataTransfer: dt })

  const off = transfer()
  fireEvent.dragStart(pill(2), { dataTransfer: off })
  fireEvent.drop(view.getByLabelText('Unselect candidate for Live Oak'), { dataTransfer: off })
  await waitFor(() => assert.equal(calls.length, 1))
  assert.deepEqual(calls[0], { url: '/api/requests/19/items/51/candidates/2', method: 'POST', body: { action: 'unselect' } })
  assert.deepEqual([...view.getByLabelText('Selected candidate for Live Oak').querySelectorAll('[data-candidate]')]
    .map((p) => p.getAttribute('data-candidate')), ['1'], 'the default takes the Selected cell at once')

  const fixed = transfer()
  fireEvent.dragStart(pill(6), { dataTransfer: fixed })
  assert.equal(view.queryByLabelText('Unselect candidate for Cedar Elm'), null, 'a selected default has nothing to fall back to')
})

const oakRow = (view: ReturnType<typeof render>) => view.container.querySelector<HTMLElement>('[data-line-row]')!

test('Size shows and edits the line\'s own ask; the customer note override can follow the supplier again', async () => {
  const req = request()
  req.items[0] = { ...oak, candidates: oak.candidates!.map((c) => c.id === 2 ? { ...c, noteFromSupplier: '30 G only' } : c) }
  const { view, calls } = setup(req)
  // Candidate 2 (30 G) is selected; the line still reads as asked.
  const size = within(oakRow(view)).getByText('15 G')
  fireEvent.click(size)
  const input = within(oakRow(view)).getByRole('textbox')
  assert.equal(input.getAttribute('value'), '15 G')
  const user = userEvent.setup({ document })
  await user.clear(input)
  await user.type(input, '36 G{Enter}')
  await waitFor(() => assert.equal(calls.length, 1))
  // `/api/rows` writes `job_request_items.size`, not the candidate.
  assert.deepEqual(calls[0], { url: '/api/rows', method: 'PATCH', body: { table: 'job_request_items', id: 51, column: 'size', value: '36 G' } })
  const hint = within(oakRow(view)).getByLabelText('Supplier\'s note')
  assert.ok(hint.querySelector('svg'), 'an inline ! sits before the note')
  const tip = document.getElementById(hint.getAttribute('aria-describedby')!)!
  assert.ok(tip.hidden, 'the tooltip waits for hover')
  fireEvent.pointerEnter(hint)
  assert.ok(!tip.hidden && /30 G only/.test(tip.textContent ?? ''), 'the supplier\'s note shows on hover')
  fireEvent.pointerLeave(hint)
  assert.ok(tip.hidden)
  fireEvent.click(hint)
  assert.equal(calls.length, 1, 'clicking the ! writes nothing')
  assert.equal(view.queryAllByLabelText('Supplier\'s note').length, 1, 'only an overridden line shows it')
  assert.equal(view.queryByRole('button', { name: 'Use supplier\'s note' }), null, 'the button is gone')
})

test('the supplier\'s-note ! shows only when the supplier left a note', () => {
  const { view } = setup()
  assert.equal(view.queryByLabelText('Supplier\'s note'), null, 'overridden, but the supplier said nothing')
})

// A substitute line (0130): candidate 2 is another plant at another size.
const substitute = () => {
  const req = request()
  req.items[0] = { ...oak, candidates: oak.candidates!.map((c) => c.id === 2 ? { ...c, name: 'Quercus virginiana' } : c) }
  return req
}

test('a substitute line still shows and edits the customer\'s size and name, with no header eyes', async () => {
  const { view, calls } = setup(substitute())
  const row = oakRow(view)
  within(row).getByText('15 G')
  const name = within(row).getByText('Live Oak', { selector: '[title="Click to edit"]' })
  for (const eye of ['Show requested size', 'Show requested name']) assert.equal(view.queryByRole('button', { name: eye }), null)
  fireEvent.click(name)
  const input = within(row).getByRole('textbox')
  assert.equal(input.getAttribute('value'), 'Live Oak')
  const user = userEvent.setup({ document })
  await user.clear(input)
  await user.type(input, 'Quercus fusiformis{Enter}')
  await waitFor(() => assert.equal(calls.length, 1))
  assert.deepEqual(calls[0], { url: '/api/rows', method: 'PATCH', body: { table: 'job_request_items', id: 51, column: 'name', value: 'Quercus fusiformis' } })
})

test('phone cards show the customer\'s size and name too', () => {
  const view = render(<RequestBody request={substitute()} version={0} detailsOpen={false} onToggleDetails={() => {}} onSaved={() => {}} mobile />)
  const card = view.container.querySelector<HTMLElement>('[data-line-card]')!
  within(card).getByText('Live Oak', { selector: '[title="Click to edit"]' })
  within(card).getByText('15 G', { selector: '[title="Click to edit"]' })
})

test('drop on Selected selects; another line\'s pill is refused; the bin deletes while dragging', async () => {
  const { view, calls, pill, saved } = setup()
  const dt = transfer()
  fireEvent.dragStart(pill(1), { dataTransfer: dt })
  assert.deepEqual(JSON.parse(dt.getData('application/x-lps-candidate')), { id: 1, itemId: 51, supplierId: 1, arId: null })
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
  assert.equal(view.container.querySelector('[data-candidate="3"]'), null, 'the binned pill leaves at once')
  assert.equal(view.queryByLabelText('Delete candidate from Live Oak'), null)
})

test('a drop that moves the pill ends the drag: no bin is left behind', async () => {
  const { view, calls, pill } = setup()
  const dt = transfer()
  fireEvent.dragStart(pill(4), { dataTransfer: dt })
  assert.ok(view.getByLabelText('Delete candidate from Live Oak'))
  // The pill moves to Selected, so its dragend never reaches React.
  fireEvent.drop(view.getByLabelText('Selected candidate for Live Oak'), { dataTransfer: dt })
  await waitFor(() => assert.equal(calls.length, 1))
  assert.ok(!view.queryByLabelText('Delete candidate from Live Oak'))
  assert.ok(!view.queryByLabelText('Hide candidate on Live Oak'))
})

test('hidden candidates: the Candidates header eye lists them; dragging offers Hide / Unhide', async () => {
  const req = request()
  req.items[0] = { ...oak, candidates: [...oak.candidates!, candidate({ id: 8, size: '24 Box', description: '24 Box Live Oak', unitPrice: 900, hidden: true })] }
  const { view, calls, pill } = setup(req)
  const list = () => view.getByRole('list', { name: 'Candidates for Live Oak' })
  assert.ok(!within(list()).queryByText('24 Box Live Oak'), 'hidden by default')

  fireEvent.click(view.getByRole('button', { name: 'Show hidden candidates' }))
  assert.ok(within(list()).getByText('24 Box Live Oak'))
  assert.match(pill(8).title, /Hidden from the line table/)
  const unhide = transfer()
  fireEvent.dragStart(pill(8), { dataTransfer: unhide })
  fireEvent.drop(view.getByLabelText('Unhide candidate on Live Oak'), { dataTransfer: unhide })
  await waitFor(() => assert.equal(calls.length, 1))
  assert.deepEqual(calls[0], { url: '/api/requests/19/items/51/candidates/8', method: 'POST', body: { action: 'unhide' } })
  fireEvent.dragEnd(pill(8), { dataTransfer: unhide })

  fireEvent.click(view.getByRole('button', { name: 'Hide hidden candidates' }))
  const hide = transfer()
  fireEvent.dragStart(pill(4), { dataTransfer: hide })
  fireEvent.drop(view.getByLabelText('Hide candidate on Live Oak'), { dataTransfer: hide })
  await waitFor(() => assert.equal(calls.length, 2))
  assert.deepEqual(calls[1], { url: '/api/requests/19/items/51/candidates/4', method: 'POST', body: { action: 'hide' } })
  assert.ok(!view.container.querySelector('[data-candidate="4"]'), 'the hidden pill leaves at once')
  assert.ok(!view.queryByLabelText('Hide candidate on Live Oak'), 'and the drag ends with it')
})

// An unasked Acosta candidate: only unasked candidates can join an AR.
const withUnaskedAcosta = () => {
  const req = request()
  req.items[0] = { ...oak, candidates: [...oak.candidates!, candidate({ id: 9, supplierId: 2, supplierName: 'Acosta Farms', size: '30 G', unitPrice: 250 })] }
  return req
}

test('dropping a candidate on its supplier in Related adds it to their newest open AR', async () => {
  const { view, calls, pill } = setup(withUnaskedAcosta())
  assert.equal(view.container.querySelector('[data-request-card-head] [data-supplier-pill]'), null, 'no supplier pills in the card header')
  fireEvent.click(view.getByRole('button', { name: 'Job details & notes' }))
  const aps = view.container.querySelector<HTMLElement>('[data-supplier-pill="1"]')!
  const acosta = view.container.querySelector<HTMLElement>('[data-supplier-pill="2"]')!

  const other = transfer()
  fireEvent.dragStart(pill(3), { dataTransfer: other })
  assert.equal(fireEvent.dragOver(aps, { dataTransfer: other }), true, 'another supplier\'s pill is not accepted')
  fireEvent.drop(aps, { dataTransfer: other })
  assert.deepEqual(calls, [])
  // Acosta's only AR is submitted: nothing reopens it by itself, so LPS confirms "Reopen and add".
  const asked: string[] = []
  dom.window.confirm = (message?: string) => { asked.push(String(message)); return asked.length > 1 }
  // A pill already on an AR cannot join one: no confirm, nothing reopened.
  assert.equal(fireEvent.dragOver(acosta, { dataTransfer: other }), false)
  fireEvent.drop(acosta, { dataTransfer: other })
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.deepEqual([asked, calls], [[], []], 'an asked pill is refused before any reopen')
  fireEvent.dragEnd(pill(3), { dataTransfer: other })
  const unasked = transfer()
  fireEvent.dragStart(pill(9), { dataTransfer: unasked })
  fireEvent.drop(acosta, { dataTransfer: unasked })
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.deepEqual(calls, [], 'declined: nothing is reopened or added')
  fireEvent.drop(acosta, { dataTransfer: unasked })
  await waitFor(() => assert.equal(calls.length, 1))
  assert.match(asked[0], /AR-43 is Completed\. Reopen it as New and add this candidate\?/)
  assert.deepEqual(calls[0], { url: '/api/requests/19/items/51/candidates/9', method: 'POST', body: { action: 'add', arId: 43, reopen: true } })
  fireEvent.dragEnd(pill(9), { dataTransfer: unasked })

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
  const view = render(<RequestBody request={withUnaskedAcosta()} version={0} detailsOpen={false} onToggleDetails={() => {}}
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

  dom.window.confirm = () => true
  const acosta = transfer()
  fireEvent.dragStart(view.container.querySelector<HTMLElement>('[data-candidate="9"]')!, { dataTransfer: acosta })
  assert.equal(fireEvent.dragOver(tabs[3], { dataTransfer: acosta }), true, 'another supplier\'s tab is not accepted')
  assert.equal(fireEvent.dragOver(tabs[2], { dataTransfer: acosta }), false)
  fireEvent.drop(tabs[2], { dataTransfer: acosta })
  await waitFor(() => assert.equal(calls.length, 1))
  assert.deepEqual(calls[0], { url: '/api/requests/19/items/51/candidates/9', method: 'POST', body: { action: 'add', arId: 43, reopen: true } })

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
    '@/lib/job-request-queries': {
      selectCandidate: record('select'), addCandidateToRequest: record('add'), deleteCandidate: record('delete'),
      setCandidateHidden: async (...args: unknown[]) => { calls.push(['hidden', ...args]); return true },
    },
  })
  const ctx = (candidateId = '7') => ({ params: Promise.resolve({ id: '19', itemId: '51', candidateId }) })
  for (const [body, id] of [[{ action: 'select' }, 'abc'], [{ action: 'request' }], [{ action: 'add' }], [{ action: 'add', arId: 'x' }], [{}]] as const) {
    assert.equal((await POST(jsonRequest('POST', body), ctx(id))).status, 400)
  }
  assert.deepEqual(calls, [])
  assert.equal((await POST(jsonRequest('POST', { action: 'select' }), ctx())).status, 200)
  assert.equal((await POST(jsonRequest('POST', { action: 'add', arId: 40 }), ctx())).status, 200)
  assert.equal((await POST(jsonRequest('POST', { action: 'add', arId: 40, reopen: true }), ctx())).status, 200)
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
  assert.deepEqual(calls.slice(0, 3), [['select', 19, 51, 7], ['add', 19, 51, 7, 40, false], ['add', 19, 51, 7, 40, true]])
  calls.length = 0
  assert.equal((await POST(jsonRequest('POST', { action: 'hide' }), ctx())).status, 200)
  assert.equal((await POST(jsonRequest('POST', { action: 'unhide' }), ctx())).status, 200)
  assert.deepEqual(calls, [['hidden', 19, 51, 7, true], ['hidden', 19, 51, 7, false]])
})
