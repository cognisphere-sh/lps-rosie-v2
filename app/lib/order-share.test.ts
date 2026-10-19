import assert from 'node:assert/strict'
import test from 'node:test'
import { JSDOM } from 'jsdom'
import { orderShareContent } from './order-share'
import type { Order } from './orders'

test('shared order includes contacts, dates, linked jobs and the six-column table with the merged supplier note', () => {
  const order: Order = {
    id: 42, recordName: 'JR-3:Order-2', supplierId: 7, supplierName: 'APS', status: 'new', fulfillmentMethod: 'delivery', fulfillmentDate: null,
    noteForCustomer: "Private customer header\n\nPrivate quote update",
    confirmationDate: null, createdAt: '', noteForSupplier: null, noteFromSupplier: null, availabilityRequestId: null,
    shareJobs: [{ jobRequestId: 3, jobName: 'Garden', expectedInstallDate: '2026-10-12', shippingAddress: '123 Garden St',
      customer: { name: 'Jane <Doe>', company: 'Garden & Co', email: 'jane@example.com', phone: '555-0100' } },
    { jobRequestId: 4, jobName: 'Patio', expectedInstallDate: null, shippingAddress: null, customer: null }],
    items: [{ id: 1, name: '<img src=x onerror=alert(1)>', size: '5 gal', quantity: 2,
      unitPrice: 10, total: 20, status: 'available', noteForCustomer: 'Private customer price', noteForSupplier: "Handle gently\n\nKeep shaded\nCall first", noteFromSupplier: null }],
  }
  const { html, text } = orderShareContent(order, 'https://example.com')
  assert.doesNotMatch(html + text, /Private customer|Private quote/)
  assert.match(text, /Handle gently/)
  const dom = new JSDOM(html)
  const document = dom.window.document
  assert.equal(document.querySelector('img'), null)
  assert.doesNotMatch(html + text, /Private order|\/partner\//)
  assert.equal(document.querySelectorAll('table[aria-label="Order items"] tbody tr').length, 1)
  for (const expected of ['Jane <Doe>', 'Garden & Co', 'jane@example.com', '555-0100', '123 Garden St', '2026-10-12',
    'Delivery', 'To be confirmed', 'Not provided', '$20.00']) {
    assert.ok(document.body.textContent?.includes(expected), expected)
    assert.ok(text.includes(expected), expected)
  }
  assert.doesNotMatch(html + text, /JR-3:Order-2|Status|Available/)
  assert.equal(document.querySelector('h2 a')?.getAttribute('href'), 'https://example.com/jobs?jr=3')
  const table = document.querySelector('table[aria-label="Order items"]')!
  assert.deepEqual([...table.querySelectorAll('thead th')].map((cell) => cell.textContent), ['Quantity', 'Size', 'Plant Name', 'Unit Price', 'Total', 'Note for supplier'])
  assert.equal(table.querySelectorAll('tbody td').length, 6)
  assert.equal(table.querySelector('tbody td:nth-child(6)')?.textContent, 'Handle gently\n\nKeep shaded\nCall first')
  assert.equal(table.querySelector('tfoot td')?.getAttribute('colspan'), '6')
  assert.equal(table.querySelector('tbody td:nth-child(3) div'), null)
  assert.ok(document.querySelector('th') && document.querySelector('tfoot'))
  order.publicToken = '11111111-1111-4111-8111-111111111111'
  const published = orderShareContent(order, 'https://example.com')
  assert.match(published.text, /Public order: https:\/\/example.com\/public\/orders\/11111111/)
  assert.doesNotMatch(published.html, /\/partner\//)
  assert.doesNotMatch(published.html, /\/jobs\?jr=/)
  const privateCopy = orderShareContent(order, 'https://example.com', 'private')
  assert.doesNotMatch(privateCopy.html, /\/public\/orders\//)
  assert.doesNotMatch(privateCopy.html + privateCopy.text, /Private order|\/partner\//)
  dom.window.close()
})
