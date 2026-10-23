// Chapter 2: Finding your way around (desktop, with a phone cut for the bottom bar).
import { recorder, reset } from './lib.mjs'

reset('S2')
const R = await recorder('ch2')
const d = await R.device('D')
const p = await R.device('P')
const card = (page, name) => page.locator('article', { has: page.getByRole('link', { name: new RegExp(name) }) }).first()

await d.login(); await p.login()
await p.goto('/partner/2')
await d.goto('/partner/2')
const { page } = d
await R.start(d, 'a')

await R.beat('2.1')
await d.ring(page.getByRole('link', { name: 'Availability Requests' }).first(), { hold: 1000 })
await d.ring(page.getByText('Supplier portal · Local Plant Supply').locator('xpath=..'))

await R.beat('2.2')
await d.zoom(await d.span(card(page, 'Barton Hills'), card(page, 'Mueller')), 1.35)
await d.moveTo(card(page, 'Barton Hills'), { ms: 900 })
await R.sleep(1500)
await d.moveTo(card(page, 'Mueller'), { ms: 900 })

await R.beat('2.3')
await d.unzoom()
await d.ring(page.getByRole('group', { name: 'Request work buckets' }))

await R.beat('2.4')
for (const b of ['New', 'Processing', 'Completed']) {
  await d.ring(page.getByRole('button', { name: new RegExp(`^${b}: `) }), { hold: 1900 })
}

await R.beat('2.5')
await d.click(page.getByRole('button', { name: /^Completed: / }), { pause: 1600 })
await d.click(page.getByRole('button', { name: /^Completed: / }), { pause: 500 })

await R.beat('2.6')
const barton = card(page, 'Barton Hills')
await d.zoom(barton, 1.9)
for (const part of [barton.getByText('New', { exact: true }), barton.getByText('Barton Hills Residence – Front Yard'),
  barton.getByText(/^\w{3}, \d\d\/\d\d$/), barton.getByText('Delivery', { exact: true }), barton.getByText(/^\d+ items?$/), barton.getByText(/^\$/)]) {
  await d.ring(part, { hold: 850 })
}

await R.beat('2.7')
await d.unzoom()
for (const l of ['Orders', 'Availability Requests', 'Order/Request History', 'Settings']) {
  await d.ring(page.getByRole('link', { name: l }).first(), { hold: 1200 })
}
await R.settle()
await R.stop()

await R.start(p, 'b')
await R.beat('2.8')
const bar = p.page.getByRole('button', { name: 'More' }).locator('xpath=ancestor::nav[1]')
await p.ring(bar, { hold: 1300 })
await p.click(p.page.getByRole('button', { name: 'More' }), { pause: 1800 })
await p.click(p.page.getByRole('button', { name: 'More' }), { pause: 600 })

// The desktop home page draws the bell's popover under the request list (app bug),
// so the bell is shown on the phone, where the Alerts popover renders correctly.
await R.beat('2.9')
await p.click(p.page.getByRole('button', { name: /^Alerts|^Notifications/ }).first(), { pause: 900 })
await p.ring(p.page.getByText('New availability request — needs your answer.').first())

await R.beat('2.10')
await R.sleep(4000)
await p.click(p.page.getByRole('button', { name: /^Alerts|^Notifications/ }).first(), { pause: 400 })
await R.settle()
await R.done()
