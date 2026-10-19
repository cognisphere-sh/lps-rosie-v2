import assert from 'node:assert/strict'
import test from 'node:test'

import { canTransition, inferKind, insetWithin } from './view-transitions.ts'

test('another rail destination is a lateral move, whatever the depth', () => {
  assert.equal(inferKind({ section: 0, path: '/suppliers/12' }, { section: 3, path: '/customers' }), 'lateral')
  assert.equal(inferKind({ section: 3, path: '/customers' }, { section: 0, path: '/suppliers' }), 'lateral')
})

test('within a destination, path depth decides deeper, back or swap', () => {
  assert.equal(inferKind({ section: 0, path: '/suppliers' }, { section: 0, path: '/suppliers/12' }), 'deeper')
  assert.equal(inferKind({ section: 0, path: '/suppliers/12' }, { section: 0, path: '/suppliers' }), 'back')
  assert.equal(inferKind({ section: 0, path: '/suppliers/12' }, { section: 0, path: '/suppliers/40' }), 'swap')
  assert.equal(inferKind({ section: 1, path: '/partner/7' }, { section: 1, path: '/partner/7/requests/9' }), 'deeper')
})

test('an unknown rail position never reads as lateral', () => {
  // The focused Jobs page hides the app rail on desktop.
  assert.equal(inferKind({ section: 4, path: '/requests' }, { section: -1, path: '/jobs' }), 'swap')
  assert.equal(inferKind({ section: -1, path: '/jobs' }, { section: 4, path: '/requests' }), 'swap')
})

test('a row becomes a rounded clip-path inset of the page column', () => {
  const frame = { top: 53, right: 1395, bottom: 900, left: 56 }
  assert.equal(
    insetWithin({ top: 170, right: 1380, bottom: 218, left: 72 }, frame),
    'inset(117px 15px 682px 16px round 12px)',
  )
  // A row partly outside the column is clamped to its edge.
  assert.equal(
    insetWithin({ top: 20, right: 1500, bottom: 80, left: 0 }, frame),
    'inset(0px 0px 820px 0px round 12px)',
  )
})

test('without the View Transitions API the update just runs', () => {
  assert.equal(canTransition(), false)
})
