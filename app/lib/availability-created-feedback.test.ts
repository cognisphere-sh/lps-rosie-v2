import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

// Exercise the actual private dialog handler without changing the page's exports
// or loading unrelated Shell/router state. Only its closure dependencies are faked.
const source = ts.createSourceFile('page.tsx', readFileSync(
  new URL('../app/requests/page.tsx', import.meta.url), 'utf8',
), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const dialog = source.statements.find((node): node is ts.FunctionDeclaration =>
  ts.isFunctionDeclaration(node) && node.name?.text === 'AvailabilityRequestDialog')
assert.ok(dialog?.body)
const create = dialog.body.statements.flatMap((node) =>
  ts.isVariableStatement(node) ? [...node.declarationList.declarations] : [],
).find((node) => ts.isIdentifier(node.name) && node.name.text === 'create')
assert.ok(create?.initializer)
const { outputText } = ts.transpileModule(`const create = ${create.initializer.getText(source)};`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
})
const runCreate = new Function(
  'groups', 'supplierId', 'share', 'fetch', 'toast', 'setBusy', 'onCreated', 'onClose', 'setError', 'sent', 'setSent',
  `${outputText}\nreturn create();`,
)

type Call = { url: string; body: unknown }
const groups = [
  { requestId: 100, label: 'First job', itemIds: [200, 201] },
  { requestId: 101, label: 'Second job', itemIds: [300] },
]
const bodyFor = (requestId: number, itemIds: number[]) => ({
  jobRequestIds: [requestId], supplierId: 11, shareCustomerDetails: false, itemIds,
})

test('cross-job selection creates one request per job, each asking only that job\'s lines', async () => {
  const calls: Call[] = []
  const events: unknown[] = []
  let sent: number[] = []
  await runCreate(groups, 11, false, async (url: string, init: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init.body)) })
    return { ok: true, json: async () => ({ id: 42 }) }
  }, (message: string) => events.push(message),
  (busy: boolean) => events.push(busy), () => events.push('refresh'), () => events.push('close'),
  (error: string) => { if (error) events.push(error) }, sent, (next: number[]) => { sent = next })
  assert.deepEqual(calls, [
    { url: '/api/availability-requests', body: bodyFor(100, [200, 201]) },
    { url: '/api/availability-requests', body: bodyFor(101, [300]) },
  ])
  assert.deepEqual(sent, [100, 101])
  assert.deepEqual(events, [true, false, 'refresh', '2 availability requests created', 'close'])
})

test('a single job toasts one created request', async () => {
  const events: unknown[] = []
  await runCreate([groups[0]], 11, false, async () => ({ ok: true, json: async () => ({ id: 42 }) }),
    (message: string) => events.push(message), () => {}, () => events.push('refresh'), () => events.push('close'),
    () => {}, [], () => {})
  assert.deepEqual(events, ['refresh', 'Availability request created', 'close'])
})

for (const network of [false, true]) test(`a failed job keeps the dialog open and a retry sends only unsent jobs (${network ? 'network' : 'HTTP'})`, async () => {
  const calls: Call[] = []
  const events: unknown[] = []
  let sent: number[] = []
  let failSecond = true
  const fetch = async (url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body)) as { jobRequestIds: number[] }
    calls.push({ url, body })
    if (body.jobRequestIds[0] === 101 && failSecond) {
      if (network) throw new Error('Network unavailable')
      return { ok: false, json: async () => ({ error: 'Creation failed' }) }
    }
    return { ok: true, json: async () => ({ id: 42 }) }
  }
  const run = () => runCreate(groups, 11, false, fetch, (message: string) => events.push(message),
    (busy: boolean) => events.push(busy), () => events.push('refresh'), () => events.push('close'),
    (error: string) => { if (error) events.push(error) }, sent, (next: number[]) => { sent = next })
  await run()
  const message = network ? 'Network unavailable' : 'Creation failed'
  assert.deepEqual(events, [true, false, 'refresh', `1 of 2 created · 1 failed — Second job: ${message}`],
    'the created job refreshes the list; the dialog stays open with the failure')
  assert.deepEqual(sent, [100])
  events.length = 0
  calls.length = 0
  failSecond = false
  await run()
  assert.deepEqual(calls.map((call) => (call.body as { jobRequestIds: number[] }).jobRequestIds), [[101]], 'retry skips the job already sent')
  assert.deepEqual(sent, [100, 101])
  assert.deepEqual(events, [true, false, 'refresh', '2 availability requests created', 'close'])
})

test('no supplier selection returns without side effects', async () => {
  const unexpected = () => assert.fail('no side effects without a selected supplier')
  await runCreate([], null, false, unexpected, unexpected, unexpected, unexpected, unexpected, unexpected, [], unexpected)
})
