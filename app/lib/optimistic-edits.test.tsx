import assert from 'node:assert/strict'
import test, { afterEach, beforeEach } from 'node:test'
import React from 'react'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { JSDOM } from 'jsdom'

import { EditableText } from '../components/workspace/editable.tsx'
import { StatusPill } from '../components/workspace/job-request.tsx'

let dom: JSDOM
const originalFetch = globalThis.fetch

beforeEach(() => {
  dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/requests' })
  const win = dom.window
  Object.defineProperty(win.HTMLElement.prototype, 'attachEvent', { configurable: true, value() {} })
  Object.defineProperty(win.HTMLElement.prototype, 'detachEvent', { configurable: true, value() {} })
  for (const [key, value] of Object.entries({
    window: win, self: win, document: win.document, navigator: win.navigator,
    HTMLElement: win.HTMLElement, HTMLButtonElement: win.HTMLButtonElement, Node: win.Node,
    MouseEvent: win.MouseEvent, KeyboardEvent: win.KeyboardEvent, CustomEvent: win.CustomEvent,
    getComputedStyle: win.getComputedStyle,
    requestAnimationFrame: (callback: FrameRequestCallback) => setTimeout(callback, 0),
    IS_REACT_ACT_ENVIRONMENT: true,
  })) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
})

afterEach(() => {
  cleanup()
  Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: originalFetch })
  dom.window.close()
})

/** A fetch whose reply the test releases, so the in-flight state can be read. */
function heldFetch() {
  let release: (ok: boolean) => void = () => {}
  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    writable: true,
    value: () => new Promise((resolve) => {
      release = (ok) => resolve({ ok, json: async () => (ok ? {} : { error: 'Denied' }) })
    }),
  })
  return (ok: boolean) => release(ok)
}

test('EditableText shows the committed value while the write is in flight, and reverts when refused', async () => {
  const release = heldFetch()
  const view = render(<EditableText table="job_request_items" id={7} column="size" value="15g" onSaved={() => {}} />)

  const user = userEvent.setup({ document })
  await user.click(view.getByRole('button', { name: '15g' }))
  await user.clear(view.getByRole('textbox'))
  await user.type(view.getByRole('textbox'), '30g{Enter}')
  assert.equal(view.getByRole('button').textContent, '30g', 'shown before the server answers')

  release(false)
  await waitFor(() => assert.equal(view.getByRole('button').textContent, '15g'))
})

test('EditableText keeps the committed value after success until the refetched value arrives', async () => {
  const release = heldFetch()
  const view = render(<EditableText table="job_request_items" id={7} column="size" value="15g" onSaved={() => {}} />)

  const user = userEvent.setup({ document })
  await user.click(view.getByRole('button', { name: '15g' }))
  await user.clear(view.getByRole('textbox'))
  await user.type(view.getByRole('textbox'), '30g{Enter}')
  release(true)
  await waitFor(() => assert.equal(view.getByRole('button').hasAttribute('disabled'), false))
  assert.equal(view.getByRole('button').textContent, '30g', 'no flicker back to the old value before the refetch')

  view.rerender(<EditableText table="job_request_items" id={7} column="size" value="30 g" onSaved={() => {}} />)
  assert.equal(view.getByRole('button').textContent, '30 g', 'the refetched value wins')
})

test('StatusPill shows the picked status at once, and reverts when refused', async () => {
  const release = heldFetch()
  const view = render(<StatusPill table="job_request_items" id={7} column="status" value="pending" label="Pending" tone="grey"
    options={[{ value: 'pending', label: 'Pending' }, { value: 'available', label: 'Available' }]} onSaved={() => {}} />)

  fireEvent.click(view.getByRole('button', { name: 'Pending' }))
  fireEvent.click(view.getByRole('menuitemradio', { name: 'Available' }))
  assert.ok(view.getByRole('button', { name: 'Available' }), 'shown before the server answers')

  release(false)
  await waitFor(() => assert.ok(view.getByRole('button', { name: 'Pending' })))
})
