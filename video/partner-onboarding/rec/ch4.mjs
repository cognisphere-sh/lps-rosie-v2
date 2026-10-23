// Chapter 4: Substitutes, notes and submitting (phone).
import { recorder, reset } from './lib.mjs'

reset('S3')
const R = await recorder('ch4')
const p = await R.device('P')
const { page } = p
const line = (name) => page.getByRole('article', { name: new RegExp(`^Line \\d+, ${name}`) })
const status = (name) => line(name).getByRole('button', { name: /status, / })

await p.login()
await p.goto('/partner/2/requests/1')
await R.start(p, 'a')

await R.beat('4.0')
await p.scroll(500, { speed: 700 })
await p.ring(line("Texas Redbud 'Oklahoma'"), { hold: 1200 })
await p.ring(await p.span(status("Texas Redbud 'Oklahoma'"), line("Texas Redbud 'Oklahoma'").getByRole('textbox', { name: /price per unit/ })), { hold: 1600 })
await p.ring(line("Texas Redbud 'Oklahoma'").getByRole('button', { name: /supplier reply/ }))

await R.beat('4.1')
await p.click(status("Texas Redbud 'Oklahoma'"), { pause: 500 })
await p.click(page.getByRole('option', { name: 'Diff Sz/Sub', exact: true }), { pause: 600 })

await R.beat('4.2')
await p.ring(page.getByText('Can you offer a substitute?'), { hold: 900 })
await p.click(page.getByText("30 G Texas Redbud 'Oklahoma'"), { pause: 700 })
await p.click(page.getByRole('button', { name: 'Submit', exact: true }), { pause: 900 })

await R.beat('4.3')
await p.click(status('Red Yucca'), { pause: 500 })
await p.click(page.getByRole('option', { name: 'Unavailable', exact: true }), { pause: 700 })
await p.ring(page.getByRole('textbox', { name: 'Something else' }).first())

await R.beat('4.4')
await p.ring(page.getByRole('button', { name: 'No Sub' }), { hold: 700 })
await p.click(page.getByRole('button', { name: 'No Sub' }), { pause: 900 })

await R.beat('4.5')
await p.ring(line('Mexican Feathergrass'))

await R.beat('4.6')
const note = page.getByRole('textbox', { name: 'Note for this request' })
// Centre the card so the sticky Submit bar doesn't cover it (or its ring).
await note.evaluate((e) => e.scrollIntoView({ block: 'center', behavior: 'smooth' }))
await R.sleep(700)
await p.click(note, { pause: 400 })
await p.type('We can deliver Tuesday to Thursday, 7am to 3pm. Trees tagged on request.', { delay: 40 })
// The card sits at the end of the page, partly under the sticky Submit bar: ring the
// visible part (its label and the note box), stopping just above the bar.
const nb = await p.box(note), sb = await p.box(page.getByRole('button', { name: 'Submit availability' }))
const top = nb.y - 26, bottom = Math.min(nb.y + nb.height, sb.y - 10)
await p.ring({ x: nb.x, y: top, width: nb.width, height: bottom - top })
await page.evaluate(() => document.activeElement?.blur()) // close the keyboard so the bottom bar settles
await R.sleep(700)

await R.beat('4.7')
await p.click(page.getByRole('button', { name: 'Submit availability' }), { pause: 700 })

await R.beat('4.8')
await p.ring(await p.span(page.getByText(/still has no answer/), page.getByRole('button', { name: 'Submit anyway' })), { hold: 2600 })
await R.until(0.8)
await p.click(page.getByRole('button', { name: 'Submit anyway' }), { pause: 400 })

await R.beat('4.9')
await page.getByText('Availability received').waitFor()
await R.sleep(3600)
await p.click(page.getByRole('link', { name: /^Back to availability requests/ }).or(page.getByRole('button', { name: /^Back to availability requests/ })).first(), { pause: 1000 })
await p.click(page.getByRole('button', { name: /^Completed: / }), { pause: 900 })
await p.ring(page.locator('article', { has: page.getByRole('link', { name: /Barton Hills/ }) }).first())
await R.settle()
await R.done()
