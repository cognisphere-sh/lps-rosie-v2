import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test, { afterEach, before, beforeEach } from 'node:test'
import React from 'react'
import { JSDOM } from 'jsdom'

// React DOM checks for a DOM once, on import; without one it never wires input
// change events (fireEvent.change is lost). Install a DOM before importing it.
type Rtl = typeof import('@testing-library/react')
let act: Rtl['act'], cleanup: Rtl['cleanup'], fireEvent: Rtl['fireEvent'], render: Rtl['render'], waitFor: Rtl['waitFor']
let EditableText: typeof import('../components/workspace/editable')['EditableText']
let JobLinePrice: typeof import('../components/workspace/job-line-price')['JobLinePrice']

let dom: JSDOM
const originalFetch = globalThis.fetch
before(async () => {
  installDom()
  ;({ act, cleanup, fireEvent, render, waitFor } = await import('@testing-library/react'))
  ;({ EditableText } = await import('../components/workspace/editable'))
  ;({ JobLinePrice } = await import('../components/workspace/job-line-price'))
  dom.window.close()
})
beforeEach(installDom)
function installDom() {
  dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/jobs?jr=121' })
  const win = dom.window
  Object.defineProperty(win.HTMLElement.prototype, 'attachEvent', { configurable: true, value() {} })
  Object.defineProperty(win.HTMLElement.prototype, 'detachEvent', { configurable: true, value() {} })
  for (const [key, value] of Object.entries({
    window: win, self: win, document: win.document, navigator: win.navigator,
    HTMLElement: win.HTMLElement, HTMLButtonElement: win.HTMLButtonElement, Node: win.Node,
    MouseEvent: win.MouseEvent, KeyboardEvent: win.KeyboardEvent, getComputedStyle: win.getComputedStyle,
    requestAnimationFrame: (callback: FrameRequestCallback) => setTimeout(callback, 0),
    IS_REACT_ACT_ENVIRONMENT: true,
  })) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  // Every test must install its own transport; no real DB/API calls are permitted.
  globalThis.fetch = (async () => { throw new Error('Unexpected fetch') }) as typeof fetch
}
afterEach(() => {
  cleanup()
  globalThis.fetch = originalFetch
  dom.window.close()
})

const props = {
  requestId: 121, itemId: 1349, selectedCandidateId: 2115, name: 'Shrub Live Oak', value: null as number | null,
  onSaved: () => {},
}
const label = 'Unit price for Shrub Live Oak'
const refreshed = (price: number | null, candidate = 2115, item = 1349, job = 121) => Response.json({
  request: { id: job, items: [{ id: item, selectedCandidateId: candidate, unitPrice: price }] },
})
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}
// Compare the status text, not the element: a failing assert.equal on a JSDOM
// node inspects the whole window and runs out of memory inside waitFor.
const settled = (view: ReturnType<typeof render>) => assert.equal(view.queryByRole('status')?.textContent, undefined)
function enter(view: ReturnType<typeof render>, next: string) {
  fireEvent.click(view.getByRole('button', { name: label }))
  const input = view.getByRole('spinbutton', { name: label })
  fireEvent.change(input, { target: { value: next } })
  fireEvent.keyDown(input, { key: 'Enter' })
}

test('same NULL after typed 0 settles as unknown only after authoritative refresh completes', async () => {
  const write = deferred<Response>()
  const read = deferred<Response>()
  const calls: Array<{ url: string; body?: unknown }> = []
  globalThis.fetch = (async (url, init) => {
    calls.push({ url: String(url), body: init?.body ? JSON.parse(String(init.body)) : undefined })
    return init?.method === 'PATCH' ? write.promise : read.promise
  }) as typeof fetch
  let saved = 0
  const view = render(<JobLinePrice {...props} onSaved={() => { saved++ }} />)
  enter(view, '0')
  await waitFor(() => assert.equal(calls.length, 1))
  assert.deepEqual(calls[0].body, { table: 'job_request_items', id: 1349, column: 'unit_price', value: '0' })
  assert.match(view.getByRole('status').textContent ?? '', /Saving price/)
  assert.equal(saved, 0)
  await act(async () => { write.resolve(Response.json({ ok: true })) })
  assert.match(view.getByRole('status').textContent ?? '', /Refreshing price/)
  assert.equal(saved, 0)
  await act(async () => { read.resolve(refreshed(null)) })
  assert.equal(view.getByRole('button', { name: label }).textContent, '—')
  assert.equal(view.queryByRole('status'), null)
  assert.equal(view.queryByRole('alert'), null)
  assert.equal(saved, 1)
  assert.equal(calls[1].url, '/api/requests/121')
  // Parent re-render with the same NULL is not required for draft settlement.
  view.rerender(<JobLinePrice {...props} onSaved={() => { saved++ }} />)
  assert.equal(view.getByRole('button', { name: label }).textContent, '—')
})

for (const authoritative of [100, 125]) {
  test(`settles the authoritative finite price ${authoritative}, not optimistic typed 150`, async () => {
    globalThis.fetch = (async (_url, init) => init?.method === 'PATCH'
      ? Response.json({ ok: true }) : refreshed(authoritative)) as typeof fetch
    const view = render(<JobLinePrice {...props} value={100} />)
    enter(view, '150')
    await waitFor(() => settled(view))
    assert.equal(view.getByRole('button', { name: label }).textContent, `$${authoritative}.00`)
  })
}

test('unchanged edit and Escape cancel preserve existing no-write mechanics', () => {
  const view = render(<JobLinePrice {...props} value={100} />)
  enter(view, '100')
  assert.equal(view.getByRole('button', { name: label }).textContent, '$100.00')
  fireEvent.click(view.getByRole('button', { name: label }))
  const input = view.getByRole('spinbutton', { name: label })
  fireEvent.change(input, { target: { value: '200' } })
  fireEvent.keyDown(input, { key: 'Escape' })
  assert.equal(view.getByRole('button', { name: label }).textContent, '$100.00')
  assert.equal(view.queryByRole('status'), null)
})

test('save failure retains explicit draft; retry writes then reads without false saved state', async () => {
  let writes = 0
  let reads = 0
  let saved = 0
  globalThis.fetch = (async (_url, init) => {
    if (init?.method === 'PATCH') {
      writes++
      return writes === 1 ? Response.json({ error: 'Write rejected' }, { status: 400 }) : Response.json({ ok: true })
    }
    reads++
    return refreshed(null)
  }) as typeof fetch
  const view = render(<JobLinePrice {...props} onSaved={() => { saved++ }} />)
  enter(view, '0')
  await waitFor(() => assert.match(view.getByRole('alert').textContent ?? '', /Draft: 0\. Price not saved\. Write rejected/))
  assert.equal(reads, 0)
  assert.equal(saved, 0)
  assert.equal(view.getByRole('button', { name: label }).textContent, '—')
  fireEvent.click(view.getByRole('button', { name: 'Retry price' }))
  await waitFor(() => assert.equal(saved, 1))
  assert.equal(writes, 2)
  assert.equal(reads, 1)
  assert.equal(view.queryByRole('alert'), null)
})

test('refresh failure retains draft; retry reads without repeating a successful write', async () => {
  let writes = 0
  let reads = 0
  let saved = 0
  globalThis.fetch = (async (_url, init) => {
    if (init?.method === 'PATCH') { writes++; return Response.json({ ok: true }) }
    reads++
    if (reads === 1) throw new Error('Refresh offline')
    return refreshed(175)
  }) as typeof fetch
  const view = render(<JobLinePrice {...props} onSaved={() => { saved++ }} />)
  enter(view, '175')
  await waitFor(() => assert.match(view.getByRole('alert').textContent ?? '', /Draft: 175\. Price not confirmed\. Refresh offline/))
  assert.equal(saved, 0)
  fireEvent.click(view.getByRole('button', { name: 'Retry price' }))
  await waitFor(() => assert.equal(saved, 1))
  assert.equal(writes, 1)
  assert.equal(reads, 2)
  assert.equal(view.getByRole('button', { name: label }).textContent, '$175.00')
})

for (const success of [true, false]) {
  test(`a newer open draft is not overwritten by late refresh ${success ? 'success' : 'failure'}`, async () => {
    const read = deferred<Response>()
    let saved = 0
    globalThis.fetch = (async (_url, init) => init?.method === 'PATCH' ? Response.json({ ok: true }) : read.promise) as typeof fetch
    const view = render(<JobLinePrice {...props} onSaved={() => { saved++ }} />)
    enter(view, '0')
    await waitFor(() => assert.match(view.getByRole('status').textContent ?? '', /Refreshing/))
    fireEvent.click(view.getByRole('button', { name: label }))
    const input = view.getByRole('spinbutton', { name: label }) as HTMLInputElement
    fireEvent.change(input, { target: { value: '200' } })
    await act(async () => { read.resolve(success ? refreshed(null) : Response.json({ error: 'Late failure' }, { status: 500 })) })
    assert.equal(input.value, '200')
    assert.equal(saved, success ? 1 : 0)
    assert.equal(view.queryByRole('alert'), null)
  })
}

test('canceling a newer draft does not lose the preceding committed save settlement', async () => {
  const read = deferred<Response>()
  globalThis.fetch = (async (_url, init) => init?.method === 'PATCH' ? Response.json({ ok: true }) : read.promise) as typeof fetch
  const view = render(<JobLinePrice {...props} value={100} />)
  enter(view, '150')
  await waitFor(() => assert.match(view.getByRole('status').textContent ?? '', /Refreshing/))
  fireEvent.click(view.getByRole('button', { name: label }))
  const input = view.getByRole('spinbutton', { name: label })
  fireEvent.change(input, { target: { value: '200' } })
  fireEvent.keyDown(input, { key: 'Escape' })
  await act(async () => { read.resolve(refreshed(150)) })
  assert.equal(view.getByRole('button', { name: label }).textContent, '$150.00')
  assert.equal(view.queryByRole('status'), null)
})

test('a late read does not replace a newer authoritative parent value', async () => {
  const read = deferred<Response>()
  globalThis.fetch = (async (_url, init) => init?.method === 'PATCH' ? Response.json({ ok: true }) : read.promise) as typeof fetch
  const view = render(<JobLinePrice {...props} value={100} />)
  enter(view, '150')
  await waitFor(() => assert.match(view.getByRole('status').textContent ?? '', /Refreshing/))
  view.rerender(<JobLinePrice {...props} value={200} />)
  await act(async () => { read.resolve(refreshed(150)) })
  assert.equal(view.getByRole('button', { name: label }).textContent, '$200.00')
})

test('newer committed edits serialize this cell writes; stale write response starts no read', async () => {
  const first = deferred<Response>()
  const values: string[] = []
  let reads = 0
  globalThis.fetch = (async (_url, init) => {
    if (init?.method === 'PATCH') {
      values.push(JSON.parse(String(init.body)).value)
      return values.length === 1 ? first.promise : Response.json({ ok: true })
    }
    reads++
    return refreshed(200)
  }) as typeof fetch
  const view = render(<JobLinePrice {...props} />)
  enter(view, '0')
  await waitFor(() => assert.equal(values.length, 1))
  enter(view, '200')
  assert.deepEqual(values, ['0'])
  await act(async () => { first.resolve(Response.json({ ok: true })) })
  await waitFor(() => settled(view))
  assert.deepEqual(values, ['0', '200'])
  assert.equal(reads, 1)
  assert.equal(view.getByRole('button', { name: label }).textContent, '$200.00')
})

test('editing back to the prior finite value after a refresh error still saves the new intent', async () => {
  const writes: string[] = []
  let reads = 0
  globalThis.fetch = (async (_url, init) => {
    if (init?.method === 'PATCH') { writes.push(JSON.parse(String(init.body)).value); return Response.json({ ok: true }) }
    if (++reads === 1) return Response.json({ error: 'Refresh failed' }, { status: 500 })
    return refreshed(100)
  }) as typeof fetch
  const view = render(<JobLinePrice {...props} value={100} />)
  enter(view, '0')
  await waitFor(() => assert.ok(view.queryByRole('alert')))
  enter(view, '100')
  await waitFor(() => settled(view))
  assert.deepEqual(writes, ['0', '100'])
  assert.equal(view.getByRole('button', { name: label }).textContent, '$100.00')
})

for (const change of ['row', 'selection'] as const) {
  test(`late response cannot settle another ${change}`, async () => {
    const read = deferred<Response>()
    let saved = 0
    globalThis.fetch = (async (_url, init) => init?.method === 'PATCH' ? Response.json({ ok: true }) : read.promise) as typeof fetch
    const view = render(<JobLinePrice {...props} onSaved={() => { saved++ }} />)
    enter(view, '0')
    await waitFor(() => assert.match(view.getByRole('status').textContent ?? '', /Refreshing/))
    view.rerender(<JobLinePrice {...props} itemId={change === 'row' ? 1400 : 1349}
      selectedCandidateId={change === 'selection' ? 2200 : 2115} value={300} onSaved={() => { saved++ }} />)
    await act(async () => { read.resolve(refreshed(null)) })
    assert.equal(view.getByRole('button', { name: label }).textContent, '$300.00')
    assert.equal(view.queryByRole('alert'), null)
    assert.equal(saved, 0)
  })
}

test('refresh selecting another candidate does not confirm that different price', async () => {
  let saved = 0
  globalThis.fetch = (async (_url, init) => init?.method === 'PATCH' ? Response.json({ ok: true }) : refreshed(495, 2135)) as typeof fetch
  const view = render(<JobLinePrice {...props} onSaved={() => { saved++ }} />)
  enter(view, '0')
  await waitFor(() => assert.match(view.getByRole('alert').textContent ?? '', /selected candidate changed/))
  assert.equal(view.getByRole('button', { name: label }).textContent, '—')
  assert.equal(saved, 0)
  assert.doesNotMatch(view.container.textContent ?? '', /495/)
})

test('authoritative prop updates remain visible outside a pending edit', () => {
  const view = render(<JobLinePrice {...props} value={100} />)
  view.rerender(<JobLinePrice {...props} value={125} />)
  assert.equal(view.getByRole('button', { name: label }).textContent, '$125.00')
})

test('shared nonprice EditableText still trims, writes once, refreshes and cancels without a price GET', async () => {
  const calls: unknown[] = []
  let saved = 0
  globalThis.fetch = (async (url, init) => {
    calls.push({ url, body: JSON.parse(String(init?.body)) })
    return Response.json({ ok: true })
  }) as typeof fetch
  const view = render(<EditableText table="job_requests" id={121} column="name" value="Old job"
    title="Job name" labelled onSaved={() => { saved++ }} />)
  fireEvent.click(view.getByRole('button', { name: 'Job name' }))
  const input = view.getByRole('textbox', { name: 'Job name' })
  fireEvent.change(input, { target: { value: ' New job ' } })
  fireEvent.keyDown(input, { key: 'Enter' })
  await waitFor(() => assert.equal(saved, 1))
  assert.deepEqual(calls, [{ url: '/api/rows', body: { table: 'job_requests', id: 121, column: 'name', value: 'New job' } }])
  view.rerender(<EditableText table="job_requests" id={121} column="name" value="New job"
    title="Job name" labelled onSaved={() => { saved++ }} />)
  assert.equal(view.getByRole('button', { name: 'Job name' }).textContent, 'New job')
  fireEvent.click(view.getByRole('button', { name: 'Job name' }))
  fireEvent.keyDown(view.getByRole('textbox', { name: 'Job name' }), { key: 'Escape' })
  assert.equal(calls.length, 1)
})

test('shared nonprice numeric editor retains its original failure and no-write behavior', async () => {
  let writes = 0
  let saved = 0
  globalThis.fetch = (async (url, init) => {
    assert.equal(url, '/api/rows')
    assert.equal(JSON.parse(String(init?.body)).column, 'demanded_quantity')
    writes++
    return Response.json({ error: 'Demand rejected' }, { status: 400 })
  }) as typeof fetch
  const view = render(<EditableText table="job_request_items" id={1349} column="demanded_quantity" value={23}
    numeric title="Demand" labelled onSaved={() => { saved++ }} />)
  fireEvent.click(view.getByRole('button', { name: 'Demand' }))
  fireEvent.keyDown(view.getByRole('spinbutton', { name: 'Demand' }), { key: 'Enter' })
  assert.equal(writes, 0)
  fireEvent.click(view.getByRole('button', { name: 'Demand' }))
  const input = view.getByRole('spinbutton', { name: 'Demand' })
  fireEvent.change(input, { target: { value: '30' } })
  fireEvent.keyDown(input, { key: 'Enter' })
  await waitFor(() => assert.equal(view.getByRole('button', { name: 'Demand' }).textContent, '23'))
  assert.equal(writes, 1)
  assert.equal(saved, 0)
  assert.equal(view.queryByRole('alert'), null, 'the price-only draft/error UI did not spread to demand')
})

test('only the Job-line unit-price consumer uses the local settlement editor', () => {
  const source = readFileSync('components/workspace/job-request.tsx', 'utf8')
  assert.equal((source.match(/<JobLinePrice /g) ?? []).length, 1)
  assert.match(source, /case 'unit_price':[^\n]*<JobLinePrice requestId=\{requestId\} itemId=\{item.id\} selectedCandidateId=\{item.selectedCandidateId\}/)
  assert.match(source, /case 'available_quantity':[^\n]*<EditableText/)
  assert.match(source, /case 'quantity':[^\n]*<EditableText/)
})
