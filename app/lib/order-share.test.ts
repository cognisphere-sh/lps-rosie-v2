import assert from 'node:assert/strict'
import test from 'node:test'
import { JSDOM } from 'jsdom'
import { orderShareContent } from './order-share'
import type { Order } from './orders'

test('shared order includes contacts, dates, fulfillment, portal link and escaped table content', () => {
  const order: Order = {
    id: 42, recordName: 'JR-3:Order-2', supplierId: 7, supplierName: 'APS', status: 'new', fulfillmentMethod: 'delivery', fulfillmentDate: null,
    confirmationDate: null, createdAt: '', notes: null, availabilityRequestIds: [],
    shareJobs: [{ jobRequestId: 3, jobName: 'Garden', expectedInstallDate: '2026-10-12', shippingAddress: '123 Garden St',
      customer: { name: 'Jane <Doe>', company: 'Garden & Co', email: 'jane@example.com', phone: '555-0100' } },
    { jobRequestId: 4, jobName: 'Patio', expectedInstallDate: null, shippingAddress: null, customer: null }],
    items: [{ id: 1, availabilityRequestItemId: null, name: '<img src=x onerror=alert(1)>', size: '5 gal', quantity: 2,
      unitPrice: 10, total: 20, status: 'available', notes: 'Keep shaded\nCall first' }],
  }
  const { html, text } = orderShareContent(order, 'https://example.com')
  const dom = new JSDOM(html)
  const document = dom.window.document
  assert.equal(document.querySelector('img'), null)
  assert.equal(document.querySelector('a')?.href, 'https://example.com/partner/7/orders/42')
  assert.equal(document.querySelectorAll('tbody tr').length, 1)
  for (const expected of ['JR-3:Order-2', 'Jane <Doe>', 'Garden & Co', 'jane@example.com', '555-0100', '123 Garden St', '2026-10-12',
    'Pickup or delivery: Delivery', 'Installation date: To be confirmed', 'Customer: Not provided', '$20.00', 'Available']) {
    assert.ok(document.body.textContent?.includes(expected), expected)
    assert.ok(text.includes(expected), expected)
  }
  dom.window.close()
})
