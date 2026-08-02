import assert from 'node:assert/strict'

import {
  matchesSizeFilter, parseSizeQuery, sizeChoicesFor, sizeChoicesForValues,
} from './size-range.ts'

assert.deepEqual(parseSizeQuery('15g Agave Americana'), {
  plantQuery: 'Agave Americana',
  size: { unit: 'gallon', value: 15, label: '15 gal' },
})
assert.deepEqual(parseSizeQuery('Agave Americana 15 gallon'), {
  plantQuery: 'Agave Americana',
  size: { unit: 'gallon', value: 15, label: '15 gal' },
})
assert.deepEqual(parseSizeQuery('24" box live oak'), {
  plantQuery: 'live oak',
  size: { unit: 'box', value: 24, label: '24" box' },
})
assert.deepEqual(parseSizeQuery('Agave Americana'), { plantQuery: 'Agave Americana', size: null })

assert.deepEqual(sizeChoicesForValues({ size: '15 G/17"' }), [{ key: 'gallon:15', label: '15 gal' }])
assert.deepEqual(sizeChoicesForValues({ size: '3/5 G' }), [
  { key: 'gallon:3', label: '3 gal' },
  { key: 'gallon:5', label: '5 gal' },
])
assert.deepEqual(sizeChoicesForValues({ size: '24" Box' }), [{ key: 'box:24', label: '24" box' }])
assert.deepEqual(sizeChoicesForValues({ size: '2.5" cal' }), [{ key: 'caliper:2.5', label: '2.5" caliper' }])
assert.deepEqual(sizeChoicesForValues({ size: '15 G; 1.25"', cal: '1.25"' }), [
  { key: 'gallon:15', label: '15 gal' },
  { key: 'caliper:1.25', label: '1.25" caliper' },
])
assert.deepEqual(sizeChoicesForValues({ size: '10"' }), [])
assert.deepEqual(sizeChoicesForValues({ size: '7.00' }), [])
assert.deepEqual(sizeChoicesForValues({ size: "B&B 7'" }), [])

assert.equal(matchesSizeFilter({ size: '15 G' }, { unit: 'gallon', value: 15, label: '15 gal' }, ''), true)
assert.equal(matchesSizeFilter({ size: '25 G' }, { unit: 'gallon', value: 15, label: '15 gal' }, ''), false)
assert.equal(matchesSizeFilter({ size: '10/15 G' }, { unit: 'gallon', value: 15, label: '15 gal' }, ''), true)
assert.equal(matchesSizeFilter({ size: '15G' }, null, 'gallon:15'), true)
assert.equal(matchesSizeFilter({ size: '10 G' }, null, 'gallon:15'), false)
assert.deepEqual(sizeChoicesFor([
  { values: { size: '15 G' } },
  { values: { size: '15G' } },
  { values: { size: '3/5 G' } },
  { values: { size: '10"' } },
]).map((choice) => choice.label), ['3 gal', '5 gal', '15 gal'])

console.log('size search checks passed')
