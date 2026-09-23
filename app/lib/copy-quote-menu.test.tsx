import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { JSDOM } from 'jsdom'
import type { JobRequestRow } from './rows'

test('quote templates escape card clipping and dismiss from the portal', async () => {
  const dom = new JSDOM('', { url: 'http://localhost' })
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true })) {
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  const { render, fireEvent, cleanup } = await import('@testing-library/react/pure')
  const { CopyQuoteMenu } = await import('../components/workspace/copy-quote-menu')
  try {
    const view = render(<div style={{ overflow: 'hidden', height: 40 }}><CopyQuoteMenu request={{} as JobRequestRow} /></div>)
    const trigger = view.getByRole('button', { name: 'Copy quote' })
    fireEvent.click(trigger)
    const menu = view.getByRole('menu', { name: 'Copy quote template' })
    assert.equal(menu.parentElement, document.body, 'Menu must escape the clipping card')
    assert.equal(view.getAllByRole('menuitem').length, 4)
    fireEvent.pointerDown(view.getByRole('menuitem', { name: 'HTML Quote' }))
    assert.equal(trigger.getAttribute('aria-expanded'), 'true', 'Portal interaction is not an outside click')
    fireEvent.keyDown(menu, { key: 'Escape' })
    assert.equal(view.queryByRole('menu'), null)
    assert.equal(document.activeElement, trigger)
    fireEvent.click(trigger)
    fireEvent.scroll(window)
    assert.equal(view.queryByRole('menu'), null)
    fireEvent.click(trigger)
    fireEvent.pointerDown(document.body)
    assert.equal(view.queryByRole('menu'), null)
  } finally { cleanup(); dom.window.close() }
})
