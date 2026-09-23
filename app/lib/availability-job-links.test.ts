import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import ts from 'typescript'

const require = createRequire(import.meta.url)

function fixture() {
  const links = Array.from({ length: 1105 }, (_, i) => ({ availability_request_id: 42, job_request_id: i + 1 }))
  const tables: Record<string, Record<string, unknown>[]> = {
    availability_request_jobs: links,
    availability_requests: [{ id: 42, record_name: 'JR-1:AR-1', supplier_id: 7, status: 'submitted', is_active: true,
      created_at: '2026-09-14T12:00:00Z', submitted_at: '2026-09-15T12:00:00Z' }],
    suppliers: [{ id: 7, name: 'APS', is_lps_partner: true, rosie_thread_id: 'supplier-7' }],
    job_requests: links.map((link) => ({ id: link.job_request_id, name: `Job ${link.job_request_id}` })),
    availability_request_items: [{ id: 51, availability_request_id: 42, name: 'Oak', size: '30 G', demanded_quantity: 10,
      status: 'can_order', available_quantity: 8, unit_price: 20, note_from_supplier: 'Ready next week', note_for_supplier: 'Single trunk only', is_active: true }],
    availability_request_item_jobs: [
      { availability_request_item_id: 51, job_request_item_id: 101, quantity: 6 },
      { availability_request_item_id: 51, job_request_item_id: 110501, quantity: 4 },
    ],
  }
  const supabase = { from(table: string) {
    let rows = [...(tables[table] ?? [])]
    const query = {
      select: (columns: string) => {
        if (table === 'availability_requests') {
          assert.ok(!columns.split(',').map((column) => column.trim()).includes('job_request_id'),
            'Header reads must work without the legacy job id')
        }
        if (table === 'availability_request_items') {
          const selected = columns.split(',').map((column) => column.trim())
          assert.ok(!['job_request_item_id', 'quantity', 'notes'].some((column) => selected.includes(column)),
            'Availability reads must work after the column cleanup')
        }
        return query
      },
      in: (column: string, values: unknown[]) => { rows = rows.filter((row) => values.includes(row[column])); return query },
      eq: (column: string, value: unknown) => { rows = rows.filter((row) => row[column] === value); return query },
      neq: (column: string, value: unknown) => { rows = rows.filter((row) => row[column] !== value); return query },
      order: () => query,
      limit: () => query,
      maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
      single: async () => rows.length === 1 ? { data: rows[0], error: null } : { data: null, error: { message: 'Request not found' } },
      range: async (from: number, to: number) => ({ data: rows.slice(from, to + 1), error: null }),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve(resolve({ data: rows.slice(0, 1000), error: null })),
    }
    return query
  } }
  const { outputText } = ts.transpileModule(readFileSync(new URL('./availability-queries.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  })
  const module = { exports: {} as Record<string, (...args: any[]) => Promise<any>> }
  const mocks: Record<string, unknown> = { 'server-only': {}, '@/lib/supabase': { supabase },
    '@/lib/partner-display': { redactPartnerRequestRefs: (name: string) => name }, '@/lib/availability-allocations': {} }
  new Function('require', 'module', 'exports', outputText)((name: string) => name in mocks ? mocks[name] : require(name), module, module.exports)
  return { tables, links, queries: module.exports }
}

test('shared requests appear on every source job, including associations beyond the row cap', async () => {
  const { links, queries } = fixture()
  const suppliers = await queries.supplierLinksByRequest(links.map((link) => link.job_request_id))
  assert.equal(Object.keys(suppliers).length, 1105)
  assert.deepEqual(suppliers[1105][0].availabilityRequests, [{ id: 42, recordName: 'JR-1:AR-1', status: 'submitted',
    createdAt: '2026-09-14T12:00:00Z', submittedAt: '2026-09-15T12:00:00Z' }])
  const requests = await queries.listAvailabilityRequests({ jobRequestId: 1105 })
  assert.equal(requests[0].recordName, 'JR-1:AR-1')
  assert.equal(requests.length, 1, 'A non-primary source job finds the combined request')
  assert.equal(requests[0].jobRequestIds.length, 1105, 'Disclosure must not mistake a truncated job list for a single job')
  assert.equal(requests[0].jobRequestIds.at(-1), 1105)
  assert.ok(requests[0].jobName.endsWith('Job 1105'))

  const detail = await queries.availabilityRequest(42)
  assert.deepEqual(detail.items[0].allocations, [
    { jobRequestItemId: 101, quantity: 6 }, { jobRequestItemId: 110501, quantity: 4 },
  ])
  assert.equal(detail.items[0].demandedQuantity, 10)
  assert.equal(detail.items[0].noteForSupplier, 'Single trunk only')
  assert.equal(detail.items[0].noteFromSupplier, 'Ready next week')
  assert.equal('jobRequestItemId' in detail.items[0], false)
  const supplierDetail = await queries.availabilityRequest(42, { forSupplierId: 7 })
  assert.equal(supplierDetail.items[0].name, 'Oak')
  assert.equal(supplierDetail.items[0].noteForSupplier, 'Single trunk only')
  assert.equal(supplierDetail.items[0].noteFromSupplier, 'Ready next week')
  assert.equal('allocations' in supplierDetail.items[0], false)
  assert.equal('jobRequestItemId' in supplierDetail.items[0], false)
})

test('supplier event context follows surviving job links, including closed history and no remaining jobs', async () => {
  const { tables, queries } = fixture()
  tables.availability_requests[0].status = 'closed'
  assert.deepEqual(await queries.supplierAvailabilityEventContext(42, 7), {
    jobRequestId: 1, supplierId: 7, supplierName: 'APS', threadId: 'supplier-7', availabilityRequestId: 42,
  })
  tables.availability_request_jobs = [{ availability_request_id: 42, job_request_id: 1105 }]
  assert.equal((await queries.supplierAvailabilityEventContext(42)).jobRequestId, 1105)
  await assert.rejects(queries.supplierAvailabilityEventContext(42, 99), /Request not found/)
  tables.availability_request_jobs = []
  assert.equal((await queries.supplierAvailabilityEventContext(42)).jobRequestId, null)
  assert.equal((await queries.listAvailabilityRequests({ supplierIds: [7] }))[0].jobRequestId, null)
})

test('portal line customer disclosure uses the sole linked job and the sharing flag', async () => {
  const { tables, queries } = fixture()
  tables.availability_requests[0].share_customer_details = true
  tables.job_requests.at(-1)!.customer_id = 91
  tables.customers = [{ id: 91, name: 'Customer name', company: 'Customer company' }]
  assert.equal((await queries.listPortalItemLines(7))[0].arCustomer, null, 'Combined requests keep customer details private')
  tables.availability_request_jobs = [{ availability_request_id: 42, job_request_id: 1105 }]
  const [line] = await queries.listPortalItemLines(7)
  assert.equal(line.arName, 'Job 1105')
  assert.equal(line.arCustomer, 'Customer company')
  tables.availability_requests[0].share_customer_details = false
  assert.equal((await queries.listPortalItemLines(7))[0].arCustomer, null)
  tables.availability_requests[0].share_customer_details = true
  tables.availability_request_jobs = []
  assert.equal((await queries.listPortalItemLines(7))[0].arCustomer, null)
})
