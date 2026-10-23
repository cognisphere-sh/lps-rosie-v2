// Template for video/partner-onboarding/rec/chN.mjs. Copy, rename, fill in.
// Run: FAST=1 node rec/chN.mjs (dry run), then node rec/chN.mjs (real take),
// with demo/local.env exported and the demo stack running.
import { recorder, reset } from './lib.mjs'

reset('S2') // the chapter's starting checkpoint
const R = await recorder('chN')
const d = await R.device('D') // desktop 1440×900 @2×; R.device('P') = phone 390×844 @3×
const { page } = d

await d.login() // jordan, current password for checkpoints ≥ S2
await d.goto('/partner/2')
R.card('N.1') // a motion-graphic beat, no footage (only if script.md says so)

await R.start(d, 'a') // one take per continuous device shot
await R.beat('N.2') // narration line N.2 starts here; the previous beat is held until its line ends
await d.ring(page.getByRole('group', { name: 'Request work buckets' }), { hold: 1200 })
await d.click(page.getByRole('button', { name: /^Completed: / }), { pause: 800 })

await R.beat('N.3')
await d.zoom(await d.card('Barton Hills Residence – Front Yard'), 1.5)
await d.ring(page.getByText('Delivery', { exact: true }).first())
await d.unzoom()

// Phone: type, then blur before tapping a button (the layout shifts when the keyboard closes).
// await p.click(page.getByPlaceholder('Message…')); await p.type('…')
// await page.evaluate(() => document.activeElement?.blur()); await R.sleep(600)

await R.settle() // hold the last beat until its narration has played
await R.done() // encodes footage/chN/<take>.mp4 + marks.json
