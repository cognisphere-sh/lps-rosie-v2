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
    suppliers: [{ id: 7, name: 'APS', is_lps_partner: true, rosie_thread_id: 'supplier-7', is_active: true },
      { id: 8, name: 'Other', is_lps_partner: true, rosie_thread_id: null }],
    job_requests: Array.from({ length: 1105 }, (_, i) => ({ id: i + 1, name: `Job ${i + 1}` })),
    candidates: [{ id: 51, availability_request_id: 42, job_request_item_id: 101, supplier_id: 7, name: 'Oak', size: '30 G',
      line: { demanded_quantity: 10 }, status: 'can_order', available_quantity: 8, unit_price: 20,
      note_for_supplier: 'Single trunk only', note_from_supplier: 'Ready next week', is_active: true },
      { id: 52, availability_request_id: null, job_request_item_id: 102, supplier_id: 7, name: 'Elm', size: '15 G',
        is_original: true, is_active: true }],
    job_request_items: [{ id: 102, job_request_id: 1105, name: 'Elm', size: '15 G', demanded_quantity: 4, is_active: true,
      default_candidate_id: 52 }],
  }
  const rpcs: [string, Record<string, unknown>][] = []
  const inserted: Record<string, unknown>[] = []
  const supabase = { rpc: (name: string, args: Record<string, unknown>) => {
    rpcs.push([name, args])
    // The catalogue look-up finds no price.
    if (name === 'search_inventory') { const none = { eq: () => none, gt: async () => ({ data: [], error: null }) }; return none }
    return Promise.resolve({ data: name === 'create_availability_request' ? 99 : null, error: null })
  }, from(table: string) {
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
      is: (column: string, value: unknown) => { rows = rows.filter((row) => row[column] === value); return query },
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
      insert: (values: Record<string, unknown>[]) => {
        inserted.push(...values)
        return { select: async () => ({ data: values.map((_, i) => ({ id: 900 + i })), error: null }) }
      },
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
  return { tables, rpcs, inserted, queries: module.exports }
}

test('a later ask to a supplier joins its existing AR for the job instead of creating another (0128)', async () => {
  const { tables, rpcs, inserted, queries } = fixture()
  // AR-42 is APS's submitted AR for JR-1105: nothing reopens it unless LPS confirmed it.
  await assert.rejects(queries.createAvailabilityRequest({ jobRequestId: 1105, supplierId: 7, shareCustomerDetails: false, itemIds: [102] }),
    (e: Error & { arId?: number; status?: string }) => e.name === 'Error' && e.arId === 42 && e.status === 'submitted')
  assert.deepEqual([rpcs, inserted], [[], []])
  // Confirmed: reopened as New, then the line's default (its APS original) is added.
  assert.deepEqual(await queries.createAvailabilityRequest({ jobRequestId: 1105, supplierId: 7, shareCustomerDetails: false, itemIds: [102], reopen: true }),
    { id: 42, reopened: true })
  assert.deepEqual(rpcs, [['reopen_availability_request', { p_request_id: 42 }],
    ['add_candidates_to_availability_request', { p_request_id: 42, p_candidate_ids: [52] }]])
  rpcs.length = 0
  // A New AR takes the line as it is.
  tables.availability_requests[0].status = 'new'
  assert.deepEqual(await queries.createAvailabilityRequest({ jobRequestId: 1105, supplierId: 7, shareCustomerDetails: false, itemIds: [102] }),
    { id: 42, reopened: false })
  assert.deepEqual(rpcs, [['add_candidates_to_availability_request', { p_request_id: 42, p_candidate_ids: [52] }]])
  rpcs.length = 0
  // The default is already asked: the line is not asked again.
  tables.candidates[1].availability_request_id = 42
  await assert.rejects(queries.createAvailabilityRequest({ jobRequestId: 1105, supplierId: 7, shareCustomerDetails: false, itemIds: [102] }),
    /already asked of this supplier/)
  assert.deepEqual([rpcs, inserted], [[], []])
  tables.availability_requests[0].status = 'closed'
  await assert.rejects(queries.createAvailabilityRequest({ jobRequestId: 1105, supplierId: 7, shareCustomerDetails: false, itemIds: [102] }),
    /AR-42 with this supplier is closed/)
  assert.deepEqual(rpcs, [])
})

test('another supplier is asked a copy of the line\'s default (§7)', async () => {
  const { tables, rpcs, inserted, queries } = fixture()
  tables.suppliers[1].is_active = true
  Object.assign(tables.candidates[1], { description: '15 G Elm, single trunk', note_for_supplier: 'Matched pair' })
  assert.deepEqual(await queries.createAvailabilityRequest({ jobRequestId: 1105, supplierId: 8, shareCustomerDetails: false, itemIds: [102] }),
    { id: 99, reopened: false })
  assert.deepEqual(inserted, [{ supplier_id: 8, job_request_item_id: 102, name: 'Elm', size: '15 G',
    description: '15 G Elm, single trunk', is_original: true, note_for_supplier: 'Matched pair', unit_price: null }])
  assert.deepEqual(rpcs.find(([name]) => name === 'create_availability_request')?.[1].p_candidate_ids, [900])
})

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

test('an asked row with a substitute shows the substitute\'s answer; the substitute is no row of its own', async () => {
  const { tables, queries } = fixture()
  tables.availability_requests = [tables.availability_requests[0]]
  tables.candidates.push(
    // Asked, answered with a picked substitute: stored Unavailable.
    { id: 53, availability_request_id: 42, job_request_item_id: 103, supplier_id: 7, name: 'Maple', size: '30 G',
      demanded_quantity: 6, status: 'unavailable', available_quantity: 0, unit_price: 40, note_from_supplier: null,
      offered_candidate_id: 54, is_active: true },
    { id: 54, availability_request_id: 42, job_request_item_id: 103, supplier_id: 7, name: 'Maple', size: '15 G',
      description: '15 G Maple', demanded_quantity: 6, status: 'diff_size_sub', available_quantity: 6, unit_price: 18,
      note_from_supplier: '30 G NA, 15 G only', is_active: true },
    // Asked on the same request in its own right: answered on its own row, never a tag.
    { id: 55, availability_request_id: 42, job_request_item_id: 103, supplier_id: 7, name: 'Maple', size: '45 G',
      description: '45 G Maple', demanded_quantity: 6, status: null, unit_price: 70, is_active: true },
    { id: 56, availability_request_id: null, job_request_item_id: 103, supplier_id: 7, name: 'Maple', size: '65 G',
      description: '65 G Maple', unit_price: 90, is_active: true },
    // A typed substitute: a placeholder, unpriced until Rosie enriches it.
    { id: 57, availability_request_id: 42, job_request_item_id: 104, supplier_id: 7, name: 'Elm', size: '30 G',
      demanded_quantity: 2, status: 'unavailable', available_quantity: 0, unit_price: 25, note_from_supplier: null,
      offered_candidate_id: 58, offer_description: 'Lacebark Elm 30 G', is_active: true },
    { id: 58, availability_request_id: 42, job_request_item_id: 104, supplier_id: 7, name: 'Lacebark Elm 30 G',
      description: 'Lacebark Elm 30 G', demanded_quantity: 2, status: 'diff_size_sub', available_quantity: 2,
      unit_price: null, note_from_supplier: 'Lacebark Elm 30 G', is_active: true },
  )
  const detail = await queries.availabilityRequest(42)
  assert.deepEqual(detail.items.map((item: { id: number }) => item.id), [51, 53, 55, 57])
  const maple = detail.items[1]
  assert.deepEqual([maple.status, maple.availableQuantity, maple.unitPrice, maple.noteFromSupplier, maple.offeredCandidateId],
    ['diff_size_sub', 6, 18, '30 G NA, 15 G only', 54])
  assert.deepEqual(maple.alternatives.map((alt: { id: number }) => alt.id), [54, 56])
  const elm = detail.items[3]
  assert.deepEqual([elm.status, elm.availableQuantity, elm.unitPrice, elm.offerDescription], ['diff_size_sub', 2, null, 'Lacebark Elm 30 G'])
  assert.equal(detail.itemCount, 4)
  assert.equal(detail.answeredCount, 3)
  const [portal] = await queries.listPortalRequests(7)
  assert.deepEqual(portal.items.map((item: { status: string | null }) => item.status), ['can_order', 'diff_size_sub', null, 'diff_size_sub'])
  const lines = await queries.listPortalItemLines(7)
  assert.deepEqual(lines.map((line: { id: number; unitPrice: number | null }) => [line.id, line.unitPrice]), [[51, 20], [53, 18], [55, 70], [57, null]])
})

test('supplier event context follows the AR\'s job, including closed history and a deleted job', async () => {
  const { tables, queries } = fixture()
  tables.availability_requests[0].status = 'closed'
  assert.deepEqual(await queries.supplierAvailabilityEventContext(42, 7), {
    jobRequestId: 1105, supplierId: 7, supplierName: 'APS', threadId: 'jr-1105', availabilityRequestId: 42,
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
