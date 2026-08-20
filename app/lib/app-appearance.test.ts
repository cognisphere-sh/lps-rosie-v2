import assert from 'node:assert/strict'
import test from 'node:test'

import { DEFAULT_APP_ACCENT, readAppAccent } from './app-appearance.ts'

test('a missing preference migrates the former implicit green default to Edge Teal', () => {
  assert.equal(readAppAccent(null), DEFAULT_APP_ACCENT)
  assert.equal(DEFAULT_APP_ACCENT, 'edge')
})

test('an explicit valid accent is preserved', () => {
  assert.equal(readAppAccent(JSON.stringify({ accent: 'plum' })), 'plum')
  assert.equal(readAppAccent(JSON.stringify({ accent: 'forest' })), 'forest')
})

test('malformed and unknown preferences fall back safely', () => {
  assert.equal(readAppAccent('{'), DEFAULT_APP_ACCENT)
  assert.equal(readAppAccent(JSON.stringify({ accent: 'neon' })), DEFAULT_APP_ACCENT)
})
