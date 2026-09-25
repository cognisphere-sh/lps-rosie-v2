import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

import { orderJobInbox, type JobInboxViewRow } from './job-inbox.ts'
import { ACTIVE_JOB_STATUSES } from './job-requests.ts'

type Row = Record<string, unknown>
type Filter = { column: string; values: unknown[] }
interface QueryCall {
  table: string
  columns: string[]
  filters: Filter[]
  range: [number, number] | null
}

const request = (id: number, overrides: Row = {}): Row => ({
  id, customer_id: null, name: `Project ${id}`, status: 'quoted', is_active: true,
  note_for_customer: null, note_internal: null,
  created_at: '2026-09-01T12:00:00Z', expected_install_date: null, updated_at: null, ...overrides,
})
const item = (id: number, jobId: number, overrides: Row = {}): Row => ({
  id, job_request_id: jobId, name: `Plant ${id}`, size: null, is_active: true,
  note_for_customer: null, note_internal: null, ...overrides,
})

/** Executes the actual query module with server-only/database boundaries replaced. */
function inbox(tables: Record<string, Row[]>, fail?: (query: QueryCall) => boolean) {
  const calls: QueryCall[] = []
  const supabase = { from(table: string) {
    assert.ok(['job_requests', 'job_request_items', 'customers', 'threads'].includes(table),
      `Unexpected table read: ${table}`)
    const call: QueryCall = { table, columns: [], filters: [], range: null }
    let order: { column: string; ascending: boolean } | null = null
    const query = {
      select(columns: string) { call.columns = columns.split(',').map((column) => column.trim()); return query },
      eq(column: string, value: unknown) { call.filters.push({ column, values: [value] }); return query },
      is(column: string, value: unknown) { call.filters.push({ column, values: [value] }); return query },
      in(column: string, values: unknown[]) { call.filters.push({ column, values }); return query },
      order(column: string, options: { ascending: boolean }) { order = { column, ...options }; return query },
      range(from: number, to: number) { call.range = [from, to]; return query },
      then(resolve: (result: { data: Row[] | null; error: { message: string } | null }) => unknown) {
        calls.push(call)
        if (fail?.(call)) return Promise.resolve(resolve({ data: null, error: { message: 'page unavailable' } }))
        let rows = [...(tables[table] ?? [])].filter((row) =>
          call.filters.every((filter) => filter.values.includes(row[filter.column])))
        if (order) {
          const { column, ascending } = order
          rows.sort((a, b) => (Number(a[column]) - Number(b[column])) * (ascending ? 1 : -1))
        }
        if (call.range) rows = rows.slice(call.range[0], call.range[1] + 1)
        // Simulate PostgREST's response cap and projection, including on unpaged calls.
        rows = rows.slice(0, 1000).map((row) => Object.fromEntries(call.columns.map((column) => [column, row[column]])))
        return Promise.resolve(resolve({ data: rows, error: null }))
      },
    }
    return query
  } }
  const { outputText } = ts.transpileModule(readFileSync(new URL('./job-inbox-queries.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  })
  const module = { exports: {} as {
    listJobInbox: () => Promise<JobInboxViewRow[]>
    JobInboxCapacityError: new () => Error
  } }
  const mocks: Record<string, unknown> = {
    'server-only': {}, '@/lib/supabase': { supabase },
    '@/lib/job-inbox': { orderJobInbox }, '@/lib/job-requests': { ACTIVE_JOB_STATUSES },
  }
  new Function('require', 'module', 'exports', outputText)((name: string) => {
    assert.ok(name in mocks, `Unexpected import: ${name}`)
    return mocks[name]
  }, module, module.exports)
  return { ...module.exports, calls }
}

test('search corpus includes active job/customer/item fields and preserves saved dates without chat or excluded work', async () => {
  const source = inbox({
    job_requests: [
      request(1, { customer_id: 7, name: 'Courtyard', expected_install_date: '2026-10-03',
        note_for_customer: "Job timing\n\nJob offer", note_internal: 'Job APS' }),
      request(2, { status: 'committed' }),
      request(3, { status: 'closed_won', name: 'Closed won secret' }),
      request(4, { status: 'closed_lost', name: 'Closed lost secret' }),
      request(5, { status: 'archived', name: 'Archived secret' }),
      request(6, { is_active: false, name: 'Inactive job secret' }),
    ],
    customers: [{ id: 7, name: 'Jamie Gardner', company: 'Green Landscaping', is_active: true }],
    job_request_items: [
      item(1, 1, { name: 'Wax Myrtle', size: '15 G', note_for_customer: "Item constraint\n\nItem delivery", note_internal: 'Item alternative' }),
      item(2, 1, { is_active: false, name: 'Inactive item secret' }),
      ...[3, 4, 5, 6].map((id) => item(id, id, { name: 'Excluded job item secret' })),
    ],
    threads: [
      { agent: 'rosie', thread_id: 'jr-2', closed_at: null, last_seq: 3, last_at: '2026-09-02T12:00:00Z', last_text: 'Chat-only secret', web_read_id: 1 },
      { agent: 'rosie', thread_id: 'supplier-7', closed_at: null, last_seq: 9, last_at: '2026-09-03T12:00:00Z', last_text: 'Supplier transcript secret', web_read_id: 0 },
    ],
  })
  const rows = await source.listJobInbox()
  assert.deepEqual(rows.map((row) => row.id), [2, 1], 'Existing global activity ordering is preserved')
  assert.equal(rows.find((row) => row.id === 1)!.expectedInstallDate, '2026-10-03', 'Calendar date is returned unchanged')
  assert.equal(rows.find((row) => row.id === 2)!.expectedInstallDate, null, 'Missing EDD is not inferred from creation or activity')
  assert.equal(rows.find((row) => row.id === 1)!.createdAt, '2026-09-01T12:00:00Z')
  const text = rows.find((row) => row.id === 1)!.searchText!
  for (const value of ['JR-1', 'Courtyard', 'Jamie Gardner', 'Green Landscaping', 'Job timing', 'Job APS', 'Job offer',
    'Wax Myrtle', '15 G', 'Item constraint', 'Item alternative', 'Item delivery']) assert.ok(text.includes(value), value)
  assert.doesNotMatch(rows.map((row) => row.searchText).join('\n'), /secret|undefined|null/i)
  assert.equal(rows[0].preview, 'Chat-only secret', 'The preview remains available independently of search')
  assert.equal(rows[0].unread, true)
  for (const query of source.calls.filter((call) => call.table === 'job_request_items')) {
    assert.deepEqual(query.filters.find((filter) => filter.column === 'job_request_id')?.values, [1, 2])
    assert.deepEqual(query.filters.find((filter) => filter.column === 'is_active')?.values, [true])
  }
})

test('all active jobs and item notes remain searchable beyond 1000 rows using bounded batches', async () => {
  const jobs = Array.from({ length: 1105 }, (_, index) => request(index + 1))
  const source = inbox({
    job_requests: jobs,
    job_request_items: [
      ...Array.from({ length: 1205 }, (_, index) => item(index + 1, 1, { note_for_customer: `Needle-${index + 1}` })),
      ...jobs.slice(1).map((job, index) => item(2000 + index, Number(job.id), { name: `Last plant for ${job.id}` })),
    ],
  })
  const rows = await source.listJobInbox()
  assert.equal(rows.length, 1105)
  const first = rows.find((row) => row.id === 1)!.searchText!
  for (const number of [1, 1000, 1001, 1205]) assert.ok(first.includes(`Needle-${number}`))
  assert.ok(rows.find((row) => row.id === 1105)!.searchText!.includes('Last plant for 1105'))
  const itemCalls = source.calls.filter((call) => call.table === 'job_request_items')
  assert.ok(itemCalls.some((call) => call.range?.[0] === 1000), 'Items are paged past the response cap')
  assert.equal(itemCalls.length, 6, 'Batched work scales by result pages, not by job')
  for (const query of itemCalls) {
    const ids = query.filters.find((filter) => filter.column === 'job_request_id')!.values
    assert.ok(ids.length <= 250 && ids.length > 0)
    assert.ok(ids.every((id) => Number(id) >= 1 && Number(id) <= 1105))
  }
})

test('a failed later item page rejects instead of returning a partial searchable inbox', async () => {
  const source = inbox({
    job_requests: [request(1)],
    job_request_items: Array.from({ length: 1001 }, (_, index) => item(index + 1, 1)),
  }, (query) => query.table === 'job_request_items' && query.range?.[0] === 1000)
  await assert.rejects(source.listJobInbox(), /job_request_items: page unavailable/)
})

test('an empty active set performs no enrichment reads', async () => {
  const source = inbox({ job_requests: [request(1, { status: 'closed_won' }), request(2, { is_active: false })] })
  assert.deepEqual(await source.listJobInbox(), [])
  assert.deepEqual(source.calls.map((call) => call.table), ['job_requests'])
})

test('the 5000-job ceiling still rejects the sentinel before reading customer, item or thread details', async () => {
  const source = inbox({ job_requests: Array.from({ length: 5001 }, (_, index) => request(index + 1)) })
  await assert.rejects(source.listJobInbox(), source.JobInboxCapacityError)
  assert.ok(source.calls.every((call) => call.table === 'job_requests'))
  assert.deepEqual(source.calls.at(-1)?.range, [5000, 5000])
})
