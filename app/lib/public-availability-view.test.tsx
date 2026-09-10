import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { JSDOM } from 'jsdom'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { PublicAvailability } from '../components/workspace/public-availability'
import type { ARDetail } from './availability'

test('public request uses the partner summary, print sheet and submit flow, then removes a revoked request', async () => {
  const dom = new JSDOM('<html><body></body></html>', { url: 'https://lps.example/public/availability/token' })
  const previous = Object.getOwnPropertyDescriptors(globalThis)
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, HTMLElement: dom.window.HTMLElement })) {
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  let revoked = false
  const writes: object[] = []
  const request: ARDetail = {
    id: 11, jobRequestId: 1, jobName: 'Garden project', supplierId: 7, supplierName: 'Nursery',
    status: 'new', publicToken: undefined, shareCustomerDetails: false, submittedAt: null,
    createdAt: '2026-09-10T12:00:00Z', itemCount: 1, answeredCount: 1,
    lpsNotes: 'Deliver Friday', customer: null, shipping: null,
    items: [{ id: 5, jobRequestItemId: 2, name: 'Live oak', size: '30 G', quantity: 4,
      status: 'available', availableQuantity: 4, unitPrice: 12.5, notes: null, lpsNotes: null }],
  }
  globalThis.fetch = async (url, init) => {
    assert.equal(url, '/api/public/availability/token')
    if (revoked) return Response.json({ error: 'This link is no longer available.' }, { status: 404 })
    if (init?.method === 'POST') {
      writes.push(JSON.parse(String(init.body)))
      request.status = 'submitted'; request.submittedAt = '2026-09-10T13:00:00Z'
      return Response.json({ ok: true })
    }
    return Response.json({ request })
  }
  try {
    const view = render(<PublicAvailability token="token" />)
    await waitFor(() => assert.ok(view.getByText('Total Items')))
    assert.ok(view.getByText('Delivery instructions'))
    assert.ok(view.getAllByText('$50.00').length)
    assert.ok(view.getByRole('button', { name: 'Print' }))
    await waitFor(() => assert.ok(document.querySelector('#ar-print-sheet')))
    fireEvent.click(view.getByRole('button', { name: 'Submit availability' }))
    await waitFor(() => assert.ok(view.getByText('Completed')))
    assert.deepEqual(writes, [{ submit: true }])
    assert.ok(view.getByRole('button', { name: 'Re-Submit availability' }))
    revoked = true
    fireEvent.focus(window)
    await waitFor(() => assert.ok(view.getByText('This link is no longer available.')))
    assert.equal(view.queryByText('Total Items'), null)
    assert.equal(document.querySelector('#ar-print-sheet'), null)
  } finally {
    cleanup()
    await new Promise(resolve => setTimeout(resolve, 30))
    dom.window.close()
    for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'fetch']) {
      if (previous[key]) Object.defineProperty(globalThis, key, previous[key])
      else Reflect.deleteProperty(globalThis, key)
    }
  }
})
