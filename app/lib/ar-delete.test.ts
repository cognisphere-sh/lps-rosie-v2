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

test('AR deletion writes only is_active, is repeatable, and validates route IDs without notifications', async () => {
  const writes: Array<{ values: Record<string, unknown>; id: unknown }> = []
  const queries = load('./availability-queries.ts', {
    'server-only': {}, '@/lib/availability-allocations': {}, '@/lib/partner-display': {},
    '@/lib/supabase': { supabase: { from: (table: string) => {
      assert.equal(table, 'availability_requests')
      let id: unknown
      let values: Record<string, unknown>
      const query = {
        update: (next: Record<string, unknown>) => { values = next; return query },
        eq: (column: string, value: unknown) => { assert.equal(column, 'id'); id = value; return query },
        select: async () => { writes.push({ values, id }); return { data: id === 42 ? [{ id }] : [], error: null } },
      }
      return query
    } } },
  })
  const { DELETE } = load('../app/api/availability-requests/[id]/route.ts', {
    'next/server': { NextResponse: Response }, '@/lib/availability-queries': queries,
    '@/lib/notify-supplier-events': { notifySupplierEvent: () => { throw new Error('Deletion is not supplier submission') } },
  })
  const remove = (id: string) => DELETE(new Request(`https://lps.example/api/availability-requests/${id}`, { method: 'DELETE' }),
    { params: Promise.resolve({ id }) })
  assert.equal((await remove('42')).status, 200)
  assert.equal((await remove('42')).status, 200)
  assert.deepEqual(writes, [{ values: { is_active: false }, id: 42 }, { values: { is_active: false }, id: 42 }])
  assert.equal((await remove('99')).status, 404)
  for (const id of ['0', '-1', '1.5', '42suffix', '9007199254740992']) assert.equal((await remove(id)).status, 400)
  await assert.rejects(queries.setAvailabilityRequestStatus(42, 'hidden'), /status must be/)
  assert.equal(writes.length, 3)
})

test('the app gate rejects partner deletion of an admin AR endpoint', async () => {
  const { default: proxy } = load('../proxy.ts', {
    'next/server': { NextResponse: Response },
    '@/lib/session': { resolveUser: async () => ({ role: 'partner', supplierId: 7 }) },
  })
  const response = await proxy({ nextUrl: new URL('https://lps.example/api/availability-requests/42'), headers: new Headers(), method: 'DELETE' })
  assert.equal(response.status, 403)
})
