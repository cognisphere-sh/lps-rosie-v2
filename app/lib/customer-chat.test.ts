import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import ts from 'typescript'

const require = createRequire(import.meta.url)

test('customer chat reuses saved threads, guards first allocation, and handles missing customers and errors', async () => {
  let saved: string | null = null
  let writes = 0
  let exists = true
  let fail = false
  let concurrentWinner: string | null = null
  const db = { from: () => {
    let next: string | undefined
    let expected: string | null | undefined
    const query = {
      select() { return query },
      eq(column: string, value: unknown) { if (column === 'rosie_thread_id') expected = value as string; return query },
      is(_column: string, value: null) { expected = value; return query },
      update(value: { rosie_thread_id: string }) { next = value.rosie_thread_id; return query },
      async maybeSingle() { return { data: exists ? { id: 5, name: 'Oak Hill', rosie_thread_id: saved } : null, error: null } },
      then(resolve: (value: unknown) => unknown) {
        writes++
        if (concurrentWinner) saved = concurrentWinner
        if (!fail && expected === saved) saved = next!
        return Promise.resolve({ error: fail ? new Error('Write failed') : null }).then(resolve)
      },
    }
    return query
  } }
  const load = (path: string, deps: Record<string, unknown>) => {
    const { outputText } = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    })
    const loaded = { exports: {} as Record<string, unknown> }
    new Function('require', 'module', 'exports', outputText)(
      (name: string) => name in deps ? deps[name] : require(name), loaded, loaded.exports,
    )
    return loaded.exports
  }
  // The allocation lives in lib/job-chat.ts, shared with a job's chat tabs.
  const jobChat = load('./job-chat.ts', { '@/lib/supabase': { supabase: db }, 'server-only': {} })
  const module = { exports: load('../app/api/customers/[id]/chat/route.ts', { '@/lib/job-chat': jobChat }) as { POST: (request: Request, context: { params: Promise<{ id: string }> }) => Promise<Response> } }
  const open = (id = '5') => module.exports.POST(new Request('http://localhost/api/customers/5/chat', { method: 'POST' }), { params: Promise.resolve({ id }) })
  const first = await (await open()).json()
  assert.match(first.threadId, /^customer-oak-hill-5-/)
  assert.equal(saved, first.threadId)
  assert.deepEqual(await (await open()).json(), first)
  assert.equal(writes, 1)
  saved = null
  concurrentWinner = 'customer-existing-winner'
  assert.equal((await (await open()).json()).threadId, concurrentWinner)
  concurrentWinner = null
  saved = null
  fail = true
  assert.equal((await open()).status, 500)
  assert.equal(saved, null)
  exists = false
  assert.equal((await open()).status, 404)
  assert.equal((await open('bad')).status, 400)
})
