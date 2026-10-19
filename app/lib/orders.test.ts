import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import ts from 'typescript'

import { isApsSupplier, orderDate, orderSubtotal, parseCreateOrder, parseOrderItemPrice, parseOrderItemUpdate, parsePartnerOrderUpdate, positiveId } from './orders'

const require = createRequire(import.meta.url)
function load(file: string, mocks: Record<string, unknown>) {
  const source = readFileSync(new URL(file, import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } })
  const module = { exports: {} as Record<string, (...args: any[]) => Promise<any>> }
  new Function('require', 'module', 'exports', outputText)((name: string) => name in mocks ? mocks[name] : require(name), module, module.exports)
  return module.exports
}

const input = () => ({ jobRequestId: 1, supplierId: 7, fulfillmentMethod: 'pickup', jobRequestItemIds: [11, 21] })

test('order creation takes one job, one supplier and unique job lines (0146)', () => {
  const parsed = parseCreateOrder(input())
  assert.deepEqual(parsed.jobRequestItemIds, [11, 21])
  assert.equal('customerConfirmed' in parsed, false, 'no customer-confirmation flag')
  for (const jobRequestItemIds of [[], [11, 11], [0], ['11'], undefined]) assert.throws(() => parseCreateOrder({ ...input(), jobRequestItemIds }), /job lines/)
  assert.throws(() => parseCreateOrder({ ...input(), jobRequestId: undefined }), /jobRequestId/)
  assert.throws(() => parseCreateOrder({ ...input(), supplierId: 0 }), /supplierId/)
  assert.throws(() => parseCreateOrder({ ...input(), fulfillmentMethod: 'truck' }), /pickup or delivery/)
})

test('suppliers can update an open order line to a supported procurement status', () => {
  assert.deepEqual(parseOrderItemUpdate({ status: 'unavailable' }), { status: 'unavailable' })
  assert.throws(() => parseOrderItemUpdate({ status: 'invented' }), /valid plant status/)
  assert.deepEqual(parseOrderItemUpdate({ status: 'diff_size_sub' }), { status: 'diff_size_sub' })
  assert.throws(() => parseOrderItemUpdate({ status: 'diff_size_qty_sub' }), /valid plant status/, 'renamed to diff_size_sub (0130)')
  assert.throws(() => parseOrderItemUpdate({ status: 'available', notes: 'extra' }), /valid plant status/)
  assert.deepEqual(parseOrderItemUpdate({ status: 'unavailable', noteFromSupplier: ' Out until May ' }), { status: 'unavailable', noteFromSupplier: 'Out until May' })
  assert.deepEqual(parseOrderItemUpdate({ status: 'available', noteFromSupplier: '' }), { status: 'available', noteFromSupplier: '' }, 'blank clears the reply')
  for (const noteFromSupplier of [null, 42, 'x'.repeat(10001)]) assert.throws(() => parseOrderItemUpdate({ status: 'available', noteFromSupplier }), /Note/)
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

test('order creation sends the job, supplier and lines to create_order (0146)', async () => {
  const calls: unknown[][] = []
  const { createOrder } = load('./order-queries.ts', {
    'server-only': {}, '@/lib/supabase': { supabase: { rpc: async (...args: unknown[]) => {
      calls.push(args); return { data: 42, error: null }
    } } },
  })
  assert.equal(await createOrder(parseCreateOrder(input())), 42)
  assert.deepEqual(calls, [['create_order', { p_job_request_id: 1, p_supplier_id: 7, p_job_request_item_ids: [11, 21],
    p_fulfillment_method: 'pickup', p_note_for_supplier: null, p_note_for_customer: null }]])
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

test('order choices are the job lines whose selected candidate is not on an order yet', async () => {
  const db = database({
    // `job_lines`: what create_order copies (0146). 13's candidate is already ordered.
    job_lines: [
      { id: 11, job_request_id: 1, selected_candidate_id: 111, candidate_supplier_id: 7, candidate_name: 'Oak', size: '30 G', candidate_status: 'partial_qty', available_quantity: 3, demanded_quantity: 10, unit_price: 20, is_active: true },
      { id: 12, job_request_id: 1, selected_candidate_id: 112, candidate_supplier_id: 7, candidate_name: 'Sage', size: '5 G', candidate_status: null, available_quantity: null, demanded_quantity: 4, unit_price: null, is_active: true },
      { id: 13, job_request_id: 1, selected_candidate_id: 113, candidate_supplier_id: 7, candidate_name: 'Elm', size: '45 G', candidate_status: 'can_order', available_quantity: 0, demanded_quantity: 2, unit_price: 90, is_active: true },
      { id: 14, job_request_id: 1, selected_candidate_id: 114, candidate_supplier_id: 8, candidate_name: 'Yaupon', size: '15 G', candidate_status: 'can_order', available_quantity: 0, demanded_quantity: 2, unit_price: 50, is_active: true },
      { id: 15, job_request_id: 1, selected_candidate_id: 115, candidate_supplier_id: 7, candidate_name: 'Gone', size: null, candidate_status: null, available_quantity: null, demanded_quantity: 1, unit_price: null, is_active: false },
    ],
    order_items: [{ id: 31, order_id: 21, candidate_id: 113 }],
    suppliers: [{ id: 7, name: 'APS', is_active: true }, { id: 8, name: 'Grower', is_active: true }],
  })
  const { orderLineChoices } = load('./order-queries.ts', { 'server-only': {}, '@/lib/supabase': { supabase: db } })
  const lines = await orderLineChoices(1)
  assert.deepEqual(lines.map((line: any) => [line.jobRequestItemId, line.supplierName, line.status, line.quantity, line.unitPrice]), [
    [11, 'APS', 'partial_qty', 3, 20],
    [12, 'APS', 'pending', 4, null],
    [14, 'Grower', 'need_to_order', 2, 50],
  ], 'the available quantity, else the Qty; unpriced and unanswered lines can be ordered')
})

test('supplier order reads link the AR of the same job and supplier, never a Draft', async () => {
  const tables = {
    orders: [{ id: 1, job_request_id: 100, supplier_id: 7, status: 'new', is_active: true }, { id: 2, job_request_id: 100, supplier_id: 8, status: 'new', is_active: true }],
    order_items: [10, 11].map((id) => ({ id, order_id: 1, candidate_id: id + 100, name: 'Oak', quantity: 2, unit_price: 10, total: 20, status: 'need_to_order', note_from_supplier: 'Tagged', is_active: true })),
    availability_requests: [{ id: 20, job_request_id: 100, supplier_id: 7, status: 'submitted' }, { id: 40, job_request_id: 100, supplier_id: 8, status: 'draft' }, { id: 50, job_request_id: 101, supplier_id: 7, status: 'new' }],
    job_requests: [{ id: 100, name: 'Private customer job', status: 'committed', is_active: true }],
    suppliers: [{ id: 7, name: 'APS' }, { id: 8, name: 'Other supplier' }],
  }
  const { listOrders } = load('./order-queries.ts', { 'server-only': {}, '@/lib/supabase': { supabase: database(tables) } })
  const orders = await listOrders({ supplierId: 7, forSupplier: true })
  assert.deepEqual(orders.map((order: { id: number }) => order.id), [1])
  assert.equal(orders[0].availabilityRequestId, 20)
  assert.equal(orders[0].items[0].noteFromSupplier, 'Tagged')
  assert.equal('candidateId' in orders[0].items[0], false, 'supplier payloads omit the candidate')
  assert.deepEqual(orders[0].jobNames, ['Private customer job'])
  assert.equal((await listOrders({ supplierId: 8, forSupplier: true }))[0].availabilityRequestId, null, 'a Draft AR is not linked for the supplier')
  const [admin] = await listOrders({ jobRequestId: 100, supplierId: 8 })
  assert.equal(admin.availabilityRequestId, 40)
  assert.equal(admin.jobRequestId, 100)
})

test('orders keep customer EDD separate from supplier commitment', async () => {
  const db = database({
    orders: [{ id: 1, job_request_id: 1, supplier_id: 7, status: 'processing', fulfillment_date: '2026-10-05', note_for_supplier: "Committed for Monday\n\nCustomer instructions", is_active: true }],
    suppliers: [{ id: 7, name: 'APS' }],
    order_items: [{ id: 10, order_id: 1, quantity: 3, is_active: true }],
    customers: [{ id: 8, name: 'Jane', company: 'Gardens', email: 'jane@example.com', phone: '555-0100' }],
    job_requests: [
      { id: 1, name: 'Private Garden', customer_id: 8, shipping_address: '123 Garden St', expected_install_date: '2026-10-03', fulfillment_method: 'delivery', status: 'committed', is_active: true },
    ],
  })
  const { listOrders } = load('./order-queries.ts', { 'server-only': {}, '@/lib/supabase': { supabase: db } })
  const [partnerOrder] = await listOrders({ supplierId: 7, forSupplier: true })
  assert.equal(partnerOrder.shareJobs, undefined)
  assert.equal(partnerOrder.customerDetails[0].customer.email, 'jane@example.com')
  assert.equal(partnerOrder.fulfillmentDate, '2026-10-05')
  assert.equal(partnerOrder.noteForSupplier, 'Committed for Monday\n\nCustomer instructions')
  assert.deepEqual(partnerOrder.jobSchedules, [{ expectedInstallDate: '2026-10-03', fulfillmentMethod: 'delivery' }])
  assert.doesNotMatch(JSON.stringify(partnerOrder), /jobRequest|candidateId/)
  const [adminOrder] = await listOrders({ supplierId: 7 })
  assert.equal(adminOrder.shareJobs.length, 1)
  assert.equal(adminOrder.shareJobs[0].customer.phone, '555-0100')
  assert.equal(adminOrder.shareJobs[0].shippingAddress, '123 Garden St')
  assert.deepEqual(adminOrder.jobSchedules.map((schedule: { jobRequestId: number }) => schedule.jobRequestId), [1])
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
        return args[0] === 42 ? { id: 42, supplierId: 7, status: 'new', availabilityRequestId: 10 }
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
    assert.equal((await patch({ noteFromSupplier: 'Edit' }, '44')).status, 409, 'Closed orders cannot be edited')
    assert.equal((await patch({ status: 'closed_won' })).status, 400)
    assert.equal((await patch({ fulfillmentDate: '2026-02-30' })).status, 400)
    assert.equal((await patch({ supplierId: 8, noteFromSupplier: 'Wrong supplier' })).status, 400)
    assert.equal((await patch({ noteForSupplier: 'LPS note' })).status, 403, 'The note for the supplier is LPS\'s')
    supplierActive = false
    assert.equal((await patch({ noteFromSupplier: 'Inactive supplier' })).status, 404)
    assert.equal((await get()).status, 404)
    supplierActive = true
    assert.equal(writes.length, previousWrites)
    const update = { status: 'processing', fulfillmentDate: '2026-09-20', noteFromSupplier: `${role} confirmation` }
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
  const lpsNote = await patch({ status: 'processing', fulfillmentDate: '2026-09-20', noteForSupplier: 'Ready by noon' })
  assert.equal(lpsNote.status, 403, 'LPS writes the note for the supplier; the supplier writes their own reply')
  const confirmation = { status: 'processing', fulfillmentDate: '2026-09-20', noteFromSupplier: 'Ready by noon' }
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
  await updatePartnerOrder(42, 7, { status: 'processing', fulfillmentDate: '2026-09-20', noteFromSupplier: 'Ready by noon' })
  assert.deepEqual(calls, [
    ['update_partner_order', { p_order_id: 42, p_supplier_id: 7, p_patch: { status: 'processing', fulfillment_method: 'pickup', fulfillment_date: '2026-09-20', note_for_supplier: 'Pickup after noon' } }],
    ['update_partner_order', { p_order_id: 42, p_supplier_id: 7, p_patch: { fulfillment_date: null } }],
    ['update_partner_order', { p_order_id: 42, p_supplier_id: 7, p_patch: { note_for_supplier: null } }],
    ['update_partner_order', { p_order_id: 42, p_supplier_id: 7, p_patch: { status: 'processing', fulfillment_date: '2026-09-20', note_from_supplier: 'Ready by noon' } }],
  ])
})

test('order creation routes reject partner sessions and invalid requests before writing', async () => {
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
  assert.equal((await post({ ...input(), jobRequestItemIds: [] })).status, 400)
  assert.equal(writes.length, 0)
  assert.equal((await post(input())).status, 201)
  assert.equal(writes.length, 1)
})

test('an order is closed with its own status or its job, for supplier and admin reads', async () => {
  const tables = {
    orders: [1, 2, 3].map((id) => ({ id, job_request_id: id === 2 ? 2 : 1, supplier_id: 7, status: id === 3 ? 'closed_won' : 'new', is_active: true })),
    order_items: [1, 2, 3].map((id) => ({ id: id * 10, order_id: id, name: 'Oak', quantity: 1, is_active: true })),
    suppliers: [{ id: 7, name: 'APS' }],
    job_requests: [{ id: 1, name: 'Private Garden', status: 'closed_won', is_active: true }, { id: 2, name: 'Private Patio', status: 'committed', is_active: true }],
  }
  const { listOrders } = load('./order-queries.ts', { 'server-only': {}, '@/lib/supabase': { supabase: database(tables) } })
  let orders = await listOrders({ supplierId: 7, forSupplier: true })
  assert.deepEqual(orders.map((order: { closed: boolean }) => order.closed), [true, false, true])
  assert.doesNotMatch(JSON.stringify(orders), /jobRequest/)
  const adminOrders = await listOrders({ supplierId: 7 })
  assert.deepEqual(adminOrders.map((order: { closed: boolean }) => order.closed), [true, false, true])
  tables.job_requests[1].status = 'closed_lost'
  orders = await listOrders({ supplierId: 7, forSupplier: true })
  assert.equal(orders[1].closed, true)
  tables.job_requests[0].status = 'committed'
  orders = await listOrders({ supplierId: 7, forSupplier: true })
  assert.equal(orders[0].closed, false)
})

test('partner header saves notify only after successful changes', async () => {
  const saved: Record<string, unknown> = { id: 42, supplierId: 7, status: 'new', fulfillmentDate: null, noteFromSupplier: null }
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
  assert.equal((await patch({ status: 'processing', fulfillmentDate: '2026-09-25', noteFromSupplier: 'After noon' })).status, 200)
  assert.equal(events.length, 1)
  assert.deepEqual(events[0].orderChanges, [
    { field: 'status', previous: 'new', value: 'processing' },
    { field: 'fulfillmentDate', previous: null, value: '2026-09-25' },
    { field: 'noteFromSupplier', previous: null, value: 'After noon' },
  ])
  assert.equal(events[0].threadId, 'supplier-aps')
  assert.equal((await patch({ noteFromSupplier: ' After noon ' })).status, 200)
  assert.equal(events.length, 1)
  failWrite = true
  assert.equal((await patch({ status: 'order_ready' })).status, 400)
  assert.equal(events.length, 1)
  failWrite = false
  assert.equal((await patch({ status: 'order_ready' })).status, 200)
  assert.equal(events.length, 2)
  assert.equal((await patch({ noteFromSupplier: null })).status, 200)
  assert.equal(events.length, 3)
  failContext = true
  assert.equal((await patch({ fulfillmentDate: '2026-09-26' })).status, 200)
  assert.equal(saved.fulfillmentDate, '2026-09-26')
})


test('order creation validates each directional header note', async () => {
  const parsed = parseCreateOrder({ ...input(), noteForSupplier: '  Pickup only ', noteForCustomer: " White flowers \n\n Ready Friday " })
  assert.equal(parsed.noteForSupplier, 'Pickup only')
  assert.equal(parsed.noteForCustomer, 'White flowers \n\n Ready Friday')
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
  assert.deepEqual((calls[0] as any[])[1], {
    p_job_request_id: 1, p_supplier_id: 7, p_job_request_item_ids: [11, 21], p_fulfillment_method: 'pickup',
    p_note_for_supplier: 'Pickup only', p_note_for_customer: "White flowers \n\n Ready Friday",
  })
})

test('order supplier payloads omit customer notes on headers and lines', async () => {
  const noteFields = { note_for_customer: "Private customer requirement\n\nPrivate customer update",
    note_for_supplier: "Loading instructions\n\nSupplier response" }
  const db = database({
    orders: [{ id: 1, job_request_id: 100, supplier_id: 7, status: 'new', is_active: true, ...noteFields }],
    suppliers: [{ id: 7, name: 'APS' }],
    order_items: [{ id: 10, order_id: 1, quantity: 1, is_active: true, ...noteFields }],
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
    orders: [{ id: 1, job_request_id: 100, supplier_id: 7, public_token: token as string | null, is_active: true, status: 'new', note_for_customer: "private header\n\nprivate input" }],
    suppliers: [{ id: 7, name: 'APS', is_active: true }],
    order_items: [{ id: 10, order_id: 1, name: 'Oak', quantity: 2, status: 'available', unit_price: 10, total: 20, is_active: true, note_for_customer: 'private line', note_for_supplier: 'Handle gently' }],
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
  assert.equal('candidateId' in order.items[0], false)
  assert.equal('jobRequestId' in order.jobSchedules[0], false)
  assert.equal(order.availabilityRequestId, null)
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
