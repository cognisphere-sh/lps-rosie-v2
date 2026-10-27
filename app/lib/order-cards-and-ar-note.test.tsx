import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { JSDOM } from 'jsdom'
import type { Order } from './orders'
import type { ARDetail } from './availability'

/** jsdom has no matchMedia; the order card's `useIsMobile` reads it. Desktop: nothing matches. */
const desktop = (dom: JSDOM) => Object.defineProperty(dom.window, 'matchMedia', { configurable: true, value: (media: string) => ({
  matches: false, media, addEventListener() {}, removeEventListener() {} }) })

test('admin order cards expand independently and AR notes submit with the response', async () => {
  const dom = new JSDOM('', { url: 'http://localhost' })
  for (const [key, value] of Object.entries({ window: dom.window, self: dom.window, document: dom.window.document, navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true })) {
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  desktop(dom)
  const { render, fireEvent, act, cleanup, within } = await import('@testing-library/react/pure')
  const { OrderCard } = await import('../components/workspace/orders')
  const { AvailabilityRequestView } = await import('../components/workspace/availability-request-view')
  const order: Order = { id: 1, recordName: 'JR-42:Order-1', jobNames: ['Garden'], status: 'new', supplierId: 7, supplierName: 'APS', items: [], availabilityRequestId: null, noteFromSupplier: null,
    fulfillmentMethod: 'pickup', confirmationDate: null, createdAt: '2026-09-15T12:00:00Z', additionalDetails: [{ field: 'Customer', value: 'Gardens' }], changeLog: null, jobSchedules: [{ jobRequestId: 42, jobName: 'Garden', expectedInstallDate: '2026-10-12', fulfillmentMethod: 'pickup' }] }
  try {
    let view = render(<><OrderCard order={order} /><OrderCard order={{ ...order, id: 2, recordName: 'JR-42:Order-2' }} /></>)
    const first = view.getByRole('button', { name: 'Expand order JR-42:Order-1' })
    const panel = document.getElementById(first.getAttribute('aria-controls')!)!
    assert.equal(panel.hidden, true)
    // One row, the /requests job card's: status, identity, EDD, mode, items, total, actions — no supplier (2026-10-21).
    const card = view.getByRole('article', { name: 'Order JR-42:Order-1' })
    const header = card.querySelector('header')!
    assert.equal(header.textContent, 'NewGardenCopy order EDDMon, 10/12Pickup0 items$0.00')
    // Below the row, collapsed until opened (2026-10-21).
    const toggle = within(within(card).getByRole('region', { name: 'Additional details' })).getByRole('button', { name: 'Additional details' })
    assert.equal(toggle.getAttribute('aria-expanded'), 'false')
    assert.equal(document.getElementById(toggle.getAttribute('aria-controls')!)!.hidden, true)
    view.rerender(<OrderCard order={{ ...order, additionalDetails: [{ field: 'Customer', value: 'Lake Landscapes' }, { field: 'Delivery phone', value: '512-350-1358' }] }} />)
    const details = within(view.getByRole('article', { name: 'Order JR-42:Order-1' })).getByRole('region', { name: 'Additional details' })
    fireEvent.click(within(details).getByRole('button', { name: 'Additional details' }))
    assert.deepEqual([...details.querySelectorAll('dt, dd')].map((cell) => cell.textContent), ['Customer', 'Lake Landscapes', 'Delivery phone', '512-350-1358'], 'the field list (0151), label over value')
    // Its own section below the order's rows, collapsed (0150); a log written as a table reads as bullets.
    view.rerender(<OrderCard order={{ ...order, changeLog: '| Date | Change |\n| --- | --- |\n| 10/22 | Oak qty 2 → 3 |' }} />)
    fireEvent.click(view.getByRole('button', { name: 'Expand order JR-42:Order-1' }))
    const log = within(view.getByRole('article', { name: 'Order JR-42:Order-1' })).getByRole('region', { name: 'Change log' })
    const logToggle = within(log).getByRole('button', { name: 'Change log' })
    assert.equal(logToggle.getAttribute('aria-expanded'), 'false')
    fireEvent.click(logToggle)
    assert.equal(log.querySelector('li')?.textContent, '10/22: Oak qty 2 → 3')
    fireEvent.click(view.getByRole('button', { name: 'Collapse order JR-42:Order-1' }))
    view.rerender(<><OrderCard order={order} /><OrderCard order={{ ...order, id: 2, recordName: 'JR-42:Order-2' }} /></>)
    assert.equal(header.querySelector('[data-order-status]')?.classList.contains('text-[12px]'), true)
    assert.equal(header.querySelector('[title^="Created"]')?.getAttribute('title'), 'Created Tue, 09/15')
    let clipboard: Record<string, Blob> | undefined
    Object.defineProperty(globalThis, 'ClipboardItem', { configurable: true, value: class {
      constructor(data: Record<string, Blob>) { clipboard = data }
    } })
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { write: async () => {} } })
    await act(async () => { fireEvent.click(view.getByRole('button', { name: 'Copy order JR-42:Order-1' })) })
    await act(async () => { fireEvent.click(view.getByRole('menuitem', { name: 'Private' })) })
    assert.equal(panel.hidden, true, 'Sharing works without expanding the order')
    assert.match(await clipboard!['text/html'].text(), /<table/)
    assert.match(await clipboard!['text/plain'].text(), /^Garden: http:\/\/localhost\/partner\/7\/orders\/1\n/, 'titled with the job, linked to the portal')
    assert.ok(view.getByRole('status').textContent?.includes('Order copied'))
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { write: async () => { throw new Error('Denied') } } })
    await act(async () => { fireEvent.click(view.getByRole('button', { name: 'Copy order JR-42:Order-1' })) })
    await act(async () => { fireEvent.click(view.getByRole('menuitem', { name: 'Private' })) })
    assert.match(view.getByRole('alert').textContent!, /Could not copy order/)
    fireEvent.click(first)
    assert.equal(panel.hidden, false)
    assert.equal(view.queryByText('Customer request:'), null)
    assert.equal(view.getAllByText('EDD').length, 2)
    assert.equal(view.container.querySelector('[data-job-metadata] dd span')?.textContent, 'Mon, 10/12')
    assert.equal(view.queryByRole('button', { name: 'By plant' }), null)
    assert.equal(view.queryByText('Share public link'), null)
    assert.equal(view.getByRole('button', { name: 'Expand order JR-42:Order-2' }).getAttribute('aria-expanded'), 'false')
    fireEvent.click(first)
    assert.equal(panel.hidden, true)
    view.unmount()

    const originalFetch = globalThis.fetch
    const writes: { url: string; body: unknown }[] = []
    globalThis.fetch = (async (url, init) => {
      writes.push({ url: String(url), body: JSON.parse(String(init?.body)) })
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }) as typeof fetch
    Object.defineProperty(globalThis, 'requestAnimationFrame', { configurable: true, value: (callback: () => void) => { callback(); return 0 } })
    let refreshed = 0
    const editableOrder = { ...order, items: [{ id: 12, name: 'Oak', size: '15 gal', quantity: 2, unitPrice: 30, total: 60, status: 'pending', noteForSupplier: null, noteFromSupplier: null }] }
    try {
      view = render(<OrderCard order={editableOrder} canEdit onChanged={() => { refreshed++ }} />)
      fireEvent.click(view.getByRole('button', { name: 'Expand order JR-42:Order-1' }))
      // The job page's AR table: same columns, answer cells typed in place (2026-10-21).
      assert.deepEqual(['Qty', 'Size', 'Plant', 'Status', 'Note', 'Unit price', 'Line total'].every((label) => view.getAllByText(label).length > 0), true)
      assert.equal(view.queryByText('Note for customer'), null, 'orders carry no customer note (0149)')
      const editor = view.getByRole('textbox', { name: 'Oak name' })
      fireEvent.change(editor, { target: { value: 'Live Oak' } })
      await act(async () => { fireEvent.blur(editor) })
      assert.deepEqual(writes, [{ url: '/api/orders/1/items/12', body: { column: 'name', value: 'Live Oak' } }])
      assert.equal(refreshed, 1)
      const quantity = view.getByRole('textbox', { name: 'Oak quantity' })
      await act(async () => { fireEvent.blur(quantity) })
      assert.equal(writes.length, 1, 'an unchanged cell writes nothing')
      const plantNote = view.getByRole('textbox', { name: 'Oak note for supplier' })
      fireEvent.change(plantNote, { target: { value: 'Single trunk only.\nCall before substituting.' } })
      await act(async () => { fireEvent.blur(plantNote) })
      assert.deepEqual(writes.at(-1), { url: '/api/orders/1/items/12', body: { column: 'note_for_supplier', value: 'Single trunk only.\nCall before substituting.' } })
      assert.equal(plantNote.closest('[title="Oak"]')?.querySelector('input')?.getAttribute('aria-label'), 'Oak name', 'our note sits under the plant name')
      assert.equal(view.queryByText('Subtotal'), null, 'the AR drawing has no footer; the card header shows the total')
      view.rerender(<OrderCard order={{ ...editableOrder, status: 'closed_won' }} canEdit />)
      assert.equal(view.queryByRole('textbox', { name: 'Oak name' }), null, 'Closed orders are read-only')
      assert.equal(view.queryByRole('textbox', { name: 'Oak note for supplier' }), null)
      view.unmount()
    } finally { globalThis.fetch = originalFetch }

    const request = { id: 3, status: 'new', jobName: 'Garden', items: [], answeredCount: 0, createdAt: '2026-09-15T12:00:00Z',
      noteForSupplier: 'Morning only', supplierName: 'APS', supplierId: 7, customer: null, shipping: null } as unknown as ARDetail
    const submissions: string[] = []
    view = render(<AvailabilityRequestView request={request} loading={false} saving={false} error=""
      onPatch={async () => {}} onSubmit={async (note) => { submissions.push(note); return true }} />)
    const note = view.getByRole('textbox', { name: 'Note for this request' }) as HTMLTextAreaElement
    assert.equal(note.value, 'Morning only')
    fireEvent.change(note, { target: { value: 'Please call before pickup' } })
    await act(async () => { fireEvent.click(view.getByRole('button', { name: 'Submit availability' })) })
    assert.deepEqual(submissions, ['Please call before pickup'])
    view.rerender(<AvailabilityRequestView request={{ ...request, status: 'closed' }} loading={false} saving={false} error=""
      onPatch={async () => {}} onSubmit={async () => true} />)
    assert.equal(note.readOnly, true)
    assert.equal(view.queryByRole('button', { name: 'Submit availability' }), null)
  } finally { cleanup(); dom.window.close() }
})

test('copy order menu creates a public link, reuses it, and copies private HTML and text linked to the portal order', async () => {
  const dom = new JSDOM('<html><body></body></html>', { url: 'https://example.com/jobs' })
  const originalFetch = globalThis.fetch
  for (const [key, value] of Object.entries({ window: dom.window, self: dom.window, document: dom.window.document, navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true })) {
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  desktop(dom)
  const copied: string[] = []
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (value: string) => { copied.push(value) } } })
  const calls: unknown[] = []
  const token = '11111111-1111-4111-8111-111111111111'
  globalThis.fetch = async (url, init) => {
    assert.equal(url, '/api/orders/42')
    calls.push(JSON.parse(String(init?.body)))
    return Response.json({ publicToken: token })
  }
  const { render, fireEvent, waitFor, cleanup } = await import('@testing-library/react/pure')
  const { OrderCard } = await import('../components/workspace/orders')
  try {
    const order = { id: 42, supplierId: 7, supplierName: 'APS', items: [], publicToken: null, status: 'new', availabilityRequestId: null, createdAt: '' } as unknown as Order
    const view = render(<OrderCard order={order} canEdit />)
    for (const choice of ['Public', 'Public', 'Private', 'Text']) {
      fireEvent.click(view.getByRole('button', { name: /Copy order/ }))
      fireEvent.click(view.getByRole('menuitem', { name: choice }))
      await waitFor(() => assert.ok(view.queryByRole('menu') === null, 'copy menu closes after copying'))
    }
    assert.deepEqual(calls, [{ isPublic: true }])
    assert.match(copied[0], new RegExp(`/public/orders/${token}`))
    assert.doesNotMatch(copied[0], /\/partner\/|\/jobs\?jr=/)
    assert.match(copied[2], /<a href="https:\/\/example.com\/partner\/7\/orders\/42"[^>]*>O-42<\/a>/, 'a private copy links the portal order')
    assert.doesNotMatch(copied[2], /\/public\/orders\//)
    assert.match(copied[3], /^O-42: https:\/\/example.com\/partner\/7\/orders\/42\n\nMode: To be confirmed\nTarget date: To be confirmed\n/, 'Text copies the plain format')
    assert.doesNotMatch(copied[3], /<table|\/public\/orders\//)
    view.rerender(<OrderCard order={{ ...order, status: 'closed_won' }} canEdit />)
    fireEvent.click(view.getByRole('button', { name: /Copy order/ }))
    assert.equal((view.getByRole('menuitem', { name: 'Public' }) as HTMLButtonElement).disabled, true)
    assert.equal((view.getByRole('menuitem', { name: 'Private' }) as HTMLButtonElement).disabled, false)
    // Print prints the supplier portal's sheet (2026-10-21), mounted only until the dialog closes.
    let printed = 0
    window.print = () => { printed += 1 }
    assert.ok(!document.getElementById('order-print-sheet'))
    fireEvent.click(view.getByRole('menuitem', { name: 'Print' }))
    await waitFor(() => assert.equal(printed, 1))
    assert.deepEqual([...document.querySelectorAll('#order-print-sheet th')].map((cell) => cell.textContent), ['Qty', 'Size', 'Name', 'Unit price', 'Total', 'Ready', 'Need to Order', 'Note'])
    assert.ok(!view.queryByRole('menu'))
    window.dispatchEvent(new window.Event('afterprint'))
    await waitFor(() => assert.ok(!document.getElementById('order-print-sheet')))
  } finally { cleanup(); globalThis.fetch = originalFetch; dom.window.close() }
})
