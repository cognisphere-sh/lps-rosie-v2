// "Photo" of the printed Zilker Courtyard request, filled in by hand, for chapter 6.
// Prints the real request sheet from the demo portal (print stylesheet), then adds
// handwritten ticks, quantities and notes and lays it on a desk.
// Needs the demo stack at checkpoint S5.
import { chromium } from 'playwright-core'

const BASE = process.env.DEMO_URL ?? 'http://localhost:3217'
const OUT = new URL('./zilker-sheet-photo.jpg', import.meta.url).pathname
// What Jordan writes on the sheet (also what LPS later enters for chapter 6).
const ANSWERS = [
  { name: 'Cedar Elm', status: 'Available', qty: '8' },
  { name: "Texas Sage 'Compacta'", status: 'Available', qty: '30' },
  { name: 'Mexican Feathergrass', status: 'Partial Qty', qty: '35', note: 'rest in 2 wks' },
  { name: 'Live Oak', status: 'Unavailable', qty: '0', note: 'none till Dec' },
  { name: 'Gulf Muhly', status: 'Available', qty: '20' },
]

const b = await chromium.launch({ channel: 'chrome', headless: true })
const page = await b.newPage({ viewport: { width: 980, height: 1400 }, deviceScaleFactor: 2 })
await page.request.post(BASE + '/api/auth/login', { data: { username: 'jordan', password: 'Bluebonnet-Row-26' } })
await page.goto(BASE + '/partner/2'); await page.waitForLoadState('networkidle')
const href = await page.getByRole('link', { name: /Zilker Courtyard/ }).first().getAttribute('href')
await page.goto(BASE + href); await page.waitForLoadState('networkidle')
await page.emulateMedia({ media: 'print' })
await page.waitForTimeout(600)
const marks = await page.evaluate((answers) => {
  const vis = (e) => e.getBoundingClientRect().width > 0
  const rows = [...document.querySelectorAll('tr')].filter(vis)
  const head = rows.find((r) => /Avail/.test(r.textContent) && /Notes/.test(r.textContent))
  const cols = [...head.children].map((c) => c.textContent.trim())
  const col = (re) => cols.findIndex((c) => re.test(c))
  const box = (e) => { const r = e.getBoundingClientRect(); return { x: r.x + scrollX, y: r.y + scrollY, w: r.width, h: r.height } }
  const out = answers.map((a) => {
    const tr = rows.find((r) => r !== head && r.children[col(/Name/)]?.querySelector('.font-bold')?.textContent.trim() === a.name)
    // Each status option is <span class="flex"><span box/>Label</span>; tick its box.
    const opt = [...tr.children[col(/Status/)].querySelectorAll('span.flex')].find((e) => e.textContent.trim() === a.status)
    return { ...a, opt: box(opt.firstElementChild), qtyCell: box(tr.children[col(/Avail/)]), noteCell: box(tr.children[col(/Notes/)]) }
  })
  const by = [...document.querySelectorAll('p')].find((e) => /^Submitted by/.test(e.textContent.trim()) && vis(e))
  return { rows: out, by: by && box(by), width: document.documentElement.scrollWidth, height: by ? box(by).y + 70 : document.documentElement.scrollHeight }
}, ANSWERS)
const shot = (await page.screenshot({ fullPage: true, type: 'png' })).toString('base64')

const ink = (x, y, text, size = 26, rot = -4) =>
  `<div style="position:absolute;left:${x}px;top:${y}px;font:${size}px 'Bradley Hand','Marker Felt','Comic Sans MS',cursive;color:#1c3f8f;transform:rotate(${rot}deg);white-space:nowrap">${text}</div>`
const overlay = marks.rows.map((r) =>
  ink(r.opt.x - 6, r.opt.y - 14, '✓', 30, -8) +
  ink(r.qtyCell.x + r.qtyCell.w / 2 - 12, r.qtyCell.y + 8, r.qty, 30) +
  (r.note ? ink(r.noteCell.x + 4, r.noteCell.y + 10, r.note, 17, -3) : '')).join('') +
  (marks.by ? ink(marks.by.x + 110, marks.by.y - 16, 'Jordan R.', 28, -2) : '')

const html = `<html><body style="margin:0;width:1600px;height:1200px;overflow:hidden;background:#6b4a2f">
<div style="position:absolute;inset:0;background:repeating-linear-gradient(92deg,rgba(255,255,255,.04) 0 3px,rgba(0,0,0,.05) 3px 9px),radial-gradient(circle at 70% 30%,rgba(255,220,170,.25),transparent 60%)"></div>
<div style="position:absolute;left:50%;top:50%;width:${marks.width + 48}px;transform:translate(-50%,-50%) rotate(-2.2deg) scale(${Math.min(1.45, 1450 / (marks.width + 48), 1100 / (marks.height + 48)).toFixed(3)});box-shadow:0 30px 60px rgba(0,0,0,.45);background:#fff;padding:24px">
  <div style="position:relative;width:${marks.width}px;height:${marks.height}px;overflow:hidden">
    <img src="data:image/png;base64,${shot}" style="width:${marks.width}px;display:block;filter:contrast(.95) brightness(1.02)">
    ${overlay}
  </div>
</div>
<div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,0) 60%,rgba(0,0,0,.18));pointer-events:none"></div>
</body></html>`
const p2 = await b.newPage({ viewport: { width: 1600, height: 1200 } })
await p2.setContent(html)
await p2.waitForTimeout(300)
await p2.screenshot({ path: OUT, type: 'jpeg', quality: 86 })
await b.close()
console.log(OUT, marks.rows.map((r) => `${r.name}:${Math.round(r.opt.x)},${Math.round(r.opt.y)}`).join(' '))
