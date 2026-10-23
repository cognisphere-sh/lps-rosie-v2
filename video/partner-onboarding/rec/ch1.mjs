// Chapter 1: Welcome and signing in (phone). The first sign-in is filmed first;
// the montage (1.2) and the closing shot (1.8) need a signed-in portal, so they
// are taken afterwards. Beat order comes from narration.json, not take order.
import { recorder, reset } from './lib.mjs'

reset('S1')
const R = await recorder('ch1')
const p = await R.device('P')
const { page } = p
R.card('1.1')
R.card('1.3')

await p.goto('/login')
await R.start(p, 'a')
await R.beat('1.4')
await p.click(page.getByLabel('Username'))
await p.type('jordan', { delay: 70 })
await p.click(page.getByLabel('Password'))
await p.type('k7mq-x2pn-r4tz-w8hd', { delay: 45 })
await p.click(page.getByRole('button', { name: 'Sign in' }), { pause: 1200 })

await R.beat('1.5')
await page.getByText('Choose a password').first().waitFor()
await p.ring(page.getByText(/You signed in with a password we generated/))

await R.beat('1.6')
await p.click(page.getByLabel('Current password'))
await p.type('k7mq-x2pn-r4tz-w8hd', { delay: 35 })
await p.click(page.getByLabel('New password'))
await p.type('Bluebonnet-Row-26', { delay: 40 })
await p.ring(page.getByText(/At least 10 characters/), { hold: 400 })
await p.click(page.getByLabel('Confirm new password'))
await p.type('Bluebonnet-Row-26', { delay: 40 })
await page.evaluate(() => document.activeElement?.blur())
await R.sleep(500)

await R.beat('1.7')
await p.click(page.getByRole('button', { name: 'Save and continue' }), { pause: 1500 })
await page.waitForURL(/\/partner\/2/)
await R.settle()
await R.stop()

// 1.2: what the portal is for, in three quick cuts.
await R.start(p, 'b')
await R.beat('1.2')
await R.sleep(1600)
await p.click(page.getByRole('link', { name: 'Orders', exact: true }).last(), { pause: 1500 })
await p.click(page.getByRole('button', { name: /^Chat with Local Plant Supply/ }).last(), { pause: 1800 })
await R.settle()
await R.stop()

const d = await R.device('D')
await d.login()
await d.goto('/partner/2')
await R.start(d, 'c')
await R.beat('1.8')
await R.sleep(1200)
await R.settle()
await R.done()
