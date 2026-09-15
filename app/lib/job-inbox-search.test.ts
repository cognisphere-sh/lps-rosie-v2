import assert from 'node:assert/strict'
import test from 'node:test'

import { searchJobInbox } from './job-inbox-search.ts'
import type { JobInboxRow } from './job-inbox.ts'

test('all search words match across the complete job corpus without changing order or records', () => {
  const base = { status: 'quoted', customer: null, customerCompany: null, customerContact: null, createdAt: null, updatedAt: null, thread: null }
  const rows: JobInboxRow[] = [
    { ...base, id: 9, name: 'Courtyard', searchText: 'JR-9\nCourtyard\nRed oak\n30 G\nReserve for Oct\nNorthwind' },
    { ...base, id: 8, name: 'Garden', searchText: 'JR-8\nGarden\nMagnolia\nNo substitutions' },
    { ...base, id: 7, name: 'Street trees', searchText: 'JR-7\nStreet trees\nRed oak\n15 G\nNorthwind' },
  ]
  assert.deepEqual(searchJobInbox(rows, 'OAK  Northwind').map((row) => row.id), [9, 7])
  assert.deepEqual(searchJobInbox(rows, 'reserve 30 g'), [rows[0]])
  assert.deepEqual(searchJobInbox(rows, 'no substitutions'), [rows[1]])
  assert.deepEqual(searchJobInbox(rows, 'JR-8'), [rows[1]])
  assert.deepEqual(searchJobInbox(rows, '%'), [])
  assert.deepEqual(searchJobInbox(rows, 'oak impossible'), [])
  assert.equal(searchJobInbox(rows, '   '), rows)
  assert.equal(searchJobInbox(rows, 'oak')[0], rows[0])
})
