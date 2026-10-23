// Chapter 5: After you submit (desktop).
import { recorder, reset } from './lib.mjs'

reset('S4')
const R = await recorder('ch5')
const d = await R.device('D')
const { page } = d
const row = (name) => page.locator('div.grid', { has: page.getByText(name, { exact: true }) }).last()
const barton = page.locator('article', { has: page.getByRole('link', { name: /Barton Hills/ }) }).first()

await d.login()
await d.goto('/partner/2')
await R.start(d, 'a')

await R.beat('5.1')
await d.click(page.getByRole('button', { name: /^Completed: / }), { pause: 700 })
await d.ring(barton.getByText('Completed', { exact: true }))

await R.beat('5.2')
await d.click(barton, { pause: 900 })
await page.getByText(/^7 lines · 1 pending$/).waitFor()

await R.beat('5.3')
await d.zoom(await d.span(row('Mexican Feathergrass')), 1.4)
await d.click(row('Mexican Feathergrass').getByRole('button', { name: /^Line status/ }))
await d.click(page.getByRole('option', { name: 'Available', exact: true }), { pause: 900 })
await d.unzoom()
await d.scroll(-800)
await d.ring(page.getByText(/^7 lines · 0 pending$/))

await R.beat('5.4')
await d.ring(page.getByText('Processing', { exact: true }).first(), { hold: 1200 })
await d.click(page.getByRole('button', { name: 'Re-Submit availability' }), { pause: 400 })
await page.getByText('Update received').waitFor()
await R.sleep(3300)

await R.beat('5.5')
await d.click(page.getByRole('button', { name: /^Share/ }), { pause: 1100 })
await d.ring(page.getByText('Private request'), { hold: 800 })
await d.click(page.getByRole('button', { name: 'Make public' }), { pause: 1000 })
await d.ring(page.getByRole('button', { name: /Copy public URL/ }))

await R.beat('5.6')
// Open the copied link as a colleague would: the public page, no portal around it.
const url = await page.getByRole('textbox', { name: 'Public request URL' }).inputValue()
await page.goto(url)
await page.waitForLoadState('networkidle')
await R.sleep(2600)
await page.goBack()
await page.waitForLoadState('networkidle')
await R.sleep(600)
await d.click(page.getByRole('button', { name: /^Share/ }), { pause: 900 })
await d.click(page.getByRole('button', { name: 'Make private' }), { pause: 700 })
await d.ring(page.getByText(/Previous link revoked/))

await R.beat('5.7')
await page.keyboard.press('Escape')
await d.moveTo(page.getByRole('button', { name: 'Print' }))
await R.sleep(500)
// Headless Chrome has no print preview: show the print stylesheet in the page instead.
await page.emulateMedia({ media: 'print' })
await R.sleep(2200)
await d.zoom({ x: 0, y: 0, width: 960, height: 600 }, 1.5) // the sheet's title and first rows
await R.sleep(2500)
await d.unzoom()
await R.until(0.95)
await page.emulateMedia({ media: 'screen' })

await R.beat('5.8')
await d.click(page.getByRole('link', { name: 'Order/Request History' }), { pause: 900 })
await d.click(page.getByRole('link', { name: 'Requests', exact: true }).or(page.getByRole('tab', { name: 'Requests' })).or(page.getByRole('button', { name: 'Requests', exact: true })).first(), { pause: 900 })
await d.ring(page.locator('main').getByText(/^\d+ requests?$/))
await R.settle()
await R.done()
