import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { JSDOM } from 'jsdom'
import ts from 'typescript'

import { ARJobSchedules } from '../components/workspace/ar-job-schedules'
import { AvailabilityRequestView } from '../components/workspace/availability-request-view'
import type { ARDetail } from './availability'

const token = '00000000-0000-4000-8000-000000000042'
const require = createRequire(import.meta.url)

function fixture() {
  const tables: Record<string, Record<string, unknown>[]> = {
    availability_requests: [{ id: 42, job_request_id: 11, supplier_id: 7, status: 'new',
      public_token: token, is_active: true, share_customer_details: true,
      created_at: '2026-09-15T02:00:00Z', submitted_at: null, note_for_supplier: null }],
    suppliers: [{ id: 7, name: 'APS', is_active: true }],
    job_requests: [
      { id: 11, name: 'Courtyard', expected_install_date: '2026-09-20', fulfillment_method: 'pickup',
        customer_id: 91, shipping_address: 'Private address', shipping_city: 'Austin', shipping_state: 'TX', shipping_zip: '78701' },
      { id: 22, name: 'Pool garden', expected_install_date: '2026-09-26', fulfillment_method: 'delivery',
        customer_id: 92, shipping_address: 'Other private address' },
    ],
    customers: [{ id: 91, name: 'Private customer', company: 'Private company', email: 'private@example.com', phone: null }],
    candidates: [],
  }
  const supabase = { from(table: string) {
    let rows = [...(tables[table] ?? [])]
    let columns = '*'
    const selected = () => rows.map((row) => columns === '*' ? row : Object.fromEntries(
      columns.split(',').map((column) => [column.trim(), row[column.trim()]]),
    ))
    const query = {
      select: (value: string) => { columns = value; return query },
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
      maybeSingle: async () => ({ data: selected()[0] ?? null, error: null }),
      range: async (from: number, to: number) => ({ data: selected().slice(from, to + 1), error: null }),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve(resolve({ data: selected().slice(0, 1000), error: null })),
    }
    return query
  } }
  const { outputText } = ts.transpileModule(readFileSync(new URL('./availability-queries.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  })
  const module = { exports: {} as Record<string, (...args: any[]) => Promise<any>> }
  const mocks: Record<string, unknown> = {
    'server-only': {}, '@/lib/supabase': { supabase }, '@/lib/partner-display': {},
  }
  new Function('require', 'module', 'exports', outputText)((name: string) => name in mocks ? mocks[name] : require(name), module, module.exports)
  return { tables, queries: module.exports }
}

test('admins see the AR\'s job identity in its schedule; supplier and public schedules omit it', async () => {
  const { tables, queries } = fixture()
  tables.availability_requests[0].share_customer_details = false
  const admin = await queries.availabilityRequest(42)
  assert.deepEqual(admin.jobSchedules, [
    { jobRequestId: 11, jobName: 'Courtyard', expectedInstallDate: '2026-09-20', fulfillmentMethod: 'pickup' },
  ])
  const supplier = await queries.availabilityRequest(42, { forSupplierId: 7 })
  const publicRequest = await queries.publicAvailabilityRequest(token)
  const [portal] = await queries.listPortalRequests(7)
  for (const request of [supplier, publicRequest, portal]) {
    assert.deepEqual(request.jobSchedules, [{ expectedInstallDate: '2026-09-20', fulfillmentMethod: 'pickup' }])
    assert.equal(request.customer, null, 'Customer details stay private unless shared')
    assert.equal(request.shipping, null)
  }
  assert.equal(await queries.availabilityRequest(42, { forSupplierId: 99 }), null)
})

test('schedule metadata keeps missing values and obeys existing single-job customer disclosure', async () => {
  const { tables, queries } = fixture()
  tables.job_requests[0].expected_install_date = null
  tables.job_requests[0].fulfillment_method = null
  tables.availability_requests[0].share_customer_details = false
  let request = await queries.availabilityRequest(42, { forSupplierId: 7 })
  assert.deepEqual(request.jobSchedules, [{ expectedInstallDate: null, fulfillmentMethod: null }])
  assert.equal(request.customer, null)
  assert.equal(request.shipping, null)
  tables.availability_requests[0].share_customer_details = true
  request = await queries.availabilityRequest(42, { forSupplierId: 7 })
  assert.equal(request.customer.name, 'Private customer')
  assert.equal(request.shipping.address, 'Private address')
  assert.equal(request.jobSchedules[0].jobRequestId, undefined)
  assert.equal(request.jobSchedules[0].jobName, undefined)
})

test('single-job supplier headers keep fulfillment date and mode with the job title', async () => {
  const { queries } = fixture()
  const request: ARDetail = await queries.availabilityRequest(42, { forSupplierId: 7 })
  const html = renderToStaticMarkup(<AvailabilityRequestView request={request} loading={false} error="" saving={false}
    onPatch={async () => {}} onSubmit={async () => true} />)
  const dom = new JSDOM(html)
  try {
    const header = dom.window.document.querySelector('header')!
    assert.equal(header.querySelector('h1')?.textContent, 'Courtyard')
    assert.match(header.textContent ?? '', /PickupSun, 09\/20/)
    const schedules = dom.window.document.querySelector('[aria-label="Job schedules"]')!
    assert.equal(schedules.closest('header'), header)
    assert.equal(schedules.children.length, 1)
    assert.doesNotMatch(schedules.textContent ?? '', /Job 1|Expected install date/)
  } finally {
    dom.window.close()
  }
})

test('admin schedules identify each source job and render missing dates/methods as missing', () => {
  const html = renderToStaticMarkup(<ARJobSchedules showJobNames schedules={[
    { jobRequestId: 11, jobName: 'Courtyard', expectedInstallDate: '2026-09-20', fulfillmentMethod: 'pickup' },
    { jobRequestId: 22, jobName: null, expectedInstallDate: null, fulfillmentMethod: null },
  ]} />)
  const dom = new JSDOM(html)
  try {
    const rows = dom.window.document.querySelector('[aria-label="Job schedules"]')!.children
    assert.equal(rows[0].textContent, 'CourtyardEDDSun, 09/20FulfillmentPickup')
    assert.equal(rows[1].textContent, 'JR-22EDD—Fulfillment—')
    const safeHtml = renderToStaticMarkup(<ARJobSchedules schedules={[
      { jobRequestId: 11, jobName: 'Private job', expectedInstallDate: '2026-09-20', fulfillmentMethod: 'pickup' },
      { expectedInstallDate: null, fulfillmentMethod: null },
    ]} />)
    assert.doesNotMatch(safeHtml, /Private job|JR-11/)
  } finally {
    dom.window.close()
  }
})


test('deleted requests disappear from admin and supplier reads while retaining their status and token', async () => {
  const { tables, queries } = fixture()
  tables.availability_requests[0].is_active = false
  assert.equal(await queries.availabilityRequest(42), null)
  assert.deepEqual(await queries.listAvailabilityRequests({ jobRequestId: 11 }), [])
  assert.equal(await queries.availabilityRequest(42, { forSupplierId: 7 }), null)
  assert.equal(await queries.publicAvailabilityRequest(token), null)
  assert.deepEqual(await queries.listPortalRequests(7), [])
  assert.deepEqual(await queries.listPortalItemLines(7), [])
  assert.equal(tables.availability_requests[0].status, 'new')
  assert.equal(tables.availability_requests[0].public_token, token)
  tables.availability_requests[0].is_active = true
  assert.equal((await queries.availabilityRequest(42, { forSupplierId: 7 })).status, 'new')
  assert.equal((await queries.listPortalRequests(7)).length, 1)
})

for (const shared of [false, true]) {
  test(`AR customer details render directly only when shared (${shared})`, () => {
    const request = {
      id: 42, status: 'new', items: [], shareCustomerDetails: shared,
      customer: { name: 'Shared Customer', company: 'Garden Co', phone: '555-0100', email: 'customer@example.com' },
      shipping: { address: '12 Garden Lane', city: 'Austin', state: 'TX', zip: '78701' },
      noteForSupplier: 'Keep shaded',
    } as unknown as ARDetail
    const html = renderToStaticMarkup(<AvailabilityRequestView request={request} loading={false} error="" saving={false} onPatch={async () => {}} onSubmit={async () => true} />)
    const dom = new JSDOM(html)
    try {
      const header = dom.window.document.querySelector('[aria-label="Job details"]')!
      assert.equal(header.textContent?.includes('Shared Customer'), shared)
      assert.equal(header.textContent?.includes('12 Garden Lane'), shared)
      assert.equal(header.querySelector('a[href="mailto:customer@example.com"]') != null, shared)
      assert.equal((dom.window.document.querySelector('textarea[aria-label="Note for this request"]') as HTMLTextAreaElement).value, 'Keep shaded')
      assert.equal(header.querySelector('button[aria-expanded]'), null)
    } finally { dom.window.close() }
  })
}
