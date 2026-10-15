import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import ts from 'typescript'

const require = createRequire(import.meta.url)

test('job demand edits write the renamed numeric field and reject obsolete or invalid inputs', async () => {
  const writes: unknown[] = []
  const supabase = {
    from(table: string) { return { update(values: unknown) { return {
      async eq(column: string, id: unknown) { writes.push({ table, values, column, id }); return { error: null } },
    } } } },
    async rpc(fn: string, args: unknown) { writes.push({ rpc: fn, args }); return { error: null } },
  }
  const mocks: Record<string, unknown> = {
    'server-only': {}, '@/lib/supabase': { supabase }, '@/lib/columns': { SUPPLIER_CATEGORIES: [] },
    '@/lib/customers': { CUSTOMER_TYPES: [] }, '@/lib/job-requests': { ITEM_STATUSES: ['available', 'pending'], REQUEST_STATUSES: [] },
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
  // Status, price, avail and the customer note are the selected candidate's (0130):
  // '' is a deliberately blank note, null follows the supplier's reply again.
  await updateCell('job_request_items', 42, 'note_for_customer', ' Single trunk\nNo substitutions ')
  await updateCell('job_request_items', 42, 'note_for_customer', '')
  await updateCell('job_request_items', 42, 'note_for_customer', null)
  await updateCell('job_request_items', 42, 'status', 'pending')
  await updateCell('job_request_items', 42, 'unit_price', ' 12.5 ')
  await updateCell('job_request_items', 42, 'available_quantity', '')
  // Size and name are the line's own ask, never the candidate's; an emptied size is null.
  await updateCell('job_request_items', 42, 'size', ' 30 G ')
  await updateCell('job_request_items', 42, 'size', ' ')
  await updateCell('job_request_items', 42, 'name', ' Quercus virginiana ')
  await assert.rejects(updateCell('job_request_items', 42, 'name', ' '), /Plant name is required/)
  const line = (p_changes: unknown) => ({ rpc: 'update_job_line', args: { p_item_id: 42, p_changes } })
  const ask = (values: unknown) => ({ table: 'job_request_items', values, column: 'id', id: 42 })
  assert.deepEqual(writes.slice(2), [
    line({ note_for_customer: 'Single trunk\nNo substitutions' }), line({ note_for_customer: '' }),
    line({ note_for_customer: null }), line({ status: 'pending' }), line({ unit_price: 12.5 }), line({ available_quantity: null }),
    ask({ size: '30 G' }), ask({ size: null }), ask({ name: 'Quercus virginiana' }),
  ])
  await assert.rejects(updateCell('job_request_items', 42, 'status', 'alternative_proposed'), /must be one of/)
  const { updateFields } = module.exports as unknown as { updateFields: (...args: unknown[]) => Promise<void> }
  await assert.rejects(updateFields('job_request_items', 42, { size: '30 G', status: 'available' }), /apart from its other fields/)
  await updateFields('job_request_items', 42, { name: 'Oak', size: '30 G', note_internal: 'x' })
  assert.deepEqual(writes.at(-1), ask({ name: 'Oak', size: '30 G', note_internal: 'x' }))
  assert.equal(writes.length, 12)
  await updateCell('inventory', 'plant-id', 'quantity', '5')
  assert.deepEqual(writes.at(-1), { table: 'inventory', values: { quantity: 5 }, column: 'id', id: 'plant-id' })
})
