import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { JSDOM } from 'jsdom'
import type { Order } from './orders'

test('order sharing publishes, copies, revokes, and preserves the open panel', async () => {
  const dom = new JSDOM('<html><body></body></html>', { url: 'https://example.com/jobs' })
  const originalFetch = globalThis.fetch
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true })) {
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  const copied: string[] = []
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (value: string) => { copied.push(value) } } })
  const calls: unknown[] = []
  const token = '11111111-1111-4111-8111-111111111111'
  globalThis.fetch = async (url, init) => {
    assert.equal(url, '/api/orders/42')
    const body = JSON.parse(String(init?.body)); calls.push(body)
    return Response.json({ publicToken: body.isPublic ? token : null })
  }
  const { render, fireEvent, waitFor, cleanup } = await import('@testing-library/react/pure')
  const { OrderSharing } = await import('../components/workspace/order-sharing')
  try {
    const order = { id: 42, publicToken: null } as Order
    const view = render(<OrderSharing order={order} closed={false} />)
    fireEvent.click(view.getByText('Share public link'))
    fireEvent.click(view.getByText('Make public'))
    await waitFor(() => assert.ok(view.getByText('Make private')))
    assert.deepEqual(copied, [`https://example.com/public/orders/${token}`])
    view.rerender(<OrderSharing order={{ ...order, publicToken: token }} closed={false} />)
    assert.equal((view.getByLabelText('Public order URL') as HTMLInputElement).value, copied[0])
    fireEvent.click(view.getByText('Make private'))
    await waitFor(() => assert.ok(view.getByText('Make public')))
    assert.equal(view.queryByLabelText('Public order URL'), null)
    assert.deepEqual(calls, [{ isPublic: true }, { isPublic: false }])
    view.rerender(<OrderSharing order={order} closed />)
    assert.equal((view.getByText('Make public') as HTMLButtonElement).disabled, true)
  } finally { cleanup(); globalThis.fetch = originalFetch; dom.window.close() }
})
