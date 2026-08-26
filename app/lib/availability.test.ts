import assert from 'node:assert/strict'
import test from 'node:test'

import { answeredIn, groupSupplierItems, type SupplierItemLine } from './availability.ts'

/** A line with everything defaulted, so each case states only what it is about. */
const line = (o: Partial<SupplierItemLine> & { id: number }): SupplierItemLine => ({
  jobRequestItemId: 1,
  name: 'x',
  size: null,
  quantity: null,
  status: null,
  availableQuantity: null,
  unitPrice: null,
  notes: null,
  lpsNotes: null,
  arId: 1,
  arStatus: 'new',
  arCreatedAt: '2026-08-01T00:00:00Z',
  arName: 'Availability request',
  arCustomer: null,
  mappedInventoryId: null,
  mappedName: null,
  mappedSize: null,
  ...o,
})

test('a mapped group is the catalogue row, whatever each job typed', () => {
  const groups = groupSupplierItems([
    line({ id: 1, name: 'Live Oak', size: '30 G', mappedInventoryId: 'u1', mappedName: 'Live Oak - Quercus virginiana', mappedSize: '30 G' }),
    line({ id: 2, name: 'live oak 30gal', size: '30 gal', mappedInventoryId: 'u1', mappedName: 'Live Oak - Quercus virginiana', mappedSize: '30 G' }),
  ])
  assert.equal(groups.length, 1)
  assert.equal(groups[0].key, 'inv:u1')
  // The row names the group — the two lines disagree, and neither wins.
  assert.equal(groups[0].name, 'Live Oak - Quercus virginiana')
  assert.equal(groups[0].size, '30 G')
  assert.equal(groups[0].lines.length, 2)
})

test('unmapped lines group by name, ignoring case and inner whitespace', () => {
  const groups = groupSupplierItems([
    line({ id: 1, name: 'Berkeley Sedge', size: '1 G' }),
    line({ id: 2, name: 'berkeley  sedge ', size: '3 G' }),
  ])
  assert.equal(groups.length, 1)
  assert.equal(groups[0].mappedInventoryId, null)
  // An unmapped group's size is what its lines actually asked for — several
  // sizes is the tell that the group is a spelling, not an offering.
  assert.equal(groups[0].size, '1 G · 3 G')
})

test('a mapped and an unmapped line with the same name stay apart', () => {
  const groups = groupSupplierItems([
    line({ id: 1, name: 'Live Oak', mappedInventoryId: 'u1', mappedName: 'Live Oak', mappedSize: '30 G' }),
    line({ id: 2, name: 'Live Oak' }),
  ])
  assert.equal(groups.length, 2)
  assert.deepEqual(groups.map((g) => g.key), ['inv:u1', 'name:live oak'])
})

test('mapped groups come first — they are the drop targets', () => {
  const groups = groupSupplierItems([
    line({ id: 1, name: 'Aaa sedge' }),
    line({ id: 2, name: 'Zzz oak', mappedInventoryId: 'u1', mappedName: 'Zzz oak', mappedSize: '30 G' }),
  ])
  assert.deepEqual(groups.map((g) => g.mappedInventoryId), ['u1', null])
})

test('a mapping whose catalogue row is gone still groups, under the asked name', () => {
  // ON DELETE SET NULL protects the ask, but a *retired* row keeps the id and
  // resolves to no name — the group must still render.
  const groups = groupSupplierItems([line({ id: 1, name: 'Redbud', size: '15 G', mappedInventoryId: 'gone' })])
  assert.equal(groups[0].name, 'Redbud')
  assert.equal(groups[0].size, null)
})

test('answeredIn counts the lines the supplier actually answered', () => {
  const lines = [
    line({ id: 1, status: 'available' }),
    line({ id: 2, status: 'unavailable' }),
    line({ id: 3 }),
  ]
  assert.equal(answeredIn(lines), 2)
})
