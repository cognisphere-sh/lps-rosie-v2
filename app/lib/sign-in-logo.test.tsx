import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { JSDOM } from 'jsdom'
import { renderToStaticMarkup } from 'react-dom/server'

import { AuthFrame } from '../components/auth-frame.tsx'
import { loginDestination } from './login-return.ts'

const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')
const login = source('../app/login/page.tsx')

function frame(signInLogo?: boolean) {
  return new JSDOM(renderToStaticMarkup(
    <AuthFrame signInLogo={signInLogo}><form aria-label="Test sign-in"><button>Sign in</button></form></AuthFrame>,
  ))
}

test('the sign-in asset is the unchanged supplied RGBA PNG, not the private reference', () => {
  const png = readFileSync(new URL('../public/lps-sign-in-logo.png', import.meta.url))
  assert.equal(createHash('sha256').update(png).digest('hex'), '0a6a32c51631ad2f8e6669c8d77ca91a77d7eb3ddcbd5981e842e90a25af2ba5')
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a')
  assert.equal(png.subarray(12, 16).toString('ascii'), 'IHDR')
  assert.equal(png.readUInt32BE(16), 1600)
  assert.equal(png.readUInt32BE(20), 533)
  assert.equal(png[24], 8)
  assert.equal(png[25], 6, 'RGBA, not flattened RGB')
})

test('the supplied logo is opt-in for both login branches, not change-password or other callers', () => {
  assert.match(login, /return \(\s*<AuthFrame signInLogo>/)
  assert.match(login, /<Suspense fallback=\{<AuthFrame signInLogo>\{null\}<\/AuthFrame>\}>/)
  assert.equal((login.match(/<AuthFrame\b/g) ?? []).length, 2)
  assert.equal((login.match(/<AuthFrame signInLogo>/g) ?? []).length, 2)
  const changePassword = source('../app/change-password/page.tsx')
  assert.match(changePassword, /<AuthFrame>/)
  assert.doesNotMatch(changePassword, /signInLogo|lps-sign-in-logo/)
})

test('the default shared frame retains its original stacked wordmark and decorations', () => {
  const dom = frame()
  try {
    const doc = dom.window.document
    assert.equal(doc.querySelector('h1')?.textContent?.trim(), 'Local Plant Supply')
    assert.match(doc.querySelector('h1')!.className, /max-w-\[9ch\].*text-\[40px\].*lg:text-\[84px\]/)
    assert.equal(doc.querySelectorAll('img').length, 0)
    assert.equal(doc.querySelectorAll('section svg').length, 2, 'leaf and seedling row remain')
    assert.match(doc.querySelector('section')!.className, /bg-primary/)
  } finally {
    dom.window.close()
  }
})

test('the logo reserves its full aspect ratio and available width before load, with no alteration', () => {
  const dom = frame(true)
  try {
    const doc = dom.window.document
    const heading = doc.querySelector('h1')!
    const image = heading.querySelector('img')!
    assert.equal(doc.querySelectorAll('img').length, 1)
    assert.equal(image.getAttribute('src'), '/lps-sign-in-logo.png')
    assert.equal(image.getAttribute('width'), '1600')
    assert.equal(image.getAttribute('height'), '533')
    assert.match(heading.className, /aspect-\[1600\/533\] w-full max-w-\[800px\]/)
    assert.match(image.className, /h-full w-full object-contain/)
    assert.doesNotMatch(image.outerHTML, /object-cover|filter|invert|mix-blend|style=/)
    assert.match(doc.querySelector('section')!.className, /bg-primary/)
    assert.equal(doc.querySelectorAll('section svg').length, 2)
  } finally {
    dom.window.close()
  }
})

test('branding has one accessible heading, no new action, and survives a missing image', () => {
  const dom = frame(true)
  try {
    const doc = dom.window.document
    const heading = doc.querySelector('h1')!
    const image = heading.querySelector('img')!
    assert.equal(doc.querySelectorAll('h1').length, 1)
    assert.equal(heading.textContent?.trim(), 'Local Plant Supply')
    assert.equal(heading.querySelector('span')!.className, 'sr-only')
    assert.equal(image.getAttribute('alt'), '')
    assert.equal(image.getAttribute('aria-hidden'), 'true', 'name is spoken once, by the heading')
    assert.equal(doc.querySelectorAll('section a, section button, section [tabindex]').length, 0)
    image.remove() // Missing artwork must not remove the name, reserved box or form.
    assert.equal(heading.textContent?.trim(), 'Local Plant Supply')
    assert.match(heading.className, /aspect-\[1600\/533\]/)
    assert.ok(doc.querySelector('form[aria-label="Test sign-in"] button'))
  } finally {
    dom.window.close()
  }
})

test('the sign-in form keeps credential, autofill, busy/error and safe-return contracts', () => {
  assert.match(login, /fetch\('\/api\/auth\/login', \{\s*method: 'POST'/)
  assert.match(login, /body: JSON\.stringify\(\{ username, password \}\)/)
  assert.match(login, /router\.push\(loginDestination\(params\.get\('next'\), body\.next \?\? '\/'\)\)/)
  assert.match(login, /<form onSubmit=\{submit\}/)
  assert.match(login, /<CardTitle role="heading" aria-level=\{2\}[^>]*>Sign in<\/CardTitle>/)
  for (const name of ['username', 'password']) {
    assert.ok(login.includes(`<Label htmlFor="${name}">`))
    assert.ok(login.includes(`id="${name}"`))
    assert.ok(login.includes(`name="${name}"`))
  }
  assert.match(login, /autoComplete="username"/)
  assert.match(login, /autoComplete="current-password"/)
  assert.match(login, /autoCapitalize="none"\s+autoCorrect="off"\s+spellCheck=\{false\}\s+autoFocus/)
  assert.match(login, /disabled=\{busy \|\| !username \|\| !password\}/)
  assert.match(login, /\{busy \? 'Signing in…' : 'Sign in'\}/)
  assert.match(login, /<AlertDescription>\{error\}<\/AlertDescription>/)
  assert.equal(loginDestination('/jobs?jr=71', '/suppliers'), '/jobs?jr=71')
  assert.equal(loginDestination('/jobs?jr=71', '/change-password'), '/change-password')
  assert.equal(loginDestination('//evil.example/jobs', '/partner/7'), '/partner/7')
})
