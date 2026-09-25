import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { scrollPlantNameWithKeyboard } from './plant-name-scroll.ts'

const overflowingName = () => ({ clientWidth: 120, scrollLeft: 0, scrollWidth: 360 })

function cssToken(block: string, name: string) {
  return block.match(new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})`))?.[1]
}

function contrast(a: string, b: string) {
  const luminance = (hex: string) => {
    const channels = hex.slice(1).match(/.{2}/g)!.map((value) => Number.parseInt(value, 16) / 255)
    const linear = channels.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]
  }
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (lighter + 0.05) / (darker + 0.05)
}

test('arrow keys move only within the plant name scroll range', () => {
  const target = overflowingName()

  assert.equal(scrollPlantNameWithKeyboard(target, 'ArrowRight'), true)
  assert.equal(target.scrollLeft, 72)

  target.scrollLeft = 230
  scrollPlantNameWithKeyboard(target, 'ArrowRight')
  assert.equal(target.scrollLeft, 240)

  scrollPlantNameWithKeyboard(target, 'ArrowLeft')
  assert.equal(target.scrollLeft, 168)
})

test('Home and End expose either edge of a long plant name', () => {
  const target = overflowingName()

  assert.equal(scrollPlantNameWithKeyboard(target, 'End'), true)
  assert.equal(target.scrollLeft, 240)

  assert.equal(scrollPlantNameWithKeyboard(target, 'Home'), true)
  assert.equal(target.scrollLeft, 0)
})

test('unhandled keys and names that fit leave browser keyboard behavior alone', () => {
  const target = overflowingName()
  assert.equal(scrollPlantNameWithKeyboard(target, 'Enter'), false)
  assert.equal(target.scrollLeft, 0)

  const fitting = { clientWidth: 120, scrollLeft: 0, scrollWidth: 120 }
  assert.equal(scrollPlantNameWithKeyboard(fitting, 'ArrowRight'), false)
  assert.equal(fitting.scrollLeft, 0)
})

test('the scrollbar thumb clears 3:1 against its light and dark row surfaces', () => {
  const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8')
  const root = css.match(/:root\s*\{([^}]*)\}/)?.[1] ?? ''
  const dark = css.match(/\.dark\s*(?:,[^{]+)?\s*\{([^}]*)\}/)?.[1] ?? ''
  const standard = css.match(/\.lps-plant-name-scroll\s*\{([^}]*)\}/)?.[1] ?? ''
  const thumb = css.match(/\.lps-plant-name-scroll::\-webkit-scrollbar-thumb\s*\{([^}]*)\}/)?.[1] ?? ''

  assert.match(standard, /scrollbar-color:\s*var\(--muted-foreground\)\s+transparent/)
  assert.match(thumb, /background:\s*var\(--muted-foreground\)/)
  for (const theme of [root, dark]) {
    const color = cssToken(theme, 'muted-foreground')!
    for (const surface of ['card', 'lps-tint']) {
      assert.ok(contrast(color, cssToken(theme, surface)!) >= 3, `${surface} contrast must be at least 3:1`)
    }
  }
})
