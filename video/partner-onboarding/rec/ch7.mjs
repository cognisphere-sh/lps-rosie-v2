// Chapter 7: Orders (phone, with a desktop insert for the change log).
import { recorder, reset } from './lib.mjs'

reset('S2')
const R = await recorder('ch7')
const p = await R.device('P')
const d = await R.device('D')
const { page } = p
const line = (name) => page.getByRole('article', { name: new RegExp(`^Line \\d+, ${name}`) })

await p.login(); await d.login()
await d.goto('/partner/2/orders')
await p.goto('/partner/2')
await R.start(p, 'a')

await R.beat('7.1')
await p.click(page.getByRole('link', { name: 'Orders', exact: true }).last(), { pause: 1000 })

await R.beat('7.2')
await p.ring(page.getByRole('group', { name: 'Order work buckets' }), { hold: 1500 })
await p.ring(page.getByRole('button', { name: /^Ready: / }))

await R.beat('7.3')
await p.click(page.getByRole('link', { name: /^New order/ }).first(), { pause: 1000 })

await R.beat('7.4')
await p.ring(await p.span(page.getByRole('button', { name: 'Additional details' }), page.getByText('Net 30 on LPS account')))

await R.beat('7.5')
await p.scroll(560, { speed: 700 })
await p.ring(line('Live Oak'))

await R.beat('7.6')
await p.click(page.getByRole('button', { name: 'Acknowledge Received' }).last(), { pause: 900 })
await p.ring(page.getByText(/If anything about this order changes/), { hold: 900 })
await p.click(page.getByRole('dialog').getByRole('button', { name: 'Acknowledge Received' }), { pause: 1200 })
await p.scroll(-900, { speed: 1200 })
await p.ring(page.getByText(/^Acknowledged:/))

await R.beat('7.7')
for (const [name, note] of [['Gulf Muhly', 'Arrived Tuesday, all 40 tagged'], ['Dwarf Yaupon Holly', 'In from our Tyler farm']]) {
  const sel = line(name).getByRole('combobox', { name: 'Update plant status' })
  await p.box(sel)
  await p.click(sel, { pause: 300 })
  await sel.selectOption({ label: 'Available' })
  await R.sleep(700)
  await p.fill(page.getByRole('dialog').getByRole('textbox'), note, { delay: 40 })
  if (name === 'Dwarf Yaupon Holly') await p.ring(page.getByText(/This is staged until you save/), { hold: 1200 })
  await p.click(page.getByRole('button', { name: 'Save status' }), { pause: 800 })
}

await R.beat('7.8')
const save = page.getByRole('button', { name: /^Save 2 status changes/ })
await p.ring(page.getByRole('contentinfo', { name: 'Save order status changes' }).or(save).first(), { hold: 1800 })
await p.click(save, { pause: 1200 })

await R.beat('7.9')
await p.click(page.getByRole('button', { name: 'Mark as Ready' }), { pause: 900 })
await p.click(page.getByRole('button', { name: /^Confirm: ready for/ }), { pause: 1200 })
await p.click(page.getByRole('link', { name: /^Back to orders/ }), { pause: 900 })
await p.click(page.getByRole('button', { name: /^Ready: / }), { pause: 900 })
await p.ring(page.locator('article', { has: page.getByRole('link', { name: /Order Ready order O-1|order O-1$/ }) }).first())

await R.beat('7.10')
await p.click(page.getByRole('button', { name: /^Chat with Local Plant Supply/ }), { pause: 2600 })
await p.click(page.getByRole('button', { name: 'Hide chat' }), { pause: 500 })
await R.settle()
await R.stop()

const dp = d.page
await R.start(d, 'b')
await R.beat('7.11')
await d.click(dp.getByRole('link', { name: /^Processing order/ }).first(), { pause: 1100 })
await d.click(dp.getByRole('button', { name: /Change log/ }), { pause: 700 })
await d.ring(await d.span(dp.getByRole('button', { name: /Change log/ }), dp.getByText(/Delivery moved to/)))

await R.beat('7.12')
await d.moveTo(dp.getByRole('button', { name: 'Print' }))
await d.click(dp.getByRole('button', { name: 'Print' }), { pause: 300 })
// Headless Chrome has no print preview: show the print stylesheet in the page instead.
await dp.emulateMedia({ media: 'print' })
await R.sleep(1500)
const head = (t) => dp.getByText(t, { exact: true })
await d.zoom(await d.span(dp.getByText('Cedar Park Medical Plaza', { exact: true }), dp.getByText(/^Subtotal/)), 1.4)
await d.ring(await d.span(head('Ready'), head('Need to Order')), { hold: 1500 })
await d.ring(head('Note'))
await R.until(0.95)
await d.unzoom()
await dp.emulateMedia({ media: 'screen' })
await R.settle()
await R.done()
