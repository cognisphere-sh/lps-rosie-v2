import assert from 'node:assert/strict'

import { matchesSizeRange, sizeBoundsFor } from './size-range.ts'

assert.deepEqual(sizeBoundsFor({ size: '5 G' }, 'gallon'), { min: 5, max: 5 })
assert.deepEqual(sizeBoundsFor({ size: '10/15 G' }, 'gallon'), { min: 10, max: 15 })
assert.deepEqual(sizeBoundsFor({ size: '3 G/5 G' }, 'gallon'), { min: 3, max: 5 })
assert.deepEqual(sizeBoundsFor({ size: '25 G/21"' }, 'gallon'), { min: 25, max: 25 })
assert.deepEqual(sizeBoundsFor({ size: '72" Box' }, 'box'), { min: 72, max: 72 })
assert.deepEqual(sizeBoundsFor({ size: "3-4'" }, 'height'), { min: 3, max: 4 })
assert.deepEqual(sizeBoundsFor({ h: "6-7' HT", size: 'anything' }, 'height'), { min: 6, max: 7 })
assert.deepEqual(sizeBoundsFor({ size: '2.5" cal' }, 'caliper'), { min: 2.5, max: 2.5 })
assert.equal(sizeBoundsFor({ size: '4"' }, 'box'), null)
assert.equal(matchesSizeRange({ size: '15 G' }, 'gallon', '5', '15'), true)
assert.equal(matchesSizeRange({ size: '25 G' }, 'gallon', '5', '15'), false)
assert.equal(matchesSizeRange({ size: '10/15 G' }, 'gallon', '12', '20'), true)

console.log('size range checks passed')
