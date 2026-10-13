import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { JSDOM } from 'jsdom'

test('a click opens the picker; a picked date leaves the field; a typed date keeps focus', async () => {
  const win = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lps.example' }).window
  for (const [key, value] of Object.entries({
    window: win, self: win, document: win.document, navigator: win.navigator,
    HTMLElement: win.HTMLElement, HTMLInputElement: win.HTMLInputElement, Element: win.Element, Node: win.Node,
    getComputedStyle: win.getComputedStyle,
  })) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  // React DOM reads the DOM globals when it loads, so it comes in after them.
  const { cleanup, fireEvent, render } = await import('@testing-library/react')
  const { datePickerProps } = await import('../components/workspace/editable')

  const log: string[] = []
  function DateField() {
    const [date, setDate] = React.useState('')
    return <input type="date" aria-label="Date" value={date} {...datePickerProps({
      onChange: (event) => { setDate(event.target.value); log.push(`change ${event.target.value}`) },
      onBlur: (event) => log.push(`blur ${event.currentTarget.value}`),
    })} />
  }
  const view = render(<DateField />)
  const input = view.getByLabelText('Date') as HTMLInputElement
  let opened = 0
  input.showPicker = () => { opened += 1 }

  input.focus()
  fireEvent.click(input)
  assert.equal(opened, 1)
  fireEvent.change(input, { target: { value: '2026-10-09' } })
  assert.deepEqual(log, ['change 2026-10-09', 'blur 2026-10-09'])
  assert.notEqual(document.activeElement, input)

  log.length = 0
  input.focus()
  fireEvent.keyDown(input, { key: '1' })
  fireEvent.change(input, { target: { value: '2026-10-01' } })
  assert.deepEqual(log, ['change 2026-10-01'])
  assert.equal(document.activeElement, input)
  cleanup()
})
