import assert from 'node:assert/strict'
import test from 'node:test'
import React, { useRef, useState } from 'react'
import { JSDOM } from 'jsdom'
import { act, cleanup, render } from '@testing-library/react'
import { useTouchDrag } from '../components/workspace/touch-drag'

const dom = new JSDOM('<html><body></body></html>', { url: 'https://lps.example', pretendToBeVisual: true })
for (const [key, value] of Object.entries({
  window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
  HTMLElement: dom.window.HTMLElement, Event: dom.window.Event, getComputedStyle: dom.window.getComputedStyle,
  requestAnimationFrame: dom.window.requestAnimationFrame, cancelAnimationFrame: dom.window.cancelAnimationFrame,
})) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })


function Harness({ log }: { log: string[] }) {
  const pill = useRef<HTMLSpanElement>(null)
  const [dragging, setDragging] = useState(false)
  useTouchDrag(pill, {
    start: (dt) => { dt.setData('application/x-test', '42'); setDragging(true) },
    end: () => { setDragging(false); log.push('end') },
  })
  return <div>
    <span ref={pill} draggable data-testid="pill">{dragging ? 'dragging' : 'pill'}</span>
    <div data-testid="zone"
      onDragOver={(e) => { if (e.dataTransfer.types.includes('application/x-test')) e.preventDefault() }}
      onDrop={(e) => log.push(`drop ${e.dataTransfer.getData('application/x-test')}`)} />
  </div>
}

const touch = (node: Element, type: string, x: number, y: number) => {
  const event = new dom.window.Event(type, { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'touches', { value: type === 'touchend' ? [] : [{ clientX: x, clientY: y }] })
  node.dispatchEvent(event)
  return event
}
const wait = (ms: number) => act(() => new Promise((resolve) => setTimeout(resolve, ms)))

test('press and hold, drag and release drops the payload on the zone under the finger', async () => {
  const log: string[] = []
  const view = render(<Harness log={log} />)
  const pill = view.getByTestId('pill')
  const zone = view.getByTestId('zone')
  document.elementFromPoint = () => zone

  touch(pill, 'touchstart', 10, 10)
  assert.equal(pill.draggable, false, "the browser's own long-press drag cannot take the touch over")
  await wait(400)
  assert.equal(pill.textContent, 'dragging', 'the hold starts the drag, which re-renders the owner')
  const native = new dom.window.Event('dragstart', { bubbles: true, cancelable: true })
  pill.dispatchEvent(native)
  assert.equal(native.defaultPrevented, true, 'a native drag starting mid-touch is refused')
  const move = touch(pill, 'touchmove', 60, 80)
  assert.equal(move.defaultPrevented, true, 'a drag in progress does not scroll the page')
  await act(async () => { touch(pill, 'touchend', 60, 80) })
  assert.deepEqual(log, ['drop 42', 'end'])
  assert.equal(pill.textContent, 'pill')
  assert.equal(pill.draggable, true, 'a mouse can still drag it afterwards')
  assert.equal(document.body.querySelectorAll('[data-testid="pill"]').length, 1, 'the drag ghost is removed')
  cleanup()
})

test('moving before the hold completes is a scroll, never a drag', async () => {
  const log: string[] = []
  const view = render(<Harness log={log} />)
  const pill = view.getByTestId('pill')
  document.elementFromPoint = () => view.getByTestId('zone')

  touch(pill, 'touchstart', 10, 10)
  const move = touch(pill, 'touchmove', 10, 40)
  assert.equal(move.defaultPrevented, false)
  await wait(400)
  touch(pill, 'touchend', 10, 40)
  assert.deepEqual(log, [])
  assert.equal(pill.textContent, 'pill')
  cleanup()
})
