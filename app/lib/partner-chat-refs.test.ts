import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import ts from 'typescript'

const require = createRequire(import.meta.url)

type Row = Record<string, unknown>

/** Just enough of supabase-js's query builder for partnerChatMessages. */
function fakeDb(tables: Record<string, Row[]>) {
  return {
    from(table: string) {
      let rows = [...(tables[table] ?? [])]
      const query = {
        select() { return query },
        eq(column: string, value: unknown) { rows = rows.filter((r) => r[column] === value); return query },
        neq(column: string, value: unknown) { rows = rows.filter((r) => r[column] !== value); return query },
        in(column: string, values: unknown[]) { rows = rows.filter((r) => values.includes(r[column])); return query },
        or(filter: string) {
          const head = Number(/id\.eq\.(\d+)/.exec(filter)![1])
          rows = rows.filter((r) => r.id === head || r.head_branch_id === head)
          return query
        },
        order(column: string, { ascending }: { ascending: boolean }) {
          rows.sort((a, b) => (Number(a[column]) - Number(b[column])) * (ascending ? 1 : -1))
          return query
        },
        async single() { return { data: rows[0] ?? null, error: rows[0] ? null : { message: 'none' } } },
        then(resolve: (value: unknown) => unknown) { return Promise.resolve({ data: rows, error: null }).then(resolve) },
      }
      return query
    },
  }
}

function load(tables: Record<string, Row[]>) {
  const { outputText } = ts.transpileModule(readFileSync(new URL('./partner-chat.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  })
  const module = { exports: {} as { partnerChatMessages: (supplierId: number, messages: Row[]) => Promise<Row[]> } }
  const deps: Record<string, unknown> = {
    'server-only': {},
    '@/lib/supabase': { supabase: fakeDb(tables) },
    '@/lib/partner-display': { redactPartnerRequestRefs: (text: string) => text.replace(/\bJR-\d+\b/g, 'availability request') },
  }
  new Function('require', 'module', 'exports', outputText)((name: string) => name in deps ? deps[name] : require(name), module, module.exports)
  return module.exports
}

const tables = {
  // Company 7 with a second location 8; supplier 9 is someone else.
  suppliers: [{ id: 7, head_branch_id: 7 }, { id: 8, head_branch_id: 7 }, { id: 9, head_branch_id: 9 }],
  job_requests: [{ id: 101, name: 'Smith | Courtyard' }, { id: 102, name: 'Pool garden JR-102' }, { id: 103, name: 'Draft only' }],
  availability_requests: [
    { id: 41, supplier_id: 7, job_request_id: 101, status: 'submitted' },
    { id: 42, supplier_id: 8, job_request_id: 102, status: 'new' },
    { id: 43, supplier_id: 7, job_request_id: 103, status: 'draft' },
    { id: 44, supplier_id: 9, job_request_id: 103, status: 'new' },
  ],
  orders: [{ id: 21, supplier_id: 7, job_request_id: 101, is_active: true }],
}

test('portal messages carry their job: the order once placed, else the AR, never a draft or another supplier\'s', async () => {
  const { partnerChatMessages } = load(tables)
  const out = await partnerChatMessages(8, [
    { id: 1, role: 'agent', senderKind: 'agent', text: 'Order placed', originThreadId: 'jr-101', jobRequestId: 101 },
    { id: 2, role: 'user', senderKind: 'lps', senderName: 'bhoumik', text: 'Can you check?', originThreadId: 'jr-102', jobRequestId: 102 },
    { id: 3, role: 'agent', senderKind: 'agent', text: 'Draft job', originThreadId: 'jr-103', jobRequestId: 103 },
    { id: 4, role: 'agent', senderKind: 'agent', text: 'Do you have Red Oak?', originThreadId: 'main' },
    { id: 5, role: 'user', senderKind: 'supplier', senderName: 'Oak Hill (portal)', text: 'Yes' },
  ])
  assert.deepEqual(out[0].ref, { kind: 'order', name: 'Smith | Courtyard', href: '/partner/7/orders/21' })
  assert.deepEqual(out[1].ref, { kind: 'ar', name: 'Pool garden availability request', href: '/partner/8/requests/42' })
  assert.deepEqual(out[2].ref, { kind: 'job', name: 'Draft only', href: null })
  assert.equal(out[3].ref, undefined)
  // LPS is one identity to the supplier: no team names, no internal thread ids.
  assert.equal(out[1].senderName, undefined)
  assert.equal(out[1].originThreadId, undefined)
  assert.equal(out[1].jobRequestId, undefined)
  assert.equal(out[4].senderName, 'Oak Hill (portal)')
})
