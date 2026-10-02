import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'

const require = createRequire(import.meta.url)
function load(file: string, mocks: Record<string, unknown>) {
  const { outputText } = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  })
  const module = { exports: {} as Record<string, (...args: any[]) => Promise<any>> }
  new Function('require', 'module', 'exports', outputText)((name: string) => name in mocks ? mocks[name] : require(name), module, module.exports)
  return module.exports
}

test('the admin AR endpoint has no DELETE handler or deletion query', () => {
  const queries = load('./availability-queries.ts', {
    'server-only': {}, '@/lib/partner-display': {}, '@/lib/supabase': { supabase: {} },
  })
  const route = load('../app/api/availability-requests/[id]/route.ts', {
    'next/server': { NextResponse: Response }, '@/lib/availability-queries': queries,
    '@/lib/notify-supplier-events': {},
  })
  assert.equal(route.DELETE, undefined)
  assert.equal(queries.deleteAvailabilityRequest, undefined)
})

test('the app gate rejects partner deletion of an admin AR endpoint', async () => {
  const { default: proxy } = load('../proxy.ts', {
    'next/server': { NextResponse: Response },
    '@/lib/session': { resolveUser: async () => ({ role: 'partner', supplierId: 7 }) },
  })
  const response = await proxy({ nextUrl: new URL('https://lps.example/api/availability-requests/42'), headers: new Headers(), method: 'DELETE' })
  assert.equal(response.status, 403)
})

test('Draft publishes through the validated send RPC; withdrawal preserves the AR', async () => {
  let status = 'draft'
  const calls: unknown[][] = []
  const writes: Record<string, unknown>[] = []
  let values: Record<string, unknown>
  let excluded: unknown
  const chain = {
    update: (next: Record<string, unknown>) => { values = next; excluded = undefined; return chain },
    eq: () => chain,
    neq: (_key: string, next: unknown) => { excluded = next; return chain },
    select: () => values ? Promise.resolve({ data: status === excluded ? [] : (writes.push(values), status = String(values.status), [{ id: 64 }]), error: null }) : chain,
    maybeSingle: async () => ({ data: { status }, error: null }),
  }
  const queries = load('./availability-queries.ts', {
    'server-only': {}, '@/lib/partner-display': {},
    '@/lib/supabase': { supabase: {
      from: () => chain,
      rpc: async (...args: unknown[]) => { calls.push(args); status = 'new'; return { error: null } },
    } },
  })
  await queries.setAvailabilityRequestStatus(64, 'submitted').then(() => assert.fail('Draft bypassed Publish'), error => assert.match(error.message, /not found/))
  values = undefined as any
  await queries.setAvailabilityRequestStatus(64, 'new')
  assert.deepEqual(calls, [['send_availability_request', { p_request_id: 64 }]])
  assert.deepEqual(writes, [])
  await queries.setAvailabilityRequestStatus(64, 'draft')
  assert.deepEqual(writes, [{ status: 'draft', submitted_at: null }])
  await assert.rejects(queries.setAvailabilityRequestStatus(64, 'hidden'), /status must be/)
})
