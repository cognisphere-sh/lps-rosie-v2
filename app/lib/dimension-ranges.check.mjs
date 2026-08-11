import assert from 'node:assert/strict'

import { dimensionFilterQuery, parseDimensionRanges } from './dimension-ranges.ts'

assert.equal(
  dimensionFilterQuery({ h: { min: '10', max: '12' }, w: { min: '24' }, price: { min: '5' } }),
  'height_min=10&height_max=12&width_min=24',
)
assert.deepEqual(
  parseDimensionRanges(new URLSearchParams('height_min=10&height_max=12&width_min=24&caliper_max=2.75')),
  { heightMin: 10, heightMax: 12, widthMin: 24, caliperMax: 2.75 },
)
assert.equal(dimensionFilterQuery({ h: { min: '12', max: '10' } }), '')
assert.equal(dimensionFilterQuery({ w: { min: 'not-a-number' } }), '')
assert.deepEqual(parseDimensionRanges(new URLSearchParams()), {})
assert.deepEqual(parseDimensionRanges(new URLSearchParams('height_min=0')), { heightMin: 0 })
assert.throws(
  () => parseDimensionRanges(new URLSearchParams('height_min=12&height_max=10')),
  /height_min cannot exceed height_max/,
)
assert.throws(
  () => parseDimensionRanges(new URLSearchParams('width_min=Infinity')),
  /width_min must be a non-negative number/,
)
assert.throws(
  () => parseDimensionRanges(new URLSearchParams('caliper_max=-1')),
  /caliper_max must be a non-negative number/,
)

console.log('dimension range checks passed')
