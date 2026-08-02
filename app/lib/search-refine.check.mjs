import assert from 'node:assert/strict'

import { refinePlantGroups } from './search-refine.ts'

const groups = [{
  supplier: 'test',
  plants: [
    { values: { name: 'Agave americana [Blue Century Plant]', other: 'American Aloe, Century Plant' } },
    { values: { name: 'Agave americana [Marginata]', other: null } },
    { values: { name: 'Tilia americana [Redmond]', other: 'American Linden' } },
    { values: { name: 'Ulmus americana [Princeton]', other: 'American Elm' } },
  ],
}]

assert.deepEqual(
  refinePlantGroups(groups, 'Agave Americana')[0].plants.map((plant) => plant.values.name),
  ['Agave americana [Blue Century Plant]', 'Agave americana [Marginata]'],
)
assert.equal(refinePlantGroups(groups, 'Agave Americ')[0].plants.length, 2)
assert.equal(refinePlantGroups(groups, 'americana')[0].plants.length, 4)
assert.equal(refinePlantGroups(groups, 'misspelled identity')[0].plants.length, 4)

const commonName = [{
  plants: [
    { values: { name: 'Acer palmatum', other: 'Japanese Maple' } },
    { values: { name: 'Acer rubrum', other: 'Red Maple' } },
  ],
}]
assert.equal(refinePlantGroups(commonName, 'Japanese Maple')[0].plants.length, 1)
assert.equal(refinePlantGroups(commonName, 'Japanese Mapl')[0].plants.length, 1)

console.log('search refinement checks passed')
