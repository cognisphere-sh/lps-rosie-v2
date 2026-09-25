import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import ts from 'typescript'

const require = createRequire(import.meta.url)

test('job demand edits write the renamed numeric field and reject obsolete or invalid inputs', async () => {
  const writes: unknown[] = []
  const supabase = { from(table: string) { return { update(values: unknown) { return {
    async eq(column: string, id: unknown) { writes.push({ table, values, column, id }); return { error: null } },
  } } } } }
  const mocks: Record<string, unknown> = {
    'server-only': {}, '@/lib/supabase': { supabase }, '@/lib/columns': { SUPPLIER_CATEGORIES: [] },
    '@/lib/customers': { CUSTOMER_TYPES: [] }, '@/lib/job-requests': { ITEM_STATUSES: [], REQUEST_STATUSES: [] },
    '@/lib/server-filters': {},
  }
  const { outputText } = ts.transpileModule(readFileSync(new URL('./queries.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  })
  const module = { exports: {} as { updateCell: (...args: any[]) => Promise<void> } }
  new Function('require', 'module', 'exports', outputText)((name: string) => name in mocks ? mocks[name] : require(name), module, module.exports)
  const { updateCell } = module.exports
  await updateCell('job_request_items', 42, 'demanded_quantity', ' 2.5 ')
  await updateCell('job_request_items', 42, 'demanded_quantity', '')
  assert.deepEqual(writes, [
    { table: 'job_request_items', values: { demanded_quantity: 2.5 }, column: 'id', id: 42 },
    { table: 'job_request_items', values: { demanded_quantity: null }, column: 'id', id: 42 },
  ])
  for (const value of ['0', '-1', 'NaN', 'Infinity', 'unknown']) {
    await assert.rejects(updateCell('job_request_items', 42, 'demanded_quantity', value), /must be/)
  }
  await assert.rejects(updateCell('job_request_items', 42, 'quantity', '5'), /refusing to write/)
  assert.equal(writes.length, 2)
  await updateCell('job_request_items', 42, 'note_for_customer', ' Single trunk\nNo substitutions ')
  await updateCell('job_request_items', 42, 'note_for_customer', '')
  assert.deepEqual(writes.slice(2), [
    { table: 'job_request_items', values: { note_for_customer: 'Single trunk\nNo substitutions' }, column: 'id', id: 42 },
    { table: 'job_request_items', values: { note_for_customer: null }, column: 'id', id: 42 },
  ])
  await updateCell('inventory', 'plant-id', 'quantity', '5')
  assert.deepEqual(writes.at(-1), { table: 'inventory', values: { quantity: 5 }, column: 'id', id: 'plant-id' })
})
