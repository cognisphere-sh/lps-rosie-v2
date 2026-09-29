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
    if (init?.method && init.method !== 'GET') writes.push(`${path} ${init.body}`)
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
const portalHeaders = ['Need', 'Avail qty', 'Size', 'Plant', 'Status', 'Note', 'Unit price']
const defaultHeaders = ['Need', 'Avail qty', 'Size', 'Plant', 'Status', 'Note', 'Unit price']

test('focused Job header chip opens the portal drawing and summary strip; ordinary opens restore default even for same AR', async () => {
  const events: unknown[] = []
  const off = onOpenAvailabilityRequest((id, presentation) => events.push([id, presentation]))
  const view = render(<><FocusedJobRecord request={job} mobile={false} version={0} onSaved={() => {}} /><AvailabilityRequestDrawer /></>)
  fireEvent.click(view.getByRole('button', { name: /AR-84/ }))
  await view.findByRole('dialog', { name: 'Availability request AR-84' })
  await waitFor(() => assert.deepEqual(labels(table(document.body).head), portalHeaders))
  const { head, row } = table(document.body)
  assert.equal(head.style.gridTemplateColumns, row.style.gridTemplateColumns)
  await waitFor(() => assert.ok(parseInt(table(document.body).head.style.minWidth, 10) > 916))
  assert.equal(row.children[5].getAttribute('aria-label'), 'Line 19 supplier notes')
  assert.equal(row.children[6].getAttribute('aria-label'), 'Line 19 price per unit')
  assert.ok(within(document.body).getByText('Total Items'))
  assert.equal(within(document.body).queryByText('Line total'), null)
  assert.ok(view.getByText('Other Job', { exact: false }))
  assert.deepEqual(events, [[84, 'focused-job']])
  act(() => openAvailabilityRequest(84))
  await waitFor(() => assert.deepEqual(labels(table(document.body).head), defaultHeaders))
  assert.equal(within(document.body).queryByText('Total Items'), null)
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
  await waitFor(() => assert.deepEqual(labels(table(document.body).head), portalHeaders))
  assert.deepEqual(events, [[84, 'focused-job']])
  act(() => openAvailabilityRequest(84))
  await waitFor(() => assert.deepEqual(labels(table(document.body).head), defaultHeaders))
  assert.deepEqual(events, [[84, 'focused-job'], [84, 'default']])
  assert.deepEqual(writes, [])
  off()
})

test('focused drawer edits name, size, need, price and note inline through the admin routes', async () => {
  const keys: Record<string, keyof ARItem> = {
    name: 'name', size: 'size', demanded_quantity: 'demandedQuantity',
    unit_price: 'unitPrice', note_for_supplier: 'noteForSupplier',
  }
  let saved: ARItem = { ...item }
  globalThis.fetch = async (input, init) => {
    if (init?.method === 'PATCH') {
      writes.push(`${input} ${init.body}`)
      const { details, changes } = JSON.parse(String(init.body)) as Record<string, Record<string, string>>
      for (const [column, value] of Object.entries({ ...details, ...changes })) {
        saved = { ...saved, [keys[column]]: typeof item[keys[column]] === 'number' ? Number(value) : value }
      }
    }
    return Response.json({ request: { ...ar(84), items: [saved] } })
  }
  render(<AvailabilityRequestDrawer />)
  act(() => openAvailabilityRequest(84, 'focused-job'))
  await waitFor(() => assert.deepEqual(labels(table(document.body).head), portalHeaders))
  await waitFor(() => assert.ok(parseInt(table(document.body).head.style.minWidth, 10) > 916))
  const user = userEvent.setup({ document })
  const edit = async (name: string, value: string) => {
    const field = within(table(document.body).row).getByRole('textbox', { name })
    await user.clear(field)
    await user.type(field, value)
    await user.tab()
    await waitFor(() => assert.ok(writes.some(write => write.includes(value))))
  }
  await edit('Line 19 plant name', 'Quercus alba')
  await edit('Line 19 requested size', '45 G')
  await edit('Line 19 requested quantity', '14')
  await edit('Line 19 price per unit', '13.25')
  await edit('Line 19 supplier notes', 'Tagged and held')
  assert.deepEqual(writes.map(write => JSON.parse(write.slice(write.indexOf(' ') + 1))), [
    { itemId: 19, details: { name: 'Quercus alba' } },
    { itemId: 19, details: { size: '45 G' } },
    { itemId: 19, details: { demanded_quantity: '14' } },
    { itemId: 19, changes: { unit_price: '13.25' } },
    { itemId: 19, details: { note_for_supplier: 'Tagged and held' } },
  ])
})

test('the portal status menu opens inside the drawer host, where the modal leaves it interactive', async () => {
  render(<AvailabilityRequestDrawer />)
  act(() => openAvailabilityRequest(84, 'focused-job'))
  await waitFor(() => assert.deepEqual(labels(table(document.body).head), portalHeaders))
  fireEvent.click(within(table(document.body).row).getByRole('button', { name: /^Line status/ }))
  const listbox = await within(document.body).findByRole('listbox', { name: 'Line status' })
  assert.ok(listbox.closest('[data-ar-drawer-host]'))
  assert.equal(listbox.closest('[inert]'), null)
  assert.deepEqual(writes, [])
})

test('closed focused AR stays read-only in the portal drawing', async () => {
  globalThis.fetch = async () => Response.json({ request: ar(84, 'closed') })
  const view = render(<AvailabilityRequestDrawer />)
  act(() => openAvailabilityRequest(84, 'focused-job'))
  await waitFor(() => assert.deepEqual(labels(table(document.body).head), portalHeaders))
  const { row } = table(document.body)
  assert.equal(within(row).queryAllByRole('textbox').length, 0)
  assert.ok(row.textContent?.includes(fullName))
  assert.ok(row.textContent?.includes(supplierNote))
  assert.ok(within(document.body).getByText('$100.00'))
  assert.equal(view.queryByRole('button', { name: 'Submit request' }), null)
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

test('an editable cell shows its full text as a hover tooltip only when clipped', async () => {
  render(<AvailabilityRequestDrawer />)
  act(() => openAvailabilityRequest(84, 'focused-job'))
  await waitFor(() => assert.deepEqual(labels(table(document.body).head), portalHeaders))
  const name = within(table(document.body).row).getByRole('textbox', { name: 'Line 19 plant name' })
  const size = within(table(document.body).row).getByRole('textbox', { name: 'Line 19 requested size' })
  Object.defineProperties(name, { scrollWidth: { value: 400 }, clientWidth: { value: 180 } })
  fireEvent.mouseEnter(name)
  fireEvent.mouseEnter(size)
  assert.equal(name.title, fullName)
  assert.equal(size.title, '')
  assert.deepEqual(writes, [])
})

test('portal drawing clips Plant, wraps Size, saves them on Enter, and clamps Notes', async () => {
  const saved: unknown[] = []
  const view = render(<ARLineTable items={[item]} editable design="portal"
    onPatch={async () => {}} onPatchDetails={async (...args) => { saved.push(args) }} />)
  const name = view.getByRole('textbox', { name: 'Line 19 plant name' }) as HTMLInputElement
  const size = view.getByRole('textbox', { name: 'Line 19 requested size' })
  const note = view.getByRole('textbox', { name: 'Line 19 supplier notes' })
  assert.equal(name.tagName, 'INPUT')
  assert.match(name.className, /truncate/)
  assert.equal(size.tagName, 'TEXTAREA')
  assert.match(size.className, /whitespace-pre-wrap/)
  assert.match(note.className, /whitespace-nowrap/)
  assert.match(note.className, /focus:whitespace-pre-wrap/)
  const user = userEvent.setup({ document })
  await user.clear(name)
  await user.type(name, 'Quercus alba{Enter}')
  assert.equal(name.value, 'Quercus alba')
  assert.deepEqual(saved, [[19, { name: 'Quercus alba' }]])
})

test('AR columns fit the full plant name and retain a dragged, resized layout', async () => {
  const first = render(<ARLineTable items={[item]} editable={false} design="portal" />)
  await waitFor(() => assert.ok(parseInt(table(first.container).head.style.gridTemplateColumns.split(' ')[3], 10) > 200))
  const initialPlantWidth = parseInt(table(first.container).head.style.gridTemplateColumns.split(' ')[3], 10)
  const data = new Map<string, string>()
  const dataTransfer = {
    setData: (type: string, value: string) => data.set(type, value),
    getData: (type: string) => data.get(type) ?? '',
    effectAllowed: 'move', dropEffect: 'move',
  }
  fireEvent.dragStart(first.getByText('Unit price'), { dataTransfer })
  fireEvent.drop(first.getByText('Note').parentElement!, { dataTransfer })
  assert.deepEqual(labels(table(first.container).head), ['Need', 'Avail qty', 'Size', 'Plant', 'Status', 'Unit price', 'Note'])
  assert.equal(table(first.container).row.children[5].getAttribute('title'), '$12.50')
  assert.equal(table(first.container).row.children[6].getAttribute('title'), supplierNote)

  fireEvent.mouseDown(first.getByRole('separator', { name: 'Resize Plant' }), { clientX: 100 })
  fireEvent.mouseMove(document, { clientX: 150 })
  fireEvent.mouseUp(document)
  await waitFor(() => assert.equal(
    parseInt(table(first.container).head.style.gridTemplateColumns.split(' ')[3], 10), initialPlantWidth + 50,
  ))
  first.unmount()

  const second = render(<ARLineTable items={[item]} editable={false} design="portal" />)
  await waitFor(() => assert.deepEqual(labels(table(second.container).head),
    ['Need', 'Avail qty', 'Size', 'Plant', 'Status', 'Unit price', 'Note']))
  assert.equal(parseInt(table(second.container).head.style.gridTemplateColumns.split(' ')[3], 10), initialPlantWidth + 50)
})
