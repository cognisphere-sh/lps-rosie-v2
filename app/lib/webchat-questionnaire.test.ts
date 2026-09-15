import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import test from 'node:test'
import WebchatPlugin from '../../harness/plugins/webchat/index'
import { parseQuestionnaire, questionnaireAnswers } from '../../harness/plugins/webchat/questions'

test('agent creates a validated questionnaire and receives confirmed pairs on the same thread', async () => {
  const plugin = new WebchatPlugin()
  const rows: { threadId: string; text: string; portal?: boolean }[] = []
  const events: { text: string; threadIdOverride: string }[] = []
  Object.assign(plugin, {
    cfg: { threadId: 'main' },
    ctx: { secrets: {}, log: { error() {} }, notify(_name: string, event: typeof events[number]) { events.push(event) } },
    record: async (threadId: string, message: { text: string }) => { rows.push({ ...message, threadId }); return { id: rows.length, ...message } },
    sessionUser: async () => 'Chris', setPending() {}, markRead() {},
  })
  async function post(path: string, body: unknown) {
    let status = 0
    const req = Object.assign(Readable.from([JSON.stringify(body)]), { method: 'POST', url: path, headers: { 'x-webhook-secret': process.env.COGNISPHERE_WEBHOOK_SECRET } })
    await plugin.handleHttpRequest(req as any, { writeHead(s: number) { status = s }, end() {} } as any)
    return status
  }
  assert.equal(await post('/api/reply', { questionnaire: { title: 'Delivery', questions: [] } }), 400)
  assert.equal(rows.length, 0)
  const questionnaire = { title: 'Delivery', questions: [{ question: 'Which day?', options: ['Monday', 'Tuesday'] }, { question: 'Where?', options: ['Driveway'] }] }
  assert.equal(await post('/api/reply', { questionnaire, threadId: 'jr-12', portal: true }), 200)
  assert.equal(rows[0].threadId, 'jr-12')
  assert.equal(rows[0].portal, true)
  assert.equal(events.length, 0)
  const saved = parseQuestionnaire(rows[0].text)!
  assert.deepEqual(saved.questions, questionnaire.questions)
  const text = questionnaireAnswers(saved, ['Monday', 'Behind the gate'])
  assert.equal(await post('/api/send', { threadId: 'jr-12', text }), 200)
  assert.equal(events.length, 1)
  assert.equal(events[0].threadIdOverride, 'jr-12')
  assert.match(events[0].text, /Which day\?\nAnswer: Monday/)
  assert.match(events[0].text, /Where\?\nAnswer: Behind the gate/)
})
