import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import ts from 'typescript'

import { isApsSupplier, isDirectOrder, orderDate, orderSubtotal, parseCreateOrder, parseOrderItemPrice, parseOrderItemUpdate, parsePartnerOrderUpdate, positiveId } from './orders'

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
  const parsed = parseCreateOrder(input())
  assert.equal(isDirectOrder(parsed), false)
  if (isDirectOrder(parsed)) throw new Error('Expected an availability-backed order')
  assert.equal(parsed.items[0].allocations.length, 2)
  for (const customerConfirmed of [undefined, false, 'true', 1]) assert.throws(() => parseCreateOrder({ ...input(), customerConfirmed }), /customer/)
  for (const quantity of [0, -1, NaN, Infinity, '2']) assert.throws(() => parseCreateOrder({ ...input(), items: [{ availabilityRequestItemId: 101, allocations: [{ jobRequestItemId: 11, quantity }] }] }), /positive/)
  assert.throws(() => parseCreateOrder({ ...input(), items: [input().items[0], input().items[0]] }), /unique/)
  assert.throws(() => parseCreateOrder({ ...input(), items: [{ availabilityRequestItemId: 101, allocations: [{ jobRequestItemId: 11, quantity: 1 }, { jobRequestItemId: 11, quantity: 2 }] }] }), /unique/)
  assert.throws(() => parseCreateOrder({ ...input(), fulfillmentMethod: 'truck' }), /pickup or delivery/)
})

test('a confirmed quote can create a direct order without an availability line', () => {
  const direct = parseCreateOrder({ supplierId: 7, customerConfirmed: true, items: [{ jobRequestItemId: 11, quantity: 2 }] })
  assert.equal(isDirectOrder(direct), true)
  if (!isDirectOrder(direct)) throw new Error('Expected a direct order')
  assert.deepEqual(direct.items, [{ jobRequestItemId: 11, quantity: 2 }])
  assert.throws(() => parseCreateOrder({ supplierId: 7, customerConfirmed: true, items: [{ jobRequestItemId: 11, quantity: 0 }] }), /positive/)
})

test('suppliers can update an open order line to a supported procurement status', () => {
  assert.deepEqual(parseOrderItemUpdate({ status: 'unavailable' }), { status: 'unavailable' })
  assert.throws(() => parseOrderItemUpdate({ status: 'invented' }), /valid plant status/)
  assert.throws(() => parseOrderItemUpdate({ status: 'available', notes: 'extra' }), /valid plant status/)
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
      select: (columns: string) => {
        if (table === 'job_request_items') assert.ok(!columns.split(/,\s*/).includes('quantity'), 'Job demand reads use demanded_quantity')
        if (table === 'order_items') assert.ok(!columns.split(/,\s*/).includes('availability_request_item_id'), 'Order reads must not use the removed AR pointer')
        return chain
      },
      eq: (key: string, value: unknown) => { rows = rows.filter((row) => row[key] === value); return chain },
      neq: (key: string, value: unknown) => { rows = rows.filter((row) => row[key] !== value); return chain },
      in: (key: string, values: unknown[]) => { rows = rows.filter((row) => values.includes(row[key])); return chain },
      not: (key: string, operator: string, values: string | null) => {
        rows = rows.filter((row) => operator === 'is' ? row[key] !== values : !String(values).slice(1, -1).split(',').includes(row[key]))
        return chain
      },
      order: (_column: string) => chain,
      maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
      range: async (from: number, to: number) => ({ data: rows.slice(from, to + 1), error: null }),
    }
    return chain
  } }
}

test('direct-order candidates subtract prior allocations from renamed customer demand', async () => {
  const db = database({
    job_requests: [{ id: 1, name: 'Garden', status: 'quoted', is_active: true }],
    job_request_items: [
      { id: 11, job_request_id: 1, name: 'Oak', demanded_quantity: 10, unit_price: 20, is_active: true },
      { id: 12, job_request_id: 1, name: 'Unknown', demanded_quantity: null, unit_price: 10, is_active: true },
      { id: 13, job_request_id: 1, name: 'Fraction', demanded_quantity: 2.5, unit_price: 4, is_active: true },
    ],
    orders: [{ id: 21, status: 'processing', is_active: true }, { id: 22, status: 'closed_lost', is_active: true }],
    order_items: [{ id: 31, order_id: 21, is_active: true }, { id: 32, order_id: 22, is_active: true }],
    order_item_job_request_items: [
      { order_item_id: 31, job_request_item_id: 11, quantity: 3 },
      { order_item_id: 32, job_request_item_id: 11, quantity: 5 },
    ],
  })
  const { directOrderCandidates } = load('./order-queries.ts', { 'server-only': {}, '@/lib/supabase': { supabase: db } })
  const candidates = await directOrderCandidates([1])
  assert.deepEqual(candidates.map((item: any) => [item.jobRequestItemId, item.remainingQuantity]), [[11, 7], [13, 2.5]])
})

test('candidates account for split and competing orders, ignore lost orders, and allow Can Order with zero on hand', async () => {
  const db = database({
    job_requests: [{ id: 1, name: 'Garden', status: 'committed', is_active: true }, { id: 2, name: 'Archived', status: 'archived', is_active: true }],
    job_request_items: [{ id: 11, job_request_id: 1, demanded_quantity: 10, is_active: true }, { id: 21, job_request_id: 2, demanded_quantity: 15, is_active: true }],
    availability_requests: [{ id: 10, supplier_id: 7, status: 'submitted', is_active: true }],
    // One candidate per job line; 104 sits on the archived job and 105 was never asked.
    candidates: [
      { id: 101, availability_request_id: 10, job_request_item_id: 11, name: 'Oak', demanded_quantity: 10, available_quantity: 0, status: 'can_order', is_active: true },
      { id: 102, availability_request_id: 10, job_request_item_id: 11, name: 'Oak', demanded_quantity: 10, available_quantity: 10, status: 'available', is_active: true },
      { id: 103, availability_request_id: 10, job_request_item_id: 11, name: 'Oak 5 G', demanded_quantity: 5, available_quantity: 20, status: 'available', is_active: true },
      { id: 104, availability_request_id: 10, job_request_item_id: 21, name: 'Oak', demanded_quantity: 15, available_quantity: 15, status: 'available', is_active: true },
      { id: 105, availability_request_id: null, job_request_item_id: 11, name: 'Oak', demanded_quantity: 10, available_quantity: 10, status: 'available', is_active: true },
    ],
    suppliers: [{ id: 7, name: 'Austin Plant Supply', is_active: true }],
    orders: [{ id: 201, supplier_id: 7, status: 'new', is_active: true }, { id: 202, supplier_id: 8, status: 'order_ready', is_active: true }, { id: 203, supplier_id: 7, status: 'closed_lost', is_active: true }],
    order_items: [
      { id: 301, order_id: 201, quantity: 3, is_active: true },
      // Another supplier consumes customer demand, but not this supplier's offer.
      { id: 302, order_id: 202, quantity: 3, is_active: true },
      { id: 303, order_id: 203, quantity: 4, is_active: true },
    ],
    order_item_job_request_items: [{ order_item_id: 301, job_request_item_id: 11, quantity: 3 }, { order_item_id: 302, job_request_item_id: 11, quantity: 3 }, { order_item_id: 303, job_request_item_id: 11, quantity: 4 }],
  })
  const { orderCandidates, orderJobChoices } = load('./order-queries.ts', { 'server-only': {}, '@/lib/supabase': { supabase: db } })
  const candidates = await orderCandidates([1, 2])
  assert.equal(candidates.length, 3)
  assert.equal(candidates[0].remainingQuantity, 7, 'Can Order can procure the seven remaining plants despite zero on hand')
  assert.deepEqual(candidates.map((candidate: any) => candidate.availabilityRequestItemId), [101, 102, 103], 'archived jobs and unasked candidates are omitted')
  for (const candidate of candidates) assert.equal(candidate.allocations.length, 1)
  assert.deepEqual(candidates.map((candidate: any) => candidate.allocations[0].remainingQuantity), [4, 4, 2],
    'all suppliers consume customer demand; same-supplier orders also consume each related AR allocation')
  assert.deepEqual((await orderJobChoices()).map((job: { id: number }) => job.id), [1])
})

test('supplier order reads derive related ARs through job items with supplier and active-record isolation', async () => {
  const db = database({
    orders: [{ id: 1, supplier_id: 7, status: 'new', is_active: true }, { id: 2, supplier_id: 8, status: 'new', is_active: true }],
    order_items: [10, 11, 12, 13].map((id) => ({ id, order_id: 1, name: 'Oak', quantity: 2, unit_price: 10, total: 20, status: 'need_to_order', is_active: true })),
    candidates: [[101, 20, true], [102, 20, true], [103, 30, true], [104, 40, true], [105, 50, true], [106, 60, false], [107, null, true]]
      .map(([id, availability_request_id, is_active]) => ({ id, availability_request_id, job_request_item_id: 11, is_active })),
    availability_requests: [{ id: 20, supplier_id: 7, is_active: true }, { id: 30, supplier_id: 7, is_active: true }, { id: 40, supplier_id: 8, is_active: true }, { id: 50, supplier_id: 7, status: 'draft' }],
    order_item_job_request_items: [{ order_item_id: 10, job_request_item_id: 11, quantity: 2 }],
    job_request_items: [{ id: 11, job_request_id: 100 }],
    job_requests: [{ id: 100, name: 'Private customer job', status: 'committed', is_active: true }],
    suppliers: [{ id: 7, name: 'APS' }, { id: 8, name: 'Other supplier' }],
  })
  const { listOrders } = load('./order-queries.ts', { 'server-only': {}, '@/lib/supabase': { supabase: db } })
  const orders = await listOrders({ supplierId: 7, forSupplier: true })
  assert.deepEqual(orders.map((order: { id: number }) => order.id), [1])
  assert.equal('allocations' in orders[0].items[0], false)
  assert.equal('availabilityRequestItemId' in orders[0].items[0], false)
  assert.deepEqual(orders[0].availabilityRequestIds, [20, 30], 'Related requests are deduplicated, supplier-scoped and exclude Drafts')
  assert.deepEqual(orders[0].jobNames, ['Private customer job'])
})


test('candidate capacity counts same-supplier orders on its own job line; other suppliers consume only customer demand', async () => {
  const db = database({
    job_requests: [{ id: 1, name: 'Garden', status: 'committed', is_active: true }],
    job_request_items: [{ id: 11, job_request_id: 1, demanded_quantity: 10, is_active: true }],
    availability_requests: [{ id: 10, supplier_id: 7, status: 'submitted', is_active: true }],
    candidates: [{ id: 101, availability_request_id: 10, job_request_item_id: 11, name: 'Oak', demanded_quantity: 10, available_quantity: 10, status: 'diff_size_qty_sub', is_active: true }],
    suppliers: [{ id: 7, name: 'APS', is_active: true }],
    orders: [
      { id: 201, supplier_id: 7, status: 'new', is_active: true },
      { id: 202, supplier_id: 7, status: 'new', is_active: true },
      { id: 203, supplier_id: 8, status: 'new', is_active: true },
      { id: 204, supplier_id: 7, status: 'new', is_active: false },
    ],
    order_items: [
      { id: 301, order_id: 201, quantity: 103, is_active: true },
      { id: 302, order_id: 202, quantity: 4, is_active: true },
      { id: 303, order_id: 203, quantity: 2, is_active: true },
      { id: 304, order_id: 204, quantity: 7, is_active: true },
      { id: 305, order_id: 201, quantity: 7, is_active: false },
    ],
    order_item_job_request_items: [
      { order_item_id: 301, job_request_item_id: 11, quantity: 3 },
      { order_item_id: 301, job_request_item_id: 31, quantity: 100 },
      // Another job line's order with this supplier does not use this candidate's capacity.
      { order_item_id: 302, job_request_item_id: 21, quantity: 4 },
      { order_item_id: 303, job_request_item_id: 11, quantity: 2 },
      { order_item_id: 304, job_request_item_id: 11, quantity: 7 },
      { order_item_id: 305, job_request_item_id: 11, quantity: 7 },
    ],
  })
  const { orderCandidates } = load('./order-queries.ts', { 'server-only': {}, '@/lib/supabase': { supabase: db } })
  const candidates = await orderCandidates([1])
  assert.equal(candidates.length, 1)
  assert.equal(candidates[0].remainingQuantity, 7, '10 offered minus 3 already ordered from this supplier for this line')
  assert.deepEqual(candidates[0].allocations.map((a: any) => [a.jobRequestItemId, a.remainingQuantity]), [[11, 5]],
    'customer demand is also reduced by the other supplier\'s 2')
})

test('orders keep customer EDD separate from supplier commitment and deduplicate combined job schedules', async () => {
  const db = database({
    orders: [{ id: 1, supplier_id: 7, status: 'processing', fulfillment_date: '2026-10-05', note_for_supplier: "Committed for Monday\n\nCustomer instructions", is_active: true }],
    suppliers: [{ id: 7, name: 'APS' }],
    order_items: [{ id: 10, order_id: 1, quantity: 3, is_active: true }],
    order_item_job_request_items: [
      { order_item_id: 10, job_request_item_id: 21, quantity: 1 },
      { order_item_id: 10, job_request_item_id: 12, quantity: 1 },
      { order_item_id: 10, job_request_item_id: 11, quantity: 1 },
    ],
    job_request_items: [{ id: 11, job_request_id: 1 }, { id: 12, job_request_id: 1 }, { id: 21, job_request_id: 2 }],
    customers: [{ id: 8, name: 'Jane', company: 'Gardens', email: 'jane@example.com', phone: '555-0100' }],
    job_requests: [
      { id: 2, name: 'Private Patio', expected_install_date: '2026-10-08', fulfillment_method: 'pickup', status: 'committed', is_active: true },
      { id: 1, name: 'Private Garden', customer_id: 8, shipping_address: '123 Garden St', expected_install_date: '2026-10-03', fulfillment_method: 'delivery', status: 'committed', is_active: true },
    ],
  })
  const { listOrders } = load('./order-queries.ts', { 'server-only': {}, '@/lib/supabase': { supabase: db } })
  const [partnerOrder] = await listOrders({ supplierId: 7, forSupplier: true })
  assert.equal(partnerOrder.shareJobs, undefined)
  assert.equal(partnerOrder.customerDetails.find((detail: { jobName: string }) => detail.jobName === 'Private Garden').customer.email, 'jane@example.com')
  assert.equal(partnerOrder.fulfillmentDate, '2026-10-05')
  assert.equal(partnerOrder.noteForSupplier, 'Committed for Monday\n\nCustomer instructions')
  assert.deepEqual(partnerOrder.jobSchedules, [
    { expectedInstallDate: '2026-10-03', fulfillmentMethod: 'delivery' },
    { expectedInstallDate: '2026-10-08', fulfillmentMethod: 'pickup' },
  ])
  assert.doesNotMatch(JSON.stringify(partnerOrder), /jobRequest|allocations/)
  const [adminOrder] = await listOrders({ supplierId: 7 })
  assert.equal(adminOrder.shareJobs.length, 2)
  assert.equal(adminOrder.shareJobs[0].customer.email, 'jane@example.com')
  assert.equal(adminOrder.shareJobs[0].customer.phone, '555-0100')
  assert.equal(adminOrder.shareJobs[0].shippingAddress, '123 Garden St')
  assert.deepEqual(adminOrder.jobSchedules.map((schedule: { jobRequestId: number }) => schedule.jobRequestId), [1, 2])
  assert.equal(adminOrder.jobSchedules[0].jobName, 'Private Garden')
})

test('partner order updates validate the editable fields and strict dates', () => {
  assert.deepEqual(parsePartnerOrderUpdate({ status: 'processing', fulfillmentMethod: 'delivery', fulfillmentDate: '2026-10-02' }),
    { status: 'processing', fulfillmentMethod: 'delivery', fulfillmentDate: '2026-10-02' })
  assert.deepEqual(parsePartnerOrderUpdate({ status: 'order_ready' }), { status: 'order_ready' })
  assert.deepEqual(parsePartnerOrderUpdate({ noteForSupplier: '  Ready after noon\nCall on arrival  ' }), { noteForSupplier: 'Ready after noon\nCall on arrival' })
  for (const noteForSupplier of [null, '', '   ']) assert.deepEqual(parsePartnerOrderUpdate({ noteForSupplier }), { noteForSupplier: null })
  assert.equal(parsePartnerOrderUpdate({ noteForSupplier: 'x'.repeat(10000) }).noteForSupplier?.length, 10000)
  for (const noteForSupplier of [false, 12, [], {}, 'x'.repeat(10001)]) assert.throws(() => parsePartnerOrderUpdate({ noteForSupplier }), /Note for supplier/)
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
    '@/lib/notify-supplier-events': { notifySupplierEvent: async () => {} },
    '@/lib/order-queries': {
      supplierOrderEventContext: async () => ({ supplierId: 7, supplierName: 'APS', threadId: 'supplier-aps', orderId: 42 }),
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
    assert.equal(detail.canEditFulfillmentMethod, false)
    for (const invalidId of ['0', '-1', 'bad', '42x', '1.5']) {
      assert.equal((await get(invalidId)).status, 400)
      assert.equal((await patch({ status: 'processing' }, invalidId)).status, 400)
    }
    assert.equal((await get('99')).status, 404)
    assert.equal((await patch({ status: 'processing' }, '99')).status, 404)
    assert.equal((await patch({ status: 'processing' }, '43')).status, 409, 'An order linked only to closed jobs cannot be edited')
    assert.equal((await patch({ noteForSupplier: 'Edit' }, '44')).status, 409, 'Closed orders cannot be edited')
    assert.equal((await patch({ status: 'closed_won' })).status, 400)
    assert.equal((await patch({ fulfillmentDate: '2026-02-30' })).status, 400)
    assert.equal((await patch({ supplierId: 8, noteForSupplier: 'Wrong supplier' })).status, 400)
    supplierActive = false
    assert.equal((await patch({ noteForSupplier: 'Inactive supplier' })).status, 404)
    assert.equal((await get()).status, 404)
    supplierActive = true
    assert.equal(writes.length, previousWrites)
    const update = { status: 'processing', fulfillmentDate: '2026-09-20', noteForSupplier: `${role} confirmation` }
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

test('Pickup or delivery is never writable through a supplier portal session, while suppliers can confirm with a date and note', async () => {
  let role = 'partner'
  const writes: unknown[][] = []
  const { PATCH } = load('../app/api/partner/[id]/orders/[orderId]/route.ts', {
    'next/server': { NextResponse: Response },
    '@/lib/partner-auth': { requirePartnerAccess: async () => ({ ok: true, supplierId: 7, user: { role } }) },
    '@/lib/availability-queries': { partnerSupplier: async () => ({ id: 7 }) },
    '@/lib/orders': { parsePartnerOrderUpdate, positiveId },
    '@/lib/notify-supplier-events': { notifySupplierEvent: async () => {} },
    '@/lib/order-queries': {
      supplierOrderEventContext: async () => ({ supplierId: 7, supplierName: 'APS', threadId: 'supplier-aps', orderId: 42 }),
      orderDetail: async () => ({ id: 42, supplierId: 7, status: 'new', fulfillmentMethod: null }),
      updatePartnerOrder: async (...args: unknown[]) => { writes.push(args) },
    },
  })
  const patch = (body: unknown) => PATCH(new Request('https://lps.example/api/partner/7/orders/42', { method: 'PATCH', body: JSON.stringify(body) }), { params: Promise.resolve({ id: '7', orderId: '42' }) })
  for (const fulfillmentMethod of ['pickup', 'delivery', null, '', false]) {
    const response = await patch({ status: 'processing', fulfillmentDate: '2026-09-20', fulfillmentMethod })
    assert.equal(response.status, 403)
    assert.equal((await response.json()).error, 'Pickup or delivery is managed by Chris')
  }
  assert.equal(writes.length, 0, 'A forbidden method field rejects the entire confirmation')
  const confirmation = { status: 'processing', fulfillmentDate: '2026-09-20', noteForSupplier: 'Ready by noon' }
  assert.equal((await patch(confirmation)).status, 200)
  assert.deepEqual(writes, [[42, 7, confirmation]])
  role = 'admin'
  for (const fulfillmentMethod of ['pickup', 'delivery', null]) assert.equal((await patch({ fulfillmentMethod })).status, 403)
  assert.equal(writes.length, 1)
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
  for (const invalidId of ['0', '-1', 'bad', '42x', '1.5']) assert.equal((await patch({ noteForSupplier: 'Edit' }, invalidId)).status, 400)
  assert.equal(reads.length, 0)
  assert.equal((await patch({ status: 'processing' }, '99')).status, 404)
  assert.equal((await patch({ status: 'processing' }, '43')).status, 409)
  assert.equal((await patch({ noteForSupplier: 'Edit' }, '44')).status, 409)
  const unavailable = await patch({ noteForSupplier: 'Inactive supplier' }, '46')
  assert.equal(unavailable.status, 400)
  assert.equal((await unavailable.json()).error, 'Order is unavailable', 'The guarded RPC rejects an inactive supplier')
  for (const body of [{ status: 'closed_won' }, { fulfillmentDate: '2026-02-30' }, { supplierId: 8, noteForSupplier: 'Override' }, { notes: 'Procurement snapshot edit' }]) {
    assert.equal((await patch(body)).status, 400)
  }
  assert.equal(writes.length, 0)
  const update = { status: 'processing', fulfillmentMethod: 'delivery', fulfillmentDate: '2026-09-20', noteForSupplier: 'Confirmed by Chris' }
  assert.equal((await patch(update)).status, 200)
  assert.equal((await patch({ status: 'order_ready' })).status, 200)
  assert.equal((await patch({ fulfillmentDate: '2026-09-21', noteForSupplier: null })).status, 200)
  assert.equal((await patch({ fulfillmentMethod: null })).status, 200)
  assert.equal((await patch({ noteForSupplier: 'Confirmed directly with nonportal supplier' }, '45')).status, 200)
  assert.deepEqual(writes, [
    [42, 7, update], [42, 7, { status: 'order_ready' }], [42, 7, { fulfillmentDate: '2026-09-21', noteForSupplier: null }],
    [42, 7, { fulfillmentMethod: null }],
    [45, 8, { noteForSupplier: 'Confirmed directly with nonportal supplier' }],
  ], 'The atomic RPC uses the supplier on the fetched order, including suppliers without a portal')
})

test('partner order updates send one scoped RPC and preserve omitted versus cleared fields', async () => {
  const calls: unknown[] = []
  const { updatePartnerOrder } = load('./order-queries.ts', {
    'server-only': {}, '@/lib/supabase': { supabase: { rpc: async (...args: unknown[]) => { calls.push(args); return { error: null } } } },
  })
  await updatePartnerOrder(42, 7, { status: 'processing', fulfillmentMethod: 'pickup', fulfillmentDate: '2026-09-20', noteForSupplier: 'Pickup after noon' })
  await updatePartnerOrder(42, 7, { fulfillmentDate: null })
  await updatePartnerOrder(42, 7, { noteForSupplier: null })
  await updatePartnerOrder(42, 7, { status: 'processing', fulfillmentDate: '2026-09-20', noteForSupplier: 'Ready by noon' })
  assert.deepEqual(calls, [
    ['update_partner_order', { p_order_id: 42, p_supplier_id: 7, p_patch: { status: 'processing', fulfillment_method: 'pickup', fulfillment_date: '2026-09-20', note_for_supplier: 'Pickup after noon' } }],
    ['update_partner_order', { p_order_id: 42, p_supplier_id: 7, p_patch: { fulfillment_date: null } }],
    ['update_partner_order', { p_order_id: 42, p_supplier_id: 7, p_patch: { note_for_supplier: null } }],
    ['update_partner_order', { p_order_id: 42, p_supplier_id: 7, p_patch: { status: 'processing', fulfillment_date: '2026-09-20', note_for_supplier: 'Ready by noon' } }],
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
  for (const items of [input().items, [{ jobRequestItemId: 11, quantity: 1 }]]) {
    for (const noteFromCustomer of ['Keep this customer requirement', '', null, 42]) {
      const response = await post({ ...input(), items, noteFromCustomer, noteForCustomer: 'Current note' })
      assert.equal(response.status, 400)
      assert.deepEqual(await response.json(), { error: 'Use noteForCustomer instead of noteFromCustomer' })
    }
    assert.equal((await post({ ...input(), items, noteFromCustomer: 'Legacy note only' })).status, 400)
  }
  assert.equal(writes.length, 0)
  assert.equal((await post(input())).status, 201)
  assert.equal(writes.length, 1)
})

test('order closure follows every linked job for supplier and admin reads, with internal job IDs omitted', async () => {
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
  assert.doesNotMatch(JSON.stringify(orders), /jobRequest|allocations/)
  const adminOrders = await listOrders({ supplierId: 7 })
  assert.deepEqual(adminOrders.map((order: { closed: boolean }) => order.closed), [true, false, false, true])
  tables.job_requests[1].status = 'closed_lost'
  orders = await listOrders({ supplierId: 7, forSupplier: true })
  assert.equal(orders[1].closed, true)
  tables.job_requests[0].status = 'committed'
  orders = await listOrders({ supplierId: 7, forSupplier: true })
  assert.equal(orders[0].closed, false)
})

test('partner header saves notify only after successful changes', async () => {
  const saved: Record<string, unknown> = { id: 42, supplierId: 7, status: 'new', fulfillmentDate: null, noteForSupplier: null }
  const events: any[] = []
  let failWrite = false
  let failContext = false
  const { PATCH } = load('../app/api/partner/[id]/orders/[orderId]/route.ts', {
    'next/server': { NextResponse: Response },
    '@/lib/partner-auth': { requirePartnerAccess: async () => ({ ok: true, supplierId: 7 }) },
    '@/lib/availability-queries': { partnerSupplier: async () => ({ id: 7 }) },
    '@/lib/orders': { parsePartnerOrderUpdate, positiveId },
    '@/lib/order-queries': {
      orderDetail: async () => ({ ...saved }),
      updatePartnerOrder: async (id: number, supplier: number, update: object) => {
        assert.equal(id, 42); assert.equal(supplier, 7)
        if (failWrite) throw new Error('write failed')
        Object.assign(saved, update)
      },
      supplierOrderEventContext: async () => {
        if (failContext) throw new Error('context unavailable')
        return { supplierId: 7, supplierName: 'APS', threadId: 'supplier-aps', orderId: 42 }
      },
    },
    '@/lib/notify-supplier-events': { notifySupplierEvent: async (event: any) => {
      for (const change of event.orderChanges) assert.equal(saved[change.field], change.value)
      events.push(event)
    } },
  })
  const patch = (body: object) => PATCH(new Request('https://lps.example/api/partner/7/orders/42', {
    method: 'PATCH', body: JSON.stringify(body),
  }), { params: Promise.resolve({ id: '7', orderId: '42' }) })
  assert.equal((await patch({ status: 'processing', fulfillmentDate: '2026-09-25', noteForSupplier: 'After noon' })).status, 200)
  assert.equal(events.length, 1)
  assert.deepEqual(events[0].orderChanges, [
    { field: 'status', previous: 'new', value: 'processing' },
    { field: 'fulfillmentDate', previous: null, value: '2026-09-25' },
    { field: 'noteForSupplier', previous: null, value: 'After noon' },
  ])
  assert.equal(events[0].threadId, 'supplier-aps')
  assert.equal((await patch({ noteForSupplier: ' After noon ' })).status, 200)
  assert.equal(events.length, 1)
  failWrite = true
  assert.equal((await patch({ status: 'order_ready' })).status, 400)
  assert.equal(events.length, 1)
  failWrite = false
  assert.equal((await patch({ status: 'order_ready' })).status, 200)
  assert.equal(events.length, 2)
  assert.equal((await patch({ noteForSupplier: null })).status, 200)
  assert.equal(events.length, 3)
  failContext = true
  assert.equal((await patch({ fulfillmentDate: '2026-09-26' })).status, 200)
  assert.equal(saved.fulfillmentDate, '2026-09-26')
})


test('order creation validates and routes each directional header note', async () => {
  const parsed = parseCreateOrder({ ...input(), noteForSupplier: '  Pickup only ', noteForCustomer: " White flowers \n\n Ready Friday " })
  assert.equal(parsed.noteForSupplier, 'Pickup only')
  assert.equal(parsed.noteForCustomer, 'White flowers \n\n Ready Friday')
  assert.throws(() => parseCreateOrder({ ...input(), notes: 'Old field' }), /noteForSupplier/)
  for (const field of ['noteForSupplier', 'noteForCustomer']) {
    for (const value of [false, 42, [], {}, 'x'.repeat(10001)]) {
      assert.throws(() => parseCreateOrder({ ...input(), [field]: value }), /must be text/)
    }
  }
  const calls: unknown[] = []
  const { createOrder } = load('./order-queries.ts', { 'server-only': {}, '@/lib/supabase': { supabase: {
    rpc: async (name: string, params: unknown) => { calls.push([name, params]); return { data: 123, error: null } },
  } } })
  await createOrder(parsed)
  await createOrder(parseCreateOrder({ ...input(), items: [{ jobRequestItemId: 11, quantity: 1 }], noteForSupplier: 'Direct supplier note' }))
  assert.deepEqual((calls[0] as any[])[1], {
    p_supplier_id: 7, p_customer_confirmed: true, p_fulfillment_method: 'pickup', p_fulfillment_date: null,
    p_note_for_supplier: 'Pickup only', p_note_for_customer: "White flowers \n\n Ready Friday",
    p_items: [{ candidate_id: 101, allocations: [{ job_request_item_id: 11, quantity: 2 }, { job_request_item_id: 21, quantity: 3 }] }],
  })
  assert.equal((calls[1] as any[])[0], 'create_direct_order')
  assert.equal((calls[1] as any[])[1].p_note_for_supplier, 'Direct supplier note')
  assert.equal((calls[1] as any[])[1].p_note_for_customer, null)
})

test('order supplier payloads omit customer notes on headers and lines', async () => {
  const noteFields = { note_for_customer: "Private customer requirement\n\nPrivate customer update",
    note_for_supplier: "Loading instructions\n\nSupplier response" }
  const db = database({
    orders: [{ id: 1, supplier_id: 7, status: 'new', is_active: true, ...noteFields }],
    suppliers: [{ id: 7, name: 'APS' }],
    order_items: [{ id: 10, order_id: 1, quantity: 1, is_active: true, ...noteFields }],
    order_item_job_request_items: [],
  })
  const { listOrders } = load('./order-queries.ts', { 'server-only': {}, '@/lib/supabase': { supabase: db } })
  const [admin] = await listOrders({ supplierId: 7 })
  const [supplier] = await listOrders({ supplierId: 7, forSupplier: true })
  assert.equal(admin.noteForCustomer, noteFields.note_for_customer)
  assert.equal('noteForCustomer' in admin.items[0], true)
  for (const row of [admin, admin.items[0]]) assert.equal(row.noteForCustomer, noteFields.note_for_customer)
  for (const row of [supplier, supplier.items[0]]) {
    assert.equal('noteForCustomer' in row, false)
    assert.equal(row.noteForSupplier, noteFields.note_for_supplier)
    assert.equal('notes' in row, false)
  }
  assert.doesNotMatch(JSON.stringify(supplier), /Private customer/)
})

test('supplier price edits reject invalid values and unrelated fields', () => {
  assert.equal(parseOrderItemPrice({ unitPrice: 12.34 }), 12.34)
  assert.equal(parseOrderItemPrice({ unitPrice: null }), null)
  for (const unitPrice of [-1, 0, Infinity, NaN, '12', 1.001, 100000000]) assert.throws(() => parseOrderItemPrice({ unitPrice }))
  assert.throws(() => parseOrderItemPrice({ unitPrice: 12, status: 'available' }))
  assert.throws(() => parseOrderItemPrice({}))
})

test('partner price endpoint saves only an owned open line and rejects invalid prices', async () => {
  let closed = false
  const writes: unknown[] = []
  const { PATCH } = load('../app/api/partner/[id]/orders/[orderId]/items/[itemId]/route.ts', {
    'next/server': { NextResponse: { json: (body: unknown, options?: ResponseInit) => new Response(JSON.stringify(body), options) } },
    '@/lib/availability-queries': { partnerSupplier: async () => ({ id: 7 }) },
    '@/lib/partner-auth': { requirePartnerAccess: async () => ({ ok: true, supplierId: 7 }) },
    '@/lib/order-queries': {
      orderDetail: async (id: number, supplier: number) => id === 11 && supplier === 7 ? { closed, status: 'processing', items: [{ id: 110 }] } : null,
      updatePartnerOrderItemPrice: async (...args: unknown[]) => { writes.push(args) },
    },
  })
  const save = (unitPrice: unknown, itemId = '110') => PATCH(new Request('http://localhost', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ unitPrice }) }), { params: Promise.resolve({ id: '7', orderId: '11', itemId }) })
  assert.equal((await save(23.5)).status, 200)
  assert.deepEqual(writes, [[11, 7, 110, 23.5]])
  assert.equal((await save(-1)).status, 400)
  assert.equal((await save(23.5, '999')).status, 404)
  closed = true
  assert.equal((await save(23.5)).status, 409)
  assert.equal(writes.length, 1)
})

test('admin order cell edits validate fields and preserve generated totals', async () => {
  const { parseOrderItemCell } = await import('./orders')
  assert.deepEqual(parseOrderItemCell('name', ' Oak '), { name: 'Oak' })
  assert.deepEqual(parseOrderItemCell('quantity', '2.5'), { quantity: 2.5 })
  assert.deepEqual(parseOrderItemCell('unit_price', ''), { unit_price: null })
  assert.deepEqual(parseOrderItemCell('note_for_supplier', 'Call first'), { note_for_supplier: 'Call first' })
  for (const value of ['', '0', '-1', 'Infinity', 'NaN']) assert.throws(() => parseOrderItemCell('quantity', value))
  assert.throws(() => parseOrderItemCell('unit_price', '1.234'))
  assert.throws(() => parseOrderItemCell('name', ' '))
  for (const column of ['total', 'order_id', 'is_active', 'status']) assert.throws(() => parseOrderItemCell(column, '1'))
})

test('admin inline order edits enforce role, order membership, and closure', async () => {
  let role = 'admin'
  let closed = false
  const writes: unknown[] = []
  const { PATCH } = load('../app/api/orders/[orderId]/items/[itemId]/route.ts', {
    '@/lib/session': { resolveUser: async () => ({ role }) },
    '@/lib/orders': await import('./orders'),
    '@/lib/order-queries': {
      orderDetail: async () => ({ supplierId: 7, closed, status: 'processing', items: [{ id: 12 }] }),
      updateOrderItemCell: async (...args: unknown[]) => { writes.push(args) },
    },
  })
  const request = (item = '12') => PATCH(new Request('http://localhost/api/orders/1/items/12', {
    method: 'PATCH', body: JSON.stringify({ column: 'unit_price', value: '25.50' }),
  }), { params: Promise.resolve({ orderId: '1', itemId: item }) })
  assert.equal((await request()).status, 200)
  assert.deepEqual(writes, [[1, 12, { unit_price: 25.5 }]])
  assert.equal((await request('99')).status, 404)
  closed = true
  assert.equal((await request()).status, 409)
  role = 'supplier'
  assert.equal((await request()).status, 403)
  assert.equal(writes.length, 1)
})


test('public orders require a live capability and expose only supplier details', async () => {
  const token = '11111111-1111-4111-8111-111111111111'
  const tables = {
    orders: [{ id: 1, supplier_id: 7, public_token: token as string | null, is_active: true, status: 'new', note_for_customer: "private header\n\nprivate input" }],
    suppliers: [{ id: 7, name: 'APS', is_active: true }],
    order_items: [{ id: 10, order_id: 1, name: 'Oak', quantity: 2, status: 'available', unit_price: 10, total: 20, is_active: true, note_for_customer: 'private line', note_for_supplier: 'Handle gently' }],
    order_item_job_request_items: [{ order_item_id: 10, job_request_item_id: 11, quantity: 2 }],
    job_request_items: [{ id: 11, job_request_id: 100 }],
    job_requests: [{ id: 100, name: 'Garden', status: 'committed', is_active: true }],
  }
  const db = database(tables)
  const { publicOrder, orderDetail } = load('./order-queries.ts', { 'server-only': {}, '@/lib/supabase': { supabase: db } })
  assert.equal(await publicOrder('bad-token'), null)
  assert.equal(db.reads.length, 0)
  const order = await publicOrder(token)
  assert.ok(order)
  assert.equal(order.items[0].noteForSupplier, 'Handle gently')
  for (const field of ['publicToken', 'noteForCustomer', 'noteForCustomer', 'shareJobs']) assert.equal(field in order, false)
  assert.equal('noteForCustomer' in order.items[0], false)
  assert.equal('allocations' in order.items[0], false)
  assert.equal('jobRequestId' in order.jobSchedules[0], false)
  assert.deepEqual(order.availabilityRequestIds, [])
  assert.equal((await orderDetail(1)).publicToken, token)
  tables.orders[0].public_token = null
  assert.equal(await publicOrder(token), null)
  tables.orders[0].public_token = token
  tables.suppliers[0].is_active = false
  assert.equal(await publicOrder(token), null)
  tables.suppliers[0].is_active = true
  tables.orders[0].status = 'closed_won'
  assert.equal(await publicOrder(token), null)
  tables.orders[0].status = 'new'
  tables.job_requests[0].status = 'closed_lost'
  assert.equal(await publicOrder(token), null)
  tables.job_requests[0].status = 'committed'
  tables.orders[0].is_active = false
  assert.equal(await publicOrder(token), null)
})

test('only admins may publish orders and sharing bodies cannot mix mutations', async () => {
  let user: unknown = null
  const calls: unknown[][] = []
  const { PATCH } = load('../app/api/orders/[orderId]/route.ts', {
    '@/lib/session': { resolveUser: async () => user },
    '@/lib/orders': { positiveId, parsePartnerOrderUpdate },
    '@/lib/order-queries': { orderDetail: async () => ({ id: 1, supplierId: 7, status: 'new' }), setOrderPublic: async (...args: unknown[]) => { calls.push(args); return 'token' } },
  })
  const patch = (body: unknown) => PATCH(new Request('http://localhost/api/orders/1', { method: 'PATCH', body: JSON.stringify(body) }), { params: Promise.resolve({ orderId: '1' }) })
  assert.equal((await patch({ isPublic: true })).status, 401)
  user = { role: 'partner' }
  assert.equal((await patch({ isPublic: true })).status, 403)
  user = { role: 'admin' }
  assert.equal((await patch({ isPublic: 'true' })).status, 400)
  assert.equal((await patch({ isPublic: true, status: 'processing' })).status, 400)
  assert.equal((await patch({ isPublic: true })).status, 200)
  assert.equal((await patch({ isPublic: false })).status, 200)
  assert.deepEqual(calls, [[1, true], [1, false]])
})
