import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { Composer, Transcript, type ChatMessage } from '../components/workspace/chat-kit'

const messages: ChatMessage[] = [
  { id: 1, at: 1000, role: 'agent', text: '[Read order](https://example.test/order)', files: [] },
  { id: 2, at: 2000, role: 'user', text: 'My reply', files: [
    { name: 'sample.txt', label: 'Example document', mime: 'text/plain', size: 10 },
    { name: 'sample.png', label: 'Example image', mime: 'image/png', size: 10 },
  ] },
]

test('presentation hooks retain speaker side, reference destinations, chronology and copy controls', () => {
  const html = renderToStaticMarkup(<Transcript messages={messages} pending={false} error="" hasMore loadingMore={false}
    fileHref={file => `/safe/${file.name}`} empty="No messages" pendingLabel="Working" wallpaper="desert-night"
    onRefresh={async () => {}} onLoadMore={async () => {}}
    identify={m => ({ mine: m.role === 'user', name: m.role === 'user' ? 'You' : 'Local Plant Supply',
      tag: <a href="/partner/7/orders/4">Ref Order: Example</a> })} />)
  assert.match(html, /data-chat-bubble="incoming"/)
  assert.match(html, /data-chat-bubble="own"/)
  assert.match(html, /data-chat-meta="sender"/)
  assert.match(html, /data-chat-meta="reference"/)
  assert.match(html, /data-chat-meta="timestamp"/)
  assert.match(html, /data-chat-attachments=""/)
  assert.match(html, /href="\/safe\/sample.txt"/)
  assert.match(html, /src="\/safe\/sample.png"/)
  assert.match(html, /href="\/partner\/7\/orders\/4"/)
  assert.match(html, /href="https:\/\/example.test\/order"/)
  assert.equal((html.match(/aria-label="Copy message"/g) ?? []).length, 2)
  assert.ok(html.indexOf('Read order') < html.indexOf('My reply'))
  assert.match(html, /Load earlier messages/)
  assert.doesNotMatch(html, /data-partner-chat=/, 'shared primitives do not opt other callers into portal CSS')
})

test('portal stylesheet is scoped, does not replace stored themes or wallpaper, and isolates small text', () => {
  const css = readFileSync(new URL('../app/partner-chat.css', import.meta.url), 'utf8')
  const selectors = [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{/g)]
  assert.ok(selectors.length > 10)
  for (const [, group] of selectors) {
    if (group.trim().startsWith('@media')) continue
    for (const selector of group.trim().split(/,\s*(?![^()]*\))/)) {
      assert.ok(selector.includes('[data-partner-chat]'), `unscoped selector: ${selector}`)
    }
  }
  assert.doesNotMatch(css, /--primary\s*:|background-image\s*:|background-size\s*:/)
  assert.match(css, /\[data-chat-meta\][\s\S]*?background: var\(--card\)/)
  assert.match(css, /:focus-visible/)
  const partner = readFileSync(new URL('../components/workspace/partner.tsx', import.meta.url), 'utf8')
  assert.equal((partner.match(/data-partner-chat=""/g) ?? []).length, 2, 'desktop and mobile opt in, not closed rail or page')
})

test('portal waveform spacing leaves positive bars beside fixed Play/time controls at narrow widths', () => {
  const css = readFileSync(new URL('../app/partner-chat.css', import.meta.url), 'utf8')
  assert.match(css, /\[data-partner-chat\] \[data-chat-voice\] \[role='presentation'\] \{\s*column-gap: min\(2px, 0\.75%\);/)
  assert.match(css, /\[data-partner-chat\] \[data-chat-voice\] \[role='presentation'\] span \{\s*min-width: 1px;/)
  const kit = readFileSync(new URL('../components/workspace/chat-kit.tsx', import.meta.url), 'utf8')
  const bars = Number(/const BARS = (\d+)/.exec(kit)?.[1])
  assert.equal(bars, 40, 'retain the shared waveform and seek surface')
  // Available seek-region widths after the existing fixed Play/time/padding,
  // including the 280px dock and the nearby phone widths. Actual browser bar
  // bounds are independently asserted and retained with visual QA evidence.
  for (const regionWidth of [75, 91, 130]) {
    const gap = Math.min(2, regionWidth * 0.0075)
    const barWidth = (regionWidth - (bars - 1) * gap) / bars
    assert.ok(barWidth >= 1, `visible bar at ${regionWidth}px seek region`)
    assert.ok(barWidth * bars + gap * (bars - 1) <= regionWidth + 0.001)
  }
})

test('shared composer keeps disabled gates and accessible controls without opting into portal styles', () => {
  const composer = {
    busy: false, files: [], recording: false, notice: '', paused: false, finishing: false,
    seconds: 0, levels: [], upload: async () => {}, drop: () => {}, record: async () => {},
    cancelRecording: () => {}, togglePause: () => {}, sendRecording: () => {},
    dismissNotice: () => {}, onPaste: () => {}, clear: () => {},
  } as unknown as Parameters<typeof Composer>[0]['composer']
  const html = renderToStaticMarkup(<Composer composer={composer} draft="" setDraft={() => {}}
    onSend={() => {}} placeholder="Type a message…" disabled />)
  assert.match(html, /<fieldset[^>]*disabled=""/)
  assert.match(html, /aria-label="Message"/)
  for (const label of ['Attach a file', 'Record a voice note', 'Send']) assert.ok(html.includes(`aria-label="${label}"`))
  assert.doesNotMatch(html, /data-partner-chat=/)
})
