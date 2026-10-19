import assert from 'node:assert/strict'
import test from 'node:test'

import { errorCopy } from './error-copy'

test('a sentence written for people passes through unchanged', () => {
  assert.equal(errorCopy(new Error('Job name must be 120 characters or fewer.'), 'Could not save Name'),
    'Job name must be 120 characters or fewer.')
})

test('plumbing becomes the caller fallback with a next step', () => {
  assert.equal(errorCopy(new TypeError('Failed to fetch'), 'Could not save Price'),
    "Could not save Price — couldn't reach the server. Check your connection and try again.")
  assert.equal(errorCopy(new Error('canceling statement due to lock timeout'), 'Could not save Price'),
    'Could not save Price — the record was busy. Try again in a moment.')
  assert.equal(errorCopy(new Error('new row for relation "candidates" violates check constraint "x"'), 'Could not save Price'),
    "Could not save Price — that value isn't allowed here.")
  assert.equal(errorCopy(new Error('PGRST116: JSON object requested'), 'Could not save'),
    'Could not save. Try again; if it keeps failing, reload the page.')
})

test('String(cause) prefixes and empty messages are handled', () => {
  assert.equal(errorCopy('Error: Could not load jobs', 'Could not load jobs'), 'Could not load jobs')
  assert.equal(errorCopy(new Error(''), 'Could not save'), 'Could not save. Try again; if it keeps failing, reload the page.')
})
