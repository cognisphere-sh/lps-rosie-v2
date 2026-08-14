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

// The selector offers standardized buckets, so every spelling of a 15-gallon
// container answers one checkbox. Multiple selections retain OR semantics.
assert.equal(matchesSizeFilter({ size: '15 G', size_std: '15G' }, null, ['15G']), true)
assert.equal(matchesSizeFilter({ size: '15 G/17"', size_std: '15G' }, null, ['15G']), true)
assert.equal(matchesSizeFilter({ size: '15 G', size_std: '15G' }, null, ['15 G']), false)
assert.equal(matchesSizeFilter({ size: '5 G', size_std: '5G' }, null, ['5G', '15G']), true)
assert.equal(matchesSizeFilter({ size: '10 G', size_std: '10G' }, null, ['5G', '15G']), false)
assert.equal(matchesSizeFilter({ size: 'B&B', size_std: 'other' }, null, ['other']), true)
assert.equal(matchesSizeFilter({ size: null, size_std: null }, null, []), true)
// A row with no standard yet is not silently swept into a bucket.
assert.equal(matchesSizeFilter({ size: '15 G', size_std: null }, null, ['15G']), false)
assert.equal(matchesSizeFilter({ size: null, size_std: null }, null, ['15G']), false)

console.log('size search checks passed')
