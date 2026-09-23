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

test('partner sharing requires access and scopes writes to the authorized supplier', async () => {
  let allowed = false
  const writes: unknown[][] = []
  const { PATCH } = load('../app/api/partner/[id]/requests/[arId]/route.ts', {
    'next/server': { NextResponse: Response },
    '@/lib/notify-supplier-events': { notifySupplierEvent: async () => {} },
    '@/lib/partner-auth': { requirePartnerAccess: async () => allowed
      ? { ok: true, supplierId: 7 }
      : { ok: false, res: Response.json({ error: 'unauthorized' }, { status: 401 }) } },
    '@/lib/availability-queries': {
      partnerSupplier: async () => ({ id: 7 }),
      setAvailabilityRequestPublic: async (...args: unknown[]) => { writes.push(args); return 'token' },
    },
  })
  const patch = (body: object) => PATCH(new Request('https://lps.example/api/partner/7/requests/11', {
    method: 'PATCH', body: JSON.stringify(body),
  }), { params: Promise.resolve({ id: '7', arId: '11' }) })
  assert.equal((await patch({ isPublic: true })).status, 401)
  assert.equal(writes.length, 0)
  allowed = true
  assert.equal((await patch({ isPublic: 'true' })).status, 400)
  assert.equal(writes.length, 0)
  assert.equal((await patch({ isPublic: true })).status, 200)
  assert.deepEqual(writes, [[11, true, 7]])
})

test('sharing database write cannot change another supplier request', async () => {
  let token: string | null = null
  let status = 'new'
  let active = true
  const filters: Record<string, unknown> = {}
  let values: { public_token: string | null }
  const chain = {
    update: (next: typeof values) => { values = next; return chain },
    eq: (key: string, value: unknown) => { filters[key] = value; return chain },
    select: () => chain,
    maybeSingle: async () => ({ data: active ? { id: 11, supplier_id: 7, status } : null, error: null }),
    single: async () => {
      if (filters.supplier_id !== 7) return { data: null, error: { message: 'not found' } }
      token = values.public_token
      return { data: { public_token: token }, error: null }
    },
  }
  const { setAvailabilityRequestPublic } = load('./availability-queries.ts', {
    'server-only': {},
    '@/lib/availability': {},
    '@/lib/partner-display': {},
    '@/lib/supabase': { supabase: { from: () => chain } },
  })
  await assert.rejects(setAvailabilityRequestPublic(11, true, 9), /not found/)
  assert.equal(token, null)
  const published = await setAvailabilityRequestPublic(11, true, 7)
  assert.match(published, /^[0-9a-f-]{36}$/)
  assert.equal(filters.id, 11)
  assert.equal(filters.is_active, true)
  await setAvailabilityRequestPublic(11, false, 7)
  assert.equal(token, null)
  active = false
  await assert.rejects(setAvailabilityRequestPublic(11, true, 7), /not found/)
  assert.equal(token, null)
  active = true
  status = 'closed'
  await assert.rejects(setAvailabilityRequestPublic(11, true, 7), /closed/)
  assert.equal(token, null)
})
