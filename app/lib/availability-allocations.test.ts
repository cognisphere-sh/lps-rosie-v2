import assert from 'node:assert/strict'
import test from 'node:test'
import { buildAvailabilitySnapshots } from './availability-allocations.ts'

test('a consolidated supplier line retains each job quantity and quoted price', () => {
  const lines = [
    { id: 1, name: 'Live oak', size: '100 gal', quantity: 2 },
    { id: 2, name: 'Live oak', size: '100 gal', quantity: 3 },
    { id: 3, name: 'Live oak', size: '100 gal', quantity: 4 },
    { id: 4, name: 'Live oak', size: '100 gal', quantity: null },
  ]
  const prices = new Map([[1, 200], [2, 200], [3, 250]])
  const result = buildAvailabilitySnapshots(lines, prices, true)
  assert.equal(result.length, 3)
  assert.equal(result[0].quantity, 5)
  assert.deepEqual(result[0].allocations, [
    { job_request_item_id: 1, quantity: 2 }, { job_request_item_id: 2, quantity: 3 },
  ])
  assert.equal(result[1].unit_price, 250)
  assert.equal(result[2].quantity, null)
  assert.equal(buildAvailabilitySnapshots(lines, prices, false).length, 4)
})
