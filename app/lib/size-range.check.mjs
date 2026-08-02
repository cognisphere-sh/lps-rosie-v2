import assert from 'node:assert/strict'

import {
  matchesSizeFilter, parseSizeQuery, sizeChoiceFor, sizeChoicesFor,
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

assert.deepEqual(sizeChoiceFor({ size: '15 G/17"' }), { key: 'gallon:15:15', label: '15 gal' })
assert.deepEqual(sizeChoiceFor({ size: '10/15 G' }), { key: 'gallon:10:15', label: '10–15 gal' })
assert.deepEqual(sizeChoiceFor({ size: '24" Box' }), { key: 'box:24:24', label: '24" box' })
assert.deepEqual(sizeChoiceFor({ size: 'B&B 7\'' }), { key: "raw:b&b 7'", label: "B&B 7'" })
assert.equal(matchesSizeFilter({ size: '15 G' }, { unit: 'gallon', value: 15, label: '15 gal' }, ''), true)
assert.equal(matchesSizeFilter({ size: '25 G' }, { unit: 'gallon', value: 15, label: '15 gal' }, ''), false)
assert.equal(matchesSizeFilter({ size: '10/15 G' }, { unit: 'gallon', value: 15, label: '15 gal' }, ''), true)
assert.equal(matchesSizeFilter({ size: '15G' }, null, 'gallon:15:15'), true)
assert.equal(matchesSizeFilter({ size: '10 G' }, null, 'gallon:15:15'), false)
assert.deepEqual(sizeChoicesFor([
  { values: { size: '15 G' } },
  { values: { size: '15G' } },
  { values: { size: '5 G' } },
]).map((choice) => choice.label), ['5 gal', '15 gal'])

console.log('size search checks passed')
