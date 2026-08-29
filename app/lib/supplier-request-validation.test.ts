import assert from 'node:assert/strict'
import test from 'node:test'

import { invalidSupplierRequest } from './supplier-request-validation.ts'

test('valid Supplier search and filter values keep their existing API path', () => {
  assert.equal(invalidSupplierRequest(new URLSearchParams({ q: 'Austin oak', 's.lps_partner': 'true', 's.name': 'oak' })), null)
  assert.equal(invalidSupplierRequest(new URLSearchParams([['s.city', 'Austin'], ['s.city', 'Dallas'], ['s.lps_partner', 'false']])), null)
})

test('malformed partner and Postgres-incompatible NUL parameters fail closed without reflection', () => {
  const genericNulError = 'query parameter contains an invalid null character'
  assert.equal(invalidSupplierRequest(new URLSearchParams({ 's.lps_partner': 'wat' })), 's.lps_partner must be true or false')
  assert.equal(invalidSupplierRequest(new URLSearchParams({ q: 'Austin\0Dallas', facets: '1' })), genericNulError)
  assert.equal(invalidSupplierRequest(new URLSearchParams({ 's.city': 'Austin\0Dallas' })), genericNulError)
  assert.equal(invalidSupplierRequest(new URLSearchParams([['\0', 'x']])), genericNulError)
  assert.equal(invalidSupplierRequest(new URLSearchParams('%00=x')), genericNulError)

  const attackerKey = '<attacker-controlled-key>'
  const error = invalidSupplierRequest(new URLSearchParams([[attackerKey, 'x\0y']]))
  assert.equal(error, genericNulError)
  assert.equal(error?.includes(attackerKey), false)
})
