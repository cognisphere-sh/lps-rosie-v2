import assert from 'node:assert/strict'
import test from 'node:test'

import { supplierAgentThreads } from './agents.ts'
import { customerThreadId } from './customers.ts'

test('supplier header routes each agent to its stored per-agent thread', () => {
  assert.deepEqual(
    supplierAgentThreads({
      rosie_thread_id: 'supplier-live-oak',
      daisy_thread_id: 'supplier-live-oak',
    }),
    [
      { agentId: 'rosie', threadId: 'supplier-live-oak' },
      { agentId: 'daisy', threadId: 'supplier-live-oak' },
    ],
  )
})

test('supplier header omits missing threads instead of inventing one', () => {
  assert.deepEqual(
    supplierAgentThreads({ rosie_thread_id: 'supplier-live-oak', daisy_thread_id: null }),
    [{ agentId: 'rosie', threadId: 'supplier-live-oak' }],
  )
})

test('supplier routing trims ids and rejects Rosie and Daisy blanks independently', () => {
  assert.deepEqual(
    supplierAgentThreads({ rosie_thread_id: '   ', daisy_thread_id: ' supplier-live-oak ' }),
    [{ agentId: 'daisy', threadId: 'supplier-live-oak' }],
  )
  assert.deepEqual(
    supplierAgentThreads({ rosie_thread_id: ' supplier-live-oak ', daisy_thread_id: '\t' }),
    [{ agentId: 'rosie', threadId: 'supplier-live-oak' }],
  )
})

test('customer detail and JR actions use only the stored canonical Rosie thread', () => {
  assert.equal(customerThreadId({ rosieThreadId: 'customer-acme-42' }), 'customer-acme-42')
  assert.equal(customerThreadId({ rosieThreadId: null }), null)
  assert.equal(customerThreadId({ rosieThreadId: '   ' }), null)
})
