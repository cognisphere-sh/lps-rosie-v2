import assert from 'node:assert/strict'
import test, { afterEach, beforeEach } from 'node:test'
import React from 'react'
import { act, cleanup, render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { JSDOM } from 'jsdom'

import { EditableText } from '../components/workspace/editable.tsx'
import { KeyboardDismissBlur } from '../components/workspace/keyboard-dismiss.tsx'

let dom: JSDOM
let viewport: EventTarget & { width: number; height: number }
const resize = (height: number, width = 390) => act(() => {
  viewport.height = height
  viewport.width = width
  viewport.dispatchEvent(new dom.window.Event('resize'))
})

beforeEach(() => {
  dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/jobs?jr=19' })
  const win = dom.window
  Object.defineProperty(win.HTMLElement.prototype, 'attachEvent', { configurable: true, value() {} })
  Object.defineProperty(win.HTMLElement.prototype, 'detachEvent', { configurable: true, value() {} })
  viewport = Object.assign(new win.EventTarget(), { width: 390, height: 800 })
  Object.defineProperty(win, 'visualViewport', { configurable: true, value: viewport })
  Object.defineProperty(win, 'matchMedia', { configurable: true, value: (query: string) => ({
    matches: query === '(pointer: coarse)', addEventListener() {}, removeEventListener() {},
  }) })
  for (const [key, value] of Object.entries({
    window: win, self: win, document: win.document, navigator: win.navigator, HTMLElement: win.HTMLElement,
    HTMLInputElement: win.HTMLInputElement, HTMLTextAreaElement: win.HTMLTextAreaElement,
    MouseEvent: win.MouseEvent, KeyboardEvent: win.KeyboardEvent,
    Node: win.Node, getComputedStyle: win.getComputedStyle,
    requestAnimationFrame: (callback: FrameRequestCallback) => setTimeout(callback, 0),
    IS_REACT_ACT_ENVIRONMENT: true,
  })) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
})

afterEach(() => { cleanup(); dom.window.close() })

test('closing the keyboard (Android back) blurs the open card editor, which saves and closes it', async () => {
  const saved: string[] = []
  const view = render(<><KeyboardDismissBlur /><EditableText table="job_request_items" id={1} column="name" value="Abelia"
    onCommit={async (value) => { saved.push(value) }} onSaved={() => undefined} tapToEdit /></>)
  const user = userEvent.setup({ document })
  await user.click(view.getByRole('button'))
  const input = view.getByRole('textbox') as HTMLInputElement
  assert.equal(document.activeElement, input)
  await user.type(input, ' grandiflora')
  resize(460) // keyboard opens: the field stays open
  assert.equal(document.activeElement, input)
  resize(500) // the keyboard's suggestion strip changes height: still open
  assert.equal(document.activeElement, input)
  resize(800) // back hides the keyboard
  assert.equal(view.queryByRole('textbox'), null)
  assert.deepEqual(saved, ['Abelia grandiflora'])
})

test('a rotation or toolbar slide never closes the editor', () => {
  const view = render(<><KeyboardDismissBlur /><input aria-label="field" /></>)
  const input = view.getByLabelText('field') as HTMLInputElement
  input.focus()
  resize(744) // the browser toolbar slides in and out
  resize(800)
  assert.equal(document.activeElement, input)
  resize(390, 800) // landscape
  resize(800, 390) // portrait again
  assert.equal(document.activeElement, input)
})
