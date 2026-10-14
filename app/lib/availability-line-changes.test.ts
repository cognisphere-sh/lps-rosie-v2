import assert from 'node:assert/strict'
import test from 'node:test'
import { withLineChanges, type ARItem } from './availability.ts'

const item: ARItem = {
  id: 1, name: 'Oak', size: '5 G', demandedQuantity: 10, status: 'partial_qty', availableQuantity: 4,
  unitPrice: 20, noteForSupplier: null, noteFromSupplier: null,
}

test('status sets the optimistic quantity as the database does', () => {
  assert.equal(withLineChanges(item, { status: 'available' }).availableQuantity, 10)
  assert.equal(withLineChanges(item, { status: '' }).availableQuantity, null)
  assert.equal(withLineChanges(item, { status: '' }).status, null)
  assert.equal(withLineChanges(item, { status: '', available_quantity: '4' }).availableQuantity, null)
  assert.equal(withLineChanges(item, { note_from_supplier: 'x' }).availableQuantity, 4)
})
