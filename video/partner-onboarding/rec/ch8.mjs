// Chapter 8: Chatting with Local Plant Supply (desktop and phone).
import { recorder, reset } from './lib.mjs'

const ROOT = new URL('..', import.meta.url).pathname
reset('S2')
const R = await recorder('ch8')
const d = await R.device('D')
const p = await R.device('P')
const dp = d.page, pp = p.page
const chatButton = (page) => page.getByRole('button', { name: /^Chat with Local Plant Supply/ }).last()
const lpsReply = (text) => fetch('http://127.0.0.1:4799/demo/reply', {
  method: 'POST', headers: { 'x-app-secret': 'demo-secret' },
  body: JSON.stringify({ threadId: 'supplier-hill-country-growers', text, path: '/partner/2/orders/1' }),
})

// Headless Chrome's fake microphone never resolves here, so the phone's
// getUserMedia returns a stream that plays Jordan's voice note instead.
await p.ctx.route('**/__voice.wav', (route) => route.fulfill({ path: ROOT + 'demo/jordan-voice.wav', contentType: 'audio/wav' }))
await p.ctx.addInitScript(() => {
  navigator.mediaDevices.getUserMedia = async () => {
    const ac = new AudioContext()
    const buf = await ac.decodeAudioData(await (await fetch('/__voice.wav')).arrayBuffer())
    const src = ac.createBufferSource(); src.buffer = buf
    const dest = ac.createMediaStreamDestination(); src.connect(dest); src.start()
    return dest.stream
  }
})
await d.login(); await p.login()
await d.goto('/partner/2/orders/1')
await p.goto('/partner/2/orders/1')

await R.start(d, 'a')
await R.beat('8.1')
await d.ring(chatButton(dp), { hold: 1200 })
await d.click(chatButton(dp), { pause: 1200 })

await R.beat('8.2')
await d.ring(dp.getByText('Availability chat').locator('xpath=../..'))
await R.settle()
await R.stop()

await R.start(p, 'b')
await R.beat('8.3')
await p.click(chatButton(pp), { pause: 1200 })
await p.scroll(-500, { speed: 500 })
await R.sleep(600)
await p.scroll(500, { speed: 500 })
await R.settle()
await R.stop()

await R.start(d, 'c')
await R.beat('8.4')
await d.ring(dp.getByRole('link', { name: 'Cedar Park Medical Plaza' }).last(), { hold: 1200 })
await d.click(dp.getByRole('link', { name: 'Cedar Park Medical Plaza' }).last(), { pause: 1500 })
await R.settle()
await R.stop()

await R.start(p, 'd')
await R.beat('8.5')
const chooser = pp.waitForEvent('filechooser')
await p.click(pp.getByRole('button', { name: 'Attach a file' }), { pause: 200 })
await (await chooser).setFiles(ROOT + 'demo/photos/riverbend-oaks-tagged.jpg')
await R.sleep(900)
await p.click(pp.getByRole('textbox', { name: /Message/ }).or(pp.getByPlaceholder('Message…')).first())
await p.type('Live oaks tagged for Riverbend.', { delay: 45 })
await pp.evaluate(() => document.activeElement?.blur()) // keyboard closes, layout settles
await R.sleep(600)
await p.click(pp.getByRole('button', { name: 'Send', exact: true }), { pause: 3400 })

await R.beat('8.6')
await p.click(pp.getByRole('button', { name: 'Record a voice note' }), { pause: 200 })
await R.sleep(5200)
await p.click(pp.getByRole('button', { name: 'Send voice note' }), { pause: 2500 })
await p.click(pp.getByRole('button', { name: /^Play/ }).last(), { pause: 2200 })
await R.settle()
await R.stop()
// Close the phone's chat, or it marks the next reply read before the desktop sees it.
await pp.getByRole('button', { name: 'Hide chat' }).tap()
await R.sleep(500)

await R.start(d, 'e')
await R.beat('8.7')
await d.click(dp.getByRole('button', { name: 'Hide panel' }), { pause: 900 })
await lpsReply('Monday first thing is perfect. Thanks!')
await R.sleep(2200)
await d.ring(chatButton(dp), { hold: 1000 })
await d.click(dp.getByRole('button', { name: /^Notifications/ }), { pause: 900 })
await d.ring(dp.getByText('Monday first thing is perfect. Thanks!').last())
await R.settle()
await R.stop()

await R.start(p, 'f')
await R.beat('8.8')
await p.click(chatButton(pp), { pause: 1500 })
await R.settle()
await R.done()
