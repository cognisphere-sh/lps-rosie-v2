import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { JSDOM } from 'jsdom'

test('header EDD opens the picker, saves changes and restores failed edits', async () => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' })
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document,
    navigator: dom.window.navigator, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node,
    IS_REACT_ACT_ENVIRONMENT: true })) {
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  const { act, fireEvent, render, cleanup } = await import('@testing-library/react/pure')
  const { JobMetadata } = await import('../components/workspace/job-metadata.tsx')
  const originalFetch = globalThis.fetch
  try {
    for (const date of ['2026-08-30', null]) {
      const writes: unknown[] = []
      const saved: number[] = []
      let fail = false
      globalThis.fetch = async (_url, init) => {
        writes.push(JSON.parse(String(init?.body)))
        return new Response(fail ? JSON.stringify({ error: 'Save failed' }) : '{}', { status: fail ? 500 : 200 })
      }
      const view = render(<JobMetadata request={{ id: 27, expectedInstallDate: date, fulfillmentMethod: null }}
        showFulfillment={false} onDateSaved={(id) => saved.push(id)} />)
      const input = view.getByLabelText('Edit EDD') as HTMLInputElement
      let opened = false
      input.showPicker = () => { opened = true }
      fireEvent.click(input)
      assert.equal(opened, true)
      await act(async () => { fireEvent.change(input, { target: { value: '2026-09-20' } }) })
      assert.deepEqual(writes, [{ table: 'job_requests', id: 27, column: 'expected_install_date', value: '2026-09-20' }])
      assert.deepEqual(saved, [27])
      assert.equal(input.value, '2026-09-20')
      fireEvent.focus(input)
      assert.match(input.parentElement!.textContent ?? '', /^Sun, 09\/20$/, 'focused, it still reads Day, MM/DD')
      assert.match(input.className, /opacity-0/, 'never the raw date field')
      fail = true
      await act(async () => { fireEvent.change(input, { target: { value: '2026-09-21' } } ) })
      assert.equal(input.value, '2026-09-20')
      assert.equal(view.getByRole('alert').textContent, 'Save failed')
      assert.deepEqual(saved, [27])
      view.unmount()
    }
    const writes: unknown[] = []
    let fail = false
    globalThis.fetch = async (_url, init) => {
      writes.push(JSON.parse(String(init?.body)))
      return new Response(fail ? JSON.stringify({ error: 'Save failed' }) : '{}', { status: fail ? 500 : 200 })
    }
    const view = render(<JobMetadata request={{ id: 27, expectedInstallDate: null, fulfillmentMethod: null }} onDateSaved={() => {}} />)
    const select = view.getByRole('combobox', { name: 'Pickup or delivery' }) as HTMLSelectElement
    assert.equal(select.selectedOptions[0].textContent, '-')
    for (const value of ['pickup', 'delivery', '']) {
      await act(async () => { fireEvent.change(select, { target: { value } }) })
      assert.equal(select.value, value)
      assert.deepEqual(writes.at(-1), { table: 'job_requests', id: 27, column: 'fulfillment_method', value })
    }
    fail = true
    await act(async () => { fireEvent.change(select, { target: { value: 'pickup' } }) })
    assert.equal(select.value, '')
    assert.equal(view.getByRole('alert').textContent, 'Save failed')
  } finally { globalThis.fetch = originalFetch; cleanup(); dom.window.close() }
})
