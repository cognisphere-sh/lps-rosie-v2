import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test, { afterEach, beforeEach } from 'node:test'
import React from 'react'
import { act, cleanup, fireEvent, render, waitFor, within } from '@testing-library/react'
import { JSDOM } from 'jsdom'
import ts from 'typescript'

import { useJobUpdates } from './use-job-updates.ts'
import { usePartnerUpdates } from './use-partner-updates.ts'
import { availabilityRequestStatusChanged } from './chat-bus.ts'
import type { JobRequestRow } from './rows.ts'

const require = createRequire(import.meta.url)
let dom: JSDOM
let params = new URLSearchParams('jr=19')
const originalFetch = globalThis.fetch

class FakeEventSource {
  static instances: FakeEventSource[] = []
  onmessage: ((event: MessageEvent) => void) | null = null
  onopen: (() => void) | null = null
  closed = false
  constructor(readonly url: string) { FakeEventSource.instances.push(this) }
  close() { this.closed = true }
  send(value: unknown) { this.onmessage?.({ data: JSON.stringify(value) } as MessageEvent) }
}

const router = { replace() {}, push() {}, back() {} }
function loadPage(file: string): React.ComponentType {
  const source = readFileSync(new URL(file, import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } })
  const mocks: Record<string, unknown> = {
    'next/navigation': { useRouter: () => router, useSearchParams: () => params },
    '@/components/workspace/shell': {
      Shell: ({ children, focusedIntake, toolbar }: any) => <div>{toolbar?.(null)}{children}{focusedIntake?.savedPanel}</div>,
      JobsTopActions: () => null,
      useToast: () => () => {},
    },
  }
  const module = { exports: {} as { default: React.ComponentType } }
  new Function('require', 'module', 'exports', outputText)((name: string) => name in mocks ? mocks[name] : require(name), module, module.exports)
  return module.exports.default
}

const JobsPage = loadPage('../app/(workspace)/jobs/page.tsx')
const RequestsPage = loadPage('../app/(workspace)/requests/page.tsx')

beforeEach(() => {
  dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/jobs?jr=19', pretendToBeVisual: true })
  const win = dom.window
  // Wide enough that the Active jobs rail opens by default (FOCUSED_JOBS_RAIL_ROOM).
  Object.defineProperty(win, 'innerWidth', { configurable: true, value: 1440 })
  Object.defineProperty(win, 'matchMedia', { configurable: true, value: (query: string) => ({
    matches: query.includes('min-width'), media: query, addEventListener() {}, removeEventListener() {},
  }) })
  Object.defineProperties(win.HTMLElement.prototype, {
    attachEvent: { configurable: true, value() {} }, detachEvent: { configurable: true, value() {} },
    scrollTo: { configurable: true, value() {} }, scrollIntoView: { configurable: true, value() {} },
  })
  for (const [key, value] of Object.entries({
    window: win, self: win, document: win.document, navigator: win.navigator,
    sessionStorage: win.sessionStorage, localStorage: win.localStorage,
    HTMLElement: win.HTMLElement, HTMLInputElement: win.HTMLInputElement, HTMLButtonElement: win.HTMLButtonElement,
    Node: win.Node, CustomEvent: win.CustomEvent, getComputedStyle: win.getComputedStyle,
    requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 0),
    cancelAnimationFrame: (id: number) => clearTimeout(id), EventSource: FakeEventSource,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  FakeEventSource.instances = []
  params = new URLSearchParams('jr=19')
})

afterEach(() => { cleanup(); globalThis.fetch = originalFetch; dom.window.close() })
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const emit = () => act(() => { FakeEventSource.instances[0].send({ type: 'jobs' }) })
const batch = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 230)) })

function job(id = 19, name = 'Oak Grove'): JobRequestRow {
  return {
    id, name, status: 'quoted', customer: null,
    billing: { address: null, city: null, state: null, zip: null },
    shipping: { address: null, city: null, state: null, zip: null },
    noteForCustomer: null, noteInternal: null, notes: [],
    itemCount: 0, statusCounts: {}, lineTotal: 0, supplierLinks: [], items: [],
    createdAt: '2026-09-11T10:00:00Z', updatedAt: '2026-09-11T10:00:00Z',
  }
}

function withLine(request: JobRequestRow): JobRequestRow {
  return { ...request, status: 'quoted', itemCount: 1, lineTotal: 150, statusCounts: { available: 1 }, items: [{
    id: 100, name: 'Live oak from Rosie', size: '30 G', quantity: 3, availableQuantity: 3,
    unitPrice: 50, total: 150, status: 'available', notes: [], noteForCustomer: null, noteInternal: null, updatedAt: '2026-09-11T11:00:00Z',
  }] }
}

test('shared browser stream batches writes, ignores chat, catches changes during reads and reconnects', async () => {
  let calls = 0, otherCalls = 0
  let release!: () => void
  const pending = new Promise<void>((resolve) => { release = resolve })
  function Consumer() { useJobUpdates(async () => { calls++; if (calls === 1) await pending }); return null }
  function Other() { useJobUpdates(() => { otherCalls++ }); return null }
  const first = render(<Consumer />)
  const other = render(<Other />)
  assert.equal(FakeEventSource.instances.length, 1)
  const source = FakeEventSource.instances[0]
  act(() => { source.send({ type: 'thread' }); source.send(null) })
  await batch()
  assert.equal(calls, 0)
  for (let n = 0; n < 20; n++) emit()
  await batch()
  assert.equal(calls, 1); assert.equal(otherCalls, 1)
  emit(); emit()
  await batch()
  assert.equal(calls, 1)
  await act(async () => { release(); await pending })
  await batch()
  assert.equal(calls, 2)
  act(() => source.onopen?.())
  await batch()
  assert.equal(calls, 3)
  first.unmount()
  assert.equal(source.closed, false)
  other.unmount()
  assert.equal(source.closed, true)
  const before = calls
  act(() => source.onopen?.())
  await batch()
  assert.equal(calls, before)
})

test('hidden tabs catch up on return, failed reads retry and fallback polling resyncs', async (t) => {
  let calls = 0
  function Consumer() { useJobUpdates(async () => { if (++calls === 1) throw new Error('offline') }); return null }
  render(<Consumer />)
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
  emit(); await batch(); assert.equal(calls, 0)
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
  act(() => document.dispatchEvent(new dom.window.Event('visibilitychange')))
  await batch(); assert.equal(calls, 1)
  act(() => window.dispatchEvent(new dom.window.Event('online')))
  await batch(); assert.equal(calls, 2)
  cleanup()
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] })
  render(<Consumer />)
  await act(async () => { t.mock.timers.tick(60_000) })
  await act(async () => { t.mock.timers.tick(200) })
  assert.equal(calls, 3)
  cleanup(); t.mock.timers.reset()
})

test('partner consumers share the authorized URL, reconnect, and replace it when the supplier changes', async () => {
  const refreshed: number[] = []
  function Consumer({ id }: { id: number }) { usePartnerUpdates(id, () => { refreshed.push(id) }); return null }
  const first = render(<Consumer id={7} />)
  const other = render(<Consumer id={7} />)
  assert.equal(FakeEventSource.instances.length, 1)
  const source = FakeEventSource.instances[0]
  assert.equal(source.url, '/api/partner/7/events')
  act(() => source.onopen?.())
  await batch()
  assert.deepEqual(refreshed, [7, 7])
  first.rerender(<Consumer id={8} />)
  const next = FakeEventSource.instances[1]
  assert.equal(next.url, '/api/partner/8/events')
  other.unmount()
  assert.equal(source.closed, true)
  act(() => next.send({ type: 'jobs' }))
  await batch()
  assert.deepEqual(refreshed, [7, 7, 8])
  first.unmount()
  assert.equal(next.closed, true)
})

test('focused job updates rows, totals, status and sidebar without remounting a name draft', async () => {
  let saved = job(), inbox = [saved], detailReads = 0
  globalThis.fetch = (async (input) => {
    const url = String(input)
    if (url === '/api/job-inbox') return response({ jobs: inbox.map((row) => ({ ...row, customerCompany: null, customerContact: null, thread: null })) })
    if (url === '/api/requests/19') { detailReads++; return response({ request: saved }) }
    return response({})
  }) as typeof fetch
  const view = render(<JobsPage />)
  await waitFor(() => assert.ok(view.queryByRole('button', { name: /edit job name/i })))
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })
  fireEvent.click(view.getByRole('button', { name: /edit job name/i }))
  const draft = view.getByRole('textbox') as HTMLInputElement
  // React was imported before JSDOM, so dispatch through the rendered input
  // handler (its legacy change-event feature detection otherwise drops it).
  const propsKey = Object.keys(draft).find((key) => key.startsWith('__reactProps$'))!
  const props = (draft as unknown as Record<string, { onChange: (event: unknown) => void }>)[propsKey]
  act(() => props.onChange({ target: { value: 'My unsaved name' } }))
  assert.equal(draft.value, 'My unsaved name')
  const main = view.getByRole('main', { name: 'Selected job' })
  main.scrollTop = 185
  saved = withLine(saved)
  inbox = [saved, job(20, 'New job created by Rosie')]
  const before = detailReads
  for (let n = 0; n < 10; n++) emit()
  await waitFor(() => assert.ok(view.queryByText('Live oak from Rosie')))
  assert.equal(detailReads, before + 1)
  assert.equal(view.getByRole('textbox'), draft)
  assert.equal(draft.value, 'My unsaved name')
  assert.equal(main.scrollTop, 185)
  assert.match(main.textContent ?? '', /150/)
  assert.ok(view.getAllByText('Quote').length)
  assert.match(view.container.textContent ?? '', /New job created by Rosie/)
  saved = job()
  inbox = [saved]
  emit()
  await waitFor(() => assert.ok(!view.queryByText('Live oak from Rosie')))
})

test('focused job ignores a late read after switching jobs and keeps saved data on read failure', async () => {
  let hold = false, fail = false
  let resolveOld!: (value: Response) => void
  globalThis.fetch = (async (input) => {
    const url = String(input)
    if (url === '/api/job-inbox') return response({ jobs: [] })
    if (url === '/api/requests/19' && hold) return new Promise<Response>((resolve) => { resolveOld = resolve })
    if (url === '/api/requests/20' && fail) return response({ error: 'offline' }, 503)
    return response({ request: url.endsWith('/20') ? job(20, 'Second job') : job() })
  }) as typeof fetch
  const view = render(<JobsPage />)
  await waitFor(() => assert.ok(view.queryByRole('button', { name: /edit job name/i })))
  hold = true; emit(); await batch()
  params = new URLSearchParams('jr=20')
  view.rerender(<JobsPage />)
  await waitFor(() => assert.match(view.container.textContent ?? '', /Second job/))
  await act(async () => resolveOld(response({ request: job(19, 'Stale response') })))
  assert.doesNotMatch(view.container.textContent ?? '', /Stale response/)
  fail = true; emit()
  await waitFor(() => assert.match(view.container.textContent ?? '', /Showing the last saved data/))
  assert.match(view.container.textContent ?? '', /Second job/)
})

test('All jobs updates new jobs, changed rows and deletion with the saved filters intact', async () => {
  let jobs = [job()]
  const urls: string[] = []
  globalThis.fetch = (async (input) => {
    const url = String(input); urls.push(url)
    if (url.includes('facets=1')) return response({ facets: { size: [], customer: [] }, summary: { requests: jobs.length, items: jobs.reduce((n, row) => n + row.itemCount, 0) } })
    return response({ requests: jobs, total: jobs.length, pageCount: 1 })
  }) as typeof fetch
  sessionStorage.setItem('lps.requests.visit.v1', JSON.stringify({ status: ['Active', 'Quote'] }))
  const view = render(<RequestsPage />)
  await waitFor(() => assert.match(view.container.textContent ?? '', /Oak Grove/))
  const firstListUrl = urls.find((url) => !url.includes('facets=1'))
  jobs = [withLine(job()), job(20, 'New job created by Rosie')]
  emit()
  await waitFor(() => assert.match(view.container.textContent ?? '', /New job created by Rosie/))
  assert.equal(urls.filter((url) => !url.includes('facets=1')).at(-1), firstListUrl)
  assert.match(view.container.textContent ?? '', /150/)
  jobs = [jobs[1]]; emit()
  await waitFor(() => assert.doesNotMatch(view.container.textContent ?? '', /Oak Grove/))
})

test('a reserved job shows its saved record in the standard workspace as Rosie writes it', async () => {
  let saved: JobRequestRow | null = null
  sessionStorage.setItem('lps.jobs.intake.v1', JSON.stringify({ id: 19, returnUrl: '/requests' }))
  globalThis.fetch = (async (input) => String(input) === '/api/job-inbox'
    ? response({ jobs: [] })
    : saved ? response({ request: saved }) : response({ error: 'not found' }, 404)) as typeof fetch
  const view = render(<JobsPage />)
  await waitFor(() => assert.ok(view.queryByText('New job request · JR-19')))
  assert.ok(view.getByRole('main', { name: 'Selected job' }))
  assert.ok(view.getByRole('button', { name: 'Open Rosie' }))
  assert.equal(view.queryByRole('button', { name: 'Resume intake' }), null)
  assert.ok(sessionStorage.getItem('lps.jobs.intake.v1'))
  saved = withLine(job())
  emit()
  await waitFor(() => assert.ok(view.queryByText('Live oak from Rosie')))
  assert.ok(view.getByRole('button', { name: /edit job name/i }))
  assert.equal(view.queryByText('New job request · JR-19'), null)
  // The saved row commits before the passive effect clears its intake marker.
  await waitFor(() => assert.equal(sessionStorage.getItem('lps.jobs.intake.v1'), null))
  assert.equal(params.toString(), 'jr=19')
})

test('reserved intake shows newly saved records before any chat reply and stays in intake', async () => {
  let saved: JobRequestRow | null = null
  params = new URLSearchParams('jr=19&intake=1')
  sessionStorage.setItem('lps.jobs.intake.v1', JSON.stringify({ id: 19, returnUrl: '/requests' }))
  globalThis.fetch = (async (input) => String(input) === '/api/job-inbox'
    ? response({ jobs: [] })
    : saved ? response({ request: saved }) : response({ error: 'not found' }, 404)) as typeof fetch
  const view = render(<JobsPage />)
  await waitFor(() => assert.match(view.container.textContent ?? '', /Nothing has been saved/))
  saved = withLine(job())
  emit()
  await waitFor(() => assert.match(view.container.textContent ?? '', /Quote · 1 active line/))
  assert.match(view.container.textContent ?? '', /Saved so far/)
  assert.equal(params.get('intake'), '1')
  saved = null
  emit()
  await waitFor(() => assert.match(view.container.textContent ?? '', /Nothing has been saved/))
})

function changeSearch(input: HTMLInputElement, value: string) {
  const propsKey = Object.keys(input).find((key) => key.startsWith('__reactProps$'))!
  const props = (input as unknown as Record<string, { onChange: (event: unknown) => void }>)[propsKey]
  act(() => props.onChange({ target: { value } }))
}

test('inline save keeps the focused record and open details mounted while reconciling', async () => {
  let saved = job(), hold = false
  let release!: (value: Response) => void
  globalThis.fetch = (async (input, init) => {
    const url = String(input)
    if (url === '/api/job-inbox') return response({ jobs: [] })
    if (url === '/api/rows' && init?.method === 'PATCH') {
      saved = { ...saved, name: JSON.parse(String(init.body)).value }
      hold = true
      return response({})
    }
    if (url === '/api/requests/19' && hold) return new Promise<Response>((resolve) => { release = resolve })
    return response({ request: saved })
  }) as typeof fetch
  const view = render(<JobsPage />)
  await waitFor(() => assert.ok(view.queryByRole('button', { name: /edit job name/i })))
  const record = view.container.querySelector('[data-focused-job-record]')!
  const main = view.getByRole('main', { name: 'Selected job' })
  fireEvent.click(view.getByRole('button', { name: /Job details & notes/i }))
  main.scrollTop = 185
  fireEvent.click(view.getByRole('button', { name: /edit job name/i }))
  const input = view.getByRole('textbox', { name: /edit job name/i }) as HTMLInputElement
  changeSearch(input, 'Updated job name')
  fireEvent.blur(input)
  await waitFor(() => assert.ok(release))
  assert.equal(view.container.querySelector('[data-focused-job-record]'), record)
  assert.equal(view.queryByText('Checking this job…'), null)
  assert.equal(view.getByRole('button', { name: /Job details & notes/i }).getAttribute('aria-expanded'), 'true')
  await act(async () => release(response({ request: saved })))
  await waitFor(() => assert.ok(view.queryByText('Updated job name')))
  assert.equal(view.container.querySelector('[data-focused-job-record]'), record)
  assert.equal(view.getByRole('button', { name: /Job details & notes/i }).getAttribute('aria-expanded'), 'true')
  assert.equal(main.scrollTop, 185)
})

test('Active jobs search reaches plant/notes beyond a list page without fetching or changing the selected job', async () => {
  let inboxReads = 0, detailReads = 0
  const inbox = Array.from({ length: 31 }, (_, i) => ({
    ...job(19 + i, i === 0 ? 'Oak Grove' : `Project ${i}`),
    customerCompany: null, customerContact: null, thread: null,
    searchText: i === 30 ? 'JR-49\nProject 30\nMuskogee\nDo not substitute' : `JR-${19 + i}\nProject ${i}`,
  }))
  globalThis.fetch = (async (input) => {
    if (String(input) === '/api/job-inbox') { inboxReads++; return response({ jobs: inbox }) }
    if (String(input) === '/api/requests/19') { detailReads++; return response({ request: job() }) }
    return response({})
  }) as typeof fetch
  const view = render(<JobsPage />)
  await waitFor(() => assert.equal(view.container.querySelectorAll('[data-focused-job-rail-primary]').length, 31))
  await waitFor(() => assert.ok(view.queryByRole('button', { name: /edit job name/i })))
  const search = view.getByRole('searchbox', { name: 'Search active jobs' }) as HTMLInputElement
  const main = view.getByRole('main', { name: 'Selected job' })
  const allIds = [...view.container.querySelectorAll('[data-focused-job-rail-primary]')].map((row) => row.textContent)
  const beforeInbox = inboxReads, beforeDetail = detailReads
  search.focus()
  changeSearch(search, '  MUSKOGEE substitute ')
  assert.equal(view.container.querySelectorAll('[data-focused-job-rail-primary]').length, 1)
  assert.equal(view.container.querySelector('[data-focused-job-rail-primary]')?.textContent, 'Project 30')
  assert.equal(view.getByRole('status').textContent, '1 matching job')
  assert.equal(document.activeElement, search)
  assert.equal(view.getByRole('main', { name: 'Selected job' }), main)
  assert.match(main.textContent ?? '', /Oak Grove/)
  assert.equal(params.toString(), 'jr=19')
  assert.equal(inboxReads, beforeInbox); assert.equal(detailReads, beforeDetail)

  changeSearch(search, 'No such plant')
  assert.ok(view.getByText('No matching active jobs'))
  assert.equal(view.queryByText('No active jobs'), null)
  assert.match(main.textContent ?? '', /Oak Grove/)
  fireEvent.click(view.getByRole('button', { name: 'Collapse active jobs' }))
  fireEvent.click(view.getByRole('button', { name: 'Expand active jobs' }))
  assert.equal((view.getByRole('searchbox') as HTMLInputElement).value, 'No such plant')
  fireEvent.click(view.getByRole('button', { name: 'Clear job search' }))
  assert.equal(search.value, '')
  assert.equal(document.activeElement, search)
  assert.deepEqual([...view.container.querySelectorAll('[data-focused-job-rail-primary]')].map((row) => row.textContent), allIds)
  assert.equal(params.toString(), 'jr=19')
})

test('live note changes recompute Active jobs matches while keeping search text, focus and selected details', async () => {
  let searchText = 'JR-20\nSecond project\nCedar'
  globalThis.fetch = (async (input) => String(input) === '/api/job-inbox'
    ? response({ jobs: [{ ...job(20, 'Second project'), customerCompany: null, customerContact: null, thread: null, searchText }] })
    : response({ request: job() })) as typeof fetch
  const view = render(<JobsPage />)
  await waitFor(() => assert.ok(view.queryByRole('button', { name: /edit job name/i })))
  const search = view.getByRole('searchbox', { name: 'Search active jobs' }) as HTMLInputElement
  const main = view.getByRole('main', { name: 'Selected job' })
  search.focus()
  changeSearch(search, 'Magnolia')
  assert.ok(view.getByText('No matching active jobs'))
  searchText = 'JR-20\nSecond project\nCustomer requested Magnolia'
  emit()
  await waitFor(() => assert.equal(view.container.querySelector('[data-focused-job-rail-primary]')?.textContent, 'Second project'))
  assert.equal(view.getByRole('searchbox'), search)
  assert.equal(search.value, 'Magnolia')
  assert.equal(document.activeElement, search)
  assert.equal(view.getByRole('main', { name: 'Selected job' }), main)
  assert.match(main.textContent ?? '', /Oak Grove/)
  assert.equal(params.toString(), 'jr=19')
})

test('focused job AR tabs immediately receive status changes', async () => {
  const saved = { ...job(), supplierLinks: [{
    supplierId: 7, name: 'APS', lpsPartner: true, rosieThreadId: null,
    availabilityRequests: [{ id: 42, status: 'new', createdAt: '2026-09-01T12:00:00Z', submittedAt: null }],
  }] }
  globalThis.fetch = (async (input) => String(input) === '/api/job-inbox'
    ? response({ jobs: [] }) : response({ request: saved })) as typeof fetch
  const view = render(<JobsPage />)
  await waitFor(() => assert.ok(view.queryByRole('button', { name: /edit job name/i })))
  const main = view.getByRole('main', { name: 'Selected job' })
  assert.ok(within(main).getByRole('tab', { name: 'AR-42 · APS — New' }))
  act(() => availabilityRequestStatusChanged({ arId: 42, status: 'submitted', submittedAt: '2026-09-15T12:00:00Z' }))
  assert.ok(within(main).getByRole('tab', { name: 'AR-42 · APS — Completed' }))
  act(() => availabilityRequestStatusChanged({ arId: 42, status: 'new', submittedAt: null }))
  assert.ok(within(main).getByRole('tab', { name: 'AR-42 · APS — New' }))
})
