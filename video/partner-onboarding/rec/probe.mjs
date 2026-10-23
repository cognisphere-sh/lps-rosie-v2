// Dev helper: run a snippet against the demo portal and save screenshots.
//   node rec/probe.mjs <snippet.mjs> [D|P] [path]
import { chromium } from 'playwright-core'
import { pathToFileURL } from 'node:url'
const [snippet, kind = 'D', path = '/partner/2'] = process.argv.slice(2)
const B = 'http://localhost:3217'
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const ctx = await browser.newContext(kind === 'D' ? { viewport: { width: 1440, height: 900 } }
  : { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
const page = await ctx.newPage()
await page.request.post(B + '/api/auth/login', { data: { username: 'jordan', password: process.env.PW ?? 'Bluebonnet-Row-26' } })
await page.goto(B + path); await page.waitForLoadState('networkidle').catch(() => {})
const shot = (n) => page.screenshot({ path: `${process.env.OUT}/${n}.png` })
try { await (await import(pathToFileURL(snippet).href)).default({ page, shot, ctx }) }
catch (e) { console.log('ERR', e.message.split('\n')[0]); await shot('error') }
await browser.close()
