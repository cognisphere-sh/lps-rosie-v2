import assert from 'node:assert/strict'
import test from 'node:test'

import { availabilityShareContent } from './availability-share'
import type { ARDetail } from './availability'

const ar = {
  id: 84, recordName: 'AR-84', jobRequestId: 31, jobName: 'Courtyard <garden>', supplierId: 7, supplierName: 'Valley Growers',
  shareCustomerDetails: false, status: 'processing', submittedAt: null, createdAt: '', itemCount: 2, answeredCount: 2,
  noteForSupplier: 'Deliver Tuesday', publicToken: 'tok', customer: { name: 'Secret Customer', company: null, email: 'c@example.com', phone: null }, shipping: null,
  items: [
    { id: 1, name: 'Abelia', size: '3 gal', demandedQuantity: 10, status: 'partial_qty', availableQuantity: 6, unitPrice: 12, noteForSupplier: 'Full shape', noteFromSupplier: 'Rest in May' },
    { id: 2, name: 'Boxwood', size: '5 gal', demandedQuantity: 4, status: 'unavailable', availableQuantity: 4, unitPrice: 20, noteForSupplier: null, noteFromSupplier: null, offerDescription: 'Boxwood 7 gal' },
  ],
} as ARDetail

test('availability copy links public or portal, carries the print columns and no customer details', () => {
  const publicCopy = availabilityShareContent(ar, 'https://example.com', 'public')
  assert.match(publicCopy.html, /<a href="https:\/\/example.com\/public\/availability\/tok"[^>]*>Courtyard &lt;garden&gt;<\/a>/)
  assert.match(publicCopy.html, /Diff Sz\/Sub: Boxwood 7 gal/)
  assert.doesNotMatch(publicCopy.html + publicCopy.text, /Secret Customer|c@example.com/)
  const privateCopy = availabilityShareContent(ar, 'https://example.com', 'private')
  assert.equal(privateCopy.text, ['10 × 3 gal Abelia', '4 × 5 gal Boxwood', '', 'https://example.com/partner/7/requests/84'].join('\n'))
  assert.equal(publicCopy.text.split('\n').at(-1), 'https://example.com/public/availability/tok')
  assert.equal(publicCopy.url, 'https://example.com/public/availability/tok')
  assert.equal(privateCopy.url, 'https://example.com/partner/7/requests/84')
  assert.throws(() => availabilityShareContent({ ...ar, publicToken: null }, 'https://example.com', 'public'))
})
