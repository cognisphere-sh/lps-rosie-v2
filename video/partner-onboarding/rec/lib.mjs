// Screen recorder for the onboarding video: drives the local demo portal in
// headless Chrome, records each take from the DevTools screencast at full device
// resolution, and logs beat starts (narration sync) and highlight rects.
import { chromium } from 'playwright-core'
import { mkdir, writeFile, rm } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'

export const BASE = process.env.DEMO_URL ?? 'http://localhost:3217'
const ROOT = new URL('..', import.meta.url).pathname
const PASSWORD = 'Bluebonnet-Row-26'
const VO = JSON.parse(readFileSync(join(ROOT, 'vo.json'), 'utf8'))
const GAP = 0.45

const DEVICES = {
  D: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 },
  P: {
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36',
  },
}

// A visible pointer (desktop) and tap ripple (phone); headless Chrome draws neither.
const OVERLAY = `(() => {
  const css = '#__cur{position:fixed;left:0;top:0;width:26px;height:26px;pointer-events:none;z-index:2147483647;transition:opacity .2s;will-change:transform}'
    + '.__rip{position:fixed;pointer-events:none;z-index:2147483646;border-radius:50%;border:2px solid rgba(14,124,134,.9);background:rgba(14,124,134,.18);transform:translate(-50%,-50%) scale(.3);animation:__rip .55s ease-out forwards}'
    + '@keyframes __rip{to{transform:translate(-50%,-50%) scale(1);opacity:0}}';
  const touch = matchMedia('(pointer: coarse)').matches;
  const pos = JSON.parse(sessionStorage.getItem('__cur') || '[720,450]');
  const mount = () => {
    if (document.getElementById('__cur')) return;
    const st = document.createElement('style'); st.textContent = css; document.documentElement.appendChild(st);
    if (!touch) {
      const c = document.createElement('div'); c.id = '__cur';
      c.innerHTML = '<svg viewBox="0 0 26 26" width="26" height="26"><path d="M4 2l17 10.5-7.5 1.6 4.4 8.4-3.3 1.7-4.4-8.5L4 21z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
      c.style.transform = 'translate(' + pos[0] + 'px,' + pos[1] + 'px)';
      document.documentElement.appendChild(c);
    }
  };
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', mount) : mount();
  addEventListener('mousemove', (e) => {
    const c = document.getElementById('__cur'); if (c) c.style.transform = 'translate(' + e.clientX + 'px,' + e.clientY + 'px)';
    sessionStorage.setItem('__cur', JSON.stringify([e.clientX, e.clientY]));
  }, true);
  addEventListener('pointerdown', (e) => {
    const r = document.createElement('div'); r.className = '__rip';
    const s = e.pointerType === 'touch' ? 64 : 40;
    Object.assign(r.style, { left: e.clientX + 'px', top: e.clientY + 'px', width: s + 'px', height: s + 'px' });
    document.documentElement.appendChild(r); setTimeout(() => r.remove(), 700);
  }, true);
})()`

export const PREFS = {
  'lps.nav.open': '1',
  'lps.portal.chat.v1': JSON.stringify({ open: false, width: 380 }),
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

export async function recorder(chapter, { fakeAudio } = {}) {
  const dir = join(ROOT, 'footage', chapter)
  await rm(dir, { recursive: true, force: true })
  await mkdir(dir, { recursive: true })
  // One browser per device kind: the screencast only yields device pixels when the
  // browser itself runs at that scale factor, not just the emulated one.
  const browsers = {}
  const browserFor = async (kind) => (browsers[kind] ??= await chromium.launch({
    channel: 'chrome', headless: true,
    args: ['--hide-scrollbars', '--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
      `--force-device-scale-factor=${DEVICES[kind].deviceScaleFactor}`, '--window-size=1600,1100',
      ...(fakeAudio ? [`--use-file-for-fake-audio-capture=${fakeAudio}%noloop`] : [])],
  }))
  const log = { takes: {}, beats: [], events: [] }
  const pages = []
  let take = null

  async function device(kind, { prefs = {}, theme = 'light', ua } = {}) {
    const ctx = await (await browserFor(kind)).newContext({ ...DEVICES[kind], ...(ua ? { userAgent: ua } : {}), colorScheme: theme, permissions: ['microphone', 'clipboard-read', 'clipboard-write'] })
    await ctx.addInitScript(OVERLAY)
    await ctx.addInitScript((p) => {
      for (const [k, v] of Object.entries(p)) if (localStorage.getItem(k) === null) localStorage.setItem(k, v)
      sessionStorage.setItem('pwa_prompt_shown', '1')
    }, { ...PREFS, ...prefs })
    const page = await ctx.newPage()
    pages.push(page)
    page.on('framenavigated', (f) => { if (take && f === page.mainFrame()) log.events.push({ take: take.name, t: now(), kind: 'nav' }) })
    const cdp = await ctx.newCDPSession(page)
    let mouse = [720, 450]
    const d = {
      kind, page, ctx, cdp,
      async login(password = PASSWORD) {
        const r = await page.request.post(BASE + '/api/auth/login', { data: { username: 'jordan', password } })
        if (!r.ok()) throw new Error(`login ${r.status()}`)
      },
      async goto(path) { await page.goto(BASE + path); await page.waitForLoadState('networkidle').catch(() => {}); await sleep(400) },
      async box(target) {
        const l = (typeof target === 'string' ? page.locator(target) : target).filter({ visible: true }).first()
        await l.waitFor({ state: 'visible', timeout: 15000 })
        await l.scrollIntoViewIfNeeded()
        return l.boundingBox()
      },
      async moveTo(target, { ms = 650 } = {}) {
        const b = await d.box(target)
        const to = [b.x + b.width / 2, b.y + b.height / 2]
        if (kind === 'D') {
          const from = mouse, n = Math.max(12, Math.round(ms / 16))
          for (let i = 1; i <= n; i++) {
            const k = ease(i / n)
            await page.mouse.move(from[0] + (to[0] - from[0]) * k, from[1] + (to[1] - from[1]) * k)
            await sleep(ms / n)
          }
          mouse = to
        }
        return to
      },
      async click(target, { pause = 350, ms } = {}) {
        const [x, y] = await d.moveTo(target, { ms })
        await sleep(kind === 'D' ? 160 : 260)
        log.events.push({ take: take?.name, t: now(), kind: 'click' })
        if (kind === 'D') await page.mouse.click(x, y)
        else await page.touchscreen.tap(x, y)
        await sleep(pause)
      },
      async type(text, { delay = 55 } = {}) {
        log.events.push({ take: take?.name, t: now(), kind: 'type', duration: (text.length * delay) / 1000 })
        await page.keyboard.type(text, { delay }); await sleep(250)
      },
      async fill(target, text, opts) { await d.click(target); await page.keyboard.press('ControlOrMeta+A'); await d.type(text, opts) },
      async scroll(dy, { x = null, y = null, speed = 900 } = {}) {
        const v = DEVICES[kind].viewport
        await cdp.send('Input.synthesizeScrollGesture', {
          x: x ?? v.width / 2, y: y ?? v.height / 2, yDistance: -dy, speed,
          gestureSourceType: kind === 'D' ? 'mouse' : 'touch',
        })
        await sleep(300)
      },
      // Highlight: a ring (and optional zoom) over the target, drawn in Remotion.
      async ring(target, { label = null, zoom = 0, hold = 0 } = {}) {
        const b = target && typeof target === 'object' && 'width' in target ? target : await d.box(target)
        log.events.push({ take: take?.name, t: now(), kind: 'ring', rect: b, label, zoom })
        if (hold) await sleep(hold)
        return b
      },
      async zoom(target, scale = 1.6, { hold = 0 } = {}) {
        const b = target && typeof target === 'object' && 'width' in target ? target : await d.box(target)
        log.events.push({ take: take?.name, t: now(), kind: 'zoom', rect: b, scale })
        if (hold) await sleep(hold)
      },
      // Rect of the card (bordered, rounded box) around a piece of text.
      async card(text) {
        const l = page.getByText(text, { exact: true }).filter({ visible: true }).first()
        await l.waitFor({ state: 'visible', timeout: 15000 })
        await l.scrollIntoViewIfNeeded()
        return l.evaluate((el) => {
          let n = el
          while (n && n !== document.body) {
            const cs = getComputedStyle(n)
            if (parseFloat(cs.borderTopWidth) > 0 && parseFloat(cs.borderTopLeftRadius) > 4 && n.getBoundingClientRect().width > 200) break
            n = n.parentElement
          }
          const r = n.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }
        })
      },
      // Union rect of several targets (locators, selectors or rects).
      async span(...targets) {
        const bs = []
        for (const t of targets) bs.push(t && typeof t === 'object' && 'width' in t ? t : await d.box(t))
        const x = Math.min(...bs.map((b) => b.x)), y = Math.min(...bs.map((b) => b.y))
        return { x, y, width: Math.max(...bs.map((b) => b.x + b.width)) - x, height: Math.max(...bs.map((b) => b.y + b.height)) - y }
      },
      async unzoom() { log.events.push({ take: take?.name, t: now(), kind: 'unzoom' }) },
    }
    return d
  }

  // On a failed step, save a screenshot of every open page for debugging.
  process.on('uncaughtException', async (e) => {
    console.error(e.message.split('\n')[0])
    for (const [i, pg] of pages.entries()) await pg.screenshot({ path: join(dir, `error-${i}.png`) }).catch(() => {})
    process.exit(1)
  })
  const now = () => (take ? Date.now() / 1000 - take.t0 : 0)

  async function start(d, name) {
    const fdir = join(dir, name)
    await mkdir(fdir, { recursive: true })
    const frames = []
    const v = DEVICES[d.kind]
    const onFrame = async ({ data, metadata, sessionId }) => {
      const file = join(fdir, `f${String(frames.length).padStart(6, '0')}.jpg`)
      frames.push({ file, ts: metadata.timestamp })
      writeFile(file, Buffer.from(data, 'base64'))
      d.cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {})
    }
    d.cdp.on('Page.screencastFrame', onFrame)
    await d.cdp.send('Page.startScreencast', {
      format: 'jpeg', quality: 90, everyNthFrame: 1,
      maxWidth: v.viewport.width * v.deviceScaleFactor, maxHeight: v.viewport.height * v.deviceScaleFactor,
    })
    // Nudge a repaint so the take starts on a frame.
    await d.page.evaluate(() => { document.documentElement.style.outline = '0 solid transparent'; requestAnimationFrame(() => (document.documentElement.style.outline = '')) })
    await sleep(300)
    take = { name, d, frames, onFrame, t0: frames[0]?.ts ?? Date.now() / 1000 }
    log.takes[name] = { device: d.kind, file: `${name}.mp4`, css: v.viewport, dpr: v.deviceScaleFactor }
  }

  async function stop() {
    const { name, d, frames, onFrame, t0 } = take
    await sleep(400)
    const tEnd = Date.now() / 1000
    await d.cdp.send('Page.stopScreencast')
    d.cdp.off('Page.screencastFrame', onFrame)
    await sleep(300)
    const lines = []
    frames.forEach((f, i) => {
      const next = frames[i + 1]?.ts ?? tEnd
      lines.push(`file '${f.file}'`, `duration ${Math.max(0.001, next - f.ts).toFixed(4)}`)
    })
    lines.push(`file '${frames.at(-1).file}'`)
    const list = join(dir, `${name}.txt`)
    await writeFile(list, lines.join('\n'))
    // Frames before t0 are trimmed so beat times line up with the video.
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list,
      '-vf', 'fps=30,scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p', '-c:v', 'libx264', '-crf', '16', '-preset', 'medium',
      '-ss', String(Math.max(0, t0 - frames[0].ts)), join(dir, `${name}.mp4`)])
    log.takes[name].duration = tEnd - t0
    await rm(join(dir, name), { recursive: true, force: true })
    await rm(list)
    take = null
  }

  return {
    device, start, stop, sleep,
    // Beats hold at least as long as their narration line, so footage and voice stay in sync.
    async beat(id) {
      const prev = log.beats.at(-1)
      if (prev && prev.take === take?.name) {
        const left = (VO[prev.id] ?? 0) + GAP - (now() - prev.t)
        if (left > 0 && !process.env.FAST) await sleep(left * 1000)
      }
      log.beats.push({ id, take: take.name, t: now() })
      console.log('beat', id, take.name, now().toFixed(2))
    },
    // Wait until a fraction of the current beat's narration has played.
    async until(frac = 1) {
      const b = log.beats.at(-1)
      const left = (VO[b.id] ?? 0) * frac - (now() - b.t)
      if (left > 0 && !process.env.FAST) await sleep(left * 1000)
    },
    // Wait for an LPS chat reply to appear, and log when it did (its ding plays then).
    async reply(d, text, { timeout = 15000 } = {}) {
      await d.page.getByText(text).filter({ visible: true }).last().waitFor({ timeout })
      log.events.push({ take: take?.name, t: now(), kind: 'reply' })
    },
    // A beat shown as a motion graphic instead of footage (no take).
    card(id) { log.beats.push({ id, take: null, t: 0 }); console.log('card', id) },
    // Hold the current beat until its narration has played (call before stop()).
    async settle() { await this.beat('_end'); log.beats.pop() },
    async done() {
      if (take) await stop()
      await writeFile(join(dir, 'marks.json'), JSON.stringify(log, null, 1))
      for (const b of Object.values(browsers)) await b.close()
    },
  }
}

// Reset the demo database to a checkpoint (see demo/reset.sh).
export function reset(cp) {
  execFileSync(join(ROOT, 'demo/reset.sh'), [cp], { stdio: ['ignore', 'ignore', 'inherit'] })
}
