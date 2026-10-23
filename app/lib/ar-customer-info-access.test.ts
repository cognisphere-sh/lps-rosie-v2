import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'

const require = createRequire(import.meta.url)
function load(file: string, mocks: Record<string, unknown>) {
  const source = readFileSync(new URL(file, import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } })
  const module = { exports: {} as Record<string, (...args: any[]) => Promise<any>> }
  new Function('require', 'module', 'exports', outputText)((name: string) => name in mocks ? mocks[name] : require(name), module, module.exports)
  return module.exports
}

test('existing admin disclosure PATCH validates boolean, targets only CI and preserves Closed refusal', async () => {
  const writes: unknown[][] = []
  let closed = false
  const { PATCH } = load('../app/api/availability-requests/[id]/route.ts', {
    'next/server': { NextResponse: Response },
    '@/lib/notify-supplier-events': { notifySupplierEvent: async () => {} },
    '@/lib/availability-queries': {
      setAvailabilityRequestShareCustomerDetails: async (...args: unknown[]) => { if (closed) throw new Error('request closed'); writes.push(args) },
      supplierAvailabilityEventContext: async () => ({}),
      setAvailabilityRequestPublic: () => { throw new Error('must never publish') },
      setAvailabilityRequestStatus: () => { throw new Error('must never submit or reopen') },
    },
  })
  const patch = (body: object) => PATCH(new Request('https://example.test/api/availability-requests/84', { method: 'PATCH', body: JSON.stringify(body) }), { params: Promise.resolve({ id: '84' }) })
  assert.equal((await patch({ shareCustomerDetails: 'true' })).status, 400)
  assert.equal((await patch({ shareCustomerDetails: true })).status, 200)
  assert.equal((await patch({ shareCustomerDetails: false })).status, 200)
  assert.deepEqual(writes, [[84, true], [84, false]])
  closed = true
  assert.equal((await patch({ shareCustomerDetails: true })).status, 409)
  assert.equal(writes.length, 2)
})

test('existing setter is one flag on one non-Closed AR, with no defaults/publication/status writes', async () => {
  let values: unknown
  const filters: unknown[][] = []
  let exists = true
  const chain = {
    update: (next: unknown) => { values = next; return chain },
    eq: (...args: unknown[]) => { filters.push(['eq', ...args]); return chain },
    neq: (...args: unknown[]) => { filters.push(['neq', ...args]); return chain },
    select: async () => ({ data: exists ? [{ id: 84 }] : [], error: null }),
  }
  const { setAvailabilityRequestShareCustomerDetails } = load('./availability-queries.ts', {
    'server-only': {}, '@/lib/availability': {}, '@/lib/partner-display': {},
    '@/lib/supabase': { supabase: { from: (table: string) => { assert.equal(table, 'availability_requests'); return chain } } },
  })
  await setAvailabilityRequestShareCustomerDetails(84, true)
  assert.deepEqual(values, { share_customer_details: true })
  assert.deepEqual(filters, [['eq', 'id', 84], ['neq', 'status', 'closed']])
  exists = false
  await assert.rejects(setAvailabilityRequestShareCustomerDetails(84, false), /not found or closed/)
})

test('existing coarse admin gate rejects signed-out/partner callers, and partner PATCH does not offer a CI writer', async () => {
  let user: { role: string; supplierId?: number } | null = null
  const { default: proxy } = load('../proxy.ts', {
    'next/server': { NextResponse: { next: () => Response.json({ ok: true }), json: Response.json } },
    '@/lib/session': { resolveUser: async () => user }, '@/lib/login-return': {},
  })
  const req = { nextUrl: new URL('https://example.test/api/availability-requests/84'), headers: new Headers() }
  assert.equal((await proxy(req)).status, 401)
  user = { role: 'partner', supplierId: 7 }
  assert.equal((await proxy(req)).status, 403)
  user = { role: 'admin' }
  assert.equal((await proxy(req)).status, 200)
  const { PATCH } = load('../app/api/partner/[id]/requests/[arId]/route.ts', {
    'next/server': { NextResponse: Response },
    '@/lib/partner-auth': { requirePartnerAccess: async () => ({ ok: true, supplierId: 7 }) },
    '@/lib/availability-queries': { partnerSupplier: async () => ({ id: 7 }) },
    '@/lib/notify-supplier-events': {},
  })
  const response = await PATCH(new Request('https://example.test/api/partner/7/requests/84', { method: 'PATCH', body: JSON.stringify({ shareCustomerDetails: true }) }), { params: Promise.resolve({ id: '7', arId: '84' }) })
  assert.equal(response.status, 400)
})
