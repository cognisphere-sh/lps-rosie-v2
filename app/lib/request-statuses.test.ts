import assert from 'node:assert/strict'
import test from 'node:test'
import { ACTIVE_JOB_STATUSES, ITEM_STATUS_OPTIONS, REQUEST_STATUSES, REQUEST_STATUS_OPTIONS, isActiveJobStatus, itemPill, requestStatusLabel, requestStatusToken, requestStatusTone } from './job-requests.ts'
import { ORDER_STATUSES, ORDER_STATUS_META } from './orders.ts'
import { AR_ANSWER_OPTIONS, AR_RESPONSE_OPTIONS, answeredIn, arResponseLabel } from './availability.ts'
import { normalizeStoredRequestStatusLabels } from './request-list-state.ts'
import { countItemFilters } from '../components/workspace/supplier-items.tsx'
import type { SupplierItemLine } from './availability.ts'

test('working sales stages stay active and terminal/legacy archived jobs do not', () => {
  assert.deepEqual(REQUEST_STATUS_OPTIONS.map((o) => o.label), ['Quote', 'Availability', 'Committed', 'Won', 'Lost'])
  for (const status of ACTIVE_JOB_STATUSES) assert.equal(isActiveJobStatus(status), true)
  for (const status of ['confirmed', 'closed_won', 'closed_lost', 'archived']) assert.equal(isActiveJobStatus(status), false)
  assert.equal(requestStatusLabel('archived'), 'Archived')
})

test('both plant pickers use the requested order and preserve saved status labels for partial quantities', () => {
  const labels = ['Available', 'Partial Qty', 'Unavailable', 'Diff Sz/Sub', 'Can Order', 'Arriving Soon', 'Pending']
  assert.deepEqual(ITEM_STATUS_OPTIONS.map((o) => o.label), labels)
  assert.deepEqual(AR_RESPONSE_OPTIONS.map((o) => o.label), ['Available', 'Partial Qty', 'Unavailable', 'Diff Sz/Sub', 'Can Order', 'Arriving Soon', 'Pending'])
  assert.deepEqual(AR_ANSWER_OPTIONS.map((o) => o.label), ['Available', 'Unavailable/Sub', 'Can Order/Arriving Soon', 'Partial Qty', 'Pending'])
  assert.deepEqual(normalizeStoredRequestStatusLabels(['Need to Order', 'Can Order'], ITEM_STATUS_OPTIONS, []), ['Can Order'])
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
  assert.deepEqual(normalizeStoredRequestStatusLabels(['Substituted', 'Different Sz/Qnty/Sub', 'Diff Sz/Qnty/Sub'], ITEM_STATUS_OPTIONS, []), ['Diff Sz/Sub'])
})


test('the persisted old default expands to include newly introduced working stages', () => {
  const current = REQUEST_STATUS_OPTIONS.map((o) => o.label)
  assert.deepEqual(normalizeStoredRequestStatusLabels(['Sourcing', 'Quote Delivered', 'Closed won', 'Closed lost'], REQUEST_STATUS_OPTIONS, current), current)
})


test('Quote and Availability remain separate active filters', () => {
  const options = REQUEST_STATUS_OPTIONS
  assert.deepEqual(normalizeStoredRequestStatusLabels(['Active', 'Quote', 'Availability', 'Confirmed'], options, []), ['Quote', 'Availability', 'Committed'])
  assert.deepEqual(ACTIVE_JOB_STATUSES, ['quoted', 'availability', 'committed'])
})


test('a current filter that deliberately excludes Committed survives restoration', () => {
  const selected = ['Active', 'Quote', 'Won', 'Lost']
  assert.deepEqual(normalizeStoredRequestStatusLabels(selected, REQUEST_STATUS_OPTIONS, REQUEST_STATUS_OPTIONS.map((o) => o.label)), ['Quote', 'Won', 'Lost'])
})


test('saved In Progress includes both restored stages and preserves an excluded Committed', () => {
  assert.deepEqual(normalizeStoredRequestStatusLabels(
    ['New', 'In Progress', 'Closed Won', 'Closed Lost'], REQUEST_STATUS_OPTIONS, [],
  ), ['Quote', 'Availability', 'Won', 'Lost'])
  assert.deepEqual(normalizeStoredRequestStatusLabels(
    ['In Progress', 'Quote Delivered', 'Availability', 'Quote'], REQUEST_STATUS_OPTIONS, [],
  ), ['Quote', 'Availability'])
})

test('the previous complete default restores all five job stages', () => {
  const current = REQUEST_STATUS_OPTIONS.map((o) => o.label)
  assert.deepEqual(normalizeStoredRequestStatusLabels(
    ['New', 'In Progress', 'Confirmed', 'Closed Won', 'Closed Lost'], REQUEST_STATUS_OPTIONS, current,
  ), current)
})

test('legacy Confirmed job filters map to Committed independently of the partner order lifecycle', () => {
  const fallback = REQUEST_STATUS_OPTIONS.map((option) => option.label)
  assert.deepEqual(normalizeStoredRequestStatusLabels(['Confirmed'], REQUEST_STATUS_OPTIONS, fallback), ['Committed'])
  assert.deepEqual(normalizeStoredRequestStatusLabels(['Confirmed', 'Committed', 'Availability'], REQUEST_STATUS_OPTIONS, fallback), ['Committed', 'Availability'])
  assert.deepEqual(normalizeStoredRequestStatusLabels(['Quote', 'Availability', 'Committed', 'Confirmed', 'Won', 'Lost'], REQUEST_STATUS_OPTIONS, fallback), fallback)
  assert.deepEqual(normalizeStoredRequestStatusLabels([], REQUEST_STATUS_OPTIONS, fallback), [])
  assert.equal(requestStatusLabel('confirmed'), 'Committed')
  assert.equal(requestStatusToken('confirmed'), 'Cmt')
  assert.equal(requestStatusTone('confirmed'), requestStatusTone('committed'))
  assert.equal((REQUEST_STATUSES as readonly string[]).includes('confirmed'), false)
  assert.deepEqual(ORDER_STATUSES, ['new', 'processing', 'order_ready', 'closed_won', 'closed_lost'])
  assert.equal(ORDER_STATUS_META.new.label, 'New')
  assert.equal(ORDER_STATUS_META.processing.label, 'Processing')
  assert.equal(ORDER_STATUS_META.order_ready.label, 'Order Ready')
})

test('unknown saved labels cannot resolve to inherited object properties', () => {
  assert.deepEqual(normalizeStoredRequestStatusLabels(
    ['__proto__', 'constructor', 'toString', 'Availability'], REQUEST_STATUS_OPTIONS, [],
  ), ['Availability'])
})
