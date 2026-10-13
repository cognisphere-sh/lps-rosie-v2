import assert from 'node:assert/strict'
import test, { afterEach, beforeEach } from 'node:test'
import React from 'react'
import { JSDOM } from 'jsdom'
import { cleanup, fireEvent, render, waitFor, within } from '@testing-library/react'
import { ARLineTable } from '../components/workspace/availability'
import { AvailabilityRequestView } from '../components/workspace/availability-request-view'
import type { ARDetail, ARItem } from './availability'

// Offline DOM regressions, not a substitute for real-browser layout/reference QA.
let dom: JSDOM
let previous: PropertyDescriptorMap
let width = 1440
const globalKeys = ['window', 'document', 'navigator', 'HTMLElement', 'Node', 'getComputedStyle',
  'requestAnimationFrame', 'cancelAnimationFrame', 'IS_REACT_ACT_ENVIRONMENT']
const item: ARItem = {
  id: 1, name: 'Synthetic long nursery cultivar 🌵 without customer information', size: '15 G',
  demandedQuantity: 6, availableQuantity: null, status: null, unitPrice: 12,
  noteForSupplier: 'Keep this long synthetic request note accessible.', noteFromSupplier: null,
}
const request = (changes: Partial<ARDetail> = {}): ARDetail => ({
  id: 1, jobRequestId: 1, jobName: 'Synthetic QA request', supplierId: 1, supplierName: 'Synthetic nursery',
  status: 'new', createdAt: '2026-10-01T12:00:00Z', submittedAt: null,
  shareCustomerDetails: false, customer: null, shipping: null,
  itemCount: 1, answeredCount: 0, noteForSupplier: 'Synthetic whole-request note', items: [item], ...changes,
})

beforeEach(() => {
  previous = Object.getOwnPropertyDescriptors(globalThis)
  width = 1440
  dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://synthetic.example/' })
  Object.defineProperty(dom.window, 'matchMedia', {
    value: () => ({ matches: width < 900, addEventListener() {}, removeEventListener() {} }),
  })
  const globals = {
    window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement, Node: dom.window.Node,
    getComputedStyle: dom.window.getComputedStyle,
    requestAnimationFrame: (callback: FrameRequestCallback) => setTimeout(() => callback(Date.now()), 0),
    cancelAnimationFrame: (id: number) => clearTimeout(id), IS_REACT_ACT_ENVIRONMENT: true,
  }
  for (const [key, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  // React's input-event fallback may run when an answer dialog autofocuses an input.
  Object.defineProperty(dom.window.HTMLElement.prototype, 'attachEvent', { value() {} })
  Object.defineProperty(dom.window.HTMLElement.prototype, 'detachEvent', { value() {} })
})

afterEach(() => {
  cleanup()
  dom.window.close()
  for (const key of globalKeys) {
    if (previous[key]) Object.defineProperty(globalThis, key, previous[key])
    else Reflect.deleteProperty(globalThis, key)
  }
})

function assertCenteredStatus(view: ReturnType<typeof render>) {
  const heading = view.getByTitle('Status — drag to reorder').parentElement!
  const trigger = view.getByRole('button', { name: 'Line status, Pending' })
  assert.ok(heading.classList.contains('text-center'))
  assert.ok(trigger.parentElement!.classList.contains('justify-center'))
  assert.ok(trigger.parentElement!.classList.contains('[&>button]:min-h-11'))
  const header = heading.parentElement!
  const row = trigger.closest<HTMLElement>('.grid')!
  assert.equal(header.style.gridTemplateColumns, row.style.gridTemplateColumns)
  assert.equal(header.style.minWidth, row.style.minWidth)
  assert.ok(header.classList.contains('border-l-[3px]'))
  // Variable-bearing shorthands keep authored text; CSSOM longhands stay unresolved.
  // This checks source geometry, not computed/rendered pixels (the browser QA gate).
  assert.equal(row.style.borderLeft, '3px solid var(--lps-tone-grey-dot)')
}

test('shared detail centers desktop Status across persisted reorder and resize without changing the table contract', () => {
  const order = ['status', 'plant', 'need', 'avail', 'size', 'note', 'unit_price']
  window.localStorage.setItem('lps.ar.columns.v1', JSON.stringify({ order, widths: { status: 236, plant: 350 } }))
  const view = render(<AvailabilityRequestView request={request()} loading={false} error="" saving={false}
    onPatch={async () => {}} onSubmit={async () => false} />)
  assertCenteredStatus(view)
  const columns = view.getByTitle('Status — drag to reorder').parentElement!.parentElement!
  assert.ok(columns.style.gridTemplateColumns.startsWith('236px 350px'))
  fireEvent.mouseDown(view.getByRole('separator', { name: 'Resize Status' }), { clientX: 10 })
  fireEvent.mouseMove(document, { clientX: 50 })
  fireEvent.mouseUp(document)
  assert.ok(columns.style.gridTemplateColumns.startsWith('276px 350px'))
  fireEvent.drop(view.getByTitle('Plant — drag to reorder').parentElement!, {
    dataTransfer: { getData: () => 'status' },
  })
  assertCenteredStatus(view)
  const saved = JSON.parse(window.localStorage.getItem('lps.ar.columns.v1')!)
  assert.equal(saved.widths.status, 276)
  assert.equal(saved.widths.plant, 350)
  assert.deepEqual([...saved.order].sort(), [...order].sort())
  assert.equal(saved.order[0], 'plant')
  assert.equal(saved.order[1], 'status')
  assert.ok(within(view.container).getByText(item.noteForSupplier!))
  const printSheet = document.querySelector<HTMLElement>('#ar-print-sheet')!
  assert.ok(printSheet)
  assert.ok(within(printSheet).getByText(item.noteForSupplier!))
})

test('default, focused portal-style and leading-column callers remain opted out', () => {
  for (const design of ['default', 'portal'] as const) {
    const view = render(<ARLineTable items={[item]} editable design={design}
      leadingHeader="Job" renderLeading={() => 'Synthetic job'} />)
    const heading = view.getByTitle('Status — drag to reorder').parentElement!
    assert.equal(heading.classList.contains('text-center'), false)
    assert.equal(heading.parentElement!.classList.contains('border-l-[3px]'), false)
    const control = design === 'portal'
      ? view.getByRole('button', { name: 'Line status, Pending' }) : view.getByRole('combobox', { name: 'Line status' })
    const cell = control.closest('div.px-1')!
    assert.equal(cell.classList.contains('justify-center'), false)
    assert.equal(cell.classList.contains('[&>button]:min-h-11'), false)
    assert.ok(view.getByText('Synthetic job'))
    cleanup()
  }
})

test('centered desktop Status keeps keyboard options, answer patch and focus restoration', async () => {
  const writes: unknown[] = []
  const view = render(<AvailabilityRequestView request={request()} loading={false} error="" saving={false}
    onPatch={async (id, changes) => { writes.push({ id, changes }) }} onSubmit={async () => false} />)
  assert.deepEqual(writes, [])
  const trigger = view.getByRole('button', { name: 'Line status, Pending' })
  trigger.focus()
  fireEvent.keyDown(trigger, { key: 'ArrowDown' })
  const available = view.getByRole('option', { name: 'Available' })
  assert.deepEqual(view.getAllByRole('option').map((option) => option.textContent),
    ['Available', 'Unavailable', 'Diff Sz/Sub', 'Can Order/Arriving Soon', 'Partial Qty', 'Pending✓'])
  fireEvent.keyDown(available, { key: 'Enter' })
  await waitFor(() => assert.equal(document.activeElement, trigger))
  assert.deepEqual(writes, [{ id: 1, changes: { status: 'available', available_quantity: '6' } }])
})

test('desktop touch sizing selects only the direct Status trigger, never nested answer-dialog actions', () => {
  const writes: unknown[] = []
  const view = render(<AvailabilityRequestView request={request()} loading={false} error="" saving={false}
    onPatch={async (id, changes) => { writes.push({ id, changes }) }} onSubmit={async () => false} />)
  const trigger = view.getByRole('button', { name: 'Line status, Pending' })
  const cell = trigger.parentElement!
  assert.ok(cell.classList.contains('[&>button]:min-h-11'))
  assert.equal(cell.classList.contains('[&_button]:min-h-11'), false)
  // These assertions inspect actual mounted DOM structure; JSDOM does not prove CSS geometry.
  const dialogs: Array<[string, string[]]> = [
    ['Diff Sz/Sub', ['No Sub', 'Cancel', 'Submit']],
    ['Can Order/Arriving Soon', ['Cancel', 'Save answer']],
    ['Partial Qty', ['Cancel', 'Save answer']],
  ]
  for (const [option, actions] of dialogs) {
    fireEvent.click(trigger)
    fireEvent.click(view.getByRole('option', { name: option }))
    const directButtons = [...cell.querySelectorAll(':scope > button')]
    assert.deepEqual(directButtons, [trigger])
    assert.equal(cell.querySelectorAll('button').length, actions.length + 1)
    for (const name of actions) {
      const action = view.getByRole('button', { name })
      assert.ok(cell.contains(action), `${option}: existing non-portalled dialog stays in the cell`)
      assert.notEqual(action.parentElement, cell, `${name} is nested, not a direct trigger`)
      assert.equal(directButtons.includes(action), false, `${name} must not receive trigger sizing`)
      assert.equal(action.className.includes('min-h-11'), false, `${name} retains desktop dialog classes`)
    }
    fireEvent.click(view.getByRole('button', { name: 'Cancel' }))
  }
  assert.deepEqual(writes, [])
})

test('button alone is centered, decoration is inert and existing submission/note/receipt semantics remain', async () => {
  const submissions: string[] = []
  let accepted = false
  const props = { request: request(), loading: false, error: '', saving: false,
    onPatch: async () => {}, onSubmit: async (note: string) => { submissions.push(note); return accepted } }
  const view = render(<AvailabilityRequestView {...props} />)
  const button = view.getByRole('button', { name: 'Submit availability' })
  assert.ok(button.parentElement!.classList.contains('flex-col'))
  assert.ok(button.parentElement!.classList.contains('items-center'))
  assert.ok(button.classList.contains('w-full') && button.classList.contains('max-w-sm'))
  // The app's primary theme colour, not the old desert-night artwork.
  assert.ok(button.classList.contains('bg-primary') && button.classList.contains('text-primary-foreground'))
  assert.equal(button.querySelector('[aria-hidden="true"]'), null)
  assert.equal(button.textContent?.trim(), 'Submit availability')
  // No explanation under the button (removed 2026-10-07).
  assert.equal(button.parentElement!.children.length, 1)
  assert.deepEqual(submissions, [])
  fireEvent.click(button)
  await waitFor(() => assert.equal(submissions.length, 1))
  assert.equal(view.queryByText('Availability received'), null)
  accepted = true
  fireEvent.click(button)
  await waitFor(() => assert.ok(view.getByText('Availability received')))
  assert.deepEqual(submissions, ['Synthetic whole-request note', 'Synthetic whole-request note'])
  fireEvent.click(view.getByText('Availability received'))
  view.rerender(<AvailabilityRequestView {...props} request={request({ submittedAt: '2026-10-02T12:00:00Z' })} saving />)
  assert.equal((view.getByRole('button', { name: 'Submitting…' }) as HTMLButtonElement).disabled, true)
  view.rerender(<AvailabilityRequestView {...props} request={request({ submittedAt: '2026-10-02T12:00:00Z' })} />)
  fireEvent.click(view.getByRole('button', { name: 'Re-Submit availability' }))
  await waitFor(() => assert.ok(view.getByText('Update received')))
})

test('closed, loading and error views keep the existing submit gates and accessible content', () => {
  const props = { loading: false, error: '', saving: false, onPatch: async () => {}, onSubmit: async () => false }
  const view = render(<AvailabilityRequestView {...props} request={request({ status: 'closed' })} />)
  assert.equal(view.queryByRole('button', { name: /Submit availability/i }), null)
  assert.ok(view.getByText('This request is closed — the lines are read-only.'))
  assert.equal((view.getByRole('textbox', { name: 'Note for this request' }) as HTMLTextAreaElement).readOnly, true)
  view.rerender(<AvailabilityRequestView {...props} request={null} loading error="Synthetic load failure" />)
  assert.ok(view.getByText('Loading…'))
  assert.equal(view.getByRole('alert').textContent, 'Synthetic load failure')
  assert.equal(view.queryByRole('button', { name: /Submit availability/i }), null)
})

test('320/390/480px keep stacked phone cards, original Status association and the safe-area submit bar', () => {
  for (const phoneWidth of [320, 390, 480]) {
    width = phoneWidth
    const view = render(<AvailabilityRequestView request={request()} loading={false} error="" saving={false}
      onPatch={async () => {}} onSubmit={async () => false} />)
    assert.ok(view.getByRole('article', { name: `Line 1, ${item.name}` }))
    assert.equal(view.queryByTitle('Status — drag to reorder'), null)
    assert.ok(view.getByRole('button', { name: `Line 1, ${item.name} status, Pending` }).closest('label')!.textContent!.includes('Status'))
    assert.ok(view.getByRole('button', { name: 'Submit availability' }).parentElement!.className.includes('env(safe-area-inset-bottom)'))
    cleanup()
  }
})
