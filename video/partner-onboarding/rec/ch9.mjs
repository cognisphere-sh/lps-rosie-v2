// Chapter 9: Settings, the app and handy tips (phone and desktop).
import { recorder, reset } from './lib.mjs'

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1'
reset('S4')
const R = await recorder('ch9')
const ip = await R.device('P', { ua: IPHONE })
const d = await R.device('D')
const p = await R.device('P')
R.card('9.1')
await ip.login(); await d.login(); await p.login()
await ip.goto('/partner/2'); await d.goto('/partner/2'); await p.goto('/partner/2')
const more = (pg) => pg.getByRole('button', { name: 'More' })

await R.start(ip, 'a')
await R.beat('9.2')
await ip.click(more(ip.page), { pause: 700 })
await ip.click(ip.page.getByText('Install app', { exact: true }), { pause: 1200 })
await ip.ring(ip.page.getByText('Add to Home Screen').first(), { hold: 1200 })
await R.until(0.85)
await ip.click(ip.page.getByRole('button', { name: 'Got it' }), { pause: 500 })

await R.beat('9.3')
// The More menu stays open behind the install sheet; open it only if it closed.
if (!(await ip.page.getByText('Settings', { exact: true }).isVisible())) await ip.click(more(ip.page), { pause: 600 })
await ip.click(ip.page.getByText('Settings', { exact: true }), { pause: 1100 })
await ip.ring(ip.page.getByText(/^Signed in as jordan/))
await R.settle()
await R.stop()

const { page } = d
await R.start(d, 'b')
await R.beat('9.4')
await d.click(page.getByRole('button', { name: 'By item' }), { pause: 1100 })
await d.click(page.getByRole('button', { name: /Live Oak/ }).first(), { pause: 900 })
await d.ring(await d.card('Live Oak'))

await R.beat('9.5')
await d.click(page.getByRole('button', { name: 'By status' }), { pause: 1300 })
await d.zoom(await d.span(await d.card('Can Order'), await d.card('Arriving Soon')), 1.3)
await R.sleep(2200)
await d.unzoom()
await R.settle()
await R.stop()

await R.start(p, 'c')
await R.beat('9.6')
await p.click(more(p.page), { pause: 600 })
// The row is labelled with the current theme and toggles it.
const theme = (name) => p.page.getByText(name, { exact: true })
await p.ring(theme('Light mode'), { hold: 600 })
await p.click(theme('Light mode'), { pause: 1500 })
if (!(await theme('Dark mode').isVisible())) await p.click(more(p.page), { pause: 500 })
await p.click(theme('Dark mode'), { pause: 700 })
if (!(await p.page.getByText('Log out', { exact: true }).isVisible())) await p.click(more(p.page), { pause: 500 })
await p.ring(p.page.getByText('Log out', { exact: true }))
await R.settle()
R.card('9.7')
R.card('9.8')
await R.done()
