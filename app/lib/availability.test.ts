import assert from 'node:assert/strict'
import test from 'node:test'

import {
  answeredIn,
  AR_STATUSES,
  arStatusLabel,
  arStatusTone,
  availabilityRequestLinkLabel,
  groupSupplierItems,
  isSubmittedARStatus,
  withAvailabilityRequestStatus,
  withoutAvailabilityRequest,
  type SupplierItemLine,
  type SupplierLink,
} from './availability.ts'

/** A line with everything defaulted, so each case states only what it is about. */
const line = (o: Partial<SupplierItemLine> & { id: number }): SupplierItemLine => ({
  name: 'x',
  size: null,
  demandedQuantity: null,
  status: null,
  availableQuantity: null,
  unitPrice: null,
  noteFromSupplier: null,
  noteForSupplier: null,
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

test('only the current submitted lifecycle state earns a submitted indicator', () => {
  assert.equal(isSubmittedARStatus('submitted'), true)
  for (const status of ['new', 'processing', 'closed']) {
    assert.equal(isSubmittedARStatus(status), false)
  }
})

test('an AR link accessible name includes the submitted state conveyed by its dot', () => {
  assert.equal(
    availabilityRequestLinkLabel(7, 'Oak Hill', 'submitted'),
    'Open availability request AR-7 to Oak Hill — Completed',
  )
  for (const status of ['new', 'processing']) {
    assert.equal(
      availabilityRequestLinkLabel(7, 'Oak Hill', status),
      'Open availability request AR-7 to Oak Hill — In progress',
    )
  }
  assert.equal(availabilityRequestLinkLabel(7, 'Oak Hill', 'closed'), 'Open availability request AR-7 to Oak Hill — Closed')
})

test('a drawer status signal updates only its linked AR and preserves unrelated references', () => {
  const links: SupplierLink[] = [
    {
      supplierId: 1,
      name: 'Oak Hill',
      lpsPartner: true,
      availabilityRequests: [
        { id: 7, status: 'processing' },
        { id: 6, status: 'closed' },
      ],
      rosieThreadId: 'supplier-oak-hill',
    },
    {
      supplierId: 2,
      name: 'Pine Farm',
      lpsPartner: true,
      availabilityRequests: [{ id: 5, status: 'new' }],
      rosieThreadId: null,
    },
  ]

  const next = withAvailabilityRequestStatus(links, 7, 'submitted')
  assert.notEqual(next, links)
  assert.notEqual(next[0], links[0])
  assert.equal(next[1], links[1])
  assert.equal(next[0].availabilityRequests[0].status, 'submitted')
  assert.equal(next[0].availabilityRequests[1], links[0].availabilityRequests[1])
  assert.equal(withAvailabilityRequestStatus(next, 7, 'submitted'), next)
  assert.equal(withAvailabilityRequestStatus(next, 99, 'submitted'), next)
})

test('answeredIn counts the lines the supplier actually answered', () => {
  const lines = [
    line({ id: 1, status: 'available' }),
    line({ id: 2, status: 'unavailable' }),
    line({ id: 3 }),
  ]
  assert.equal(answeredIn(lines), 2)
})

test('confirmed submission stamps update on first submit and resubmit without changing creation dates', () => {
  const createdAt = '2026-09-14T12:00:00Z'
  const submittedAt = '2026-09-15T12:00:00Z'
  const links: SupplierLink[] = [{ supplierId: 7, name: 'APS', lpsPartner: true, rosieThreadId: null,
    availabilityRequests: [{ id: 42, status: 'new', createdAt, submittedAt: null }] }]
  const first = withAvailabilityRequestStatus(links, 42, 'submitted', submittedAt)
  assert.deepEqual(first[0].availabilityRequests[0], { id: 42, status: 'submitted', createdAt, submittedAt })
  const nextStamp = '2026-09-16T12:00:00Z'
  const resubmitted = withAvailabilityRequestStatus(first, 42, 'submitted', nextStamp)
  assert.equal(resubmitted[0].availabilityRequests[0].submittedAt, nextStamp)
  assert.notEqual(resubmitted, first, 'A same-status resubmit still changes the displayed date')
  assert.equal(withAvailabilityRequestStatus(resubmitted, 42, 'submitted', nextStamp), resubmitted)
  assert.equal(withAvailabilityRequestStatus(resubmitted, 42, 'submitted'), resubmitted)
  const processing = withAvailabilityRequestStatus(resubmitted, 42, 'processing')
  assert.equal(processing[0].availabilityRequests[0].submittedAt, nextStamp, 'Older status-only signals preserve the stored stamp')
  const reopened = withAvailabilityRequestStatus(processing, 42, 'new', null)
  assert.equal(reopened[0].availabilityRequests[0].submittedAt, null)
  assert.equal(reopened[0].availabilityRequests[0].createdAt, createdAt)
})

test('AR status vocabulary is independent of deletion', () => {
  assert.deepEqual(AR_STATUSES, ['new', 'processing', 'submitted', 'closed'])
})

test('deletion removes the AR from every mounted supplier link while preserving other requests', () => {
  const links: SupplierLink[] = [
    { supplierId: 1, name: 'APS', lpsPartner: true, rosieThreadId: 'aps', availabilityRequests: [{ id: 11, status: 'new' }, { id: 12, status: 'submitted' }] },
    { supplierId: 2, name: 'Other', lpsPartner: true, rosieThreadId: null, availabilityRequests: [{ id: 11, status: 'new' }] },
  ]
  const next = withoutAvailabilityRequest(links, 11)
  assert.equal(next.length, 1)
  assert.deepEqual(next[0].availabilityRequests, [{ id: 12, status: 'submitted' }])
  assert.equal(links[0].availabilityRequests.length, 2)
})
