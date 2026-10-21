import assert from 'node:assert/strict'
import test from 'node:test'
import { JSDOM } from 'jsdom'
import { changeLogBullets, detailsBlocks, orderShareContent } from './order-share'
import type { Order } from './orders'

const order = (): Order => ({
  id: 42, recordName: 'JR-3:Order-2', supplierId: 7, supplierName: 'Austin Plant Supply', status: 'new', fulfillmentMethod: 'delivery',
  confirmationDate: null, createdAt: '', noteFromSupplier: 'Supplier reply', availabilityRequestId: null, changeLog: null, jobNames: ['Garden'],
  additionalDetails: [{ field: 'Customer', value: 'Garden & Co' }, { field: 'Delivery address', value: '123 Garden St' }, { field: 'Delivery contact', value: 'Jane, jane@example.com, 555-0100' }],
  jobSchedules: [{ jobRequestId: 3, jobName: 'Garden', expectedInstallDate: '2026-11-02', fulfillmentMethod: 'delivery' }],
  shareJobs: [{ jobRequestId: 3, jobName: 'Garden', expectedInstallDate: '2026-11-02', shippingAddress: '123 Garden St',
    customer: { name: 'Jane <Doe>', company: 'Garden & Co', email: 'jane@example.com', phone: '555-0100' } }],
  items: [{ id: 1, name: '<img src=x onerror=alert(1)>', size: '5 gal', quantity: 2,
    unitPrice: 10, total: 20, status: 'available', noteForSupplier: 'Handle gently\nKeep shaded', noteFromSupplier: null }],
})

test('a copied order is titled with its job name linked to the order, then mode, target date and additional details; no supplier or Customer row (2026-10-21)', () => {
  const { html, text } = orderShareContent(order(), 'https://example.com')
  const dom = new JSDOM(html)
  const document = dom.window.document
  assert.equal(document.querySelector('img'), null)
  for (const expected of ['Garden & Co', 'Delivery', 'Mon, 11/02', '123 Garden St', 'Jane, jane@example.com, 555-0100', '$20.00']) {
    assert.ok(document.body.textContent?.includes(expected), expected)
    assert.ok(text.includes(expected), expected)
  }
  assert.match(text, /^Garden: https:\/\/example\.com\/partner\/7\/orders\/42\n\nMode: Delivery\nTarget date: Mon, 11\/02\n/)
  const title = document.querySelector('h1 a')!
  assert.equal(title.textContent, 'Garden')
  assert.equal(title.getAttribute('href'), 'https://example.com/partner/7/orders/42')
  assert.doesNotMatch(html + text, /Austin Plant Supply|Supplier|Status|Available|Supplier reply|\/jobs\?jr=/)
  assert.equal(html.match(/>Customer</g)?.length, 1, 'the customer is only its Additional details field')
  const table = document.querySelector('table[aria-label="Order items"]')!
  assert.deepEqual([...table.querySelectorAll('thead th')].map((cell) => cell.textContent), ['Qty', 'Size', 'Name', 'Unit Price', 'Total'])
  assert.equal(table.querySelectorAll('tbody td').length, 5)
  assert.equal(table.querySelector('tbody td:nth-child(3) div')?.textContent, 'Handle gently\nKeep shaded', 'our note under the name')
  assert.equal(table.querySelector('tfoot td')?.getAttribute('colspan'), '5')
  dom.window.close()
})

test('copy text uses the Text Quote line format', () => {
  const { text } = orderShareContent(order(), 'https://example.com', 'private')
  assert.match(text, /\n2 x 5 gal <img src=x onerror=alert\(1\)> - Handle gently; Keep shaded - \$10\.00\n\nSubtotal: \$20\.00$/)
})

test('the change log is not copied (2026-10-21)', () => {
  const { html, text } = orderShareContent({ ...order(), changeLog: '- 10/22: Wax myrtle 15 G qty 10 → 12' }, 'https://example.com', 'private')
  assert.doesNotMatch(html + text, /Change log|Wax myrtle/)
})

test('a public copy links the public order; a private copy links the supplier portal order', () => {
  const published = orderShareContent({ ...order(), publicToken: '11111111-1111-4111-8111-111111111111' }, 'https://example.com')
  assert.match(published.text, /^Garden: https:\/\/example.com\/public\/orders\/11111111/)
  assert.doesNotMatch(published.html + published.text, /\/partner\//)
  const privateCopy = orderShareContent({ ...order(), publicToken: '11111111-1111-4111-8111-111111111111' }, 'https://example.com', 'private')
  assert.doesNotMatch(privateCopy.html + privateCopy.text, /\/public\/orders\//)
  assert.match(privateCopy.html, /<a href="https:\/\/example.com\/partner\/7\/orders\/42"[^>]*>Garden<\/a>/)
  const bare = orderShareContent({ ...order(), recordName: null, jobNames: [], fulfillmentMethod: null, jobSchedules: [], shareJobs: [], additionalDetails: null }, 'https://example.com')
  assert.match(bare.text, /^O-42: https:\/\/example.com\/partner\/7\/orders\/42\n\nMode: To be confirmed\nTarget date: To be confirmed\n\n2 x/)
})

test('each additional details field is its own row of the details table, in order (0151)', () => {
  const additionalDetails = [{ field: 'Customer', value: 'Lake Landscapes' }, { field: 'Delivery contact', value: 'Will Heathcott' },
    { field: 'Payment method', value: 'Net 30' }, { field: 'Notes', value: 'Gate 4411\nRing twice' }]
  const { html, text } = orderShareContent({ ...order(), additionalDetails }, 'https://example.com', 'private')
  const dom = new JSDOM(html)
  const details = dom.window.document.querySelector('table[role="presentation"]')!
  assert.equal(details.querySelector('table'), null, 'no table inside a cell')
  assert.deepEqual([...details.querySelectorAll('tr')].map((row) => [...row.querySelectorAll('th, td')].map((cell) => cell.innerHTML)), [
    ['Mode', 'Delivery'], ['Target date', 'Mon, 11/02'], ['Customer', 'Lake Landscapes'], ['Delivery contact', 'Will Heathcott'],
    ['Payment method', 'Net 30'], ['Notes', 'Gate 4411<br>Ring twice']])
  assert.match(text, /\nTarget date: Mon, 11\/02\nCustomer: Lake Landscapes\nDelivery contact: Will Heathcott\nPayment method: Net 30\nNotes: Gate 4411\nRing twice\n\n2 x/)
  dom.window.close()
})

test('a change log written as a pipe table reads as bullets; its header row is dropped', () => {
  assert.deepEqual(detailsBlocks('| Date | Change |\n| --- | --- |\n| 10/22 | Oak qty 2 → 3 |'), [{ kind: 'fields', fields: [['10/22', 'Oak qty 2 → 3']] }])
  assert.equal(changeLogBullets('| 10/22 | Oak qty 2 → 3 |\n- 10/23: Added Sage'), '- 10/22: Oak qty 2 → 3\n- 10/23: Added Sage')
})
