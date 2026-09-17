import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { JSDOM } from 'jsdom'

test('every customer has a chat action, including first-time customers; failed allocation never opens chat', async () => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' })
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document,
    navigator: dom.window.navigator, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, CustomEvent: dom.window.CustomEvent,
    IS_REACT_ACT_ENVIRONMENT: true })) {
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  const { act, fireEvent, render, cleanup } = await import('@testing-library/react/pure')
  const { CustomerChatButton } = await import('../components/workspace/customer-chat-button.tsx')
  const originalFetch = globalThis.fetch
  const opened: unknown[] = []
  dom.window.addEventListener('lps:open-chat', (event) => opened.push((event as CustomEvent).detail))
  let calls = 0
  let fail = false
  globalThis.fetch = async (url, init) => {
    calls++
    assert.equal(url, '/api/customers/5/chat')
    assert.equal(init?.method, 'POST')
    return new Response(JSON.stringify(fail ? { error: 'Write failed' } : { threadId: 'customer-saved' }), { status: fail ? 500 : 200 })
  }
  try {
    const view = render(<CustomerChatButton customerId={5} label="Oak Hill" />)
    await act(async () => { fireEvent.click(view.getByRole('button', { name: 'Chat with Oak Hill' })) })
    assert.deepEqual(opened, [{ agentId: 'rosie', threadId: 'customer-saved', label: 'Oak Hill' }])
    view.rerender(<CustomerChatButton customerId={5} threadId="customer-original" label="Oak Hill" />)
    await act(async () => { fireEvent.click(view.getByRole('button', { name: 'Chat with Oak Hill' })) })
    assert.equal(calls, 1)
    assert.deepEqual(opened[1], { agentId: 'rosie', threadId: 'customer-original', label: 'Oak Hill' })
    fail = true
    view.rerender(<CustomerChatButton customerId={5} label="Oak Hill" />)
    await act(async () => { fireEvent.click(view.getByRole('button', { name: 'Chat with Oak Hill' })) })
    assert.equal(opened.length, 2)
    assert.equal(view.getByRole('alert').textContent, 'Write failed')
  } finally { globalThis.fetch = originalFetch; cleanup(); dom.window.close() }
})
