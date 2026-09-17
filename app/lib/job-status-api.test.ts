import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import ts from 'typescript'

import * as jobStatuses from './job-requests.ts'

const require = createRequire(import.meta.url)

function load(file: string, mocks: Record<string, unknown>) {
  const { outputText } = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  })
  const module = { exports: {} as Record<string, (...args: any[]) => Promise<any>> }
  new Function('require', 'module', 'exports', outputText)(
    (name: string) => name in mocks ? mocks[name] : require(name), module, module.exports,
  )
  return module.exports
}

test('legacy Confirmed request-list filters select Committed without widening or changing item filters', async () => {
  let filters: Record<string, unknown> = {}
  const { GET } = load('../app/api/requests/route.ts', {
    '@/lib/job-requests': jobStatuses,
    '@/lib/job-request-queries': { listJobRequests: async (_query: string, value: Record<string, unknown>) => {
      filters = value
      return { requests: [], total: 0, pageCount: 1 }
    } },
  })
  const empty = await GET(new Request('http://localhost/api/requests?status=none'))
  assert.equal(empty.status, 200)
  assert.deepEqual(filters.status, [])
  await GET(new Request('http://localhost/api/requests?itemStatus=none'))
  assert.deepEqual(filters.itemStatus, [])
  let result = await GET(new Request('http://localhost/api/requests?status=confirmed&itemStatus=pending'))
  assert.equal(result.status, 200)
  assert.deepEqual(filters.status, ['committed'])
  assert.deepEqual(filters.itemStatus, ['pending'])
  result = await GET(new Request('http://localhost/api/requests?status=confirmed,committed,availability,closed_won'))
  assert.equal(result.status, 200)
  assert.deepEqual(filters.status, ['committed', 'availability', 'closed_won'])
})

test('single and multi-field job-status writes reject Confirmed before a database mutation', async () => {
  const writes: { table: string; values: Record<string, unknown>; id: unknown }[] = []
  const queries = load('./queries.ts', {
    'server-only': {}, '@/lib/columns': { SUPPLIER_CATEGORIES: [] }, '@/lib/customers': { CUSTOMER_TYPES: [] },
    '@/lib/job-requests': jobStatuses, '@/lib/server-filters': {},
    '@/lib/supabase': { supabase: { from: (table: string) => ({ update: (values: Record<string, unknown>) => ({
      eq: async (_column: string, id: unknown) => { writes.push({ table, values, id }); return { error: null } },
    }) }) } },
  })
  const { PATCH } = load('../app/api/rows/route.ts', { '@/lib/queries': queries })
  const patch = (fields: Record<string, unknown>) => PATCH(new Request('http://localhost/api/rows', {
    method: 'PATCH', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ table: 'job_requests', id: 19, ...fields }),
  }))
  for (const fields of [{ column: 'status', value: 'confirmed' }, { changes: { status: 'confirmed', sourcing_notes: 'Should not save' } }]) {
    const result = await patch(fields)
    assert.equal(result.status, 400)
    const body = await result.json()
    assert.match(body.error, /status must be one of/)
    assert.doesNotMatch(body.error, /confirmed/)
  }
  assert.deepEqual(writes, [])
  assert.equal((await patch({ column: 'status', value: 'committed' })).status, 200)
  assert.deepEqual(writes, [{ table: 'job_requests', values: { status: 'committed' }, id: 19 }])
})
