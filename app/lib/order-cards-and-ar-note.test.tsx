import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { JSDOM } from 'jsdom'
import type { Order } from './orders'
import type { ARDetail } from './availability'

test('admin order cards expand independently and AR notes submit with the response', async () => {
  const dom = new JSDOM('', { url: 'http://localhost' })
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true })) {
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  const { render, fireEvent, act, cleanup } = await import('@testing-library/react/pure')
  const { OrderCard } = await import('../components/workspace/orders')
  const { AvailabilityRequestView } = await import('../components/workspace/availability-request-view')
  const order: Order = { id: 1, status: 'new', supplierId: 7, supplierName: 'APS', items: [], availabilityRequestIds: [],
    fulfillmentDate: null, fulfillmentMethod: 'pickup', confirmationDate: null, createdAt: '2026-09-15T12:00:00Z', notes: 'Keep plants shaded' }
  try {
    let view = render(<><OrderCard order={order} /><OrderCard order={{ ...order, id: 2 }} /></>)
    const first = view.getByRole('button', { name: 'Expand order O-1' })
    const panel = document.getElementById(first.getAttribute('aria-controls')!)!
    assert.equal(panel.hidden, true)
    assert.ok(view.getAllByText(/Created:/).length)
    let clipboard: Record<string, Blob> | undefined
    Object.defineProperty(globalThis, 'ClipboardItem', { configurable: true, value: class {
      constructor(data: Record<string, Blob>) { clipboard = data }
    } })
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { write: async () => {} } })
    await act(async () => { fireEvent.click(view.getByRole('button', { name: 'Share order O-1' })) })
    assert.equal(panel.hidden, true, 'Sharing works without expanding the order')
    assert.match(await clipboard!['text/html'].text(), /<table/)
    assert.match(await clipboard!['text/plain'].text(), /http:\/\/localhost\/partner\/7\/orders\/1/)
    assert.ok(view.getByRole('status').textContent?.includes('Order copied'))
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { write: async () => { throw new Error('Denied') } } })
    await act(async () => { fireEvent.click(view.getByRole('button', { name: 'Share order O-1' })) })
    assert.match(view.getByRole('alert').textContent!, /Could not copy order/)
    fireEvent.click(first)
    assert.equal(panel.hidden, false)
    assert.equal(view.getByRole('button', { name: 'Expand order O-2' }).getAttribute('aria-expanded'), 'false')
    fireEvent.click(first)
    assert.equal(panel.hidden, true)
    view.unmount()

    const request = { id: 3, status: 'new', jobName: 'Garden', items: [], answeredCount: 0, createdAt: '2026-09-15T12:00:00Z',
      supplierNotes: 'Morning only', supplierName: 'APS', supplierId: 7, customer: null, shipping: null, lpsNotes: null } as unknown as ARDetail
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
