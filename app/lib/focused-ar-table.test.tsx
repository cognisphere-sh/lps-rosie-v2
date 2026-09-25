import assert from 'node:assert/strict'
import test, { afterEach, beforeEach } from 'node:test'
import React from 'react'
import { JSDOM } from 'jsdom'
import { act, cleanup, fireEvent, render, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { ARLineTable } from '../components/workspace/availability.tsx'
import { AvailabilityRequestDrawer } from '../components/workspace/ar-drawer.tsx'
import { FocusedJobRecord } from '../components/workspace/focused-job-record.tsx'
import { RequestCardHeader } from '../components/workspace/request-list-card.tsx'
import { onOpenAvailabilityRequest, openAvailabilityRequest } from './chat-bus.ts'
import type { ARDetail, ARItem } from './availability.ts'
import type { JobRequestRow } from './rows.ts'

let dom: JSDOM
const priorFetch = globalThis.fetch
let writes: string[]
const fullName = 'Quercus virginiana “Cathedral” — exact saved cultivar 超長名稱 '.repeat(3)
const supplierNote = 'Shared instruction and response; actual recorded supplier-note audience'
const item: ARItem = {
  id: 19,
  allocations: [{ jobRequestItemId: 27, quantity: 7 }, { jobRequestItemId: 28, quantity: 5 }],
  name: fullName, size: '30 G', demandedQuantity: 12, availableQuantity: 8,
  status: 'arriving_soon', unitPrice: 12.5, noteForSupplier: supplierNote,
}
const ar = (id = 84, status = 'processing'): ARDetail => ({
  id, recordName: `AR-${id}`, jobRequestId: 31, jobRequestIds: [31, 32],
  jobName: 'Courtyard', supplierId: 7, supplierName: 'Exact supplier', status,
  shareCustomerDetails: false, submittedAt: null, createdAt: '2026-09-01T15:00:00Z',
  itemCount: 1, answeredCount: 1, noteForSupplier: 'Whole-request shared note',
  jobSchedules: [
    { jobRequestId: 31, jobName: 'Courtyard', fulfillmentMethod: 'delivery', expectedInstallDate: '2026-10-01' },
    { jobRequestId: 32, jobName: 'Other Job', fulfillmentMethod: 'pickup', expectedInstallDate: '2026-10-02' },
  ], customer: null, shipping: null, items: [item],
})
const job: JobRequestRow = {
  id: 31, name: 'Courtyard', status: 'availability', customer: null,
  billing: { address: null, city: null, state: null, zip: null },
  shipping: { address: null, city: null, state: null, zip: null },
  noteForCustomer: null, notes: [], noteInternal: null,
  itemCount: 0, statusCounts: {}, lineTotal: 0, items: [],
  supplierLinks: [{ supplierId: 7, name: 'Exact supplier', lpsPartner: false,
    rosieThreadId: 'supplier-stored-thread', availabilityRequests: [{ id: 84, recordName: 'AR-84', status: 'processing' }] }],
  createdAt: null, updatedAt: null,
}

beforeEach(() => {
  dom = new JSDOM('<!doctype html><html><body><button id="outside">Outside</button></body></html>', { url: 'http://localhost/jobs?jr=31' })
  const win = dom.window
  Object.defineProperty(win, 'innerWidth', { configurable: true, value: 1280 })
  Object.defineProperty(win, 'matchMedia', { configurable: true, value: (query: string) => ({
    matches: query.includes('min-width'), media: query,
    addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
  }) })
  for (const [key, value] of Object.entries({
    window: win, self: win, document: win.document, navigator: win.navigator,
    HTMLElement: win.HTMLElement, HTMLButtonElement: win.HTMLButtonElement,
    Node: win.Node, MouseEvent: win.MouseEvent, KeyboardEvent: win.KeyboardEvent,
    CustomEvent: win.CustomEvent, DOMException: win.DOMException,
    getComputedStyle: win.getComputedStyle,
    requestAnimationFrame: (callback: FrameRequestCallback) => setTimeout(() => callback(Date.now()), 0),
    cancelAnimationFrame: (id: number) => clearTimeout(id), IS_REACT_ACT_ENVIRONMENT: true,
  })) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  Object.defineProperties(win.HTMLElement.prototype, {
    attachEvent: { configurable: true, value() {} }, detachEvent: { configurable: true, value() {} },
    getClientRects: { configurable: true, value() { return this.isConnected ? [{ width: 1, height: 1 }] : [] } },
  })
  writes = []
  globalThis.fetch = async (input, init) => {
    const path = String(input)
    assert.match(path, /^\/api\/availability-requests\/\d+$/)
    if (init?.method && init.method !== 'GET') writes.push(path)
    return Response.json({ request: ar(Number(path.split('/').at(-1))) })
  }
})
afterEach(async () => {
  cleanup()
  await new Promise(resolve => setTimeout(resolve, 0))
  globalThis.fetch = priorFetch
  dom.window.close()
})
function table(root: ParentNode) {
  const head = [...root.querySelectorAll<HTMLElement>('[style]')]
    .find(node => node.style.gridTemplateColumns && node.textContent?.startsWith('Need'))!
  assert.ok(head)
  return { head, row: head.nextElementSibling as HTMLElement, footer: head.parentElement!.lastElementChild as HTMLElement }
}
const labels = (head: HTMLElement) => [...head.children].map(node => node.textContent)
const focusedHeaders = ['Need', 'Avail qty', 'Size', 'Plant', 'Status', 'Note for supplier', 'Price', 'Line total']
const defaultHeaders = ['Need', 'Size', 'Plant', 'Status', 'Avail qty', 'Price', 'Line total', 'Note for supplier']

test('focused grid places the existing supplier-audience note after Status with header, row and subtotal aligned', () => {
  for (const design of ['default', 'portal', 'focused-job'] as const) {
    const view = render(<ARLineTable items={[item]} editable={false} design={design} />)
    const { head, row, footer } = table(view.container)
    assert.deepEqual(labels(head), design === 'focused-job' ? focusedHeaders
      : design === 'portal' ? ['Need', 'Size', 'Plant', 'Status', 'Avail qty', 'Price', 'Note for supplier'] : defaultHeaders)
    assert.equal(row.children[0].textContent, '12')
    assert.equal(row.children[design === 'focused-job' ? 1 : 4].textContent, '8')
    assert.equal(row.children[design === 'focused-job' ? 2 : 1].textContent, '30 G')
    assert.ok(row.children[design === 'focused-job' ? 3 : 2].textContent?.includes(fullName))
    assert.equal(row.children[design === 'focused-job' ? 5 : row.children.length - 1].textContent, supplierNote)
    assert.equal(head.style.gridTemplateColumns, row.style.gridTemplateColumns)
    if (design === 'focused-job') {
      assert.match(head.style.gridTemplateColumns, /56px 90px 90px 190px 150px/)
      assert.equal(head.style.minWidth, '1060px')
    } else assert.equal(head.style.minWidth, design === 'portal' ? '960px' : '1090px')
    if (design !== 'portal') {
      assert.equal(row.children[design === 'focused-job' ? 7 : 6].textContent, '$100.00')
      assert.equal(footer.style.gridTemplateColumns, head.style.gridTemplateColumns)
      assert.equal((footer.firstElementChild as HTMLElement).style.gridColumn, design === 'focused-job' ? '1 / 8' : '1 / 7')
      assert.equal(footer.lastElementChild?.textContent, '$100.00')
    } else assert.equal(view.queryByText('Subtotal'), null)
    view.unmount()
  }
  assert.deepEqual(writes, [])
})

test('optional leading Job column retains focused supplier-note and final-total alignment', () => {
  const view = render(<ARLineTable items={[item]} editable={false} design="focused-job"
    leadingHeader="Job" renderLeading={() => <span>Courtyard and Other Job</span>} />)
  const head = [...view.container.querySelectorAll<HTMLElement>('[style]')]
    .find(node => node.style.gridTemplateColumns && node.textContent?.startsWith('JobNeed'))!
  assert.ok(head)
  const row = head.nextElementSibling as HTMLElement
  const footer = head.parentElement!.lastElementChild as HTMLElement
  assert.deepEqual(labels(head), ['Job', ...focusedHeaders])
  assert.equal(row.children.length, head.children.length)
  assert.equal(row.children[6].textContent, supplierNote)
  assert.equal(row.children[8].textContent, '$100.00')
  assert.equal(head.style.gridTemplateColumns, row.style.gridTemplateColumns)
  assert.equal(footer.style.gridTemplateColumns, head.style.gridTemplateColumns)
  assert.equal((footer.firstElementChild as HTMLElement).style.gridColumn, '1 / 9')
  assert.equal(footer.lastElementChild?.textContent, '$100.00')
  assert.deepEqual(writes, [])
})

test('focused full-name disclosure never writes or duplicates the name editor; requested quantity stays distinct', async () => {
  const details: unknown[] = []
  const changes: unknown[] = []
  const view = render(<ARLineTable items={[item]} editable design="focused-job"
    onPatch={async (...args) => { changes.push(args) }} onPatchDetails={async (...args) => { details.push(args) }} />)
  const editor = view.getByRole('textbox', { name: 'Line 19 plant name' }) as HTMLInputElement
  assert.equal(editor.value, fullName)
  editor.focus()
  await userEvent.setup({ document }).tab()
  const summary = view.getByLabelText('Full plant name for line 19')
  assert.equal(document.activeElement, summary)
  assert.match(summary.className, /min-h-11/)
  fireEvent.click(summary)
  assert.equal(summary.parentElement?.hasAttribute('open'), true)
  assert.equal(summary.nextElementSibling?.textContent, fullName)
  assert.equal(view.getAllByRole('textbox', { name: /plant name/ }).length, 1)
  assert.equal((view.getByRole('textbox', { name: 'Line 19 requested quantity' }) as HTMLInputElement).value, '12')
  assert.equal((view.getByRole('textbox', { name: 'Line 19 available quantity' }) as HTMLInputElement).value, '8')
  assert.equal((view.getByRole('textbox', { name: 'Line 19 supplier notes' }) as HTMLTextAreaElement).value, supplierNote)
  assert.equal(view.getAllByRole('textbox', { name: 'Line 19 supplier notes' }).length, 1)
  assert.deepEqual(details, [])
  assert.deepEqual(changes, [])
})

test('focused Job header chip opts in; ordinary numeric and ordinary Job header restore default even for same AR', async () => {
  const events: unknown[] = []
  const off = onOpenAvailabilityRequest((id, presentation) => events.push([id, presentation]))
  const view = render(<><FocusedJobRecord request={job} mobile={false} version={0} onSaved={() => {}} /><AvailabilityRequestDrawer /></>)
  fireEvent.click(view.getByRole('button', { name: /AR-84/ }))
  await view.findByRole('dialog', { name: 'Availability request AR-84' })
  await waitFor(() => assert.deepEqual(labels(table(document.body).head), focusedHeaders))
  assert.equal(view.getByText('Whole-request shared note').textContent?.includes('Whole-request shared note'), true)
  assert.ok(view.getByText('Other Job', { exact: false }))
  assert.deepEqual(events, [[84, 'focused-job']])
  act(() => openAvailabilityRequest(84))
  await waitFor(() => assert.deepEqual(labels(table(document.body).head), defaultHeaders))
  fireEvent.click(view.getByRole('button', { name: 'Close availability request AR-84' }))
  view.unmount()
  const ordinary = render(<><RequestCardHeader request={job} mobile={false} expanded onToggle={() => {}}
    onDelete={() => {}} onSaved={() => {}} /><AvailabilityRequestDrawer /></>)
  fireEvent.click(ordinary.getByRole('button', { name: /AR-84/ }))
  await waitFor(() => assert.deepEqual(labels(table(document.body).head), defaultHeaders))
  assert.deepEqual(events, [[84, 'focused-job'], [84, 'default'], [84, 'default']])
  assert.deepEqual(writes, [])
  off()
})

test('a custom AR record name stays visible while the focused chip routes by stored numeric id', async () => {
  const savedName = 'North field · fall sourcing'
  const namedJob: JobRequestRow = {
    ...job,
    supplierLinks: [{
      ...job.supplierLinks[0],
      availabilityRequests: [{ id: 84, status: 'processing', recordName: savedName }],
    }],
  }
  const events: unknown[] = []
  const off = onOpenAvailabilityRequest((id, presentation) => events.push([id, presentation]))
  globalThis.fetch = async input => {
    assert.equal(String(input), '/api/availability-requests/84')
    return Response.json({ request: { ...ar(84), recordName: savedName } })
  }
  const view = render(<><FocusedJobRecord request={namedJob} mobile={false} version={0} onSaved={() => {}} /><AvailabilityRequestDrawer /></>)
  const chip = view.getByRole('button', { name: `Open availability request ${savedName} to Exact supplier — In progress` })
  assert.ok(chip.textContent?.includes(savedName))
  fireEvent.click(chip)
  await view.findByRole('dialog', { name: `Availability request ${savedName}` })
  await waitFor(() => assert.deepEqual(labels(table(document.body).head), focusedHeaders))
  assert.deepEqual(events, [[84, 'focused-job']])
  assert.ok(view.getByRole('button', { name: `Close availability request ${savedName}` }))
  act(() => openAvailabilityRequest(84))
  await waitFor(() => assert.deepEqual(labels(table(document.body).head), defaultHeaders))
  assert.ok(view.getByRole('dialog', { name: `Availability request ${savedName}` }))
  assert.deepEqual(events, [[84, 'focused-job'], [84, 'default']])
  assert.deepEqual(writes, [])
  off()
})

test('focused read-only/phone/empty presentations preserve source note and no write on navigation', async () => {
  const phone = render(<ARLineTable items={[item]} editable design="focused-job" mobileCards
    onPatchDetails={async () => { throw new Error('unexpected write') }} />)
  assert.equal(phone.container.querySelectorAll('article').length, 1)
  assert.equal(phone.getAllByRole('textbox', { name: /plant name/ }).length, 1)
  const full = phone.getByLabelText('Full plant name for line 19')
  fireEvent.click(full)
  assert.equal(full.nextElementSibling?.textContent, fullName)
  assert.ok(phone.getByRole('textbox', { name: /supplier notes/ }))
  const card = phone.container.querySelector('article')!
  const statusLabel = within(card).getByText('Status').closest('label')!
  const noteLabel = within(card).getByText('Note for supplier').closest('label')!
  assert.equal(statusLabel.nextElementSibling, noteLabel)
  assert.equal(within(card).getAllByText('Note for supplier').length, 1)
  phone.unmount()
  const empty = render(<ARLineTable items={[]} editable={false} design="focused-job" />)
  assert.ok(empty.getByText('No lines on this request.'))
  assert.equal(empty.queryByText('Subtotal'), null)
  empty.rerender(<ARLineTable items={[item]} editable={false} design="focused-job" mobileCards />)
  assert.equal(empty.queryAllByRole('textbox').length, 0)
  assert.ok(empty.getByText(fullName).classList.contains('break-words'))
  assert.equal(empty.getByText(supplierNote).textContent, supplierNote)
  const readonlyCard = empty.container.querySelector('article')!
  assert.equal(within(readonlyCard).getByText('Status').closest('label')?.nextElementSibling,
    within(readonlyCard).getByText('Note for supplier').closest('label'))
  const ordinaryPhone = render(<ARLineTable items={[item]} editable={false} design="default" mobileCards />)
  const ordinaryCard = ordinaryPhone.container.querySelector('article')!
  assert.equal(within(ordinaryCard).getByText('Status').closest('label')?.nextElementSibling?.textContent?.includes('Available qty'), true)
  assert.equal(within(ordinaryCard).getAllByText('Note for supplier').length, 1)
  assert.deepEqual(writes, [])
})

test('closed focused AR stays read-only with merged supplier note and total visible', async () => {
  globalThis.fetch = async () => Response.json({ request: ar(84, 'closed') })
  const view = render(<AvailabilityRequestDrawer />)
  act(() => openAvailabilityRequest(84, 'focused-job'))
  await waitFor(() => assert.deepEqual(labels(table(document.body).head), focusedHeaders))
  const { row, footer } = table(document.body)
  assert.equal(within(row).queryAllByRole('textbox').length, 0)
  assert.ok(row.textContent?.includes(fullName))
  assert.ok(row.textContent?.includes(supplierNote))
  assert.equal(footer.lastElementChild?.textContent, '$100.00')
  assert.equal(view.queryByRole('button', { name: 'Submit request' }), null)
  assert.deepEqual(writes, [])
})

test('a multi-Job AR keeps each line supplier note after Status only in focused drawing and subtotal under Line total', async () => {
  const other: ARItem = {
    ...item, id: 20, name: 'Acer rubrum', demandedQuantity: 3, availableQuantity: 2,
    allocations: [{ jobRequestItemId: 29, quantity: 3 }], unitPrice: 20,
    noteForSupplier: 'Second line: LPS ask and supplier reply share the existing field',
  }
  globalThis.fetch = async input => {
    assert.equal(String(input), '/api/availability-requests/84')
    return Response.json({ request: { ...ar(84), itemCount: 2, answeredCount: 2, items: [item, other] } })
  }
  const view = render(<AvailabilityRequestDrawer />)
  act(() => openAvailabilityRequest(84, 'focused-job'))
  await waitFor(() => assert.deepEqual(labels(table(document.body).head), focusedHeaders))
  const { head, row, footer } = table(document.body)
  const otherRow = row.nextElementSibling as HTMLElement
  for (const [line, expectedNote, expectedTotal] of [
    [row, supplierNote, '$100.00'],
    [otherRow, other.noteForSupplier, '$40.00'],
  ] as const) {
    assert.equal(line.style.gridTemplateColumns, head.style.gridTemplateColumns)
    assert.equal(line.children.length, head.children.length)
    assert.equal(line.children[5].textContent, expectedNote)
    assert.equal(line.children[7].textContent, expectedTotal)
  }
  assert.equal((footer.firstElementChild as HTMLElement).style.gridColumn, '1 / 8')
  assert.equal(footer.lastElementChild?.textContent, '$140.00')
  assert.ok(view.getByText('Other Job', { exact: false }))
  act(() => openAvailabilityRequest(84))
  await waitFor(() => assert.deepEqual(labels(table(document.body).head), defaultHeaders))
  const ordinary = table(document.body)
  assert.equal(ordinary.row.children[7].textContent, supplierNote)
  assert.equal((ordinary.row.nextElementSibling as HTMLElement).children[7].textContent, other.noteForSupplier)
  assert.equal((ordinary.footer.firstElementChild as HTMLElement).style.gridColumn, '1 / 7')
  assert.equal(ordinary.footer.lastElementChild?.textContent, '$140.00')
  assert.deepEqual(writes, [])
})

test('late focused AR load cannot relabel or repaint subsequent ordinary AR', async () => {
  let resolve!: (value: Response) => void
  const slow = new Promise<Response>(done => { resolve = done })
  globalThis.fetch = async input => String(input).endsWith('/84') ? slow : Response.json({ request: ar(85) })
  render(<AvailabilityRequestDrawer />)
  act(() => openAvailabilityRequest(84, 'focused-job'))
  act(() => openAvailabilityRequest(85))
  await waitFor(() => assert.deepEqual(labels(table(document.body).head), defaultHeaders))
  await act(async () => resolve(Response.json({ request: { ...ar(84), supplierName: 'Stale supplier' } })))
  assert.ok(within(document.body).getByRole('dialog', { name: 'Availability request AR-85' }))
  assert.equal(within(document.body).queryByText('Stale supplier'), null)
  assert.deepEqual(labels(table(document.body).head), defaultHeaders)
  assert.deepEqual(writes, [])
})
