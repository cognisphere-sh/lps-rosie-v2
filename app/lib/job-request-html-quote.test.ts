import assert from 'node:assert/strict'
import test from 'node:test'

import { jobRequestToHtmlQuote, quoteSubtotal } from './job-request-html-quote'
import type { JobRequestRow } from './rows'

function request(): JobRequestRow {
  return {
    id: 42, name: 'Courtyard', status: 'quoted',
    customer: { id: 3, name: 'Taylor Lee', company: 'Lee Landscape', email: null, phone: null, type: null, rosieThreadId: null },
    billing: { address: null, city: null, state: null, zip: null }, shipping: { address: null, city: null, state: null, zip: null },
    noteForCustomer: null, notes: [], noteInternal: null, itemCount: 2, statusCounts: {}, lineTotal: 390,
    supplierLinks: [], createdAt: null, updatedAt: null,
    items: [
      { id: 1, name: 'Live Oak <Specimen>', size: '15 G', quantity: 2, availableQuantity: 1, unitPrice: 120, total: 240, status: 'quoted', notes: [], noteForCustomer: '45 G $595.00', noteInternal: null, updatedAt: null },
      { id: 2, name: 'Yaupon Holly', size: '7 G', quantity: 3, availableQuantity: 2, unitPrice: 50, total: 150, status: 'quoted', notes: [], noteForCustomer: null, noteInternal: null, updatedAt: null },
    ],
  }
}

test('job request HTML quote is email-safe, customer-facing, and totals priced lines', () => {
  const quote = jobRequestToHtmlQuote(request())
  assert.match(quote.html, /Quote · JR-42/)
  assert.match(quote.html, /Lee Landscape · Courtyard/)
  assert.match(quote.html, /Live Oak &lt;Specimen&gt;/)
  assert.match(quote.html, /45 G \$595\.00/)
  assert.match(quote.html, /<strong>\$220\.00<\/strong>/)
  assert.match(quote.html, />\$100\.00<\/td>/)
  assert.doesNotMatch(quote.html, /\$150\.00/)
  assert.doesNotMatch(quote.html, /availableQuantity|noteInternal/)
  assert.match(quote.text, /1 x 15 G Live Oak <Specimen> - 45 G \$595\.00 - \$120\.00 - \$120\.00/)
  assert.match(quote.text, /Subtotal: \$220\.00/)
})

test('job request HTML quote renders full job names once and escapes their slug', () => {
  for (const prefix of ['Lee Landscape', 'Taylor Lee']) {
    const value = request()
    value.name = `${prefix} | Courtyard <Phase 2>`
    const quote = jobRequestToHtmlQuote(value)
    assert.ok(quote.html.includes(`<br>${prefix} | Courtyard &lt;Phase 2&gt;</p>`))
    assert.doesNotMatch(quote.html, /Lee Landscape ·/)
  }
})

test('job request HTML quote falls back to demand only while availability is unanswered', () => {
  const incomplete = request()
  incomplete.items[1] = { ...incomplete.items[1], availableQuantity: null }
  const quote = jobRequestToHtmlQuote(incomplete)
  assert.match(quote.text, /3 x 7 G Yaupon Holly - \$50\.00 - \$150\.00/)
})

test('a selected substitute prints its description (job_lines.quote_name) and size', () => {
  const sub = request()
  sub.items[1] = { ...sub.items[1], size: '15 G', requestedSize: '7 G', quoteName: '15 G Yaupon Holly, multi-trunk', isSubstitute: true, status: 'diff_size_sub' }
  const quote = jobRequestToHtmlQuote(sub, { includeAvailabilityStatus: true })
  assert.match(quote.text, /2 x 15 G Yaupon Holly, multi-trunk - Diff Sz\/Sub - \$50\.00 - \$100\.00/)
  assert.doesNotMatch(quote.html, /Yaupon Holly<\/td>/)
})

test('unavailable lines copy as zero quantity and zero total', () => {
  const unavailable = request()
  unavailable.items[1] = { ...unavailable.items[1], status: 'unavailable', availableQuantity: null }
  const quote = jobRequestToHtmlQuote(unavailable)
  assert.match(quote.text, /0 x 7 G Yaupon Holly - \$50\.00 - \$0\.00/)
  assert.match(quote.text, /Subtotal: \$120\.00/)
})

test('quote subtotal matches the copied quote and counts unpriced lines as zero', () => {
  const value = request()
  value.items[1] = { ...value.items[1], status: 'unavailable' }
  assert.equal(quoteSubtotal(value.items), 120)
  assert.match(jobRequestToHtmlQuote(value).text, /Subtotal: \$120\.00/)
  assert.equal(quoteSubtotal([...request().items, { ...request().items[0], unitPrice: null }]), 220)
})

test('availability templates add each line status to text and an HTML Status column', () => {
  const availability = request()
  availability.items[0] = { ...availability.items[0], status: 'available' }
  availability.items[1] = { ...availability.items[1], status: 'unavailable', availableQuantity: null }
  const quote = jobRequestToHtmlQuote(availability, { includeAvailabilityStatus: true })
  assert.match(quote.text, /1 x 15 G Live Oak <Specimen> - Available - 45 G \$595\.00/)
  assert.match(quote.text, /0 x 7 G Yaupon Holly - Unavailable - \$50\.00 - \$0\.00/)
  assert.match(quote.html, />Status<\/th>/)
  assert.match(quote.html, />Unavailable<\/td>/)
  assert.match(quote.html, /colspan="6"/)
})

test('job request HTML quote refuses a line with neither demand nor availability', () => {
  const incomplete = request()
  incomplete.items[1] = { ...incomplete.items[1], quantity: null, availableQuantity: null }
  assert.throws(() => jobRequestToHtmlQuote(incomplete), /Every line needs a quantity and unit price/)
})
