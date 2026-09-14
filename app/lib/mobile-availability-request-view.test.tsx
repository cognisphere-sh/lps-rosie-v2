import assert from 'node:assert/strict'
import test, { afterEach, beforeEach } from 'node:test'
import React from 'react'
import { JSDOM } from 'jsdom'
import { act, cleanup, fireEvent, render, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { AvailabilityRequestDrawer } from '../components/workspace/ar-drawer.tsx'
import { AvailabilityRequestView } from '../components/workspace/availability-request-view.tsx'
import { ARLineTable, LineStatusPicker } from '../components/workspace/availability.tsx'
import { BodyModalPortal } from '../components/workspace/body-modal-portal.tsx'
import { openAvailabilityRequest } from './chat-bus.ts'
import type { ARDetail, ARItem } from './availability.ts'

let dom: JSDOM
let originalFetch: typeof fetch
let viewportWidth = 390
let mediaListeners: Set<() => void>
let visualListeners: Map<string, Set<() => void>>
let visualViewport: {
  offsetTop: number
  height: number
  addEventListener: (type: string, listener: () => void) => void
  removeEventListener: (type: string, listener: () => void) => void
}

const line = (id: number, changes: Partial<ARItem> = {}): ARItem => ({
  id,
  jobRequestItemId: id + 100,
  name: id === 19
    ? 'Quercus virginiana “Cathedral” 🌳 超長品種名稱 without separators'
    : `Ilex vomitoria line ${id}`,
  size: id === 19 ? '30 G multi-stem specification with long Unicode 尺寸' : null,
  quantity: id === 19 ? 12 : 20,
  status: id === 19 ? 'arriving_soon' : null,
  availableQuantity: id === 19 ? 8 : null,
  unitPrice: id === 19 ? 12.5 : null,
  notes: id === 19 ? 'Four more expected next week — confirmé' : null,
  lpsNotes: id === 19 ? 'Accept only the named cultivar.' : null,
  ...changes,
})

const request = (changes: Partial<ARDetail> = {}): ARDetail => ({
  id: 84,
  jobRequestId: 31,
  jobName: 'Courtyard 🌳 retrofit with an exceptionally long project name',
  supplierId: 7,
  supplierName: 'Vivero São José — 北美苗圃 with a long supplier identity',
  shareCustomerDetails: true,
  status: 'processing',
  submittedAt: '2026-08-31T18:00:00.000Z',
  createdAt: '2026-08-30T15:00:00.000Z',
  itemCount: 2,
  answeredCount: 1,
  lpsNotes: 'Keep the cultivar exact — 🚚 access is narrow and this deliberately long note must wrap.',
  customer: null,
  shipping: null,
  items: [line(19), line(20)],
  ...changes,
})

function mediaMatches(query: string): boolean {
  if (query.includes('max-width: 899px')) return viewportWidth <= 899
  if (query.includes('min-width: 900px')) return viewportWidth >= 900
  return false
}

async function setWidth(width: number) {
  viewportWidth = width
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width })
  await act(async () => {
    for (const listener of mediaListeners) listener()
  })
}

async function setVisualViewport(top: number, height: number) {
  visualViewport.offsetTop = top
  visualViewport.height = height
  await act(async () => {
    for (const listener of visualListeners.get('resize') ?? []) listener()
    for (const listener of visualListeners.get('scroll') ?? []) listener()
  })
}

beforeEach(() => {
  dom = new JSDOM(
    '<!doctype html><html><body><button id="opener">Open request</button><button id="fallback">Workspace fallback</button></body></html>',
    { url: 'http://localhost/jobs?jr=31' },
  )
  viewportWidth = 390
  mediaListeners = new Set()
  visualListeners = new Map([['resize', new Set()], ['scroll', new Set()]])
  visualViewport = {
    offsetTop: 0,
    height: 700,
    addEventListener(type, listener) { visualListeners.get(type)?.add(listener) },
    removeEventListener(type, listener) { visualListeners.get(type)?.delete(listener) },
  }
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
  Object.defineProperty(win, 'visualViewport', { configurable: true, value: visualViewport })
  const globals = {
    window: win,
    document: win.document,
    navigator: win.navigator,
    HTMLElement: win.HTMLElement,
    Node: win.Node,
    MouseEvent: win.MouseEvent,
    KeyboardEvent: win.KeyboardEvent,
    CustomEvent: win.CustomEvent,
    DOMException: win.DOMException,
    getComputedStyle: win.getComputedStyle,
    requestAnimationFrame: (callback: FrameRequestCallback) => setTimeout(() => callback(Date.now()), 0),
    cancelAnimationFrame: (id: number) => clearTimeout(id),
    IS_REACT_ACT_ENVIRONMENT: true,
  }
  for (const [key, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  Object.defineProperty(win.HTMLElement.prototype, 'getClientRects', {
    configurable: true,
    value() { return this.isConnected ? [{ width: 1, height: 1 }] : [] },
  })
  Object.defineProperty(win.HTMLElement.prototype, 'getBoundingClientRect', {
    configurable: true,
    value() {
      return { x: 0, y: 0, left: 0, top: 0, right: viewportWidth, bottom: 700, width: viewportWidth, height: 700, toJSON() {} }
    },
  })
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
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function installStore(initial: ARDetail[]) {
  const store = new Map(initial.map((entry) => [entry.id, entry]))
  const writes: Array<{ id: number; body: Record<string, unknown> }> = []
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const id = Number(String(input).match(/availability-requests\/(\d+)/)?.[1])
    const current = store.get(id)
    if (!current) return json({ error: 'missing' }, 404)
    if (init?.method === 'PATCH') {
      const body = JSON.parse(String(init.body)) as Record<string, unknown>
      writes.push({ id, body })
      let next = current
      if (typeof body.status === 'string') {
        next = {
          ...next,
          status: body.status,
          submittedAt: body.status === 'submitted' ? '2026-09-01T16:00:00.000Z' : next.submittedAt,
        }
      }
      if (typeof body.itemId === 'number' && body.changes && typeof body.changes === 'object') {
        const changes = body.changes as Record<string, string>
        next = {
          ...next,
          items: next.items.map((item) => item.id !== body.itemId ? item : {
            ...item,
            status: changes.status === '' ? null : changes.status ?? item.status,
            availableQuantity: changes.available_quantity === '' ? null : changes.available_quantity != null ? Number(changes.available_quantity) : item.availableQuantity,
            unitPrice: changes.unit_price === '' ? null : changes.unit_price != null ? Number(changes.unit_price) : item.unitPrice,
            notes: changes.notes ?? item.notes,
          }),
        }
      }
      if (typeof body.itemId === 'number' && body.details && typeof body.details === 'object') {
        const details = body.details as Record<string, string>
        next = {
          ...next,
          items: next.items.map((item) => item.id !== body.itemId ? item : {
            ...item,
            name: details.name ?? item.name,
            size: details.size === '' ? null : details.size ?? item.size,
            quantity: details.quantity === '' ? null : details.quantity != null ? Number(details.quantity) : item.quantity,
            lpsNotes: details.lps_notes === '' ? null : details.lps_notes ?? item.lpsNotes,
          }),
        }
      }
      store.set(id, next)
      return json({ ok: true })
    }
    return json({ request: current })
  }) as typeof fetch
  return { store, writes }
}

async function openDrawer(id = 84) {
  const opener = document.getElementById('opener') as HTMLButtonElement
  opener.focus()
  const view = render(<AvailabilityRequestDrawer />)
  act(() => openAvailabilityRequest(id))
  const dialog = await view.findByRole('dialog', { name: `Availability request AR-${id}` })
  await waitFor(() => assert.equal(document.activeElement, view.getByRole('button', { name: `Close availability request AR-${id}` })))
  return { view, dialog, opener }
}

function mobileSurface(dialog: HTMLElement) {
  return within(dialog).getByTestId('availability-mobile-lines')
}

test('drawer plant details save on mobile and desktop and survive reopening without changing answers or other lines', async () => {
  const { store, writes } = installStore([request()])
  const user = userEvent.setup({ document })
  const { view } = await openDrawer()
  for (const width of [390, 1280]) {
    await setWidth(width)
    const fields = [
      { label: /plant name/, column: 'name', value: `Live Oak ${width}` },
      { label: /requested size/, column: 'size', value: '15 G' },
      { label: /requested quantity/, column: 'quantity', value: '24.5' },
      { label: /note to supplier/, column: 'lps_notes', value: `Deliver Friday ${width}` },
    ]
    // Give every field a different value on the second pass too.
    fields[1].value = width === 390 ? '15 G' : '30 G'
    fields[2].value = width === 390 ? '24.5' : '30'
    for (const field of fields) {
      const input = view.getAllByRole('textbox', { name: field.label })[0]
      await user.clear(input)
      await user.type(input, field.value)
      await user.tab()
      await waitFor(() => assert.deepEqual(writes.at(-1), {
        id: 84, body: { itemId: 19, details: { [field.column]: field.value } },
      }))
    }
    await user.click(view.getByRole('button', { name: 'Close availability request AR-84' }))
    act(() => openAvailabilityRequest(84))
    await view.findByRole('dialog', { name: 'Availability request AR-84' })
    for (const field of fields) {
      await waitFor(() => assert.equal((view.getAllByRole('textbox', { name: field.label })[0] as HTMLInputElement).value, field.value))
    }
    const saved = store.get(84)!
    assert.deepEqual(saved.items[1], line(20))
    assert.equal(saved.items[0].availableQuantity, 8)
    assert.equal(saved.items[0].unitPrice, 12.5)
    assert.equal(saved.items[0].notes, line(19).notes)
  }
})

test('moving between plant fields while a save is pending preserves every edit', async () => {
  const { store, writes } = installStore([request()])
  const saveFetch = globalThis.fetch
  let release!: () => void
  const pending = new Promise<void>((resolve) => { release = resolve })
  let firstSignal: AbortSignal | null | undefined
  let first = true
  globalThis.fetch = (async (input, init) => {
    if (init?.method === 'PATCH' && first) {
      first = false
      firstSignal = init.signal
      await pending
    }
    return saveFetch(input, init)
  }) as typeof fetch
  const { view } = await openDrawer()
  const user = userEvent.setup({ document })
  for (const [label, value] of [[/plant name/, 'Red Maple'], [/requested size/, '45 G'], [/requested quantity/, '18']] as const) {
    const input = view.getAllByRole('textbox', { name: label })[0]
    await user.clear(input)
    await user.type(input, value)
    await user.tab()
  }
  assert.equal(firstSignal?.aborted, false)
  await act(async () => release())
  await waitFor(() => assert.equal(writes.length, 3))
  assert.equal(store.get(84)!.items[0].name, 'Red Maple')
  assert.equal(store.get(84)!.items[0].size, '45 G')
  assert.equal(store.get(84)!.items[0].quantity, 18)
})

test('supplier request cards edit quantities, multiline notes and complete answers, with one set of controls at each breakpoint', async () => {
  const patches: Array<[number, Record<string, string>]> = []
  const user = userEvent.setup({ document })
  const props = {
    request: request(), loading: false, error: '', saving: false,
    onPatch: async (id: number, changes: Record<string, string>) => { patches.push([id, changes]) },
    onSubmit: async () => {},
  }
  const view = render(<AvailabilityRequestView {...props} />)
  assert.equal(view.queryByRole('textbox', { name: /plant name|requested size|requested quantity|note to supplier/ }), null)
  for (const width of [320, 390, 480, 899]) {
    await setWidth(width)
    assert.equal(within(mobileSurface(view.container)).getAllByRole('article').length, 2)
    assert.equal(view.container.querySelector('[style*="min-width: 960px"]'), null)
    assert.ok(view.getByRole('heading', { name: props.request.jobName! }))
  }

  const quantity = view.getByLabelText(/Line 1, .* available quantity/)
  assert.equal(quantity.getAttribute('inputmode'), 'decimal')
  await user.clear(quantity)
  await user.type(quantity, '0')
  await user.tab()
  assert.deepEqual(patches.at(-1), [19, { available_quantity: '0' }])

  const notes = view.getByLabelText(/Line 1, .* notes/)
  assert.equal(notes.tagName, 'TEXTAREA')
  await user.clear(notes)
  await user.type(notes, 'First delivery{Enter}Second delivery')
  assert.equal(document.activeElement, notes)
  await user.tab()
  assert.deepEqual(patches.at(-1), [19, { notes: 'First delivery\nSecond delivery' }])

  const trigger = view.getByRole('button', { name: /Line 2, .* status, Pending/ })
  await user.click(trigger)
  await user.click(view.getByRole('option', { name: 'Can Order' }))
  const dialog = await view.findByRole('dialog', { name: 'Can Order' })
  await user.type(within(dialog).getByLabelText('Price per unit'), '24.50')
  await user.type(within(dialog).getByLabelText('ETA / notes'), 'Next Friday')
  await user.click(within(dialog).getByRole('button', { name: 'Save answer' }))
  await waitFor(() => assert.equal(document.activeElement, trigger))
  assert.deepEqual(patches.at(-1), [20, { status: 'can_order', notes: 'Next Friday', unit_price: '24.50' }])

  await setWidth(900)
  assert.equal(view.queryByRole('textbox', { name: /plant name|requested size|requested quantity|note to supplier/ }), null)
  assert.equal(view.queryByTestId('availability-mobile-lines'), null)
  assert.ok(view.container.querySelector('[style*="min-width: 960px"]'))
  await setWidth(390)
  view.rerender(<AvailabilityRequestView {...props} request={request({ status: 'closed' })} />)
  assert.equal(view.container.querySelector('input, textarea, select'), null)
  assert.equal(view.queryByRole('button', { name: /Submit availability/i }), null)
})

test('actual 320/390/480/899 phone DOM fits one scroller and reachable footer, then 900 renders only the unchanged 1070px table', async () => {
  const many = Array.from({ length: 36 }, (_, index) => line(100 + index, {
    name: `長い Unicode plant ${index} — ${'W'.repeat(50)}`,
    availableQuantity: index === 0 ? 0 : null,
    unitPrice: index === 0 ? 0 : null,
  }))
  installStore([request({ items: many, itemCount: many.length })])
  const { dialog } = await openDrawer()

  const scroller = dialog.querySelector<HTMLElement>('[data-ar-drawer-scroller]')!
  const footer = dialog.querySelector<HTMLElement>('[data-ar-drawer-footer]')!
  const header = dialog.querySelector('header')!
  assert.equal(dialog.querySelectorAll('[data-ar-drawer-scroller]').length, 1)
  assert.equal(scroller.contains(footer), false)
  assert.match(header.className, /pl-\[max\(12px,env\(safe-area-inset-left\)\)\]/)
  assert.match(header.className, /pr-\[max\(12px,env\(safe-area-inset-right\)\)\]/)
  assert.match(header.className, /pt-\[max\(12px,env\(safe-area-inset-top\)\)\]/)
  assert.match(scroller.className, /pl-\[max\(12px,env\(safe-area-inset-left\)\)\]/)
  assert.match(scroller.className, /pr-\[max\(12px,env\(safe-area-inset-right\)\)\]/)
  assert.match(footer.className, /pl-\[max\(12px,env\(safe-area-inset-left\)\)\]/)
  assert.match(footer.className, /pr-\[max\(12px,env\(safe-area-inset-right\)\)\]/)
  assert.match(footer.className, /pb-\[max\(12px,env\(safe-area-inset-bottom\)\)\]/)

  for (const width of [320, 390, 480, 899]) {
    await setWidth(width)
    const mobile = mobileSurface(dialog)
    assert.equal(within(mobile).getAllByRole('article').length, 36)
    assert.equal(mobile.querySelector('[style*="min-width"]'), null)
    assert.equal(dialog.querySelector('[style*="min-width: 1070px"]'), null)
    const fieldBudget = (width - 24 - 2 - 24 - 12) / 2
    assert.ok(fieldBudget >= 129, `${width}px field budget ${fieldBudget}`)
    assert.match((within(mobile).getByLabelText(/^Line 1, .* plant name/) as HTMLInputElement).value, /長い Unicode plant/)
    assert.ok(within(dialog).getByRole('button', { name: 'Submit again' }))
  }

  await setVisualViewport(41, 356)
  const backdrop = document.querySelector<HTMLElement>('[data-ar-drawer-backdrop]')!
  assert.equal(backdrop.style.top, '41px')
  assert.equal(backdrop.style.height, '356px')
  assert.equal(scroller.contains(footer), false)

  await setWidth(900)
  assert.equal(within(dialog).queryByTestId('availability-mobile-lines'), null)
  const desktop = dialog.querySelector<HTMLElement>('.overflow-x-auto')!
  assert.equal(desktop.querySelector<HTMLElement>('[style*="min-width"]')?.style.minWidth, '1070px')
  assert.equal(dialog.querySelectorAll('[style*="min-width: 1070px"]').length > 0, true)
})

test('summary stays truthful, zero and null remain distinct, and Submit wording derives only from submittedAt including closed copy', async () => {
  installStore([
    request({
      id: 84,
      status: 'processing',
      submittedAt: '2026-08-31T18:00:00.000Z',
      items: [line(19, { quantity: 0, availableQuantity: 0, unitPrice: 0 }), line(20)],
    }),
    request({ id: 85, status: 'closed', submittedAt: '2026-08-30T12:00:00.000Z' }),
    request({ id: 86, status: 'processing', submittedAt: null }),
  ])
  const { view, dialog } = await openDrawer(84)
  const summary = within(dialog).getByRole('region', { name: 'Request summary' })
  assert.match(summary.textContent ?? '', /Vivero São José — 北美苗圃/)
  assert.match(summary.textContent ?? '', /Courtyard 🌳 retrofit/)
  assert.match(summary.textContent ?? '', /Sent/)
  assert.match(summary.textContent ?? '', /Submitted/)
  assert.doesNotMatch(dialog.textContent ?? '', /Last updated|changed by|supplier changed|LPS changed|provenance/i)
  const first = within(mobileSurface(dialog)).getByRole('article', { name: /Line 1/ })
  assert.equal((within(first).getByLabelText(/requested quantity/) as HTMLInputElement).value, '0')
  assert.match(first.textContent ?? '', /\$0\.00/)
  assert.equal(within(first).getByLabelText(/available quantity/).getAttribute('value'), '0')
  assert.equal(within(first).getByLabelText(/price per unit/).getAttribute('value'), '0')
  const second = within(mobileSurface(dialog)).getByRole('article', { name: /^Line 2,/ })
  assert.equal(within(second).getByLabelText(/available quantity/).getAttribute('value'), '')
  assert.equal(within(second).getByLabelText(/price per unit/).getAttribute('value'), '')
  assert.match(second.textContent ?? '', /Line total—/)
  assert.ok(view.getByRole('button', { name: 'Submit again' }))

  const generation84 = Number(dialog.getAttribute('data-ar-generation'))
  act(() => openAvailabilityRequest(85))
  const closed = await view.findByRole('dialog', { name: 'Availability request AR-85' })
  assert.ok(Number(closed.getAttribute('data-ar-generation')) > generation84)
  assert.match(closed.textContent ?? '', /Submit again/)
  assert.equal(within(closed).queryByRole('button', { name: 'Submit again' }), null)

  act(() => openAvailabilityRequest(86))
  const never = await view.findByRole('dialog', { name: 'Availability request AR-86' })
  assert.ok(within(never).getByRole('button', { name: 'Submit request' }))
  assert.equal(within(within(never).getByRole('region', { name: 'Request summary' })).queryByText('Submitted', { selector: 'dt' }), null)
})

test('drawer and nested answer use dedicated hosts with exact composable isolation and nested Escape never closes the parent', async () => {
  const exact = document.createElement('aside')
  Object.defineProperty(exact, 'inert', { configurable: true, writable: true, value: false })
  exact.setAttribute('inert', 'legacy-inert-value')
  exact.setAttribute('aria-hidden', 'false')
  document.body.appendChild(exact)
  const absent = document.createElement('aside')
  document.body.appendChild(absent)
  document.body.style.overflow = 'clip'
  installStore([request()])
  const user = userEvent.setup({ document })
  const { view, dialog } = await openDrawer()

  const drawerHost = document.querySelector<HTMLElement>('[data-ar-drawer-host]')!
  assert.ok(drawerHost)
  assert.equal(drawerHost.parentElement, document.body)
  assert.equal(document.querySelectorAll('[data-ar-drawer-host]').length, 1)
  assert.equal(exact.inert, true)
  assert.equal(exact.getAttribute('inert'), '')
  assert.equal(exact.getAttribute('aria-hidden'), 'true')
  assert.equal(absent.inert, true)
  assert.equal(absent.getAttribute('aria-hidden'), 'true')
  assert.equal(document.body.style.overflow, 'hidden')

  const status = within(mobileSurface(dialog)).getByLabelText(/Line 2, .* status/)
  await user.selectOptions(status, 'unavailable')
  const answerHost = await waitFor(() => {
    const host = document.querySelector<HTMLElement>('[data-ar-answer-dialog-host]')
    assert.ok(host)
    return host
  })
  const answer = within(answerHost).getByRole('dialog', { name: 'Unavailable' })
  assert.equal(document.querySelectorAll('[data-ar-answer-dialog-host]').length, 1)
  assert.equal(drawerHost.inert, true)
  assert.equal(drawerHost.getAttribute('aria-hidden'), 'true')
  assert.equal(view.getAllByRole('dialog').length, 1)
  assert.equal(view.getByRole('dialog'), answer)
  assert.equal(document.body.style.overflow, 'hidden')

  await user.keyboard('{Escape}')
  await waitFor(() => assert.equal(document.querySelector('[data-ar-answer-dialog-host]'), null))
  assert.ok(view.getByRole('dialog', { name: 'Availability request AR-84' }))
  assert.equal(drawerHost.hasAttribute('inert'), false)
  assert.equal(drawerHost.hasAttribute('aria-hidden'), false)
  assert.equal(document.body.style.overflow, 'hidden')
  await waitFor(() => assert.equal(document.activeElement, status))

  await user.click(view.getByRole('button', { name: 'Close availability request AR-84' }))
  await waitFor(() => assert.equal(document.querySelector('[data-ar-drawer-host]'), null))
  assert.equal(exact.inert, false)
  assert.equal(Object.prototype.hasOwnProperty.call(exact, 'inert'), true)
  assert.equal(exact.getAttribute('inert'), 'legacy-inert-value')
  assert.equal(exact.getAttribute('aria-hidden'), 'false')
  assert.equal(Object.prototype.hasOwnProperty.call(absent, 'inert'), false)
  assert.equal(absent.hasAttribute('inert'), false)
  assert.equal(absent.hasAttribute('aria-hidden'), false)
  assert.equal(document.body.style.overflow, 'clip')

  // Reproduce whole-tree disposal while both portal effects are still active.
  // React is free to clean the outer effect before the nested effect.
  view.unmount()
  const second = await openDrawer()
  const secondStatus = within(mobileSurface(second.dialog)).getByLabelText(/Line 2, .* status/)
  await user.selectOptions(secondStatus, 'unavailable')
  await second.view.findByRole('dialog', { name: 'Unavailable' })
  assert.ok(document.querySelector('[data-ar-drawer-host]'))
  assert.ok(document.querySelector('[data-ar-answer-dialog-host]'))
  second.view.unmount()
  await waitFor(() => {
    assert.equal(document.querySelector('[data-ar-drawer-host]'), null)
    assert.equal(document.querySelector('[data-ar-answer-dialog-host]'), null)
  })
  assert.equal(exact.inert, false)
  assert.equal(Object.prototype.hasOwnProperty.call(exact, 'inert'), true)
  assert.equal(exact.getAttribute('inert'), 'legacy-inert-value')
  assert.equal(exact.getAttribute('aria-hidden'), 'false')
  assert.equal(Object.prototype.hasOwnProperty.call(absent, 'inert'), false)
  assert.equal(absent.hasAttribute('inert'), false)
  assert.equal(absent.hasAttribute('aria-hidden'), false)
  assert.equal(document.body.style.overflow, 'clip')
})

test('document modal stack supports either unregister order, dynamic children, repeated nesting and exact reset', async () => {
  const exact = document.createElement('section')
  Object.defineProperty(exact, 'inert', { configurable: true, writable: true, value: true })
  exact.setAttribute('inert', 'preexisting-inert-bytes')
  exact.setAttribute('aria-hidden', 'mixed')
  document.body.appendChild(exact)
  document.body.style.setProperty('overflow', 'clip', 'important')

  function Stack({ outer, inner }: { outer: boolean; inner: boolean }) {
    return <>
      {outer ? <BodyModalPortal key="outer" hostAttribute="data-test-outer-host"><button>Outer modal</button></BodyModalPortal> : null}
      {inner ? <BodyModalPortal key="inner" hostAttribute="data-test-inner-host"><button>Inner modal</button></BodyModalPortal> : null}
    </>
  }

  const view = render(<Stack outer inner />)
  const outer = await waitFor(() => document.querySelector<HTMLElement>('[data-test-outer-host]')!)
  const inner = await waitFor(() => document.querySelector<HTMLElement>('[data-test-inner-host]')!)
  assert.equal(outer.getAttribute('aria-hidden'), 'true')
  assert.equal(inner.hasAttribute('aria-hidden'), false)
  assert.equal(document.body.style.overflow, 'hidden')

  const dynamic = document.createElement('aside')
  dynamic.setAttribute('aria-hidden', 'dynamic-baseline')
  document.body.appendChild(dynamic)
  await waitFor(() => {
    assert.equal(dynamic.inert, true)
    assert.equal(dynamic.getAttribute('aria-hidden'), 'true')
  })

  // Inner-first removal exposes the retained outer host.
  view.rerender(<Stack outer inner={false} />)
  await waitFor(() => assert.equal(document.querySelector('[data-test-inner-host]'), null))
  assert.equal(outer.hasAttribute('inert'), false)
  assert.equal(outer.hasAttribute('aria-hidden'), false)

  // Nest again, then remove the outer registration first while retaining inner.
  view.rerender(<Stack outer inner />)
  const reopenedInner = await waitFor(() => document.querySelector<HTMLElement>('[data-test-inner-host]')!)
  assert.equal(outer.getAttribute('aria-hidden'), 'true')
  assert.equal(reopenedInner.hasAttribute('aria-hidden'), false)
  view.rerender(<Stack outer={false} inner />)
  await waitFor(() => assert.equal(document.querySelector('[data-test-outer-host]'), null))
  assert.equal(reopenedInner.hasAttribute('inert'), false)
  assert.equal(reopenedInner.hasAttribute('aria-hidden'), false)

  view.rerender(<Stack outer={false} inner={false} />)
  await waitFor(() => assert.equal(document.querySelector('[data-test-inner-host]'), null))
  assert.equal(exact.inert, true)
  assert.equal(Object.prototype.hasOwnProperty.call(exact, 'inert'), true)
  assert.equal(exact.getAttribute('inert'), 'preexisting-inert-bytes')
  assert.equal(exact.getAttribute('aria-hidden'), 'mixed')
  assert.equal(Object.prototype.hasOwnProperty.call(dynamic, 'inert'), false)
  assert.equal(dynamic.hasAttribute('inert'), false)
  assert.equal(dynamic.getAttribute('aria-hidden'), 'dynamic-baseline')
  assert.equal(document.body.style.overflow, 'clip')
  assert.equal(document.body.style.getPropertyPriority('overflow'), 'important')

  // No observer from the empty stack may mutate later body additions.
  const after = document.createElement('div')
  document.body.appendChild(after)
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.equal(Object.prototype.hasOwnProperty.call(after, 'inert'), false)
  assert.equal(after.hasAttribute('inert'), false)
  assert.equal(after.hasAttribute('aria-hidden'), false)

  // A fresh registration starts from a fresh baseline rather than retained refs.
  view.rerender(<Stack outer inner={false} />)
  await waitFor(() => assert.ok(document.querySelector('[data-test-outer-host]')))
  view.rerender(<Stack outer={false} inner={false} />)
  await waitFor(() => assert.equal(document.querySelector('[data-test-outer-host]'), null))
  assert.equal(after.hasAttribute('inert'), false)
  assert.equal(exact.getAttribute('inert'), 'preexisting-inert-bytes')
  assert.equal(document.body.style.overflow, 'clip')
  assert.equal(document.body.style.getPropertyPriority('overflow'), 'important')
})

test('focus survives switch, nested breakpoint teardown, opener removal, close/reopen race and component unmount', async () => {
  installStore([request(), request({ id: 85, jobName: 'Second request' })])
  const user = userEvent.setup({ document })
  const { view, dialog, opener } = await openDrawer()
  const host = document.querySelector('[data-ar-drawer-host]')
  const generation84 = Number(dialog.getAttribute('data-ar-generation'))

  act(() => openAvailabilityRequest(85))
  const switched = await view.findByRole('dialog', { name: 'Availability request AR-85' })
  assert.equal(document.querySelector('[data-ar-drawer-host]'), host)
  assert.ok(Number(switched.getAttribute('data-ar-generation')) > generation84)
  await waitFor(() => assert.equal(document.activeElement, view.getByRole('button', { name: 'Close availability request AR-85' })))

  act(() => openAvailabilityRequest(84))
  const reopened = await view.findByRole('dialog', { name: 'Availability request AR-84' })
  const status = within(mobileSurface(reopened)).getByLabelText(/Line 2, .* status/)
  await user.selectOptions(status, 'unavailable')
  assert.ok(await view.findByRole('dialog', { name: 'Unavailable' }))
  await setWidth(900)
  await waitFor(() => assert.equal(document.querySelector('[data-ar-answer-dialog-host]'), null))
  assert.ok(view.getByRole('dialog', { name: 'Availability request AR-84' }))
  await waitFor(() => assert.equal(document.activeElement, view.getByRole('button', { name: 'Close availability request AR-84' })))

  opener.remove()
  fireEvent.click(view.getByRole('button', { name: 'Close availability request AR-84' }))
  await waitFor(() => assert.equal(document.activeElement, document.getElementById('fallback')))

  const replacement = document.createElement('button')
  replacement.textContent = 'Replacement opener'
  document.body.prepend(replacement)
  replacement.focus()
  act(() => openAvailabilityRequest(84))
  const closeButton = await view.findByRole('button', { name: 'Close availability request AR-84' })
  act(() => {
    fireEvent.click(closeButton)
    openAvailabilityRequest(85)
  })
  await view.findByRole('dialog', { name: 'Availability request AR-85' })
  await waitFor(() => assert.equal(document.activeElement, view.getByRole('button', { name: 'Close availability request AR-85' })))
  assert.notEqual(document.activeElement, replacement)

  view.unmount()
  await waitFor(() => assert.equal(document.activeElement, replacement))
  assert.equal(document.querySelector('[data-ar-drawer-host]'), null)
  assert.equal(document.body.style.overflow, '')
})

test('parent Escape and backdrop each close only the drawer, restore focus and leave no portal or isolation', async () => {
  installStore([request()])
  const user = userEvent.setup({ document })
  const { view, opener } = await openDrawer()
  await user.keyboard('{Escape}')
  await waitFor(() => assert.equal(document.querySelector('[data-ar-drawer-host]'), null))
  assert.equal(document.activeElement, opener)
  assert.equal(document.body.style.overflow, '')

  opener.focus()
  assert.equal(document.activeElement, opener)
  act(() => openAvailabilityRequest(84))
  await view.findByRole('dialog', { name: 'Availability request AR-84' })
  fireEvent.click(document.querySelector('[data-ar-drawer-backdrop]')!)
  await waitFor(() => assert.equal(document.querySelector('[data-ar-drawer-host]'), null))
  await waitFor(() => assert.equal(document.activeElement, opener))
  assert.equal(document.body.style.overflow, '')
})

test('loading, exact-generation error Retry, empty and stale open/load completions remain coherent', async () => {
  type Pending = { id: number; resolve: (response: Response) => void; signal?: AbortSignal }
  const pending: Pending[] = []
  let retry84 = false
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const id = Number(String(input).match(/availability-requests\/(\d+)/)?.[1])
    if (id === 85) return Promise.resolve(json({ request: request({ id: 85, jobName: 'Current exact request' }) }))
    if (retry84) return Promise.resolve(json({ request: request({ items: [], itemCount: 0, answeredCount: 0 }) }))
    return new Promise<Response>((resolve) => pending.push({ id, resolve, signal: init?.signal ?? undefined }))
  }) as typeof fetch

  const { view } = await openDrawer(84)
  assert.ok(view.getByRole('status'))
  assert.match(view.getByText('Loading availability request…').textContent ?? '', /Loading/)
  assert.equal(pending.length, 1)

  act(() => openAvailabilityRequest(85))
  const current = await view.findByRole('dialog', { name: 'Availability request AR-85' })
  assert.match(current.textContent ?? '', /Current exact request/)
  assert.equal(pending[0].signal?.aborted, true)
  await act(async () => pending[0].resolve(json({ request: request({ jobName: 'STALE OLD REQUEST' }) })))
  assert.doesNotMatch(current.textContent ?? '', /STALE OLD REQUEST/)

  act(() => openAvailabilityRequest(84))
  await view.findByText('Loading availability request…')
  const latest = pending.at(-1)!
  await act(async () => latest.resolve(json({ error: 'missing' }, 404)))
  const alert = await view.findByRole('alert')
  assert.match(alert.textContent ?? '', /AR-84 not found/)
  retry84 = true
  await userEvent.setup({ document }).click(within(alert).getByRole('button', { name: 'Retry' }))
  assert.ok(await view.findByTestId('availability-mobile-lines'))
  assert.ok(view.getByText('No lines on this request.'))
})

test('same-line writes are sequenced with abort ownership, PATCH failure is explicit, and stale reverse completion cannot paint', async () => {
  type Deferred = { resolve: (response: Response) => void; signal?: AbortSignal; body: Record<string, unknown> }
  const patches: Deferred[] = []
  let current = request({ submittedAt: null })
  let failNext = false
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method === 'PATCH') {
      const body = JSON.parse(String(init.body)) as Record<string, unknown>
      if (failNext) {
        failNext = false
        return Promise.resolve(json({ error: 'Line write refused' }, 500))
      }
      return new Promise<Response>((resolve) => patches.push({ resolve, signal: init.signal ?? undefined, body }))
    }
    return Promise.resolve(json({ request: current }))
  }) as typeof fetch

  const user = userEvent.setup({ document })
  const { view, dialog } = await openDrawer()
  const notes = within(mobileSurface(dialog)).getByLabelText(/Line 1, .* notes/)
  await user.clear(notes)
  await user.type(notes, 'first answer')
  await user.tab()
  await waitFor(() => assert.equal(patches.length, 1))
  await user.click(notes)
  await user.clear(notes)
  await user.type(notes, 'second answer')
  await user.tab()
  assert.equal(patches.length, 1)
  assert.equal(patches[0].signal?.aborted, true)

  await act(async () => patches[0].resolve(json({ ok: true })))
  await waitFor(() => assert.equal(patches.length, 2))
  const secondChanges = (patches[1].body.changes as Record<string, string>)
  current = {
    ...current,
    items: current.items.map((item) => item.id === 19 ? { ...item, notes: secondChanges.notes } : item),
  }
  await act(async () => patches[1].resolve(json({ ok: true })))
  await waitFor(() => assert.equal((within(mobileSurface(dialog)).getByLabelText(/Line 1, .* notes/) as HTMLTextAreaElement).value, 'second answer'))
  assert.doesNotMatch(dialog.textContent ?? '', /first answer/)

  failNext = true
  const quantity = within(mobileSurface(dialog)).getByLabelText(/Line 1, .* available quantity/)
  await user.clear(quantity)
  await user.type(quantity, '7.5')
  await user.tab()
  const alert = await view.findByRole('alert')
  assert.match(alert.textContent ?? '', /Line write refused/)
})

test('request-status writes have abort/sequence ownership and close rejects stale reverse failure', async () => {
  type PendingStatus = { resolve: (response: Response) => void; signal?: AbortSignal; status: string }
  const pending: PendingStatus[] = []
  let current = request({ status: 'processing', submittedAt: null })
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method === 'PATCH') {
      const body = JSON.parse(String(init.body)) as { status: string }
      return new Promise<Response>((resolve) => pending.push({ resolve, signal: init.signal ?? undefined, status: body.status }))
    }
    return Promise.resolve(json({ request: current }))
  }) as typeof fetch

  const user = userEvent.setup({ document })
  const { view, opener } = await openDrawer()
  const status = view.getByRole('combobox', { name: 'Request status' })
  await user.selectOptions(status, 'new')
  await waitFor(() => assert.equal(pending.length, 1))
  await user.selectOptions(status, 'processing')
  assert.equal(pending.length, 1)
  assert.equal(pending[0].signal?.aborted, true)
  await act(async () => pending[0].resolve(json({ ok: true })))
  await waitFor(() => assert.equal(pending.length, 2))
  current = { ...current, status: 'processing' }
  await act(async () => pending[1].resolve(json({ ok: true })))
  await waitFor(() => assert.match(view.getByRole('region', { name: 'Request summary' }).textContent ?? '', /^Processing/))

  await user.selectOptions(view.getByRole('combobox', { name: 'Request status' }), 'new')
  await waitFor(() => assert.equal(pending.length, 3))
  await user.click(view.getByRole('button', { name: 'Close availability request AR-84' }))
  assert.equal(pending[2].signal?.aborted, true)
  await act(async () => pending[2].resolve(json({ error: 'STALE STATUS FAILURE' }, 500)))
  assert.equal(document.querySelector('[data-ar-drawer-host]'), null)
  await waitFor(() => assert.equal(document.activeElement, opener))
})

test('double submit issues one owned PATCH, failure stays unannounced, and switch aborts stale submit/error completion', async () => {
  type PendingPatch = { resolve: (response: Response) => void; signal?: AbortSignal }
  const patches: PendingPatch[] = []
  let current84 = request({ id: 84, submittedAt: null })
  const current85 = request({ id: 85, submittedAt: null, jobName: 'Exact second request' })
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const id = Number(String(input).match(/availability-requests\/(\d+)/)?.[1])
    if (init?.method === 'PATCH') {
      return new Promise<Response>((resolve) => patches.push({ resolve, signal: init.signal ?? undefined }))
    }
    return Promise.resolve(json({ request: id === 85 ? current85 : current84 }))
  }) as typeof fetch

  const { view } = await openDrawer(84)
  const submit = view.getByRole('button', { name: 'Submit request' })
  fireEvent.click(submit)
  fireEvent.click(submit)
  await waitFor(() => assert.equal(patches.length, 1))
  assert.ok(view.getByRole('button', { name: 'Submitting…' }).hasAttribute('disabled'))
  current84 = { ...current84, status: 'submitted', submittedAt: '2026-09-01T16:00:00.000Z' }
  await act(async () => patches[0].resolve(json({ ok: true })))
  assert.ok(await view.findByRole('button', { name: 'Submit again' }))
  assert.ok(view.getByText('Request submitted.'))

  fireEvent.click(view.getByRole('button', { name: 'Submit again' }))
  await waitFor(() => assert.equal(patches.length, 2))
  await act(async () => patches[1].resolve(json({ error: 'Submit refused' }, 500)))
  assert.match((await view.findByRole('alert')).textContent ?? '', /Submit refused/)
  assert.equal(view.queryByText('Request submitted.'), null)

  fireEvent.click(view.getByRole('button', { name: 'Submit again' }))
  await waitFor(() => assert.equal(patches.length, 3))
  act(() => openAvailabilityRequest(85))
  const second = await view.findByRole('dialog', { name: 'Availability request AR-85' })
  assert.equal(patches[2].signal?.aborted, true)
  await act(async () => patches[2].resolve(json({ error: 'STALE SUBMIT FAILURE' }, 500)))
  assert.doesNotMatch(second.textContent ?? '', /STALE SUBMIT FAILURE|Request submitted/)
  assert.ok(within(second).getByRole('button', { name: 'Submit request' }))
})

test('portal/profile/default line surfaces keep the task-start non-modal answer behavior and 1070px table opt-out', async () => {
  const user = userEvent.setup({ document })
  const patches: Array<Record<string, string>> = []
  const view = render(
    <>
      <ARLineTable items={[line(19)]} editable={false} />
      <LineStatusPicker
        item={line(20)}
        editable
        portal
        onPatch={async (_id, changes) => { patches.push(changes) }}
      />
    </>,
  )
  assert.equal(view.queryByTestId('availability-mobile-lines'), null)
  assert.equal(view.container.querySelector<HTMLElement>('[style*="min-width"]')?.style.minWidth, '1070px')
  const trigger = view.getByRole('button', { name: 'Line status, Pending' })
  await user.click(trigger)
  await user.click(view.getByRole('option', { name: 'Can Order' }))
  assert.equal(document.querySelector('[data-ar-answer-dialog-host]'), null)
  assert.equal(view.queryByRole('dialog'), null)
  const price = view.getByLabelText('Price per unit')
  assert.match(price.className, /h-9/)
  assert.doesNotMatch(price.className, /h-11/)
  const cancel = view.getByRole('button', { name: 'Cancel' })
  assert.doesNotMatch(cancel.className, /min-h-11/)
  await user.keyboard('{Escape}')
  assert.ok(view.getByRole('button', { name: 'Save answer' }))
  assert.notEqual(document.activeElement, trigger)
})
