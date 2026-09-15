import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import ts from 'typescript'

import { isApsSupplier, orderDate, orderSubtotal, parseCreateOrder, parsePartnerOrderUpdate, positiveId } from './orders'

const require = createRequire(import.meta.url)
function load(file: string, mocks: Record<string, unknown>) {
  const source = readFileSync(new URL(file, import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } })
  const module = { exports: {} as Record<string, (...args: any[]) => Promise<any>> }
  new Function('require', 'module', 'exports', outputText)((name: string) => name in mocks ? mocks[name] : require(name), module, module.exports)
  return module.exports
}

const input = () => ({ supplierId: 7, customerConfirmed: true, fulfillmentMethod: 'pickup', items: [{ availabilityRequestItemId: 101, allocations: [{ jobRequestItemId: 11, quantity: 2 }, { jobRequestItemId: 21, quantity: 3 }] }] })

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

test('new orders leave fulfillment dates for the supplier', async () => {
  for (const fulfillmentDate of ['2026-09-20', '2026-02-30', false, 0]) {
    assert.throws(() => parseCreateOrder({ ...input(), fulfillmentDate }), /supplier enters the fulfillment date/)
  }
  assert.equal('fulfillmentDate' in parseCreateOrder(input()), false)
  assert.equal('fulfillmentDate' in parseCreateOrder({ ...input(), fulfillmentDate: null }), false)
  const calls: unknown[][] = []
  const { createOrder } = load('./order-queries.ts', {
    'server-only': {}, '@/lib/supabase': { supabase: { rpc: async (...args: unknown[]) => {
      calls.push(args); return { data: 42, error: null }
    } } },
  })
  assert.equal(await createOrder(parseCreateOrder(input())), 42)
  assert.equal((calls[0][1] as { p_fulfillment_date: unknown }).p_fulfillment_date, null)
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
    orders: [{ id: 201, status: 'new', is_active: true }, { id: 202, status: 'order_ready', is_active: true }, { id: 203, status: 'closed_lost', is_active: true }],
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

test('supplier order reads exclude other suppliers and expose only their source requests, without customer allocations', async () => {
  const db = database({
    orders: [{ id: 1, supplier_id: 7, status: 'new', is_active: true }, { id: 2, supplier_id: 8, status: 'new', is_active: true }],
    order_items: [101, 102, 103, 104].map((source, index) => ({ id: 10 + index, order_id: 1, availability_request_item_id: source, name: 'Oak', quantity: 2, unit_price: 10, total: 20, status: 'need_to_order', is_active: true })),
    availability_request_items: [{ id: 101, availability_request_id: 20, is_active: true }, { id: 102, availability_request_id: 20, is_active: true },
      { id: 103, availability_request_id: 30, is_active: true }, { id: 104, availability_request_id: 40, is_active: true }],
    availability_requests: [{ id: 20, supplier_id: 7, is_active: true }, { id: 30, supplier_id: 7, is_active: true }, { id: 40, supplier_id: 8, is_active: true }],
    order_item_job_request_items: [{ order_item_id: 10, job_request_item_id: 11, quantity: 2 }],
    job_request_items: [{ id: 11, job_request_id: 100 }],
    job_requests: [{ id: 100, name: 'Private customer job', status: 'committed', is_active: true }],
    suppliers: [{ id: 7, name: 'APS' }, { id: 8, name: 'Other supplier' }],
  })
  const { listOrders } = load('./order-queries.ts', { 'server-only': {}, '@/lib/supabase': { supabase: db } })
  const orders = await listOrders({ supplierId: 7, forSupplier: true })
  assert.deepEqual(orders.map((order: { id: number }) => order.id), [1])
  assert.equal('allocations' in orders[0].items[0], false)
  assert.deepEqual(orders[0].availabilityRequestIds, [20, 30], 'Source requests are deduplicated and restricted to the order supplier')
  assert.equal(JSON.stringify(orders).includes('Private customer job'), false)
})

test('orders keep customer EDD separate from supplier commitment and deduplicate combined job schedules', async () => {
  const db = database({
    orders: [{ id: 1, supplier_id: 7, status: 'processing', fulfillment_date: '2026-10-05', supplier_notes: 'Committed for Monday', notes: 'Customer instructions', is_active: true }],
    suppliers: [{ id: 7, name: 'APS' }],
    order_items: [{ id: 10, order_id: 1, quantity: 3, is_active: true }],
    order_item_job_request_items: [
      { order_item_id: 10, job_request_item_id: 21, quantity: 1 },
      { order_item_id: 10, job_request_item_id: 12, quantity: 1 },
      { order_item_id: 10, job_request_item_id: 11, quantity: 1 },
    ],
    job_request_items: [{ id: 11, job_request_id: 1 }, { id: 12, job_request_id: 1 }, { id: 21, job_request_id: 2 }],
    job_requests: [
      { id: 2, name: 'Private Patio', expected_install_date: '2026-10-08', fulfillment_method: 'pickup', status: 'committed', is_active: true },
      { id: 1, name: 'Private Garden', expected_install_date: '2026-10-03', fulfillment_method: 'delivery', status: 'committed', is_active: true },
    ],
  })
  const { listOrders } = load('./order-queries.ts', { 'server-only': {}, '@/lib/supabase': { supabase: db } })
  const [partnerOrder] = await listOrders({ supplierId: 7, forSupplier: true })
  assert.equal(partnerOrder.fulfillmentDate, '2026-10-05')
  assert.equal(partnerOrder.supplierNotes, 'Committed for Monday')
  assert.equal(partnerOrder.notes, 'Customer instructions')
  assert.deepEqual(partnerOrder.jobSchedules, [
    { expectedInstallDate: '2026-10-03', fulfillmentMethod: 'delivery' },
    { expectedInstallDate: '2026-10-08', fulfillmentMethod: 'pickup' },
  ])
  assert.doesNotMatch(JSON.stringify(partnerOrder), /Private|jobRequest|allocations/)
  const [adminOrder] = await listOrders({ supplierId: 7 })
  assert.deepEqual(adminOrder.jobSchedules.map((schedule: { jobRequestId: number }) => schedule.jobRequestId), [1, 2])
  assert.equal(adminOrder.jobSchedules[0].jobName, 'Private Garden')
})

test('partner order updates validate the editable fields and strict dates', () => {
  assert.deepEqual(parsePartnerOrderUpdate({ status: 'processing', fulfillmentMethod: 'delivery', fulfillmentDate: '2026-10-02' }),
    { status: 'processing', fulfillmentMethod: 'delivery', fulfillmentDate: '2026-10-02' })
  assert.deepEqual(parsePartnerOrderUpdate({ status: 'order_ready' }), { status: 'order_ready' })
  assert.deepEqual(parsePartnerOrderUpdate({ supplierNotes: '  Ready after noon\nCall on arrival  ' }), { supplierNotes: 'Ready after noon\nCall on arrival' })
  for (const supplierNotes of [null, '', '   ']) assert.deepEqual(parsePartnerOrderUpdate({ supplierNotes }), { supplierNotes: null })
  assert.equal(parsePartnerOrderUpdate({ supplierNotes: 'x'.repeat(10000) }).supplierNotes?.length, 10000)
  for (const supplierNotes of [false, 12, [], {}, 'x'.repeat(10001)]) assert.throws(() => parsePartnerOrderUpdate({ supplierNotes }), /Supplier note/)
  for (const value of [null, [], {}, { status: 'new' }, { status: 'closed_won' }, { status: null },
    { fulfillmentMethod: 'truck' }, { fulfillmentDate: '2026-02-30' }, { confirmationDate: '2026-09-14' }, { notes: 'edit' }]) {
    assert.throws(() => parsePartnerOrderUpdate(value))
  }
})

test('supplier and admin portal access permits atomic lifecycle updates within the authorized supplier scope', async () => {
  let role: string | null = null
  let gateStatus: number | null = null
  let supplierActive = true
  const writes: unknown[][] = []
  const scopes: unknown[][] = []
  const { PATCH, GET } = load('../app/api/partner/[id]/orders/[orderId]/route.ts', {
    'next/server': { NextResponse: Response },
    '@/lib/partner-auth': { requirePartnerAccess: async () => gateStatus || !role
      ? { ok: false, res: Response.json({ error: 'denied' }, { status: gateStatus ?? 401 }) }
      : { ok: true, supplierId: 7, user: { role } } },
    '@/lib/availability-queries': { partnerSupplier: async () => supplierActive ? { id: 7 } : null },
    '@/lib/orders': { parsePartnerOrderUpdate, positiveId },
    '@/lib/order-queries': {
      orderDetail: async (...args: unknown[]) => {
        scopes.push(args)
        return args[0] === 42 ? { id: 42, supplierId: 7, status: 'new', availabilityRequestIds: [10] }
          : args[0] === 43 ? { id: 43, supplierId: 7, status: 'new', closed: true }
          : args[0] === 44 ? { id: 44, supplierId: 7, status: 'closed_won' } : null
      },
      updatePartnerOrder: async (...args: unknown[]) => { writes.push(args) },
    },
  })
  const patch = (body: unknown, orderId = '42') => PATCH(new Request('https://lps.example/api/partner/7/orders/42', { method: 'PATCH', body: JSON.stringify(body) }), { params: Promise.resolve({ id: '7', orderId }) })
  const get = (orderId = '42') => GET(new Request('https://lps.example/api/partner/7/orders/42'), { params: Promise.resolve({ id: '7', orderId }) })
  assert.equal((await patch({ status: 'processing' })).status, 401)
  assert.equal((await get()).status, 401)
  assert.equal(scopes.length, 0)
  for (const authorizedRole of ['partner', 'admin']) {
    role = authorizedRole
    const previousWrites = writes.length
    const detail = await (await get()).json()
    assert.equal(detail.canEdit, true)
    assert.equal(detail.canEditFulfillmentMethod, role === 'admin')
    for (const invalidId of ['0', '-1', 'bad', '42x', '1.5']) {
      assert.equal((await get(invalidId)).status, 400)
      assert.equal((await patch({ status: 'processing' }, invalidId)).status, 400)
    }
    assert.equal((await get('99')).status, 404)
    assert.equal((await patch({ status: 'processing' }, '99')).status, 404)
    assert.equal((await patch({ status: 'processing' }, '43')).status, 409, 'An order linked only to closed jobs cannot be edited')
    assert.equal((await patch({ supplierNotes: 'Edit' }, '44')).status, 409, 'Closed orders cannot be edited')
    assert.equal((await patch({ status: 'closed_won' })).status, 400)
    assert.equal((await patch({ fulfillmentDate: '2026-02-30' })).status, 400)
    assert.equal((await patch({ supplierId: 8, supplierNotes: 'Wrong supplier' })).status, 400)
    supplierActive = false
    assert.equal((await patch({ supplierNotes: 'Inactive supplier' })).status, 404)
    assert.equal((await get()).status, 404)
    supplierActive = true
    assert.equal(writes.length, previousWrites)
    const update = { status: 'processing', fulfillmentDate: '2026-09-20', supplierNotes: `${role} confirmation` }
    assert.equal((await patch(update)).status, 200)
    assert.equal((await patch({ status: 'order_ready' })).status, 200)
    assert.deepEqual(writes.slice(previousWrites), [[42, 7, update], [42, 7, { status: 'order_ready' }]])
  }
  assert.equal(scopes.every((scope) => scope[1] === 7), true)
  role = 'partner'
  gateStatus = 404
  const priorScopes = scopes.length
  assert.equal((await patch({ status: 'processing' })).status, 404, 'The supplier access gate can still deny another supplier')
  assert.equal((await get()).status, 404)
  assert.equal(scopes.length, priorScopes)
  assert.equal(writes.length, 4)
})

test('only Chris/admin can set or clear order pickup or delivery, while suppliers can confirm with a date and note', async () => {
  let role = 'partner'
  const writes: unknown[][] = []
  const { PATCH } = load('../app/api/partner/[id]/orders/[orderId]/route.ts', {
    'next/server': { NextResponse: Response },
    '@/lib/partner-auth': { requirePartnerAccess: async () => ({ ok: true, supplierId: 7, user: { role } }) },
    '@/lib/availability-queries': { partnerSupplier: async () => ({ id: 7 }) },
    '@/lib/orders': { parsePartnerOrderUpdate, positiveId },
    '@/lib/order-queries': {
      orderDetail: async () => ({ id: 42, supplierId: 7, status: 'new', fulfillmentMethod: null }),
      updatePartnerOrder: async (...args: unknown[]) => { writes.push(args) },
    },
  })
  const patch = (body: unknown) => PATCH(new Request('https://lps.example/api/partner/7/orders/42', { method: 'PATCH', body: JSON.stringify(body) }), { params: Promise.resolve({ id: '7', orderId: '42' }) })
  for (const fulfillmentMethod of ['pickup', 'delivery', null, '', false]) {
    const response = await patch({ status: 'processing', fulfillmentDate: '2026-09-20', fulfillmentMethod })
    assert.equal(response.status, 403)
    assert.equal((await response.json()).error, 'Only admins can change pickup or delivery')
  }
  assert.equal(writes.length, 0, 'A forbidden method field rejects the entire confirmation')
  const confirmation = { status: 'processing', fulfillmentDate: '2026-09-20', supplierNotes: 'Ready by noon' }
  assert.equal((await patch(confirmation)).status, 200)
  assert.deepEqual(writes, [[42, 7, confirmation]])
  role = 'admin'
  for (const fulfillmentMethod of ['pickup', 'delivery', null]) assert.equal((await patch({ fulfillmentMethod })).status, 200)
  assert.deepEqual(writes.slice(1), [
    [42, 7, { fulfillmentMethod: 'pickup' }], [42, 7, { fulfillmentMethod: 'delivery' }], [42, 7, { fulfillmentMethod: null }],
  ])
})

test('portal order lists advertise write access for suppliers and admins only after supplier authorization', async () => {
  let role: string | null = null
  let gateStatus: number | null = null
  const scopes: unknown[] = []
  const { GET } = load('../app/api/partner/[id]/orders/route.ts', {
    'next/server': { NextResponse: Response },
    '@/lib/partner-auth': { requirePartnerAccess: async () => gateStatus || !role
      ? { ok: false, res: Response.json({ error: 'denied' }, { status: gateStatus ?? 401 }) }
      : { ok: true, supplierId: 7, user: { role } } },
    '@/lib/availability-queries': { partnerSupplier: async () => ({ id: 7 }) },
    '@/lib/order-queries': { listOrders: async (scope: unknown) => { scopes.push(scope); return [{ id: 42 }] } },
  })
  const get = () => GET(new Request('https://lps.example/api/partner/7/orders'), { params: Promise.resolve({ id: '7' }) })
  assert.equal((await get()).status, 401)
  for (const authorizedRole of ['partner', 'admin']) {
    role = authorizedRole
    const response = await get()
    assert.equal(response.status, 200)
    assert.equal((await response.json()).canEdit, true)
  }
  role = 'partner'
  gateStatus = 404
  assert.equal((await get()).status, 404)
  assert.deepEqual(scopes, [{ supplierId: 7, forSupplier: true }, { supplierId: 7, forSupplier: true }])
})

test('Chris can update orders through the internal API while unscoped partner access and invalid writes are rejected', async () => {
  let role: string | null = null
  const writes: unknown[][] = []
  const reads: unknown[][] = []
  const { PATCH } = load('../app/api/orders/[orderId]/route.ts', {
    'next/server': { NextResponse: Response },
    '@/lib/session': { resolveUser: async () => role ? { role } : null },
    '@/lib/orders': { parsePartnerOrderUpdate, positiveId },
    '@/lib/order-queries': {
      orderDetail: async (...args: unknown[]) => {
        reads.push(args)
        return args[0] === 42 ? { id: 42, supplierId: 7, status: 'new' }
          : args[0] === 43 ? { id: 43, supplierId: 7, status: 'new', closed: true }
          : args[0] === 44 ? { id: 44, supplierId: 7, status: 'closed_lost' }
          : args[0] === 45 ? { id: 45, supplierId: 8, status: 'new' }
          : args[0] === 46 ? { id: 46, supplierId: 9, status: 'new' } : null
      },
      updatePartnerOrder: async (...args: unknown[]) => {
        if (args[1] === 9) throw new Error('Order is unavailable')
        writes.push(args)
      },
    },
  })
  const patch = (body: unknown, orderId = '42') => PATCH(new Request('https://lps.example/api/orders/42', { method: 'PATCH', body: JSON.stringify(body) }), { params: Promise.resolve({ orderId }) })
  assert.equal((await patch({ status: 'processing' })).status, 401)
  role = 'partner'
  assert.equal((await patch({ status: 'processing' })).status, 403)
  assert.equal(reads.length, 0, 'Only admins may resolve an order through the unscoped endpoint')
  role = 'admin'
  for (const invalidId of ['0', '-1', 'bad', '42x', '1.5']) assert.equal((await patch({ supplierNotes: 'Edit' }, invalidId)).status, 400)
  assert.equal(reads.length, 0)
  assert.equal((await patch({ status: 'processing' }, '99')).status, 404)
  assert.equal((await patch({ status: 'processing' }, '43')).status, 409)
  assert.equal((await patch({ supplierNotes: 'Edit' }, '44')).status, 409)
  const unavailable = await patch({ supplierNotes: 'Inactive supplier' }, '46')
  assert.equal(unavailable.status, 400)
  assert.equal((await unavailable.json()).error, 'Order is unavailable', 'The guarded RPC rejects an inactive supplier')
  for (const body of [{ status: 'closed_won' }, { fulfillmentDate: '2026-02-30' }, { supplierId: 8, supplierNotes: 'Override' }, { notes: 'Procurement snapshot edit' }]) {
    assert.equal((await patch(body)).status, 400)
  }
  assert.equal(writes.length, 0)
  const update = { status: 'processing', fulfillmentMethod: 'delivery', fulfillmentDate: '2026-09-20', supplierNotes: 'Confirmed by Chris' }
  assert.equal((await patch(update)).status, 200)
  assert.equal((await patch({ status: 'order_ready' })).status, 200)
  assert.equal((await patch({ fulfillmentDate: '2026-09-21', supplierNotes: null })).status, 200)
  assert.equal((await patch({ fulfillmentMethod: null })).status, 200)
  assert.equal((await patch({ supplierNotes: 'Confirmed directly with nonportal supplier' }, '45')).status, 200)
  assert.deepEqual(writes, [
    [42, 7, update], [42, 7, { status: 'order_ready' }], [42, 7, { fulfillmentDate: '2026-09-21', supplierNotes: null }],
    [42, 7, { fulfillmentMethod: null }],
    [45, 8, { supplierNotes: 'Confirmed directly with nonportal supplier' }],
  ], 'The atomic RPC uses the supplier on the fetched order, including suppliers without a portal')
})

test('partner order updates send one scoped RPC and preserve omitted versus cleared fields', async () => {
  const calls: unknown[] = []
  const { updatePartnerOrder } = load('./order-queries.ts', {
    'server-only': {}, '@/lib/supabase': { supabase: { rpc: async (...args: unknown[]) => { calls.push(args); return { error: null } } } },
  })
  await updatePartnerOrder(42, 7, { status: 'processing', fulfillmentMethod: 'pickup', fulfillmentDate: '2026-09-20', supplierNotes: 'Pickup after noon' })
  await updatePartnerOrder(42, 7, { fulfillmentDate: null })
  await updatePartnerOrder(42, 7, { supplierNotes: null })
  await updatePartnerOrder(42, 7, { status: 'processing', fulfillmentDate: '2026-09-20', supplierNotes: 'Ready by noon' })
  assert.deepEqual(calls, [
    ['update_partner_order', { p_order_id: 42, p_supplier_id: 7, p_patch: { status: 'processing', fulfillment_method: 'pickup', fulfillment_date: '2026-09-20', supplier_notes: 'Pickup after noon' } }],
    ['update_partner_order', { p_order_id: 42, p_supplier_id: 7, p_patch: { fulfillment_date: null } }],
    ['update_partner_order', { p_order_id: 42, p_supplier_id: 7, p_patch: { supplier_notes: null } }],
    ['update_partner_order', { p_order_id: 42, p_supplier_id: 7, p_patch: { status: 'processing', fulfillment_date: '2026-09-20', supplier_notes: 'Ready by noon' } }],
  ])
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
  assert.equal((await post({ ...input(), fulfillmentDate: '2026-10-01' })).status, 400)
  assert.equal(writes.length, 0)
  assert.equal((await post(input())).status, 201)
  assert.equal(writes.length, 1)
})

test('order closure follows every linked job for supplier and admin reads, with portal job identities omitted', async () => {
  const tables = {
    orders: [1, 2, 3, 4].map((id) => ({ id, supplier_id: 7, status: id === 4 ? 'closed_won' : 'new', is_active: true })),
    order_items: [1, 2, 3, 4].map((id) => ({ id: id * 10, order_id: id, name: 'Oak', quantity: 1, is_active: true })),
    suppliers: [{ id: 7, name: 'APS' }],
    order_item_job_request_items: [
      { order_item_id: 10, job_request_item_id: 11, quantity: 1 },
      { order_item_id: 20, job_request_item_id: 11, quantity: 1 },
      { order_item_id: 20, job_request_item_id: 21, quantity: 1 },
    ],
    job_request_items: [{ id: 11, job_request_id: 1 }, { id: 21, job_request_id: 2 }],
    job_requests: [{ id: 1, name: 'Private Garden', status: 'closed_won', is_active: true }, { id: 2, name: 'Private Patio', status: 'committed', is_active: true }],
  }
  const { listOrders } = load('./order-queries.ts', { 'server-only': {}, '@/lib/supabase': { supabase: database(tables) } })
  let orders = await listOrders({ supplierId: 7, forSupplier: true })
  assert.deepEqual(orders.map((order: { closed: boolean }) => order.closed), [true, false, false, true])
  assert.doesNotMatch(JSON.stringify(orders), /Private|jobRequest|allocations/)
  const adminOrders = await listOrders({ supplierId: 7 })
  assert.deepEqual(adminOrders.map((order: { closed: boolean }) => order.closed), [true, false, false, true])
  tables.job_requests[1].status = 'closed_lost'
  orders = await listOrders({ supplierId: 7, forSupplier: true })
  assert.equal(orders[1].closed, true)
  tables.job_requests[0].status = 'committed'
  orders = await listOrders({ supplierId: 7, forSupplier: true })
  assert.equal(orders[0].closed, false)
})
