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
  'groups', 'supplierId', 'share', 'fetch', 'toast', 'setBusy', 'onCreated', 'onClose', 'setError', 'consolidate',
  `${outputText}\nreturn create();`,
)

test('cross-job selection creates one combined request with explicit source lines', async () => {
  const groups = [
    { requestId: 100, label: 'First job', itemIds: [200, 201] },
    { requestId: 101, label: 'Second job', itemIds: [300] },
  ]
  const calls: { url: string; body: unknown }[] = []
  const events: unknown[] = []
  await runCreate(groups, 11, false, async (url: string, init: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init.body)) })
    return { ok: true, json: async () => ({ id: 42 }) }
  }, (message: string) => events.push(message),
  (busy: boolean) => events.push(busy), () => events.push('refresh'), () => events.push('close'),
  (error: string) => { if (error) events.push(error) }, true)
  assert.deepEqual(calls, [{ url: '/api/availability-requests', body: {
    jobRequestIds: [100, 101], supplierId: 11, shareCustomerDetails: false,
    consolidateItems: true, itemIds: [200, 201, 300],
  } }])
  assert.deepEqual(events, [true, 'Availability request created', 'refresh', 'close', false])
})

for (const network of [false, true]) test(`failed combined request retains selection and dialog (${network ? 'network' : 'HTTP'})`, async () => {
  const events: unknown[] = []
  await runCreate([{ requestId: 100, itemIds: [200] }], 11, false, async () => {
    if (network) throw new Error('Network unavailable')
    return { ok: false, json: async () => ({ error: 'Creation failed' }) }
  }, () => assert.fail('No success toast'), (busy: boolean) => events.push(busy),
  () => assert.fail('Keep selection'), () => assert.fail('Keep dialog'),
  (error: string) => { if (error) events.push(error) }, false)
  assert.deepEqual(events, [true, network ? 'Network unavailable' : 'Creation failed', false])
})

test('no supplier selection returns without side effects', async () => {
  const unexpected = () => assert.fail('no side effects without a selected supplier')
  await runCreate([], null, false, unexpected, unexpected, unexpected, unexpected, unexpected, unexpected, false)
})
