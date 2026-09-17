import assert from 'node:assert/strict'
import test, { afterEach, beforeEach } from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import userEvent from '@testing-library/user-event'
import { JSDOM } from 'jsdom'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { ChatQuestionnaire } from '../components/workspace/chat-questionnaire'
import { Transcript, type ChatMessage } from '../components/workspace/chat-kit'
import { encodeQuestionnaire, parseQuestionnaire, questionnaireAnswers, validateQuestions } from '../../harness/plugins/webchat/questions'

const value = {
  id: '12345678-1234-1234-1234-123456789abc', title: 'Delivery preferences',
  questions: [{ question: 'Which day?', options: ['Monday', 'Tuesday'] }, { question: 'Where?', options: ['Driveway', 'Curbside'] }],
}
let dom: JSDOM
beforeEach(() => {
  dom = new JSDOM('<!doctype html><html><body></body></html>')
  for (const [key, val] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true }))
    Object.defineProperty(globalThis, key, { value: val, configurable: true, writable: true })
  Object.defineProperty(dom.window.HTMLElement.prototype, 'attachEvent', { value() {} })
  Object.defineProperty(dom.window.HTMLElement.prototype, 'detachEvent', { value() {} })
})
afterEach(() => { cleanup(); dom.window.close() })

test('custom chat text collapses earlier questions only after a confirmed send, including loaded history', () => {
  const question: ChatMessage = { id: 2, at: 0, role: 'agent', text: encodeQuestionnaire(value), files: [] }
  const reply: ChatMessage = { id: 3, at: 1, role: 'user', text: 'Let me check first', files: [] }
  const markup = (messages: ChatMessage[]) => renderToStaticMarkup(<Transcript messages={messages} pending={false} error="" hasMore={false} loadingMore={false} fileHref={() => ''} empty="" pendingLabel="Working" onRefresh={async () => {}} wallpaper="none" />)
  for (const messages of [[{ ...reply, id: 1 }, question], [question, { ...reply, id: -1 }], [question, { ...reply, text: '' }]]) {
    assert.match(markup(messages), /<fieldset/)
  }
  const collapsed = markup([question, reply])
  assert.doesNotMatch(collapsed, /<fieldset|<textarea|Answers submitted\./)
  assert.match(collapsed, /Which day\?/)
  assert.match(collapsed, /Where\?/)
  assert.doesNotMatch(collapsed, /Monday|Tuesday|Driveway|Curbside/)
  assert.match(markup([question, reply, { ...question, id: 4 }]), /<fieldset/)
  assert.match(markup([question, { ...reply, text: questionnaireAnswers(value, ['Monday', 'Driveway']) }]), /Answers submitted\./)
})

test('questionnaires round trip through durable text and reject invalid choices', () => {
  assert.deepEqual(parseQuestionnaire(encodeQuestionnaire(value)), value)
  assert.equal(parseQuestionnaire('An ordinary message'), null)
  for (const raw of [null, {}, { ...value, questions: [] }, { ...value, questions: [{ question: 'Q', options: ['a', ' A '] }] }, { ...value, questions: [{ question: 'Q', options: ['Something else'] }] }])
    assert.throws(() => validateQuestions(raw))
  assert.throws(() => questionnaireAnswers(value, ['Monday', '']))
  assert.deepEqual(validateQuestions({ ...value, questions: [{ question: 'Q', options: ['A', 'Something else'] }] }).questions[0].options, ['A'])
})

test('one question at a time, required free text, editable review, and a single confirmed send', async () => {
  const sends: string[] = []
  let finish!: (result: boolean) => void
  const ui = render(<ChatQuestionnaire value={value} submitted={false} onSubmit={text => { sends.push(text); return new Promise(resolve => { finish = resolve }) }} />)
  assert.equal(ui.queryByText('Where?'), null)
  assert.equal(ui.queryByRole('button', { name: 'Next' }), null)
  fireEvent.click(ui.getByRole('button', { name: 'Monday' }))
  assert.equal(ui.queryByText('Which day?'), null)
  assert.equal(ui.queryByRole('button', { name: 'Something else' }), null)
  assert.ok(ui.getByPlaceholderText('Something else'))
  assert.equal((ui.getByRole('button', { name: 'Save answer' }) as HTMLButtonElement).disabled, true)
  const user = userEvent.setup({ document: dom.window.document })
  await user.type(ui.getByLabelText('Something else'), 'Behind the blue gate')
  fireEvent.click(ui.getByRole('button', { name: 'Save answer' }))
  assert.ok(ui.getByText('Behind the blue gate'))
  assert.equal(sends.length, 0)
  fireEvent.click(ui.getByRole('button', { name: 'Edit answer 1' }))
  fireEvent.click(ui.getByRole('button', { name: 'Tuesday' }))
  assert.equal((ui.getByLabelText('Something else') as HTMLTextAreaElement).value, 'Behind the blue gate')
  fireEvent.click(ui.getByRole('button', { name: 'Save answer' }))
  fireEvent.click(ui.getByRole('button', { name: 'Submit answers' }))
  fireEvent.click(ui.getByRole('button', { name: 'Submitting…' }))
  assert.deepEqual(sends, [questionnaireAnswers(value, ['Tuesday', 'Behind the blue gate'])])
  await act(async () => finish(true))
  assert.ok(ui.getByText('Answers submitted.'))
})

test('failed sends retain review for retry; confirmed history is read only', async () => {
  let count = 0
  const single = { ...value, questions: [value.questions[0]] }
  const ui = render(<ChatQuestionnaire value={single} submitted={false} onSubmit={async () => ++count > 1} />)
  fireEvent.click(ui.getByRole('button', { name: 'Monday' }))
  await act(async () => fireEvent.click(ui.getByRole('button', { name: 'Submit answers' })))
  assert.match(ui.getByRole('alert').textContent!, /try again/)
  assert.ok(ui.getByText('Monday'))
  await act(async () => fireEvent.click(ui.getByRole('button', { name: 'Submit answers' })))
  assert.equal(count, 2)
  ui.unmount()
  const history = render(<ChatQuestionnaire value={value} submitted onSubmit={async () => { throw new Error('must not send') }} />)
  assert.equal(history.queryByRole('button'), null)
  assert.ok(history.getByText('Answers submitted.'))
})


test('Previous preserves answers and selecting the same answer advances again', () => {
  const ui = render(<ChatQuestionnaire value={value} submitted={false} />)
  fireEvent.click(ui.getByRole('button', { name: 'Monday' }))
  assert.ok(ui.getByText('Where?'))
  fireEvent.click(ui.getByRole('button', { name: 'Previous' }))
  assert.equal(ui.getByRole('button', { name: 'Monday' }).getAttribute('aria-pressed'), 'true')
  fireEvent.click(ui.getByRole('button', { name: 'Monday' }))
  fireEvent.click(ui.getByRole('button', { name: 'Curbside' }))
  assert.ok(ui.getByText('Review your answers'))
  assert.ok(ui.getByText('Monday'))
  assert.ok(ui.getByText('Curbside'))
  fireEvent.click(ui.getByRole('button', { name: 'Previous' }))
  assert.equal(ui.getByRole('button', { name: 'Curbside' }).getAttribute('aria-pressed'), 'true')
  fireEvent.click(ui.getByRole('button', { name: 'Driveway' }))
  assert.ok(ui.getByText('Driveway'))
})
