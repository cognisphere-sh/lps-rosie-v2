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
  'groups', 'supplierId', 'share', 'fetch', 'toast', 'setBusy', 'onCreated', 'onClose',
  `${outputText}\nreturn create();`,
)

type Outcome = 'success' | 'http-error' | 'malformed-error' | 'network-error'
const cases: { name: string; supplierId: number; outcomes: Outcome[]; expected: string; share: boolean }[] = [
  { name: 'single Partner', supplierId: 11, outcomes: ['success'], expected: 'Availability request created', share: false },
  { name: 'single non-Partner', supplierId: 22, outcomes: ['success'], expected: 'Availability request created', share: true },
  { name: 'multiple successes', supplierId: 22, outcomes: ['success', 'success', 'success'], expected: '3 availability requests created', share: false },
  { name: 'mixed results', supplierId: 11, outcomes: ['success', 'http-error', 'success'], expected: '2 of 3 created · 1 failed', share: true },
  { name: 'all failed', supplierId: 22, outcomes: ['http-error', 'malformed-error', 'network-error'], expected: '0 of 3 created · 3 failed', share: false },
]

for (const { name, supplierId, outcomes, expected, share } of cases) {
  test(`${name}: accurate creation toast, unchanged payloads and completion callbacks`, async () => {
    const groups = outcomes.map((_, index) => ({
      requestId: 100 + index, label: `Job ${index}`, itemIds: [200 + index, 300 + index],
    }))
    const originalGroups = structuredClone(groups)
    const calls: { url: string; init: RequestInit }[] = []
    const events: unknown[] = []
    await runCreate(groups, supplierId, share, async (url: string, init: RequestInit) => {
      const outcome = outcomes[calls.length]
      calls.push({ url, init })
      if (outcome === 'network-error') throw new Error('Network unavailable')
      return {
        ok: outcome === 'success',
        json: async () => {
          // Success does not need a link or supplier-type response to say created.
          assert.notEqual(outcome, 'success', 'successful response body must not be inspected')
          if (outcome === 'malformed-error') throw new SyntaxError('Invalid JSON')
          return { error: 'Creation failed' }
        },
      }
    }, (message: string) => events.push(message),
    (busy: boolean) => events.push(busy),
    () => events.push('refresh'), () => events.push('close'))

    assert.deepEqual(events, [true, false, expected, 'refresh', 'close'])
    assert.doesNotMatch(expected, /sent|emailed/i)
    assert.deepEqual(groups, originalGroups, 'selected lines must not be mutated')
    assert.deepEqual(calls, groups.map((group) => ({
      url: '/api/availability-requests',
      init: {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          jobRequestId: group.requestId, supplierId, shareCustomerDetails: share, itemIds: group.itemIds,
        }),
      },
    })), 'only the existing per-job create calls are made; no email or other calls')
  })
}

test('no supplier selection still returns without any side effects', async () => {
  const unexpected = () => assert.fail('no side effects without a selected supplier')
  await runCreate([], null, false, unexpected, unexpected, unexpected, unexpected, unexpected)
})
