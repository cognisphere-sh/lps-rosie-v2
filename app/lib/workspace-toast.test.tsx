import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test, { afterEach, beforeEach } from 'node:test'
import React from 'react'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { JSDOM } from 'jsdom'
import ts from 'typescript'

const require = createRequire(import.meta.url)
let dom: JSDOM

type FrameModule = {
  WorkspaceFrame: React.ComponentType<Record<string, unknown>>
  useToast: () => (message: string, tone?: 'success' | 'error') => void
}

function loadFrame(): FrameModule {
  const source = readFileSync(new URL('../components/workspace/frame.tsx', import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } })
  const mocks: Record<string, unknown> = {
    'next/navigation': { useRouter: () => ({ refresh() {}, push() {}, replace() {} }) },
    'next/link': { __esModule: true, default: ({ children, ...props }: Record<string, unknown>) => <a {...props}>{children as React.ReactNode}</a> },
    '@/components/pwa/pwa-provider': { usePWA: () => ({ isStandalone: false }) },
    '@/components/pwa/install-app-button': { InstallAppButton: () => null },
    '@/components/workspace/icons': require('../components/workspace/icons.tsx'),
    '@/lib/utils': require('./utils.ts'),
  }
  const module = { exports: {} as FrameModule }
  new Function('require', 'module', 'exports', outputText)((name: string) => name in mocks ? mocks[name] : require(name), module, module.exports)
  return module.exports
}

beforeEach(() => {
  dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/requests', pretendToBeVisual: true })
  const win = dom.window
  Object.defineProperty(win, 'matchMedia', { configurable: true, value: (query: string) => ({
    matches: query.includes('min-width'), media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
  }) })
  for (const [key, value] of Object.entries({
    window: win, self: win, document: win.document, navigator: win.navigator,
    localStorage: win.localStorage, sessionStorage: win.sessionStorage,
    HTMLElement: win.HTMLElement, HTMLInputElement: win.HTMLInputElement, HTMLTextAreaElement: win.HTMLTextAreaElement,
    Node: win.Node, getComputedStyle: win.getComputedStyle,
    requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 0),
    cancelAnimationFrame: (id: number) => clearTimeout(id),
    IS_REACT_ACT_ENVIRONMENT: true,
  })) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
})
afterEach(() => {
  cleanup()
  dom.window.close()
})

function setup() {
  const { WorkspaceFrame, useToast } = loadFrame()
  let toast: ReturnType<typeof useToast> = () => {}
  function Grab() { toast = useToast(); return null }
  const view = render(
    <WorkspaceFrame title="All jobs" theme={{ dark: false, toggle() {} }} nav={[]} activeId="requests"
      mobileBarLeft={() => null} mobileBarRight={() => null}>
      <Grab />
    </WorkspaceFrame>,
  )
  return { view, toast: (message: string, tone?: 'success' | 'error') => act(() => toast(message, tone)) }
}

test('a confirmation is announced politely and clears itself', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const { view, toast } = setup()
  toast('Price updated')
  const region = view.getByText('Price updated').closest('[aria-live]')!
  assert.equal(region.getAttribute('aria-live'), 'polite')
  assert.equal(view.queryByRole('alert'), null)
  act(() => t.mock.timers.tick(4100))
  assert.equal(view.queryByText('Price updated'), null)
})

test('a failure is an alert that stays until it is dismissed', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const { view, toast } = setup()
  toast('Could not save Price — the record was busy. Try again in a moment.', 'error')
  const alert = view.getByRole('alert')
  assert.match(alert.textContent!, /Could not save Price/)
  act(() => t.mock.timers.tick(30_000))
  assert.ok(view.getByRole('alert'), 'an error never times out')
  fireEvent.click(view.getByRole('button', { name: 'Dismiss' }))
  assert.equal(view.queryByRole('alert'), null)
})

test('the frame gives every page a main landmark, a skip link and a heading', () => {
  const { view } = setup()
  assert.equal(view.getByRole('main').id, 'main-content')
  assert.equal(view.getByRole('link', { name: 'Skip to content' }).getAttribute('href'), '#main-content')
  assert.equal(view.getByRole('heading', { level: 1 }).textContent, 'All jobs')
})
