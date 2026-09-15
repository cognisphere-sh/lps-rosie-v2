import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import ts from 'typescript'

const require = createRequire(import.meta.url)

test('shared requests appear on every source job, including associations beyond the row cap', async () => {
  const links = Array.from({ length: 1105 }, (_, i) => ({ availability_request_id: 42, job_request_id: i + 1 }))
  const tables: Record<string, Record<string, unknown>[]> = {
    availability_request_jobs: links,
    availability_requests: [{ id: 42, job_request_id: 1, supplier_id: 7, status: 'submitted', is_active: true,
      created_at: '2026-09-14T12:00:00Z', submitted_at: '2026-09-15T12:00:00Z' }],
    suppliers: [{ id: 7, name: 'APS', is_lps_partner: true, rosie_thread_id: 'supplier-7' }],
    job_requests: links.map((link) => ({ id: link.job_request_id, name: `Job ${link.job_request_id}` })),
    availability_request_items: [{ availability_request_id: 42, status: 'can_order', is_active: true }],
  }
  const supabase = { from(table: string) {
    let rows = [...(tables[table] ?? [])]
    const query = {
      select: () => query,
      in: (column: string, values: unknown[]) => { rows = rows.filter((row) => values.includes(row[column])); return query },
      eq: (column: string, value: unknown) => { rows = rows.filter((row) => row[column] === value); return query },
      order: () => query,
      limit: () => query,
      range: async (from: number, to: number) => ({ data: rows.slice(from, to + 1), error: null }),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve(resolve({ data: rows.slice(0, 1000), error: null })),
    }
    return query
  } }
  const { outputText } = ts.transpileModule(readFileSync(new URL('./availability-queries.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  })
  const module = { exports: {} as Record<string, (...args: any[]) => Promise<any>> }
  const mocks: Record<string, unknown> = { 'server-only': {}, '@/lib/supabase': { supabase }, '@/lib/partner-display': {}, '@/lib/availability-allocations': {} }
  new Function('require', 'module', 'exports', outputText)((name: string) => name in mocks ? mocks[name] : require(name), module, module.exports)
  const suppliers = await module.exports.supplierLinksByRequest(links.map((link) => link.job_request_id))
  assert.equal(Object.keys(suppliers).length, 1105)
  assert.deepEqual(suppliers[1105][0].availabilityRequests, [{ id: 42, status: 'submitted',
    createdAt: '2026-09-14T12:00:00Z', submittedAt: '2026-09-15T12:00:00Z' }])
  const requests = await module.exports.listAvailabilityRequests({ jobRequestId: 1105 })
  assert.equal(requests.length, 1, 'A non-primary source job finds the combined request')
  assert.equal(requests[0].jobRequestIds.length, 1105, 'Disclosure must not mistake a truncated job list for a single job')
  assert.equal(requests[0].jobRequestIds.at(-1), 1105)
  assert.ok(requests[0].jobName.endsWith('Job 1105'))
})
