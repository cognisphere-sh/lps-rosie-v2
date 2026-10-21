import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { JSDOM } from 'jsdom'
import type { Order, OrderItem } from './orders'

const plant = (id: number, name: string, status = 'available'): OrderItem => ({
  id, name, status, size: '5 G', quantity: 3,
  unitPrice: 20, total: 60, noteForSupplier: null, noteFromSupplier: null,
})
function order(id: number, overrides: Partial<Order> = {}): Order {
  return {
    id, supplierId: 7, supplierName: 'APS', status: 'new',
    fulfillmentMethod: null, confirmationDate: null, createdAt: '2026-09-15T12:00:00Z',
    additionalDetails: null, changeLog: null, noteFromSupplier: null, availabilityRequestId: 42, items: [plant(id * 10, 'Rose', 'need_to_order')], ...overrides,
  }
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

test('partner order lifecycle and matching request layouts', async (t) => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/partner/7/orders' })
  const originalFetch = globalThis.fetch
  const win = dom.window
  Object.defineProperty(win, 'matchMedia', { configurable: true, writable: true, value: (query: string) => ({
    matches: query.includes('min-width: 900px'), media: query,
    addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
  }) })
  Object.defineProperty(win.HTMLDialogElement.prototype, 'showModal', { configurable: true, value() { this.setAttribute('open', '') } })
  Object.defineProperty(win.HTMLElement.prototype, 'scrollTo', { configurable: true, value() {} })
  class FakeEventSource {
    static instances: FakeEventSource[] = []
    onmessage: ((event: { data: string }) => void) | null = null
    onopen: (() => void) | null = null
    closed = false
    constructor(readonly url: string) { FakeEventSource.instances.push(this) }
    close() { this.closed = true }
    emit() { this.onmessage?.({ data: '{"type":"jobs"}' }) }
  }
  for (const [key, value] of Object.entries({
    window: win, self: win, document: win.document, navigator: win.navigator,
    HTMLElement: win.HTMLElement, HTMLInputElement: win.HTMLInputElement,
    HTMLTextAreaElement: win.HTMLTextAreaElement, Element: win.Element, Node: win.Node,
    EventSource: FakeEventSource, getComputedStyle: win.getComputedStyle,
    requestAnimationFrame: (callback: FrameRequestCallback) => setTimeout(() => callback(Date.now()), 0),
    cancelAnimationFrame: (id: number) => clearTimeout(id), IS_REACT_ACT_ENVIRONMENT: true,
  })) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  const { act, cleanup, configure, fireEvent, render, waitFor, within } = await import('@testing-library/react/pure')
  configure({ asyncUtilTimeout: 5000 })
  const { AppRouterContext } = await import('next/dist/shared/lib/app-router-context.shared-runtime')
  const { PathParamsContext } = await import('next/dist/shared/lib/hooks-client-context.shared-runtime')
  const { OrderCard, JobOrders } = await import('../components/workspace/orders')
  const { PartnerOrdersView } = await import('../components/workspace/partner-orders')
  const { default: PartnerOrderPage } = await import('../app/partner/[id]/orders/[orderId]/page')
  const router = { back() {}, forward() {}, refresh() {}, hmrRefresh() {}, push() {}, replace() {}, prefetch: async () => undefined }
  const portal = (content: React.ReactNode) => <AppRouterContext.Provider value={router as never}>
    <PathParamsContext.Provider value={{ id: '7', orderId: '11' }}>{content}</PathParamsContext.Provider>
  </AppRouterContext.Provider>
  const portalResponse = (url: string) => {
    if (url.includes('/chat?')) return json({ messages: [], readId: 0, pending: false, hasMore: false })
    if (url === '/api/partner/7') return json({ supplier: { name: 'APS' }, requests: [] })
    throw new Error(`Unexpected fetch: ${url}`)
  }
  t.afterEach(async () => { cleanup(); await new Promise((resolve) => setTimeout(resolve, 0)); globalThis.fetch = originalFetch })
  try {
    await t.test('database changes refresh order items and deletion without a chat reply', async () => {
      let current = order(11)
      let deleted = false
      let reads = 0
      globalThis.fetch = (async (input) => {
        if (String(input) !== '/api/partner/7/orders/11') return portalResponse(String(input))
        reads++
        return deleted ? json({ error: 'Order not found' }, 404) : json({ order: current, canEdit: true })
      }) as typeof fetch
      const view = render(portal(<PartnerOrderPage />))
      await view.findByRole('cell', { name: '$60.00' })
      const source = FakeEventSource.instances.findLast(entry => entry.url === '/api/partner/7/events')!
      assert.ok(source)
      current = { ...current, items: [{ ...current.items[0], quantity: 5, total: 100 }] }
      await act(async () => {
        source.emit()
        await new Promise(resolve => setTimeout(resolve, 250))
      })
      assert.ok(view.getByRole('cell', { name: '$100.00' }))
      assert.equal(reads, 2)
      deleted = true
      await act(async () => {
        source.emit()
        await new Promise(resolve => setTimeout(resolve, 250))
      })
      assert.match(view.getByRole('alert').textContent ?? '', /Order not found/)
      assert.equal(view.queryByRole('cell', { name: '$100.00' }), null)
      view.unmount()
      assert.equal(source.closed, true)
    })

    await t.test('supplier acknowledges without input, then marks ready (0149)', async () => {
      let current = order(11, { fulfillmentMethod: 'delivery', jobSchedules: [{ expectedInstallDate: '2026-09-25', fulfillmentMethod: 'delivery' }], changeLog: '- 10/22: Rose qty 3 → 4',
        customerDetails: [{ jobName: 'Courtyard', customer: { name: 'Sam', company: 'Gardens', phone: null, email: null }, address: null }],
        additionalDetails: [{ field: 'Customer', value: 'Gardens' }, { field: 'Delivery address', value: '12 Garden Lane' }] })
      const writes: unknown[] = []
      let printCalls = 0
      win.print = () => { printCalls += 1 }
      globalThis.fetch = (async (input, init) => {
        if (String(input) !== '/api/partner/7/orders/11') return portalResponse(String(input))
        if (init?.method === 'PATCH') {
          const body = JSON.parse(String(init.body))
          writes.push(body)
          current = { ...current, ...body, confirmationDate: '2026-09-15' }
          return json({ order: current })
        }
        return json({ order: current, canEdit: true })
      }) as typeof fetch
      const view = render(portal(<PartnerOrderPage />))
      const trigger = await view.findByRole('button', { name: 'Acknowledge Received' })
      assert.equal(view.queryByRole('dialog'), null)
      assert.equal(view.queryByRole('combobox', { name: /Pickup or delivery/ }), null)
      assert.ok(view.getByRole('region', { name: 'Order summary' }))
      assert.ok(view.getByRole('contentinfo', { name: 'Order actions' }).contains(trigger))
      assert.equal(view.queryByText('This account has read-only access to this order.'), null)
      assert.equal(view.getByRole('region', { name: 'Job details' }).querySelector('[aria-label="Job schedules"]')?.children.length, 1, 'one job, one EDD')
      // One row like the /requests job card: status, reference and job, EDD, mode, items, total (2026-10-21);
      // the Additional details sit below it, no contact rows (0149).
      assert.match(view.getByRole('region', { name: 'Job details' }).textContent ?? '', /^NewO-11EDDFri, 09\/25Delivery1 item\$60\.00/)
      assert.equal(view.queryByText('Contact'), null)
      assert.match(view.getByRole('region', { name: 'Additional details' }).textContent ?? '', /CustomerGardensDelivery address12 Garden Lane/)
      const detailsToggle = within(view.getByRole('region', { name: 'Additional details' })).getByRole('button', { name: 'Additional details' })
      assert.equal(detailsToggle.getAttribute('aria-expanded'), 'true', 'open by default on the supplier page (2026-10-21)')
      assert.equal(document.getElementById(detailsToggle.getAttribute('aria-controls')!)!.hidden, false)
      assert.ok(view.getByRole('region', { name: 'Change log' }), 'the change log is its own section on screen')
      // The print sheet: mode, target date and the details' fields, then Qty … Total, Ready / Need to Order boxes and a blank Note; no order number.
      const sheet = () => document.getElementById('order-print-sheet')!
      // One bordered label/value table, two fields to a row; no change log on paper (2026-10-21).
      await waitFor(() => assert.ok(sheet().querySelector('table[aria-label="Order details"]')))
      assert.deepEqual([...sheet().querySelectorAll('table[aria-label="Order details"] tr')].map((row) => [...row.querySelectorAll('td')].map((cell) => cell.textContent)),
        [['Mode', 'Delivery', 'Target date', 'Fri, 09/25'], ['Customer', 'Gardens', 'Delivery address', '12 Garden Lane']])
      assert.doesNotMatch(sheet().textContent ?? '', /Change log|Rose qty 3 → 4/)
      assert.deepEqual([...sheet().querySelectorAll('th')].map((cell) => cell.textContent), ['Qty', 'Size', 'Name', 'Unit price', 'Total', 'Ready', 'Need to Order', 'Note'])
      assert.deepEqual([...sheet().querySelectorAll('table:not([aria-label]) tbody tr')].map((row) => [...row.querySelectorAll('td')].slice(5).map((cell) => cell.textContent)), [['', '', '']], 'blank boxes to tick, a blank note')
      assert.doesNotMatch(sheet().textContent ?? '', /O-11|APS/)
      fireEvent.click(view.getByRole('button', { name: 'Print' }))
      assert.equal(printCalls, 1)
      fireEvent.click(trigger)
      const dialog = within(view.getByRole('dialog', { name: 'Acknowledge Received · O-11' }))
      assert.equal(dialog.queryByRole('textbox'), null, 'nothing to fill in')
      assert.equal(view.getByRole('dialog').querySelector('input'), null)
      assert.match(view.getByRole('dialog').textContent ?? '', /send Local Plant Supply a message from the Chat sidebar/)
      await act(async () => { fireEvent.click(dialog.getByRole('button', { name: 'Acknowledge Received' })) })
      assert.deepEqual(writes, [{ status: 'processing' }])
      assert.equal(view.queryByRole('dialog'), null)
      assert.ok(view.getByText('Processing', { selector: 'span[data-order-status]' }))
      assert.equal(view.queryByRole('button', { name: 'Acknowledge Received' }), null)
      assert.equal(view.getByRole('link', { name: 'AR-42' }).getAttribute('href'), '/partner/7/requests/42', 'the supplier\'s AR for the job')
      assert.equal(view.queryByRole('button', { name: 'Edit fulfillment details' }), null)
      await act(async () => { fireEvent.click(view.getByRole('button', { name: 'Mark as Ready' })) })
      assert.equal(writes.length, 1, 'Mark as Ready asks once more before it writes')
      await act(async () => { fireEvent.click(view.getByRole('button', { name: 'Confirm: ready for Fri, 09/25' })) })
      assert.deepEqual(writes[1], { status: 'order_ready' })
      assert.ok(view.getByText('Order Ready', { selector: 'span[data-order-status]' }))
      assert.equal(view.queryByRole('button', { name: 'Mark as Ready' }), null)
      assert.equal(view.queryByRole('button', { name: 'Acknowledge Received' }), null)
    })

    await t.test('a failed acknowledgement can be retried; cancel closes the dialog', async () => {
      let calls = 0
      let refreshed = 0
      globalThis.fetch = (async () => ++calls === 1 ? json({ error: 'The order changed; please try again' }, 409) : json({ ok: true })) as typeof fetch
      const view = render(<OrderCard order={order(11, { fulfillmentMethod: 'pickup' })} supplierId={7} canEdit onChanged={() => { refreshed += 1 }} />)
      fireEvent.click(view.getByRole('button', { name: 'Acknowledge Received' }))
      const dialog = within(view.getByRole('dialog'))
      await act(async () => { fireEvent.click(dialog.getByRole('button', { name: 'Acknowledge Received' })) })
      assert.match(dialog.getByRole('alert').textContent ?? '', /order changed/)
      assert.equal(refreshed, 0)
      assert.ok(view.getByText('New', { selector: 'span[data-order-status]' }))
      await act(async () => { fireEvent.click(dialog.getByRole('button', { name: 'Acknowledge Received' })) })
      assert.equal(calls, 2)
      assert.equal(refreshed, 1)
      assert.equal(view.queryByRole('dialog'), null)
      fireEvent.click(view.getByRole('button', { name: 'Acknowledge Received' }))
      fireEvent.click(within(view.getByRole('dialog')).getByRole('button', { name: 'Cancel' }))
      assert.equal(view.queryByRole('dialog'), null)
      assert.equal(calls, 2)
    })

    await t.test('Chris expands job orders independently without a supplier confirmation control', () => {
      const view = render(<>{(['new', 'processing', 'order_ready'] as const).map((status, index) => <OrderCard key={status} order={order(index + 1, { status, noteFromSupplier: 'Ready after 10 am', fulfillmentMethod: 'pickup' })} canEdit />)}</>)
      const first = view.getByRole('button', { name: 'Expand order O-1' })
      const panel = document.getElementById(first.getAttribute('aria-controls')!)!
      fireEvent.click(first)
      assert.equal(panel.hidden, false)
      assert.equal(view.getByRole('button', { name: 'Expand order O-2' }).getAttribute('aria-expanded'), 'false')
      assert.equal(within(view.getByRole('article', { name: 'Order O-1' })).getByRole('link', { name: 'AR-42' }).getAttribute('href'), '/suppliers/7?tab=requests&ar=42')
      assert.ok(within(panel).getByText('Ready after 10 am'))
      for (const id of [2, 3]) fireEvent.click(view.getByRole('button', { name: `Expand order O-${id}` }))
      assert.equal(view.queryByRole('combobox', { name: /Pickup or delivery/ }), null)
      assert.equal(view.queryByLabelText(/Fulfillment date for/), null)
      assert.equal(within(view.getByRole('article', { name: 'Order O-1' })).queryByRole('button', { name: 'Acknowledge Received' }), null)
      assert.ok(within(view.getByRole('article', { name: 'Order O-2' })).getByRole('button', { name: 'Mark as Ready' }))
      assert.equal(view.queryByRole('button', { name: 'Edit fulfillment details' }), null)
      fireEvent.click(first)
      assert.equal(panel.hidden, true)
      assert.equal(view.getByRole('button', { name: 'Collapse order O-2' }).getAttribute('aria-expanded'), 'true')
    })

    await t.test('authorized portal previews have controls while revoked access and archived orders do not', async () => {
      let current = order(11, { status: 'processing', fulfillmentMethod: 'delivery', jobSchedules: [{ expectedInstallDate: '2026-09-20', fulfillmentMethod: 'delivery' }] })
      let canEdit = true
      const writes: unknown[] = []
      globalThis.fetch = (async (input, init) => {
        if (String(input) !== '/api/partner/7/orders/11') return portalResponse(String(input))
        if (init?.method === 'PATCH') {
          const body = JSON.parse(String(init.body))
          writes.push(body)
          current = { ...current, ...body }
          return json({ ok: true })
        }
        return json({ order: current, canEdit })
      }) as typeof fetch
      const view = render(portal(<PartnerOrderPage />))
      await view.findByRole('heading', { name: 'O-11' })
      assert.match(view.getByRole('region', { name: 'Job details' }).textContent ?? '', /Sun, 09\/20/)
      assert.equal(view.queryByRole('combobox', { name: /Pickup or delivery/ }), null)
      assert.ok(view.getByRole('button', { name: 'Mark as Ready' }))
      assert.equal(view.queryByText('This account has read-only access to this order.'), null)
      assert.deepEqual(writes, [])
      assert.equal(current.status, 'processing')
      canEdit = false
      await act(async () => { FakeEventSource.instances.findLast(entry => entry.url === '/api/partner/7/events')!.emit(); await new Promise(resolve => setTimeout(resolve, 250)) })
      assert.equal(view.queryByRole('button', { name: 'Mark as Ready' }), null)
      assert.equal(view.queryByRole('combobox', { name: /Pickup or delivery/ }), null)
      assert.ok(view.getByText('This account has read-only access to this order.'))
      current = { ...current, closed: true }; canEdit = true
      await act(async () => { FakeEventSource.instances.findLast(entry => entry.url === '/api/partner/7/events')!.emit(); await new Promise(resolve => setTimeout(resolve, 250)) })
      assert.equal(view.queryByRole('button', { name: 'Mark as Ready' }), null)
      assert.equal(view.queryByRole('contentinfo', { name: 'Order actions' }), null)
      assert.equal(view.queryByRole('combobox', { name: /Pickup or delivery/ }), null)
      assert.ok(view.getAllByRole('link', { name: 'Back to closed orders' }).some((link) => link.getAttribute('href') === '/partner/7/closed-orders'))
    })

    await t.test('Chris edits the additional details as fields on the job Orders tab; pickup/delivery is the job\'s (0149, 0151)', async () => {
      let current = order(11, { fulfillmentMethod: 'delivery', additionalDetails: [{ field: 'Customer', value: 'Gardens' }] })
      const writes: unknown[] = []
      let saved = 0
      globalThis.fetch = (async (input, init) => {
        if (String(input) === '/api/orders/11' && init?.method === 'PATCH') {
          const body = JSON.parse(String(init.body))
          writes.push(body)
          current = { ...current, ...body }
          return json({ ok: true })
        }
        assert.equal(String(input), '/api/orders?job=5')
        return json({ orders: [current], lines: [], additionalDetails: null })
      }) as typeof fetch
      const view = render(<JobOrders jobRequestId={5} onChanged={() => { saved += 1 }} />)
      await view.findByRole('button', { name: 'Expand order O-11' })
      assert.equal(view.queryByRole('button', { name: 'Acknowledge Received' }), null)
      assert.equal(view.queryByRole('combobox', { name: /Pickup or delivery/ }), null, 'set on the job, not the order')
      assert.ok(view.getByText('Delivery', { selector: 'span' }))
      fireEvent.click(within(view.getByRole('region', { name: 'Additional details' })).getByRole('button', { name: 'Additional details' }))
      fireEvent.click(view.getByRole('button', { name: 'Edit additional details for O-11' }))
      const editor = within(view.getByRole('group', { name: 'Edit additional details for O-11' }))
      assert.equal((editor.getByRole('textbox', { name: 'Customer value' }) as HTMLTextAreaElement).value, 'Gardens')
      fireEvent.click(editor.getByRole('button', { name: 'Add field' }))
      fireEvent.change(editor.getByRole('textbox', { name: 'Field 2' }), { target: { value: 'Gate code' } })
      fireEvent.change(editor.getByRole('textbox', { name: 'Gate code value' }), { target: { value: ' 1234 ' } })
      fireEvent.click(editor.getByRole('button', { name: 'Move Gate code up' }))
      fireEvent.click(editor.getByRole('button', { name: 'Add field' }))
      await act(async () => { fireEvent.click(editor.getByRole('button', { name: 'Save details' })) })
      assert.deepEqual(writes, [{ additionalDetails: [{ field: 'Gate code', value: '1234' }, { field: 'Customer', value: 'Gardens' }] }], 'in order, trimmed, the blank row dropped')
      await waitFor(() => assert.match(view.getByRole('region', { name: 'Additional details' }).textContent ?? '', /Gate code1234CustomerGardens/))
      assert.equal(view.queryByRole('group', { name: 'Edit additional details for O-11' }), null)
      assert.equal(saved, 1)
      fireEvent.click(view.getByRole('button', { name: 'Edit additional details for O-11' }))
      fireEvent.click(view.getByRole('button', { name: 'Add field' }))
      fireEvent.change(view.getByRole('textbox', { name: 'Field 3' }), { target: { value: 'Payment method' } })
      await act(async () => { fireEvent.click(view.getByRole('button', { name: 'Save details' })) })
      assert.equal(writes.length, 1, 'a field without a value is not sent')
      assert.match(within(view.getByRole('group', { name: 'Edit additional details for O-11' })).getByRole('alert').textContent ?? '', /needs a field and a value/)
    })

    await t.test('queue lifecycle buckets and floating grouping use matching open orders', async () => {
      const orders = [order(11, { items: [plant(111, 'Rose', 'need_to_order'), plant(112, 'Oak')] }),
        order(12, { status: 'processing', items: [plant(121, 'Rose')], fulfillmentMethod: 'pickup' }),
        order(13, { status: 'order_ready', items: [plant(131, 'Lavender')] }), order(14, { status: 'processing', closed: true }), order(15, { status: 'closed_won' })]
      globalThis.fetch = (async (input) => String(input) === '/api/partner/7/orders' ? json({ orders, supplier: { name: 'APS' } }) : portalResponse(String(input))) as typeof fetch
      const view = render(portal(<PartnerOrdersView />))
      const card = await view.findByRole('link', { name: 'New order O-11' })
      assert.equal(card.closest('article')!.getAttribute('data-order-row-status'), 'new')
      const buckets = view.getByRole('group', { name: 'Order work buckets' })
      assert.equal(within(buckets).getAllByRole('button').length, 3)
      assert.ok(view.getByRole('button', { name: 'New: 1 order, selected', pressed: true }))
      assert.ok(view.getByRole('button', { name: 'Processing: 1 order, selected', pressed: true }))
      assert.ok(view.getByRole('link', { name: 'Processing order O-12' }))
      assert.equal(view.queryByRole('link', { name: 'Order Ready order O-13' }), null)
      assert.equal(view.queryByRole('link', { name: 'Processing order O-14' }), null)
      fireEvent.click(view.getByRole('button', { name: 'New: 1 order, selected' }))
      assert.equal(view.queryByRole('link', { name: 'New order O-11' }), null)
      assert.ok(view.getByRole('link', { name: 'Processing order O-12' }))
      fireEvent.click(view.getByRole('button', { name: 'Ready: 1 order, not selected' }))
      assert.ok(view.getByRole('link', { name: 'Order Ready order O-13' }))
      assert.ok(view.getByRole('link', { name: 'Processing order O-12' }))
      fireEvent.click(view.getByRole('button', { name: 'New: 1 order, not selected' }))
      assert.equal(view.getAllByRole('link', { name: /order O-1/ }).length, 3)
      const grouping = view.getByRole('group', { name: 'Group order rows' })
      assert.ok(grouping.className.includes('absolute bottom-3'))
      fireEvent.click(within(grouping).getByRole('button', { name: 'By status' }))
      assert.equal(within(view.getByRole('region', { name: 'Status: Need to Order' })).getAllByRole('row').length, 2)
      assert.equal(within(view.getByRole('region', { name: 'Status: Available' })).getAllByRole('row').length, 4)
      fireEvent.click(view.getByRole('button', { name: 'By plant' }))
      const roses = within(view.getByRole('region', { name: 'Plant: Rose' }))
      assert.equal(roses.getAllByRole('row').length, 3)
      assert.equal(roses.getByRole('link', { name: 'O-11' }).getAttribute('href'), '/partner/7/orders/11')
      fireEvent.click(view.getByRole('button', { name: 'New: 1 order, selected' }))
      fireEvent.click(view.getByRole('button', { name: 'Ready: 1 order, selected' }))
      assert.ok(view.getByRole('button', { name: 'By plant', pressed: true }))
      assert.equal(view.getAllByRole('region', { name: /^Plant:/ }).length, 1)
      assert.equal(view.queryByRole('link', { name: 'O-11' }), null)
      fireEvent.click(view.getByRole('button', { name: 'By order' }))
      assert.doesNotMatch(view.getByRole('link', { name: 'Processing order O-12' }).textContent ?? '', /Fulfillment date/)
      view.unmount()
      const archive = render(portal(<PartnerOrdersView closed />))
      await archive.findByRole('link', { name: 'Closed Won order O-15' })
      assert.ok(archive.getByRole('navigation', { name: 'Order/Request History' }))
      assert.ok(archive.getByRole('link', { name: 'Processing order O-14' }))
      assert.ok(archive.getByRole('link', { name: 'Closed Won order O-15' }))
      assert.equal(archive.queryByRole('link', { name: 'New order O-11' }), null)
    })

    await t.test('Chris orders the ticked lines\' selected candidates, without a date or customer checkbox', async () => {
      const writes: Record<string, unknown>[] = []
      globalThis.fetch = (async (_input, init) => {
        if (init?.method === 'POST') { writes.push(JSON.parse(String(init.body))); return json({ id: 11 }, 201) }
        return json({ orders: [], additionalDetails: [{ field: 'Customer', value: 'Gardens' }], lines: [
          { jobRequestItemId: 51, supplierId: 7, supplierName: 'APS', name: 'Rose', size: '5 G', status: 'need_to_order', quantity: 3, unitPrice: 20 },
          { jobRequestItemId: 52, supplierId: 7, supplierName: 'APS', name: 'Oak', size: '30 G', status: 'pending', quantity: 2, unitPrice: null },
          { jobRequestItemId: 53, supplierId: 8, supplierName: 'Grower', name: 'Elm', size: '45 G', status: 'available', quantity: 1, unitPrice: 90 },
        ] })
      }) as typeof fetch
      const view = render(<JobOrders jobRequestId={5} />)
      fireEvent.click(view.getByRole('button', { name: 'Create order' }))
      const rose = await view.findByRole('checkbox', { name: 'Order Rose' }) as HTMLInputElement
      // Let the supplier's reset-ticks effect settle before unticking (it raced under a loaded test run).
      await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })
      assert.equal(rose.checked, true, 'every line is ticked')
      assert.equal(view.queryByRole('checkbox', { name: 'Order Elm' }), null, 'one supplier at a time, APS first')
      assert.equal(view.container.querySelector('input[type="date"]'), null)
      assert.equal(view.queryByRole('checkbox', { name: /Customer has confirmed/ }), null)
      fireEvent.click(view.getByRole('checkbox', { name: 'Order Oak' }))
      assert.equal(view.queryByRole('combobox', { name: /Pickup/ }), null, 'pickup/delivery is the job\'s')
      assert.equal(view.queryByText('Note for customer'), null)
      const details = within(view.getByRole('group', { name: 'Additional details (shown to the supplier)' }))
      assert.equal((details.getByRole('textbox', { name: 'Customer value' }) as HTMLTextAreaElement).value, 'Gardens', 'starts from the job\'s fields')
      fireEvent.click(details.getByRole('button', { name: 'Add field' }))
      fireEvent.change(details.getByRole('textbox', { name: 'Field 2' }), { target: { value: 'Payment method' } })
      fireEvent.change(details.getByRole('textbox', { name: 'Payment method value' }), { target: { value: 'Net 30' } })
      await act(async () => { fireEvent.click(view.getByRole('button', { name: 'Create order with 1 row' })) })
      assert.deepEqual(writes, [{ jobRequestId: 5, supplierId: 7, additionalDetails: [{ field: 'Customer', value: 'Gardens' }, { field: 'Payment method', value: 'Net 30' }], jobRequestItemIds: [51] }])
    })

    await t.test('supplier writes their note inline, reads the price, and reads contacts in the additional details', async () => {
      const current = order(11, { jobNames: ['Courtyard'], additionalDetails: [{ field: 'Customer', value: 'Sam' }, { field: 'Delivery contact', value: 'Sam, sam@example.com' }],
        customerDetails: [{ jobName: 'Courtyard', customer: { name: 'Sam', company: null, phone: '555-0100', email: 'sam@example.com' }, address: '12 Garden Lane' }], items: [{ ...plant(110, 'Rose'), noteForSupplier: "Keep shaded\n\nReserved" }] })
      const writes: unknown[] = []
      globalThis.fetch = (async (input, init) => {
        assert.equal(String(input), '/api/partner/7/orders/11/items/110')
        writes.push(JSON.parse(String(init?.body)))
        return json({ ok: true })
      }) as typeof fetch
      const view = render(<OrderCard order={current} supplierId={7} canEdit />)
      assert.ok(view.getByRole('heading', { name: 'Courtyard' }))
      assert.equal(view.queryByText('Delivery address'), null, 'no contact rows on the order card (2026-10-21)')
      assert.match(view.getByRole('region', { name: 'Additional details' }).textContent ?? '', /CustomerSamDelivery contactSam, sam@example.com/)
      // The request page's columns; our note sits under the plant it is about,
      // the supplier's own in the Note column (2026-10-21).
      assert.deepEqual(view.getAllByRole('columnheader').map((cell) => cell.textContent), ['Qty', 'Size', 'Plant', 'Status', 'Note', 'Unit price', 'Line total'])
      assert.ok(view.getByRole('cell', { name: /^Rose\s*Keep shaded/ }))
      assert.ok(view.getByRole('cell', { name: '$20.00' }))
      assert.ok(view.getByRole('cell', { name: '$60.00' }))
      assert.equal(view.queryByRole('textbox', { name: /Price for/ }), null, 'price is read-only')
      const input = view.getByRole('textbox', { name: 'Your note for Rose' })
      fireEvent.change(input, { target: { value: 'Ready Thursday' } })
      await act(async () => { fireEvent.blur(input) })
      assert.deepEqual(writes, [{ status: 'available', noteFromSupplier: 'Ready Thursday' }])
    })

    await t.test('phone order detail uses readable cards and preserves snapshot statuses', () => {
      const originalMatchMedia = win.matchMedia
      win.matchMedia = (query: string) => ({ matches: query.includes('max-width: 899px'), media: query, onchange: null,
        addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent() { return true } })
      try {
        const view = render(<OrderCard order={order(11)} supplierId={7} />)
        const lines = within(view.getByTestId('order-mobile-lines'))
        assert.ok(lines.getByRole('article', { name: 'Line 1, Rose' }))
        assert.ok(lines.getByText('Need to Order'))
        assert.equal(view.queryByRole('table'), null)
        assert.equal(view.queryByRole('combobox', { name: /Pickup or delivery/ }), null)
        assert.equal(view.queryByRole('button', { name: 'Acknowledge Received' }), null)
      } finally { win.matchMedia = originalMatchMedia }
    })
  } finally { cleanup(); globalThis.fetch = originalFetch; dom.window.close() }
})
