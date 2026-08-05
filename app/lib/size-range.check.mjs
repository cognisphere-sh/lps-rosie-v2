import assert from 'node:assert/strict'

import { matchesSizeFilter, parseSizeQuery } from './size-range.ts'

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

// A size typed into the natural-language query still matches equivalent unit
// spellings and listed ranges by value.
assert.equal(matchesSizeFilter({ size: '15 G' }, { unit: 'gallon', value: 15, label: '15 gal' }, []), true)
assert.equal(matchesSizeFilter({ size: '25 G' }, { unit: 'gallon', value: 15, label: '15 gal' }, []), false)
assert.equal(matchesSizeFilter({ size: '10/15 G' }, { unit: 'gallon', value: 15, label: '15 gal' }, []), true)

// The selector now exposes exact row values rather than inferred commercial
// buckets. Multiple selections retain OR semantics.
assert.equal(matchesSizeFilter({ size: '15G' }, null, ['15G']), true)
assert.equal(matchesSizeFilter({ size: '15G' }, null, ['15 G']), false)
assert.equal(matchesSizeFilter({ size: '5 G' }, null, ['5 G', '15 G']), true)
assert.equal(matchesSizeFilter({ size: '15 G' }, null, ['5 G', '15 G']), true)
assert.equal(matchesSizeFilter({ size: '10 G' }, null, ['5 G', '15 G']), false)
assert.equal(matchesSizeFilter({ size: null }, null, []), true)
assert.equal(matchesSizeFilter({ size: null }, null, ['15 G']), false)

console.log('size search checks passed')
