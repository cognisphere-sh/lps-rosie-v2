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
      created_at: '2026-09-15T02:00:00Z', submitted_at: null, lps_notes: null }],
    availability_request_jobs: [
      { availability_request_id: 42, job_request_id: 11 },
      { availability_request_id: 42, job_request_id: 22 },
    ],
    suppliers: [{ id: 7, name: 'APS', is_active: true }],
    job_requests: [
      { id: 11, name: 'Courtyard', expected_install_date: '2026-09-20', fulfillment_method: 'pickup',
        customer_id: 91, shipping_address: 'Private address', shipping_city: 'Austin', shipping_state: 'TX', shipping_zip: '78701' },
      { id: 22, name: 'Pool garden', expected_install_date: '2026-09-26', fulfillment_method: 'delivery',
        customer_id: 92, shipping_address: 'Other private address' },
    ],
    customers: [{ id: 91, name: 'Private customer', company: 'Private company', email: 'private@example.com', phone: null }],
    availability_request_items: [],
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
    'server-only': {}, '@/lib/supabase': { supabase }, '@/lib/partner-display': {}, '@/lib/availability-allocations': {},
  }
  new Function('require', 'module', 'exports', outputText)((name: string) => name in mocks ? mocks[name] : require(name), module, module.exports)
  return { tables, queries: module.exports }
}

test('combined requests preserve each job schedule while supplier/public schedules omit job identities', async () => {
  const { queries } = fixture()
  const admin = await queries.availabilityRequest(42)
  assert.deepEqual(admin.jobSchedules, [
    { jobRequestId: 11, jobName: 'Courtyard', expectedInstallDate: '2026-09-20', fulfillmentMethod: 'pickup' },
    { jobRequestId: 22, jobName: 'Pool garden', expectedInstallDate: '2026-09-26', fulfillmentMethod: 'delivery' },
  ])
  const safeSchedules = [
    { expectedInstallDate: '2026-09-20', fulfillmentMethod: 'pickup' },
    { expectedInstallDate: '2026-09-26', fulfillmentMethod: 'delivery' },
  ]
  const supplier = await queries.availabilityRequest(42, { forSupplierId: 7 })
  const publicRequest = await queries.publicAvailabilityRequest(token)
  const [portal] = await queries.listPortalRequests(7)
  for (const request of [supplier, publicRequest, portal]) {
    assert.deepEqual(request.jobSchedules, safeSchedules)
    assert.equal(request.customer, null, 'A combined request cannot expose one source customer as the customer for all jobs')
    assert.equal(request.shipping, null)
  }
  assert.equal(await queries.availabilityRequest(42, { forSupplierId: 99 }), null)
})

test('schedule metadata keeps missing values and obeys existing single-job customer disclosure', async () => {
  const { tables, queries } = fixture()
  tables.availability_request_jobs.pop()
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

test('supplier header uses MM-DD creation dates and keeps combined dates paired with fulfillment', async () => {
  const { queries } = fixture()
  const request: ARDetail = await queries.availabilityRequest(42, { forSupplierId: 7 })
  const html = renderToStaticMarkup(<AvailabilityRequestView request={request} loading={false} error="" saving={false}
    onPatch={async () => {}} onSubmit={async () => {}} />)
  const dom = new JSDOM(html)
  try {
    const header = dom.window.document.querySelector('header')!
    assert.ok(header.querySelector('h1'))
    assert.match(header.textContent ?? '', /Created on 09-14/)
    const schedules = dom.window.document.querySelector('[aria-label="Job schedules"]')!
    assert.equal(schedules.parentElement, header, 'Schedule metadata is part of the title header row')
    assert.equal(schedules.children.length, 2)
    assert.equal(schedules.children[0].textContent, 'Job 1EDD09-20FulfillmentPickup')
    assert.equal(schedules.children[1].textContent, 'Job 2EDD09-26FulfillmentDelivery')
    assert.doesNotMatch(schedules.textContent ?? '', /JR-|Courtyard|Pool garden|Private/)
  } finally {
    dom.window.close()
  }
})

test('single-job supplier headers keep Created on, EDD and fulfillment with the request title', async () => {
  const { tables, queries } = fixture()
  tables.availability_request_jobs.pop()
  const request: ARDetail = await queries.availabilityRequest(42, { forSupplierId: 7 })
  const html = renderToStaticMarkup(<AvailabilityRequestView request={request} loading={false} error="" saving={false}
    onPatch={async () => {}} onSubmit={async () => {}} />)
  const dom = new JSDOM(html)
  try {
    const header = dom.window.document.querySelector('header')!
    assert.equal(header.querySelector('h1')?.textContent, 'Courtyard')
    assert.match(header.textContent ?? '', /Created on 09-14EDD09-20FulfillmentPickup/)
    const schedules = dom.window.document.querySelector('[aria-label="Job schedules"]')!
    assert.equal(schedules.parentElement, header)
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
    assert.equal(rows[0].textContent, 'CourtyardEDD09-20FulfillmentPickup')
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
