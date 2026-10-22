import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { APP_ACCENTS, appAccentStyle } from './app-appearance.ts'

const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')
const layout = source('../app/layout.tsx')
const shell = source('../components/workspace/shell.tsx')
const manifest = JSON.parse(source('../public/manifest.json'))

test('browser and installed Android chrome share the existing dark card charcoal', () => {
  assert.match(layout, /themeColor: '#1A1A1A'/)
  assert.equal(manifest.theme_color, '#1A1A1A')
  assert.match(source('../app/globals.css'), /\.dark,[\s\S]*?--card: #1A1A1A;/)
  assert.equal(manifest.background_color, '#F9FCF7')
  assert.match(layout, /statusBarStyle: 'black-translucent'/)
  assert.match(source('../app/public/availability/[token]/page.tsx'), /themeColor: '#0A0A0A'/)
})

test('saved accents still style page controls in both modes, not browser metadata', () => {
  assert.doesNotMatch(shell, /theme-color|appAccentColor/)
  assert.match(source('../components/workspace/settings/app-appearance.tsx'), /The browser title bar stays charcoal\./)
  assert.match(shell, /setAppAccent\(readAppAccent\(window\.localStorage\.getItem\(APP_APPEARANCE_STORE\)\)\)/)
  assert.match(shell, /appAccentStyle\(appAccent, dark\)/)
  for (const accent of APP_ACCENTS) {
    for (const dark of [false, true]) {
      const style = appAccentStyle(accent.id, dark) as Record<string, string>
      assert.equal(style['--primary'], dark ? accent.dark : accent.light)
      assert.equal(style['--sidebar-primary'], dark ? accent.dark : accent.light)
    }
  }
})
