import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import ts from 'typescript'

const require = createRequire(import.meta.url)

test('filtered totals include every page and only matching active items, with exact cents', async () => {
  const jobs = Array.from({ length: 28 }, (_, index) => ({
    id: index + 1, customer_id: null, name: `Job ${index + 1}`, status: index < 27 ? 'committed' : 'closed_lost',
    is_active: true, created_at: '2026-09-01', updated_at: '2026-09-01',
  }))
  const items = jobs.flatMap((job) => [
    { id: job.id * 2, job_request_id: job.id, name: 'Oak', status: 'pending', size: '5g', total: '0.10', demanded_quantity: 50, available_quantity: null, unit_price: '0.002', is_active: true },
    // The stored total is demand × price; the quote subtotal uses availability (10 × 0.02).
    { id: job.id * 2 + 1, job_request_id: job.id, name: 'Pine', status: 'available', size: '15g', total: '0.40', demanded_quantity: 20, available_quantity: 10, unit_price: '0.02', is_active: true },
  ])
  items.push({ ...items[0], id: 500, total: '900', is_active: false })
  // Exceed the database's 1,000-row cap within one matching job.
  for (let index = 0; index < 1001; index++) items.push({ ...items[0], id: 1000 + index })
  const db = { from(table: string) {
    // Line values are read from the `job_lines` view (0130), never the table.
    assert.notEqual(table, 'job_request_items')
    let rows: Record<string, any>[] = table === 'job_requests' ? [...jobs] : table === 'job_lines' ? [...items] : []
    let bounds: [number, number] | null = null
    const query = {
      select(columns?: string) {
        if (table === 'job_lines' && columns) assert.ok(!columns.split(/,\s*/).includes('quantity'), 'Job demand reads use demanded_quantity')
        return query
      },
      eq(column: string, value: unknown) { rows = rows.filter((row) => row[column] === value); return query },
      in(column: string, values: unknown[]) { rows = rows.filter((row) => values.includes(row[column])); return query },
      gte(column: string, value: string) { rows = rows.filter((row) => row[column] >= value); return query },
      ilike(column: string, value: string) { rows = rows.filter((row) => String(row[column]).toLowerCase().includes(value.replaceAll('%', '').toLowerCase())); return query },
      or() { return query },
      order(column: string, options: { ascending: boolean }) { rows.sort((a, b) => (a[column] < b[column] ? -1 : a[column] > b[column] ? 1 : 0) * (options.ascending ? 1 : -1)); return query },
      range(start: number, end: number) { bounds = [start, end]; return query },
      limit(value: number) { bounds = [0, value - 1]; return query },
      then(resolve: (value: unknown) => unknown) {
        return Promise.resolve({ data: bounds ? rows.slice(bounds[0], bounds[1] + 1) : rows, error: null, count: rows.length }).then(resolve)
      },
    }
    return query
  } }
  const { outputText } = ts.transpileModule(readFileSync(new URL('./job-request-queries.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  })
  const module = { exports: {} as { listJobRequests: (...args: any[]) => Promise<any> } }
  const mocks: Record<string, unknown> = {
    'server-only': {}, '@/lib/supabase': { supabase: db }, '@/lib/notes': { parseEntries: () => [] },
    '@/lib/availability-queries': { supplierLinksByRequest: async () => ({}) },
  }
  new Function('require', 'module', 'exports', outputText)((name: string) => name in mocks ? mocks[name] : require(name), module, module.exports)
  const list = module.exports.listJobRequests
  const first = await list('', { status: ['committed'], itemStatus: ['pending'] }, 1)
  assert.equal(first.requests.length, 25)
  assert.equal(first.requests[0].items[0].quantity, 50)
  assert.equal(first.total, 27)
  assert.deepEqual(first.totals, { itemCount: 1028, subtotal: 102.8 })
  const second = await list('', { status: ['committed'], itemStatus: ['pending'] }, 2)
  assert.equal(second.requests.length, 2)
  assert.deepEqual(second.totals, first.totals)
  assert.deepEqual((await list('Pine', { status: ['committed'] }, 1)).totals, { itemCount: 27, subtotal: 5.4 })
  assert.deepEqual((await list('', { status: ['committed'], size: ['15g'] }, 1)).totals, { itemCount: 27, subtotal: 5.4 })
  assert.deepEqual((await list('', { itemStatus: [] }, 1)).totals, { itemCount: 0, subtotal: 0 })
  assert.deepEqual((await list('Missing', {}, 1)).totals, { itemCount: 0, subtotal: 0 })
})
