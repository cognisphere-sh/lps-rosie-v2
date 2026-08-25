import assert from 'node:assert/strict'
import test from 'node:test'

import { redactPortalRequestRefs } from './portal-display.ts'

test('redacts supplier-visible availability-request reference variants', () => {
  assert.equal(
    redactPortalRequestRefs('AR-6, ar-7, AR 8, AR #9, AR‐10, AR‑11, AR‒12, AR–13, AR—14, AR―15'),
    [
      'availability request', 'availability request', 'availability request',
      'availability request', 'availability request', 'availability request',
      'availability request', 'availability request', 'availability request',
      'availability request',
    ].join(', '),
  )
})

test('does not redact partial references', () => {
  assert.equal(
    redactPortalRequestRefs('FAR-6 AR-6s AR-61x'),
    'FAR-6 AR-6s AR-61x',
  )
})

test('redacts references without changing surrounding markdown syntax', () => {
  assert.equal(
    redactPortalRequestRefs('**AR-6** [Open AR #7](ar:7) `AR–8`'),
    '**availability request** [Open availability request](ar:7) `availability request`',
  )
})
