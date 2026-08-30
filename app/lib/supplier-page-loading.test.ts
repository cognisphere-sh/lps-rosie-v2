import assert from 'node:assert/strict'
import test from 'node:test'

import { appendSupplierPage, fetchSupplierPage } from './supplier-page-loading.ts'
import type { SupplierCompany } from './rows.ts'

const company = (id: number) => ({ id } as SupplierCompany)

test('bounded Supplier page fetch rejects HTTP and network failures without producing fallback data', async () => {
  await assert.rejects(
    fetchSupplierPage('/api/suppliers?page=2', async () => new Response('{"companies":[]}', { status: 503 })),
    /failed \(503\)/,
  )
  await assert.rejects(
    fetchSupplierPage('/api/suppliers?page=2', async () => { throw new TypeError('offline') }),
    /offline/,
  )
})

test('a failed next-page attempt retries the same bounded page before commit', async () => {
  let committedPage = 1
  const requested: string[] = []
  let fail = true
  const attempt = async () => {
    const nextPage = committedPage + 1
    const url = `/api/suppliers?page=${nextPage}`
    requested.push(url)
    const body = await fetchSupplierPage(url, async () => {
      if (fail) return new Response('unavailable', { status: 502 })
      return Response.json({ companies: [company(51)], total: 75, pageCount: 2 })
    })
    committedPage = nextPage
    return body
  }

  await assert.rejects(attempt(), /failed \(502\)/)
  assert.equal(committedPage, 1)
  fail = false
  const body = await attempt()
  assert.equal(committedPage, 2)
  assert.deepEqual(requested, ['/api/suppliers?page=2', '/api/suppliers?page=2'])
  assert.equal(body.total, 75)
})

test('appending a retried page preserves revealed companies and replaces duplicate ids', () => {
  assert.deepEqual(
    appendSupplierPage([company(1), company(2)], [company(2), company(3)]).map(({ id }) => id),
    [1, 2, 3],
  )
})
