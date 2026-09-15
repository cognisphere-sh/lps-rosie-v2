import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import ts from 'typescript'

import { isApsSupplier, orderDate, orderSubtotal, parseCreateOrder } from './orders'

const require = createRequire(import.meta.url)
function load(file: string, mocks: Record<string, unknown>) {
  const source = readFileSync(new URL(file, import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } })
  const module = { exports: {} as Record<string, (...args: any[]) => Promise<any>> }
  new Function('require', 'module', 'exports', outputText)((name: string) => name in mocks ? mocks[name] : require(name), module, module.exports)
  return module.exports
}

const input = () => ({ supplierId: 7, customerConfirmed: true, fulfillmentMethod: 'pickup', fulfillmentDate: '2026-09-20', items: [{ availabilityRequestItemId: 101, allocations: [{ jobRequestItemId: 11, quantity: 2 }, { jobRequestItemId: 21, quantity: 3 }] }] })

test('order creation requires explicit customer confirmation and precise positive allocations', () => {
  assert.equal(parseCreateOrder(input()).items[0].allocations.length, 2)
  for (const customerConfirmed of [undefined, false, 'true', 1]) assert.throws(() => parseCreateOrder({ ...input(), customerConfirmed }), /customer/)
  for (const quantity of [0, -1, NaN, Infinity, '2']) assert.throws(() => parseCreateOrder({ ...input(), items: [{ availabilityRequestItemId: 101, allocations: [{ jobRequestItemId: 11, quantity }] }] }), /positive/)
  assert.throws(() => parseCreateOrder({ ...input(), items: [input().items[0], input().items[0]] }), /unique/)
  assert.throws(() => parseCreateOrder({ ...input(), items: [{ availabilityRequestItemId: 101, allocations: [{ jobRequestItemId: 11, quantity: 1 }, { jobRequestItemId: 11, quantity: 2 }] }] }), /unique/)
  assert.throws(() => parseCreateOrder({ ...input(), fulfillmentMethod: 'truck' }), /pickup or delivery/)
})

test('order dates reject impossible dates and absent prices remain absent', () => {
  assert.equal(orderDate('2028-02-29', 'date'), '2028-02-29')
  for (const date of ['2026-02-29', '2026-09-31', '09/14/2026', '2026-09-14T00:00:00Z', true]) assert.throws(() => orderDate(date, 'date'), /valid date/)
  assert.equal(orderDate('', 'date'), null)
  assert.equal(orderSubtotal({ items: [{ total: null }] as any }), null)
  assert.equal(orderSubtotal({ items: [{ total: 0 }, { total: 25 }, { total: null }] as any }), 25)
  assert.equal(isApsSupplier(' Austin Plant Supply '), true)
  assert.equal(isApsSupplier('aps'), true)
  assert.equal(isApsSupplier('Another Plant Supplier'), false)
})

/** In-memory PostgREST fixture; reads apply real scope filters and pagination. */
function database(tables: Record<string, Record<string, any>[]>) {
  const reads: string[] = []
  return { reads, from(table: string) {
    reads.push(table)
    let rows = [...(tables[table] ?? [])]
    const chain = {
      select: (_columns: string) => chain,
      eq: (key: string, value: unknown) => { rows = rows.filter((row) => row[key] === value); return chain },
      neq: (key: string, value: unknown) => { rows = rows.filter((row) => row[key] !== value); return chain },
      in: (key: string, values: unknown[]) => { rows = rows.filter((row) => values.includes(row[key])); return chain },
      not: (key: string, _operator: string, values: string) => { rows = rows.filter((row) => !values.slice(1, -1).split(',').includes(row[key])); return chain },
      order: (_column: string) => chain,
      range: async (from: number, to: number) => ({ data: rows.slice(from, to + 1), error: null }),
    }
    return chain
  } }
}

test('candidates account for split and competing orders, ignore lost orders, and allow Can Order with zero on hand', async () => {
  const db = database({
    job_requests: [{ id: 1, name: 'Garden', status: 'committed', is_active: true }, { id: 2, name: 'Archived', status: 'archived', is_active: true }],
    job_request_items: [{ id: 11, job_request_id: 1, quantity: 10, is_active: true }, { id: 21, job_request_id: 2, quantity: 15, is_active: true }],
    availability_request_item_jobs: [
      { availability_request_item_id: 101, job_request_item_id: 11, quantity: 10 },
      { availability_request_item_id: 102, job_request_item_id: 11, quantity: 10 },
      { availability_request_item_id: 103, job_request_item_id: 11, quantity: 5 },
      { availability_request_item_id: 103, job_request_item_id: 21, quantity: 15 },
    ],
    availability_requests: [{ id: 10, supplier_id: 7, status: 'submitted', is_active: true }],
    availability_request_items: [
      { id: 101, availability_request_id: 10, name: 'Oak', quantity: 10, available_quantity: 0, status: 'can_order', is_active: true },
      { id: 102, availability_request_id: 10, name: 'Oak', quantity: 10, available_quantity: 10, status: 'available', is_active: true },
      { id: 103, availability_request_id: 10, name: 'Oak combined', quantity: 20, available_quantity: 20, status: 'available', is_active: true },
    ],
    suppliers: [{ id: 7, name: 'Austin Plant Supply', is_active: true }],
    orders: [{ id: 201, status: 'committed', is_active: true }, { id: 202, status: 'confirmed', is_active: true }, { id: 203, status: 'closed_lost', is_active: true }],
    order_items: [
      { id: 301, order_id: 201, availability_request_item_id: 101, quantity: 3, is_active: true },
      // This alternative response is not one of the requested candidates.
      { id: 302, order_id: 202, availability_request_item_id: 999, quantity: 3, is_active: true },
      { id: 303, order_id: 203, availability_request_item_id: 101, quantity: 4, is_active: true },
    ],
    order_item_job_request_items: [{ order_item_id: 301, job_request_item_id: 11, quantity: 3 }, { order_item_id: 302, job_request_item_id: 11, quantity: 3 }, { order_item_id: 303, job_request_item_id: 11, quantity: 4 }],
  })
  const { orderCandidates, orderJobChoices } = load('./order-queries.ts', { 'server-only': {}, '@/lib/supabase': { supabase: db } })
  const candidates = await orderCandidates([1, 2])
  assert.equal(candidates.length, 3)
  assert.equal(candidates[0].remainingQuantity, 7, 'Can Order can procure the seven remaining plants despite zero on hand')
  for (const candidate of candidates) {
    assert.equal(candidate.allocations.length, 1, 'archived jobs are omitted')
    assert.equal(candidate.allocations[0].remainingQuantity, 4, 'all orders consume customer demand, including competing ARs')
  }
  assert.deepEqual((await orderJobChoices()).map((job: { id: number }) => job.id), [1])
})

test('supplier order reads exclude other suppliers and never fetch customer allocations', async () => {
  const db = database({
    orders: [{ id: 1, supplier_id: 7, status: 'committed', is_active: true }, { id: 2, supplier_id: 8, status: 'committed', is_active: true }],
    order_items: [{ id: 10, order_id: 1, name: 'Oak', quantity: 2, unit_price: 10, total: 20, status: 'need_to_order', is_active: true }],
    suppliers: [{ id: 7, name: 'APS' }, { id: 8, name: 'Other supplier' }],
  })
  const { listOrders } = load('./order-queries.ts', { 'server-only': {}, '@/lib/supabase': { supabase: db } })
  const orders = await listOrders({ supplierId: 7, forSupplier: true })
  assert.deepEqual(orders.map((order: { id: number }) => order.id), [1])
  assert.equal('allocations' in orders[0].items[0], false)
  assert.equal(db.reads.includes('order_item_job_request_items'), false)
  assert.equal(db.reads.includes('job_requests'), false)
})

test('partner confirmation is authorized, scoped to the supplier, and cannot close orders', async () => {
  let allowed = false
  const writes: unknown[][] = []
  const scopes: unknown[][] = []
  const { PATCH } = load('../app/api/partner/[id]/orders/[orderId]/route.ts', {
    'next/server': { NextResponse: Response },
    '@/lib/partner-auth': { requirePartnerAccess: async () => allowed ? { ok: true, supplierId: 7 } : { ok: false, res: Response.json({ error: 'unauthorized' }, { status: 401 }) } },
    '@/lib/availability-queries': { partnerSupplier: async () => ({ id: 7 }) },
    '@/lib/orders': { orderDate, positiveId: (id: unknown) => typeof id === 'number' && Number.isSafeInteger(id) && id > 0 },
    '@/lib/order-queries': {
      orderDetail: async (...args: unknown[]) => { scopes.push(args); return args[0] === 42 ? { id: 42, supplierId: 7 } : null },
      confirmOrder: async (...args: unknown[]) => { writes.push(args) },
      setOrderFulfillmentDate: async (...args: unknown[]) => { writes.push(args) },
    },
  })
  const patch = (body: object, orderId = '42') => PATCH(new Request('https://lps.example/api/partner/7/orders/42', { method: 'PATCH', body: JSON.stringify(body) }), { params: Promise.resolve({ id: '7', orderId }) })
  assert.equal((await patch({ status: 'confirmed' })).status, 401)
  assert.equal(scopes.length, 0)
  allowed = true
  assert.equal((await patch({ status: 'confirmed' }, '99')).status, 404)
  assert.equal(writes.length, 0)
  assert.equal((await patch({ status: 'closed_won' })).status, 400)
  assert.equal((await patch({ status: 'confirmed', supplierId: 8, confirmationDate: '2026-09-14', fulfillmentDate: '2026-09-20' })).status, 200)
  assert.deepEqual(writes, [[42, 7, '2026-09-14', '2026-09-20']])
  assert.equal(scopes.every((scope) => scope[1] === 7), true)
})

test('order creation routes reject partner sessions and unconfirmed requests before writing', async () => {
  let role: string | null = 'partner'
  const writes: unknown[] = []
  const { POST } = load('../app/api/orders/route.ts', {
    'next/server': { NextResponse: Response },
    '@/lib/session': { resolveUser: async () => role ? { role } : null },
    '@/lib/orders': { parseCreateOrder },
    '@/lib/order-queries': { createOrder: async (body: unknown) => { writes.push(body); return 42 } },
  })
  const post = (body: unknown) => POST(new Request('https://lps.example/api/orders', { method: 'POST', body: JSON.stringify(body) }))
  assert.equal((await post(input())).status, 403)
  role = null
  assert.equal((await post(input())).status, 401)
  role = 'admin'
  assert.equal((await post({ ...input(), customerConfirmed: false })).status, 400)
  assert.equal(writes.length, 0)
  assert.equal((await post(input())).status, 201)
  assert.equal(writes.length, 1)
})
