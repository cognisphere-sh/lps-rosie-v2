import assert from 'node:assert/strict'
import test from 'node:test'

import { favouritesFirst, favouritesFirstPage } from './favourites.ts'

test('favourites lead, and both sides keep their order', () => {
  const rows = [1, 2, 3, 4, 5, 6].map((id) => ({ id, fav: id % 3 === 0 }))
  assert.deepEqual(favouritesFirst(rows, (r) => r.fav).map((r) => r.id), [3, 6, 1, 2, 4, 5])
})

test('every page is a window over favourites then the rest, never reading past a run', async () => {
  for (const [favCount, otherCount] of [[0, 23], [4, 23], [7, 0], [10, 10], [25, 3]]) {
    const runs = {
      favourites: Array.from({ length: favCount }, (_, i) => `f${i}`),
      others: Array.from({ length: otherCount }, (_, i) => `o${i}`),
    }
    const all = [...runs.favourites, ...runs.others]
    // Behaves like PostgREST: an offset past a non-empty run's end is refused.
    const read = async (scope: 'favourites' | 'others', from: number, to: number) => {
      const run = runs[scope]
      if (from > 0 && from >= run.length) throw new Error(`PGRST103 ${scope} ${from}`)
      return { records: run.slice(from, to + 1), total: run.length }
    }
    const size = 6
    for (let page = 1; (page - 1) * size < all.length; page += 1) {
      const got = await favouritesFirstPage(read, page, size)
      assert.equal(got.total, all.length)
      assert.deepEqual(got.records, all.slice((page - 1) * size, page * size), `${favCount}+${otherCount} page ${page}`)
    }
  }
})
