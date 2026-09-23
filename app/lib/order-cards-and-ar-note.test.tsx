import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { JSDOM } from 'jsdom'
import type { Order } from './orders'
import type { ARDetail } from './availability'

test('admin order cards expand independently and AR notes submit with the response', async () => {
  const dom = new JSDOM('', { url: 'http://localhost' })
  for (const [key, value] of Object.entries({ window: dom.window, self: dom.window, document: dom.window.document, navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true })) {
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  const { render, fireEvent, act, cleanup } = await import('@testing-library/react/pure')
  const { OrderCard } = await import('../components/workspace/orders')
  const { AvailabilityRequestView } = await import('../components/workspace/availability-request-view')
  const order: Order = { id: 1, recordName: 'JR-42:Order-1', status: 'new', supplierId: 7, supplierName: 'APS', items: [], availabilityRequestIds: [],
    fulfillmentDate: null, fulfillmentMethod: 'pickup', confirmationDate: null, createdAt: '2026-09-15T12:00:00Z', noteForSupplier: 'Keep plants shaded' }
  try {
    let view = render(<><OrderCard order={order} /><OrderCard order={{ ...order, id: 2, recordName: 'JR-42:Order-2' }} /></>)
    const first = view.getByRole('button', { name: 'Expand order JR-42:Order-1' })
    const panel = document.getElementById(first.getAttribute('aria-controls')!)!
    assert.equal(panel.hidden, true)
    assert.ok(view.getAllByText(/Created:/).length)
    let clipboard: Record<string, Blob> | undefined
    Object.defineProperty(globalThis, 'ClipboardItem', { configurable: true, value: class {
      constructor(data: Record<string, Blob>) { clipboard = data }
    } })
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { write: async () => {} } })
    await act(async () => { fireEvent.click(view.getByRole('button', { name: 'Copy order JR-42:Order-1' })) })
    assert.equal(panel.hidden, true, 'Sharing works without expanding the order')
    assert.match(await clipboard!['text/html'].text(), /<table/)
    assert.match(await clipboard!['text/plain'].text(), /http:\/\/localhost\/partner\/7\/orders\/1/)
    assert.ok(view.getByRole('status').textContent?.includes('Order copied'))
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { write: async () => { throw new Error('Denied') } } })
    await act(async () => { fireEvent.click(view.getByRole('button', { name: 'Copy order JR-42:Order-1' })) })
    assert.match(view.getByRole('alert').textContent!, /Could not copy order/)
    fireEvent.click(first)
    assert.equal(panel.hidden, false)
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
    const editableOrder = { ...order, items: [{ id: 12, name: 'Oak', size: '15 gal', quantity: 2, unitPrice: 30, total: 60, status: 'pending', noteForSupplier: null, noteFromSupplier: null, noteForCustomer: null }] }
    try {
      view = render(<OrderCard order={editableOrder} canEdit onChanged={() => { refreshed++ }} />)
      fireEvent.click(view.getByRole('button', { name: 'Expand order JR-42:Order-1' }))
      fireEvent.click(view.getByTitle('Edit name for Oak'))
      const editor = view.getByRole('textbox', { name: 'Edit name for Oak' })
      fireEvent.change(editor, { target: { value: 'Live Oak' } })
      await act(async () => { fireEvent.keyDown(editor, { key: 'Enter' }) })
      assert.deepEqual(writes, [{ url: '/api/orders/1/items/12', body: { column: 'name', value: 'Live Oak' } }])
      assert.equal(refreshed, 1)
      fireEvent.click(view.getByTitle('Edit quantity for Oak'))
      const quantity = view.getByRole('spinbutton', { name: 'Edit quantity for Oak' })
      fireEvent.change(quantity, { target: { value: '7' } })
      fireEvent.keyDown(quantity, { key: 'Escape' })
      assert.equal(writes.length, 1, 'Escape cancels without writing')
      fireEvent.click(view.getByRole('button', { name: 'Note to supplier for Oak' }))
      const plantNote = view.getByRole('textbox', { name: 'Note to supplier for Oak' })
      fireEvent.change(plantNote, { target: { value: 'Single trunk only.\nCall before substituting.' } })
      await act(async () => { fireEvent.blur(plantNote) })
      assert.deepEqual(writes.at(-1), { url: '/api/orders/1/items/12', body: { column: 'note_for_supplier', value: 'Single trunk only.\nCall before substituting.' } })
      view.rerender(<OrderCard order={{ ...editableOrder, status: 'closed_won' }} canEdit />)
      assert.equal(view.queryByTitle('Edit name for Oak'), null, 'Closed orders are read-only')
      assert.equal(view.queryByRole('button', { name: 'Note to supplier for Oak' }), null)
      view.unmount()
    } finally { globalThis.fetch = originalFetch }

    const request = { id: 3, status: 'new', jobName: 'Garden', items: [], answeredCount: 0, createdAt: '2026-09-15T12:00:00Z',
      noteFromSupplier: 'Morning only', supplierName: 'APS', supplierId: 7, customer: null, shipping: null, noteForSupplier: null } as unknown as ARDetail
    const submissions: string[] = []
    view = render(<AvailabilityRequestView request={request} loading={false} saving={false} error=""
      onPatch={async () => {}} onSubmit={async (note) => { submissions.push(note) }} />)
    const note = view.getByRole('textbox', { name: 'Note for this request' }) as HTMLTextAreaElement
    assert.equal(note.value, 'Morning only')
    fireEvent.change(note, { target: { value: 'Please call before pickup' } })
    await act(async () => { fireEvent.click(view.getByRole('button', { name: 'Submit availability' })) })
    assert.deepEqual(submissions, ['Please call before pickup'])
    view.rerender(<AvailabilityRequestView request={{ ...request, status: 'closed' }} loading={false} saving={false} error=""
      onPatch={async () => {}} onSubmit={async () => {}} />)
    assert.equal(note.readOnly, true)
    assert.equal(view.queryByRole('button', { name: 'Submit availability' }), null)
  } finally { cleanup(); dom.window.close() }
})
