// Self-check for the size_std ordering. Run: node lib/size-std.check.mjs
import assert from 'node:assert/strict'

import { compareSizeStd } from './size-std.ts'

const shuffled = [
  'other', '100G', 'Root Pruned', '24" Box', '1G', 'Trays', '108" Box',
  'Field Grown', '15G', 'Bare Root', '2G', 'Grow Bags', '60" Box', 'Liners',
  'Plug', '670G', '2.5G', 'B&B', '4" Pot', '8" Pot', '3.5" Pot',
]

// Smallest container to largest: the word grades that precede a pot, then
// pots, gallons and boxes each by their own number, then the field-dug grades,
// then `other`. This is the order the filter offers.
assert.deepEqual([...shuffled].sort(compareSizeStd), [
  'Bare Root', 'Liners', 'Plug', 'Trays',
  '3.5" Pot', '4" Pot', '8" Pot',
  '1G', '2G', '2.5G', '15G', '100G', '670G',
  '24" Box', '60" Box', '108" Box',
  'B&B', 'Field Grown', 'Grow Bags', 'Root Pruned',
  'other',
])

// Each family sorts numerically, not as text — the regression this guards.
assert.ok(compareSizeStd('15G', '100G') < 0)
assert.ok(compareSizeStd('2G', '10G') < 0)
assert.ok(compareSizeStd('36" Box', '108" Box') < 0)
assert.ok(compareSizeStd('4" Pot', '10" Pot') < 0)

// A pot is never confused with a box of the same number, and always precedes
// the gallon family.
assert.ok(compareSizeStd('60" Pot', '1G') < 0)
assert.ok(compareSizeStd('670G', '24" Box') < 0)

// An unrecognized value still sorts deterministically, after `other`.
assert.ok(compareSizeStd('other', 'Mystery') < 0)
assert.equal(compareSizeStd('15G', '15G'), 0)

console.log('size-std: order ok')
