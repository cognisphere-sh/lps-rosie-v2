// Draws the two demo "photos" the supplier sends in chat (illustrations, not real photos).
import { chromium } from 'playwright-core'
const tree = (x, canopy, scale = 1, tag = false) => `
  <g transform="translate(${x} 0) scale(${scale})" style="transform-origin:${x}px 620px">
    <ellipse cx="0" cy="640" rx="120" ry="16" fill="rgba(0,0,0,.22)"/>
    <path d="M-80 520 L80 520 L68 640 L-68 640 Z" fill="#1d1f1e"/><rect x="-84" y="512" width="168" height="16" rx="4" fill="#2a2d2b"/>
    <path d="M-8 520 C-10 430 -6 380 -2 300 L6 300 C8 380 12 430 10 520 Z" fill="#5a4330"/>
    <path d="M0 360 C-30 330 -60 320 -90 300" stroke="#5a4330" stroke-width="9" fill="none"/>
    <path d="M2 340 C30 310 60 300 92 286" stroke="#5a4330" stroke-width="8" fill="none"/>
    ${canopy}
    ${tag ? '<g transform="translate(-4 400) rotate(8)"><line x1="0" y1="0" x2="0" y2="20" stroke="#ddd" stroke-width="2"/><rect x="-16" y="20" width="32" height="56" rx="5" fill="#f28c28"/><circle cx="0" cy="28" r="3" fill="#fff"/><text x="0" y="58" font-size="13" font-family="Arial" font-weight="700" fill="#fff" text-anchor="middle">LPS</text></g>' : ''}
  </g>`
const blobs = (cols, r = 1) => Array.from({ length: 26 }, (_, i) => {
  const a = (i * 137.5) * Math.PI / 180, d = 40 + (i % 7) * 18
  return `<circle cx="${(Math.cos(a) * d * 1.5 * r).toFixed(0)}" cy="${(250 + Math.sin(a) * d * 0.85 * r).toFixed(0)}" r="${52 - (i % 5) * 6}" fill="${cols[i % cols.length]}"/>`
}).join('')
const scene = (trees, label) => `<html><body style="margin:0"><svg width="1200" height="900" viewBox="0 0 1200 900" xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#bcd7ea"/><stop offset="1" stop-color="#eef2e6"/></linearGradient>
  <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b9a582"/><stop offset="1" stop-color="#8f7b5a"/></linearGradient></defs>
  <rect width="1200" height="900" fill="url(#sky)"/>
  <path d="M0 520 C200 470 420 500 600 480 C820 455 1000 490 1200 470 L1200 620 L0 620 Z" fill="#8fa77a"/>
  <path d="M0 560 C260 530 520 560 760 540 C960 525 1080 545 1200 535 L1200 640 L0 640 Z" fill="#6f8f5d"/>
  <rect y="600" width="1200" height="300" fill="url(#ground)"/>
  ${Array.from({ length: 14 }, (_, i) => `<rect x="${i * 90 - 20}" y="${780 + (i % 3) * 6}" width="60" height="6" rx="3" fill="rgba(255,255,255,.18)"/>`).join('')}
  ${trees}
  <text x="40" y="870" font-family="Arial" font-size="22" fill="rgba(255,255,255,.85)">${label}</text>
</svg></body></html>`
const redbud = scene(tree(600, blobs(['#c65a9c', '#d874b0', '#b24a8a', '#e290c0', '#7aa35a']), 1), 'Hill Country Growers · Row 6')
const oaks = scene([300, 600, 900].map((x, i) => tree(x, blobs(['#3f6b35', '#4f7f3f', '#5d8f49', '#355c2d']), 1, true)).join(''), 'Tagged for Riverbend HOA')
const b = await chromium.launch({ channel: 'chrome', headless: true })
const page = await b.newPage({ viewport: { width: 1200, height: 900 } })
for (const [name, html] of [['redbud-30g', redbud], ['riverbend-oaks-tagged', oaks]]) {
  await page.setContent(html); await page.screenshot({ path: new URL(`./${name}.jpg`, import.meta.url).pathname, type: 'jpeg', quality: 88 })
}
await b.close()
