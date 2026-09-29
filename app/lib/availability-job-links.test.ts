import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import ts from 'typescript'

const require = createRequire(import.meta.url)

function fixture() {
  // One AR per job: the header names its job. Other suppliers' ARs for other
  // jobs fill the table past PostgREST's 1,000-row page.
  const tables: Record<string, Record<string, unknown>[]> = {
    availability_requests: [
      { id: 42, job_request_id: 1105, record_name: 'JR-1105:AR-1', supplier_id: 7, status: 'submitted', is_active: true,
        created_at: '2026-09-14T12:00:00Z', submitted_at: '2026-09-15T12:00:00Z' },
      ...Array.from({ length: 1104 }, (_, i) => ({ id: 1000 + i, job_request_id: i + 1, supplier_id: 8, status: 'new',
        is_active: true, created_at: '2026-09-01T12:00:00Z', submitted_at: null })),
    ],
    suppliers: [{ id: 7, name: 'APS', is_lps_partner: true, rosie_thread_id: 'supplier-7' },
      { id: 8, name: 'Other', is_lps_partner: true, rosie_thread_id: null }],
    job_requests: Array.from({ length: 1105 }, (_, i) => ({ id: i + 1, name: `Job ${i + 1}` })),
    candidates: [{ id: 51, availability_request_id: 42, job_request_item_id: 101, supplier_id: 7, name: 'Oak', size: '30 G',
      demanded_quantity: 10, status: 'can_order', available_quantity: 8, unit_price: 20,
      note_for_supplier: 'Single trunk only', note_from_supplier: 'Ready next week', is_active: true }],
  }
  const supabase = { from(table: string) {
    let rows = [...(tables[table] ?? [])]
    const query = {
      select: (columns: string) => {
        if (table === 'candidates') {
          const selected = columns.split(',').map((column) => column.trim())
          assert.ok(!['quantity', 'notes'].some((column) => selected.includes(column)),
            'Availability reads must work after the column cleanup')
        }
        return query
      },
      in: (column: string, values: unknown[]) => { rows = rows.filter((row) => values.includes(row[column])); return query },
      eq: (column: string, value: unknown) => { rows = rows.filter((row) => row[column] === value); return query },
      neq: (column: string, value: unknown) => { rows = rows.filter((row) => row[column] !== value); return query },
      not: (column: string, operator: string, value: unknown) => {
        rows = rows.filter((row) => operator === 'in'
          ? !String(value).slice(1, -1).split(',').includes(String(row[column])) : row[column] !== value)
        return query
      },
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
    '@/lib/partner-display': { redactPartnerRequestRefs: (name: string) => name } }
  new Function('require', 'module', 'exports', outputText)((name: string) => name in mocks ? mocks[name] : require(name), module, module.exports)
  return { tables, queries: module.exports }
}

test('each job links its own ARs, including jobs beyond the row cap', async () => {
  const { queries } = fixture()
  const jobIds = Array.from({ length: 1105 }, (_, i) => i + 1)
  const suppliers = await queries.supplierLinksByRequest(jobIds)
  assert.equal(Object.keys(suppliers).length, 1105)
  assert.deepEqual(suppliers[1105].map((link: { supplierId: number }) => link.supplierId), [7])
  assert.deepEqual(suppliers[1105][0].availabilityRequests, [{ id: 42, recordName: 'JR-1105:AR-1', status: 'submitted',
    createdAt: '2026-09-14T12:00:00Z', submittedAt: '2026-09-15T12:00:00Z' }])
  const requests = await queries.listAvailabilityRequests({ jobRequestId: 1105 })
  assert.deepEqual(requests.map((r: { id: number }) => r.id), [42])
  assert.equal(requests[0].recordName, 'JR-1105:AR-1')
  assert.deepEqual(requests[0].jobRequestIds, [1105])
  assert.equal(requests[0].jobName, 'Job 1105')

  const detail = await queries.availabilityRequest(42)
  // A candidate belongs to one job line; its whole demand is that line's share.
  assert.deepEqual(detail.items[0].allocations, [{ jobRequestItemId: 101, quantity: 10 }])
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

test('supplier event context follows the AR\'s job, including closed history and a deleted job', async () => {
  const { tables, queries } = fixture()
  tables.availability_requests[0].status = 'closed'
  assert.deepEqual(await queries.supplierAvailabilityEventContext(42, 7), {
    jobRequestId: 1105, supplierId: 7, supplierName: 'APS', threadId: 'supplier-7', availabilityRequestId: 42,
  })
  await assert.rejects(queries.supplierAvailabilityEventContext(42, 99), /Request not found/)
  // Deleting the job sets the AR's job to NULL; the AR survives as supplier history.
  tables.availability_requests[0].job_request_id = null
  assert.equal((await queries.supplierAvailabilityEventContext(42)).jobRequestId, null)
  assert.equal((await queries.listAvailabilityRequests({ supplierIds: [7] }))[0].jobRequestId, null)
})

test('portal line customer disclosure uses the AR\'s job and the sharing flag', async () => {
  const { tables, queries } = fixture()
  tables.availability_requests = [tables.availability_requests[0]]
  tables.availability_requests[0].share_customer_details = true
  tables.job_requests.at(-1)!.customer_id = 91
  tables.customers = [{ id: 91, name: 'Customer name', company: 'Customer company' }]
  const [line] = await queries.listPortalItemLines(7)
  assert.equal(line.arName, 'Job 1105')
  assert.equal(line.arCustomer, 'Customer company')
  tables.availability_requests[0].share_customer_details = false
  assert.equal((await queries.listPortalItemLines(7))[0].arCustomer, null)
  tables.availability_requests[0].share_customer_details = true
  tables.availability_requests[0].job_request_id = null
  assert.equal((await queries.listPortalItemLines(7))[0].arCustomer, null)
})
