import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const globals = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8')
const shell = readFileSync(new URL('../components/workspace/shell.tsx', import.meta.url), 'utf8')
const requestCard = readFileSync(new URL('../components/workspace/request-list-card.tsx', import.meta.url), 'utf8')

const lightExpected = {
  turquoise: {
    text: '#24736C', border: '#46958D', soft: '#E6F5F3', solid: '#69C4BB', 'on-solid': '#123A37',
  },
  'light-blue': {
    text: '#1C679C', border: '#438FC6', soft: '#E8F4FC', solid: '#63AEE4', 'on-solid': '#102E43',
  },
} as const

const darkExpected = {
  turquoise: {
    text: '#8DDCD3', border: '#4C9E96', soft: '#163330', solid: '#69C4BB', 'on-solid': '#07191B',
  },
  'light-blue': {
    text: '#8CCAF3', border: '#4F9ACF', soft: '#142F43', solid: '#6BB7EA', 'on-solid': '#071522',
  },
} as const

type Family = keyof typeof lightExpected
type Role = keyof (typeof lightExpected)[Family]

function cssBlock(selector: ':root' | '.dark'): string {
  const start = globals.search(new RegExp(`${selector.replace('.', '\\.')}\\s*(?:,[^{]+)?\\s*\\{`))
  assert.notEqual(start, -1)
  const end = globals.indexOf('\n}', start)
  assert.notEqual(end, -1)
  return globals.slice(start, end)
}

function cssValue(block: string, name: string): string {
  const match = block.match(new RegExp(`${name}:\\s*(#[0-9A-Fa-f]{6});`))
  assert.ok(match, `${name} is present as a six-digit color`)
  return match[1].toUpperCase()
}

function token(block: string, family: Family, role: Role): string {
  return cssValue(block, `--lps-accent-${family}-${role}`)
}

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255)
  const linear = channels.map((channel) => channel <= 0.04045
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4)
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722
}

function contrast(a: string, b: string): number {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (lighter + 0.05) / (darker + 0.05)
}

function hue(hex: string): number {
  const [red, green, blue] = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255)
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  const delta = max - min
  if (delta === 0) return 0
  const sector = max === red
    ? ((green - blue) / delta) % 6
    : max === green
      ? (blue - red) / delta + 2
      : (red - green) / delta + 4
  return (sector * 60 + 360) % 360
}

function hueDistance(a: string, b: string): number {
  const distance = Math.abs(hue(a) - hue(b))
  return Math.min(distance, 360 - distance)
}

test('both themes expose the exact reusable turquoise and light-blue role families', () => {
  for (const [block, expected] of [
    [cssBlock(':root'), lightExpected],
    [cssBlock('.dark'), darkExpected],
  ] as const) {
    for (const family of Object.keys(expected) as Family[]) {
      for (const role of Object.keys(expected[family]) as Role[]) {
        assert.equal(token(block, family, role), expected[family][role])
      }
    }
  }

  for (const family of Object.keys(lightExpected) as Family[]) {
    for (const role of Object.keys(lightExpected[family]) as Role[]) {
      assert.match(globals, new RegExp(`--color-lps-accent-${family}-${role}: var\\(--lps-accent-${family}-${role}\\);`))
    }
  }
})

test('actual normal, hover and keyboard-focus states clear text and boundary contrast without alpha loss', () => {
  const turquoiseRingControls = requestCard
    .split('</button>')
    .filter((segment) => segment.includes('ring-lps-accent-turquoise-border'))
    .map((segment) => segment.slice(segment.lastIndexOf('<button')))
  assert.equal(turquoiseRingControls.length, 1)
  for (const control of turquoiseRingControls) {
    assert.match(control, /size-11|min-h-11/)
    assert.doesNotMatch(control, /(?:^|\s)(?:hover:|focus-visible:)?opacity-\d+/)
  }

  for (const block of [cssBlock(':root'), cssBlock('.dark')]) {
    const card = cssValue(block, '--card')
    const tint = cssValue(block, '--lps-tint')
    const muted = cssValue(block, '--muted')
    const states = [
      ['normal', card],
      ['card-head hover', tint],
      ['expanded desktop hover', muted],
      ['keyboard focus', card],
    ] as const

    for (const family of Object.keys(lightExpected) as Family[]) {
      const text = token(block, family, 'text')
      const border = token(block, family, 'border')
      for (const [state, surface] of states) {
        assert.ok(contrast(text, surface) >= 4.5, `${family} ${state} text contrasts with ${surface}`)
        assert.ok(contrast(border, surface) >= 3, `${family} ${state} boundary contrasts with ${surface}`)
      }

      const soft = token(block, family, 'soft')
      assert.ok(contrast(text, soft) >= 4.5, `${family} text contrasts with its soft surface`)
      assert.ok(contrast(border, soft) >= 3, `${family} boundary contrasts with its soft surface`)
      assert.ok(contrast(token(block, family, 'on-solid'), token(block, family, 'solid')) >= 4.5,
        `${family} on-solid contrasts with solid`)
    }
  }
})

test('turquoise and light blue retain a meaningful photo-derived hue separation', () => {
  for (const block of [cssBlock(':root'), cssBlock('.dark')]) {
    const turquoise = token(block, 'turquoise', 'solid')
    const lightBlue = token(block, 'light-blue', 'solid')
    // Photo 562 measures near a 30° split; 25° allows theme tuning while
    // preventing the families from collapsing into two interchangeable cyans.
    assert.ok(hueDistance(turquoise, lightBlue) >= 25,
      `${turquoise} and ${lightBlue} remain at least 25 degrees apart`)
  }
})

test('representative uses identify Rosie and Job references without replacing state palettes', () => {
  assert.match(shell, /JobIdentityLink[\s\S]*?text-lps-accent-light-blue-text[\s\S]*?requestRef\(request\.id\)/)
  assert.match(requestCard, /text-primary.*requestRef\(request.id\)/)
  assert.match(requestCard, /aria-label=\{`Chat with Rosie about[\s\S]*?text-lps-accent-turquoise-text/)
  assert.match(requestCard, /aria-label=\{`Chat with Rosie about[\s\S]*?min-h-11/)
  assert.equal(requestCard.match(/ring-lps-accent-turquoise-border/g)?.length, 1)

  assert.match(globals, /:root \{[\s\S]*?--primary: #087F8C;/)
  assert.match(cssBlock('.dark'), /--primary: #42C7C9;/)
  assert.match(globals, /--lps-tone-green-bg: #E9F3EA;/)
  assert.match(globals, /--lps-tone-red-bg: #FAEAE5;/)
  assert.doesNotMatch(globals, /--lps-tone-(turquoise|light-blue)-/)
})
