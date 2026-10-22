import assert from 'node:assert/strict'
import test, { afterEach, beforeEach } from 'node:test'
import { JSDOM } from 'jsdom'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { SubmitReceived } from '../components/workspace/submit-received'

let dom: JSDOM
beforeEach(() => {
  dom = new JSDOM('', { url: 'http://localhost/partner/1/requests/50' })
  for (const [key, value] of Object.entries({
    window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
})
afterEach(() => {
  cleanup()
  dom.window.close()
})

test('announces a first submit and a re-submit differently', () => {
  const first = render(<SubmitReceived resubmit={false} onDone={() => {}} />)
  assert.match(first.getByRole('status').textContent ?? '', /Availability received/)
  first.rerender(<SubmitReceived resubmit onDone={() => {}} />)
  assert.match(first.getByRole('status').textContent ?? '', /Update received/)
})

test('dismisses on click and on Escape', () => {
  let done = 0
  const view = render(<SubmitReceived resubmit={false} onDone={() => { done++ }} />)
  fireEvent.click(view.getByRole('status'))
  act(() => { window.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape' })) })
  assert.equal(done, 2)
})

test('dismisses itself after a few seconds', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  let done = 0
  render(<SubmitReceived resubmit={false} onDone={() => { done++ }} />)
  t.mock.timers.tick(3100)
  assert.equal(done, 0)
  t.mock.timers.tick(200)
  assert.equal(done, 1)
})

test('the shared request view plays it only after an accepted submit', async () => {
  const { AvailabilityRequestView } = await import('../components/workspace/availability-request-view')
  const request = {
    id: 50, status: 'processing', submittedAt: null, items: [], answeredCount: 0,
    createdAt: '2026-09-29T12:00:00Z', noteForSupplier: '',
  } as unknown as import('./availability').ARDetail
  let accept = false
  const view = render(<AvailabilityRequestView request={request} loading={false} error="" saving={false}
    onPatch={async () => {}} onSubmit={async () => accept} />)
  const button = view.getByRole('button', { name: 'Submit availability' })
  await act(async () => { fireEvent.click(button) })
  assert.equal(view.queryByText('Availability received'), null)
  accept = true
  await act(async () => { fireEvent.click(button) })
  assert.ok(view.getByText('Availability received'))
})
