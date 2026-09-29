import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'

const require = createRequire(import.meta.url)
function load(file: string, mocks: Record<string, unknown>) {
  const source = readFileSync(new URL(file, import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } })
  const module = { exports: {} as Record<string, (...args: any[]) => Promise<any>> }
  new Function('require', 'module', 'exports', outputText)((name: string) => name in mocks ? mocks[name] : require(name), module, module.exports)
  return module.exports
}

function setup() {
  let status = 'processing'
  const writes: Array<{ values: Record<string, unknown>; filters: Record<string, unknown> }> = []
  const queries = load('./availability-queries.ts', {
    'server-only': {}, '@/lib/partner-display': {},
    '@/lib/supabase': { supabase: { from(table: string) {
      if (table === 'availability_requests') {
        const query = {
          select: () => query, eq: () => query,
          maybeSingle: async () => ({ data: { id: 11, supplier_id: 7, status }, error: null }),
        }
        return query
      }
      assert.equal(table, 'candidates')
      const filters: Record<string, unknown> = {}
      let values: Record<string, unknown>
      const query = {
        update: (next: Record<string, unknown>) => { values = next; return query },
        eq: (key: string, value: unknown) => { filters[key] = value; return query },
        select: async () => {
          writes.push({ values, filters })
          return { data: filters.id === 19 ? [{ id: 19 }] : [], error: null }
        },
      }
      return query
    } } },
  })
  return { queries, writes, close: () => { status = 'closed' } }
}

test('admin details are trimmed, typed and scoped to the active availability line', async () => {
  const { queries, writes, close } = setup()
  await queries.updateARItemDetails(11, 19, { name: ' Live Oak ', size: ' 30 G ', demanded_quantity: ' 24.5 ', note_for_supplier: ' Friday ' })
  assert.deepEqual(writes, [{
    values: { name: 'Live Oak', size: '30 G', demanded_quantity: 24.5, note_for_supplier: 'Friday' },
    filters: { id: 19, availability_request_id: 11, is_active: true },
  }])
  await queries.updateARItemDetails(11, 19, { size: '', demanded_quantity: ' ', note_for_supplier: '' })
  assert.deepEqual(writes.at(-1)?.values, { size: null, demanded_quantity: null, note_for_supplier: null })
  await assert.rejects(queries.updateARItemDetails(11, 20, { name: 'Maple' }), /line not found/)
  const count = writes.length
  close()
  await assert.rejects(queries.updateARItemDetails(11, 19, { name: 'Maple' }), /closed/)
  assert.equal(writes.length, count)
})

test('invalid plant details fail before any database write', async () => {
  const { queries, writes } = setup()
  for (const changes of [
    null, [], {}, { name: ' ' }, { demanded_quantity: '0' }, { demanded_quantity: '-1' },
    { demanded_quantity: 'NaN' }, { demanded_quantity: 'Infinity' }, { demanded_quantity: '1e999' }, { demanded_quantity: '0x10' },
    { demanded_quantity: 'twelve' }, { demanded_quantity: 12 }, { name: 123 },
    { availability_request_id: '12' }, { job_request_item_id: '100' },
    { name: 'Maple', status: 'available' }, { is_active: 'false' },
  ]) {
    await assert.rejects(queries.updateARItemDetails(11, 19, changes))
  }
  assert.equal(writes.length, 0)
})

test('admin route saves plant details and reports validation and closure errors', async () => {
  const { queries, writes, close } = setup()
  const notifications: unknown[] = []
  const { PATCH } = load('../app/api/availability-requests/[id]/route.ts', {
    'next/server': { NextResponse: Response },
    '@/lib/availability-queries': {
      ...queries,
      supplierAvailabilityEventContext: async () => ({ availabilityRequestId: 11 }),
    },
    '@/lib/notify-supplier-events': { notifySupplierEvent: async (event: unknown) => { notifications.push(event) } },
  })
  const patch = (body: object) => PATCH(new Request('https://lps.example/api/availability-requests/11', {
    method: 'PATCH', body: JSON.stringify(body),
  }), { params: Promise.resolve({ id: '11' }) })
  assert.equal((await patch({ itemId: 19, details: { name: 'Maple', demanded_quantity: '5' } })).status, 200)
  assert.equal(writes.length, 1)
  assert.equal(notifications.length, 1)
  for (const body of [
    { details: { name: 'Maple' } }, { itemId: 19, details: { name: '' } },
    { itemId: 19, details: null }, { itemId: 19, details: { demanded_quantity: '-1' } },
    { itemId: 19, details: { name: 'Maple' }, changes: { status: 'available' } },
  ]) {
    assert.equal((await patch(body)).status, 400)
  }
  close()
  assert.equal((await patch({ itemId: 19, details: { name: 'Maple' } })).status, 409)
  assert.equal(writes.length, 1)
  assert.equal(notifications.length, 1)
})

test('supplier answer writes retain their existing restricted RPC', async () => {
  const calls: unknown[][] = []
  const chain = {
    select: () => chain, eq: () => chain,
    maybeSingle: async () => ({ data: { id: 11, supplier_id: 7, status: 'new' }, error: null }),
  }
  const { updateARItem } = load('./availability-queries.ts', {
    'server-only': {}, '@/lib/partner-display': {},
    '@/lib/supabase': { supabase: {
      from: () => chain,
      rpc: async (...args: unknown[]) => { calls.push(args); return { error: { message: 'Invalid answer field' } } },
    } },
  })
  await assert.rejects(updateARItem(11, 19, { name: 'Maple' }, { forSupplierId: 7 }), /Invalid answer field/)
  assert.deepEqual(calls, [['answer_availability_request', {
    p_request_id: 11, p_supplier_id: 7, p_item_id: 19, p_changes: { name: 'Maple' },
  }]])
})
