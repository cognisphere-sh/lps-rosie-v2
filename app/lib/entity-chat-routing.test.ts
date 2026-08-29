import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { agentChatButtonClass } from './agent-chat-button-style.ts'
import { supplierAgentThreads } from './agents.ts'
import { customerThreadId } from './customers.ts'

test('supplier quick actions route each agent to its stored per-agent thread', () => {
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

test('the agent quick-action variant is outlined without the avatar-only border reset', () => {
  const classes = agentChatButtonClass({ quickAction: true })
  assert.match(classes, /(?:^| )size-11(?: |$)/)
  assert.match(classes, /(?:^| )border(?: |$)/)
  assert.doesNotMatch(classes, /(?:^| )border-none(?: |$)/)
})

test('supplier chat actions sit with mobile contact routes and stay singular per viewport', () => {
  const page = readFileSync(new URL('../app/suppliers/[id]/page.tsx', import.meta.url), 'utf8')
  assert.match(page, /!isMobile && agentThreads\.map/)
  assert.match(page, /MOBILE_QUICK_ACTION_CLASS =[\s\S]*?size-11/)
  assert.match(page, /flex flex-wrap items-center gap-1\.5[\s\S]*?min-w-36 flex-1/)
  assert.match(page, /max-w-full flex-wrap[\s\S]*?agentThreads\.map[\s\S]*?quickAction[\s\S]*?quickPhone[\s\S]*?quickEmail[\s\S]*?values\.website[\s\S]*?mapHref/)
})

test('customer detail and JR actions use only the stored canonical Rosie thread', () => {
  assert.equal(customerThreadId({ rosieThreadId: 'customer-acme-42' }), 'customer-acme-42')
  assert.equal(customerThreadId({ rosieThreadId: null }), null)
  assert.equal(customerThreadId({ rosieThreadId: '   ' }), null)
})
