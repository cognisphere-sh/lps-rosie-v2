// Self-check for column reordering. Run: node lib/table-config.check.mjs
// Mirrors `reorder` in table-config.ts — kept in sync by hand, which is fine
// for eight lines of array surgery that are easy to get subtly wrong.
import assert from 'node:assert/strict'

function reorder(keys, fromKey, toKey) {
  if (fromKey === toKey) return keys
  const fromIdx = keys.indexOf(fromKey)
  const toIdx = keys.indexOf(toKey)
  if (fromIdx === -1 || toIdx === -1) return keys

  const next = keys.filter((k) => k !== fromKey)
  const target = next.indexOf(toKey)
  next.splice(fromIdx < toIdx ? target + 1 : target, 0, fromKey)
  return next
}

function showCaliperInStoredPlants(layouts) {
  const plants = layouts.plants
  if (!plants?.hidden.includes('cal')) return layouts
  return { ...layouts, plants: { ...plants, hidden: plants.hidden.filter((key) => key !== 'cal') } }
}

const cols = ['a', 'b', 'c', 'd']

// Rightward drop lands after the target, leftward before it.
assert.deepEqual(reorder(cols, 'a', 'c'), ['b', 'c', 'a', 'd'])
assert.deepEqual(reorder(cols, 'd', 'b'), ['a', 'd', 'b', 'c'])

// Adjacent swaps must work in BOTH directions. Insert-always-before made the
// rightward one a no-op; that regression is what this guards.
assert.deepEqual(reorder(cols, 'a', 'b'), ['b', 'a', 'c', 'd'])
assert.deepEqual(reorder(cols, 'b', 'a'), ['b', 'a', 'c', 'd'])
assert.deepEqual(reorder(cols, 'c', 'd'), ['a', 'b', 'd', 'c'])

// Dragging onto either end moves the column there.
assert.deepEqual(reorder(cols, 'd', 'a'), ['d', 'a', 'b', 'c'])
assert.deepEqual(reorder(cols, 'a', 'd'), ['b', 'c', 'd', 'a'])
// No-ops must not lose or duplicate a column.
assert.deepEqual(reorder(cols, 'a', 'a'), cols)
assert.deepEqual(reorder(cols, 'zz', 'b'), cols)
assert.deepEqual(reorder(cols, 'a', 'zz'), cols)
// Every reorder is a permutation — never drops or duplicates.
for (const from of cols) {
  for (const to of cols) {
    assert.deepEqual([...reorder(cols, from, to)].sort(), [...cols].sort())
  }
}
// Input is never mutated.
assert.deepEqual(cols, ['a', 'b', 'c', 'd'])

// The one-time caliper visibility migration removes only the old default-hidden
// value, retaining every other table and plants preference byte-for-byte.
const stored = {
  suppliers: { order: ['state', 'name'], hidden: ['notes'], widths: { name: 300 } },
  plants: { order: ['size', 'cal'], hidden: ['notes', 'cal'], widths: { cal: 140 } },
}
assert.deepEqual(showCaliperInStoredPlants(stored), {
  suppliers: stored.suppliers,
  plants: { order: ['size', 'cal'], hidden: ['notes'], widths: { cal: 140 } },
})
assert.deepEqual(stored.plants.hidden, ['notes', 'cal'])
const alreadyVisible = { plants: { order: ['cal'], hidden: ['notes'], widths: {} } }
assert.equal(showCaliperInStoredPlants(alreadyVisible), alreadyVisible)

console.log('table-config: reorder and caliper migration ok')
