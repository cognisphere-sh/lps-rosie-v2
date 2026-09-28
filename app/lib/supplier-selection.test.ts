import assert from 'node:assert/strict'
import test from 'node:test'

import { supplierSelectionChanges } from './supplier-selection'

const response = { arItemId: 7, status: 'available', unitPrice: 12.5, availableQuantity: 500, note: 'Fresh flush', allocation: 10 }

test('copies status, price and the capped quantity, and records the choice', () => {
  assert.deepEqual(supplierSelectionChanges({ demandedQuantity: 20, noteForCustomer: null }, response), {
    selected_availability_request_item_id: 7, status: 'available', unit_price: 12.5, available_quantity: 10, note_for_customer: 'Fresh flush',
  })
})

test('maps AR answers onto job statuses; unanswered is pending', () => {
  const line = { demandedQuantity: null, noteForCustomer: null }
  assert.equal(supplierSelectionChanges(line, { ...response, status: 'can_order' }).status, 'need_to_order')
  assert.equal(supplierSelectionChanges(line, { ...response, status: 'diff_size_qty_sub' }).status, 'alternative_proposed')
  const unanswered = supplierSelectionChanges(line, { ...response, status: null })
  assert.equal(unanswered.status, 'pending')
  assert.ok(!('note_for_customer' in unanswered))
})

test('falls back to demand for the cap and leaves unanswered fields alone', () => {
  const changes = supplierSelectionChanges({ demandedQuantity: 4, noteForCustomer: 'x' },
    { ...response, allocation: null, unitPrice: null, note: null })
  assert.equal(changes.available_quantity, 4)
  assert.ok(!('unit_price' in changes))
  assert.ok(!('note_for_customer' in changes))
})

test('appends the supplier note once', () => {
  const line = { demandedQuantity: 10, noteForCustomer: 'Cultivar: Blue' }
  assert.equal(supplierSelectionChanges(line, response).note_for_customer, 'Cultivar: Blue\n\nFresh flush')
  assert.ok(!('note_for_customer' in supplierSelectionChanges({ ...line, noteForCustomer: 'Cultivar: Blue\n\nFresh flush' }, response)))
})
