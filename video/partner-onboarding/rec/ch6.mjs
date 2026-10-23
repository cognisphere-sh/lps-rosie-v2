// Chapter 6: Answering by photo, text or voice (phone). The supplier answers three
// requests from the chat; LPS (the stand-in harness) acknowledges each one, then the
// answers are entered the way LPS would after checking them, and show in the portal.
import { execFileSync } from 'node:child_process'
import { recorder, reset } from './lib.mjs'

const ROOT = new URL('..', import.meta.url).pathname
const MOCK = 'http://127.0.0.1:4799'
const DB = process.env.DEMO_DB ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const cue = (path, body) => fetch(MOCK + path, { method: 'POST', headers: { 'x-app-secret': 'demo-secret' }, body: JSON.stringify(body) })

reset('S5')
await cue('/demo/replies', [
  { match: 'image', reply: 'Got the Zilker Courtyard sheet, thanks! We’ll enter it for you.' },
  { match: 'audio', reply: 'Got your voice note. Feathergrass available on Mueller, thanks!' },
  { match: 'barton', reply: 'Thanks! Barton Hills: all available except Red Yucca. We’ll update it.' },
  { match: '.', reply: 'Thanks, got it.' },
])

const R = await recorder('ch6')
const p = await R.device('P')
const { page } = p
// Headless Chrome's fake microphone never resolves: getUserMedia plays the voice note instead.
await p.ctx.route('**/__voice.wav', (route) => route.fulfill({ path: ROOT + 'demo/jordan-voice-mueller.wav', contentType: 'audio/wav' }))
await p.ctx.addInitScript(() => {
  navigator.mediaDevices.getUserMedia = async () => {
    const ac = new AudioContext()
    const buf = await ac.decodeAudioData(await (await fetch('/__voice.wav')).arrayBuffer())
    const src = ac.createBufferSource(); src.buffer = buf
    const dest = ac.createMediaStreamDestination(); src.connect(dest); src.start()
    return dest.stream
  }
})
const card = (name) => page.locator('article', { has: page.getByRole('link', { name: new RegExp(name) }) }).first()
const chat = () => page.getByRole('button', { name: /^Chat with Local Plant Supply/ }).last()
const composer = () => page.getByPlaceholder('Message…')
const blur = async () => { await page.evaluate(() => document.activeElement?.blur()); await R.sleep(600) }

await p.login()
await p.goto('/partner/2')
await R.start(p, 'a')

await R.beat('6.1')
await p.ring(card('Zilker Courtyard'), { hold: 1600 })
await p.ring(card('Barton Hills'))

await R.beat('6.2')
await p.click(chat(), { pause: 1000 })
const chooser = page.waitForEvent('filechooser')
await p.click(page.getByRole('button', { name: 'Attach a file' }), { pause: 200 })
await (await chooser).setFiles(ROOT + 'demo/photos/zilker-sheet-photo.jpg')
await R.sleep(900)
await p.click(composer())
await p.type('Zilker Courtyard sheet, filled in.', { delay: 45 })
await blur()
await p.click(page.getByRole('button', { name: 'Send', exact: true }), { pause: 1200 })

await R.beat('6.3')
await p.ring(page.locator('img[alt="zilker-sheet-photo.jpg"]').last())
await R.reply(p, 'Got the Zilker Courtyard sheet')

await R.beat('6.4')
await p.click(composer())
await p.type('Barton Hills: everything’s available except the Red Yucca, we’re out until spring.', { delay: 35 })
await blur()
await p.click(page.getByRole('button', { name: 'Send', exact: true }), { pause: 300 })
await R.reply(p, 'Barton Hills: all available except Red Yucca')

await R.beat('6.5')
await p.click(page.getByRole('button', { name: 'Record a voice note' }), { pause: 200 })
await R.sleep(8600)
await p.click(page.getByRole('button', { name: 'Send voice note' }), { pause: 3000 })

await R.beat('6.6')
// What LPS enters after checking the three messages (only what the supplier said).
execFileSync('psql', [DB, '-q', '-v', 'ON_ERROR_STOP=1', '-f', ROOT + 'demo/chat-answers.sql'])
await cue('/demo/reply', { threadId: 'supplier-hill-country-growers', text: 'All three requests are updated. Have a look in Requests.' })
await R.reply(p, 'All three requests are updated')
await R.sleep(2600)

await R.beat('6.7')
await p.click(page.getByRole('button', { name: 'Hide chat' }), { pause: 900 })
await p.click(card('Barton Hills').getByRole('link').first(), { pause: 1400 })
await p.scroll(1500, { speed: 1400 })

await R.beat('6.8')
await p.ring(page.getByRole('article', { name: /Red Yucca/ }))
await R.settle()
await R.done()
