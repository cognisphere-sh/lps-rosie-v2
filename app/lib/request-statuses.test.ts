import assert from 'node:assert/strict'
import test from 'node:test'
import { ACTIVE_JOB_STATUSES, ITEM_STATUS_OPTIONS, REQUEST_STATUS_OPTIONS, isActiveJobStatus, itemPill, requestStatusLabel } from './job-requests.ts'
import { AR_RESPONSE_OPTIONS, answeredIn, arResponseLabel } from './availability.ts'
import { normalizeStoredRequestStatusLabels } from './request-list-state.ts'
import { countItemFilters } from '../components/workspace/supplier-items.tsx'
import type { SupplierItemLine } from './availability.ts'

test('working sales stages stay active and terminal/legacy archived jobs do not', () => {
  assert.deepEqual(REQUEST_STATUS_OPTIONS.map((o) => o.label), ['Active', 'Quote', 'Availability', 'Confirmed', 'Won', 'Lost'])
  for (const status of ACTIVE_JOB_STATUSES) assert.equal(isActiveJobStatus(status), true)
  for (const status of ['closed_won', 'closed_lost', 'archived']) assert.equal(isActiveJobStatus(status), false)
  assert.equal(requestStatusLabel('archived'), 'Archived')
})

test('both plant pickers use the requested order and preserve saved status labels for partial quantities', () => {
  const labels = ['Available', 'Unavailable', 'Diff Sz/Qnty/Sub', 'Need to Order', 'Arriving Soon', 'Pending']
  assert.deepEqual(ITEM_STATUS_OPTIONS.map((o) => o.label), labels)
  assert.deepEqual(AR_RESPONSE_OPTIONS.map((o) => o.label), ['Available', 'Unavailable', 'Diff Sz/Qnty/Sub', 'Can Order', 'Arriving Soon', 'Pending'])
  assert.equal(itemPill('available', 12, 4).label, 'Available')
  assert.equal(arResponseLabel(null), 'Pending')
})

test('Pending includes unanswered lines in supplier filters without counting seeded prices as answers', () => {
  const lines = [
    { status: null, unitPrice: 12 },
    { status: 'can_order', unitPrice: 12 },
    { status: 'diff_size_qty_sub', unitPrice: null },
  ] as SupplierItemLine[]
  const counts = countItemFilters(lines)
  assert.equal(counts.all, 3)
  assert.equal(counts.pending, 1)
  assert.equal(counts.can_order, 1)
  assert.equal(answeredIn(lines), 2)
  assert.deepEqual(normalizeStoredRequestStatusLabels(['Substituted', 'Different Sz/Qnty/Sub', 'Diff Sz/Qnty/Sub'], ITEM_STATUS_OPTIONS, []), ['Diff Sz/Qnty/Sub'])
})


test('the persisted old default expands to include newly introduced working stages', () => {
  const current = REQUEST_STATUS_OPTIONS.map((o) => o.label)
  assert.deepEqual(normalizeStoredRequestStatusLabels(['Sourcing', 'Quote Delivered', 'Closed won', 'Closed lost'], REQUEST_STATUS_OPTIONS, current), current)
})


test('Quote and Availability remain separate active filters', () => {
  const options = REQUEST_STATUS_OPTIONS
  assert.deepEqual(normalizeStoredRequestStatusLabels(['Active', 'Quote', 'Availability', 'Confirmed'], options, []), ['Active', 'Quote', 'Availability', 'Confirmed'])
  assert.deepEqual(ACTIVE_JOB_STATUSES, ['sourcing', 'quoted', 'availability', 'confirmed'])
})


test('a current filter that deliberately excludes Confirmed survives restoration', () => {
  const selected = ['Active', 'Quote', 'Won', 'Lost']
  assert.deepEqual(normalizeStoredRequestStatusLabels(selected, REQUEST_STATUS_OPTIONS, REQUEST_STATUS_OPTIONS.map((o) => o.label)), selected)
})


test('saved In Progress includes both restored stages and preserves an excluded Confirmed', () => {
  assert.deepEqual(normalizeStoredRequestStatusLabels(
    ['New', 'In Progress', 'Closed Won', 'Closed Lost'], REQUEST_STATUS_OPTIONS, [],
  ), ['Active', 'Quote', 'Availability', 'Won', 'Lost'])
  assert.deepEqual(normalizeStoredRequestStatusLabels(
    ['In Progress', 'Quote Delivered', 'Availability', 'Quote'], REQUEST_STATUS_OPTIONS, [],
  ), ['Quote', 'Availability'])
})

test('the previous complete default restores all six stages', () => {
  const current = REQUEST_STATUS_OPTIONS.map((o) => o.label)
  assert.deepEqual(normalizeStoredRequestStatusLabels(
    ['New', 'In Progress', 'Confirmed', 'Closed Won', 'Closed Lost'], REQUEST_STATUS_OPTIONS, current,
  ), current)
})

test('unknown saved labels cannot resolve to inherited object properties', () => {
  assert.deepEqual(normalizeStoredRequestStatusLabels(
    ['__proto__', 'constructor', 'toString', 'Availability'], REQUEST_STATUS_OPTIONS, [],
  ), ['Availability'])
})
