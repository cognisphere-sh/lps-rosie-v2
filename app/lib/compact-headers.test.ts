import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { join } from 'node:path'

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

test('WorkspaceFrame owns one compact title-only header row for retained and detail screens', () => {
  const frame = source('components/workspace/frame.tsx')
  const shell = source('components/workspace/shell.tsx')
  const partner = source('components/workspace/partner.tsx')

  assert.match(frame, /flex min-h-10 flex-none items-center gap-2/)
  // Playfair at display strength, still inside the compact 40px row.
  assert.match(frame, /text-\[20px\].*leading-7/)
  assert.match(frame, /title=\{title\}/)
  assert.doesNotMatch(frame, /subtitle/)
  assert.doesNotMatch(shell, /subtitle/)
  assert.doesNotMatch(partner.slice(partner.indexOf('export function PartnerFrame')), /subtitle/)
})

test('generic mobile workspaces hide the shared row while record identities remain', () => {
  for (const path of [
    'app/suppliers/page.tsx',
    'app/plants/page.tsx',
    'app/photos/page.tsx',
    'app/customers/page.tsx',
    'app/requests/page.tsx',
    'app/agents/page.tsx',
    'app/settings/page.tsx',
  ]) {
    assert.match(source(path), /hideHeaderOnMobile/, path)
  }

  assert.doesNotMatch(source('app/suppliers/[id]/page.tsx'), /hideHeaderOnMobile/)
  assert.doesNotMatch(source('app/customers/[id]/page.tsx'), /hideHeaderOnMobile/)
  assert.match(source('components/workspace/partner.tsx'), /hideHeaderOnMobile\n/)

  const frame = source('components/workspace/frame.tsx')
  assert.match(frame, /isMobile \? !hideHeaderOnMobile : !hideHeaderOnDesktop/)
  assert.match(frame, /pt-\[env\(safe-area-inset-top\)\]/)
  assert.match(frame, /pt-\[calc\(0\.25rem\+env\(safe-area-inset-top\)\)\]/)
})

test('qualifying desktop lists move Shell-owned controls into their existing toolbar', () => {
  for (const path of [
    'app/suppliers/page.tsx',
    'app/plants/page.tsx',
    'app/photos/page.tsx',
    'app/customers/page.tsx',
    'app/requests/page.tsx',
  ]) {
    const route = source(path)
    assert.match(route, /hideHeaderOnDesktop/, path)
    assert.match(route, /rightActions/, path)
  }

  const focusedJobs = source('app/jobs/page.tsx')
  assert.match(focusedJobs, /hideHeaderOnDesktop/)
  assert.match(focusedJobs, /<JobsTopActions(?:\s|>)/)
  // Settings uses its own content heading; it has no list toolbar to relocate.
  assert.match(source('app/settings/page.tsx'), /hideHeaderOnDesktop/)

  // The portal's request page joined the compact set with the 2026-08-30
  // redesign: its header card's strip carries the name.
  for (const path of ['app/partner/[id]/page.tsx', 'app/partner/[id]/requests/[arId]/page.tsx']) {
    const portal = source(path)
    assert.match(portal, /hideHeaderOnDesktop/, path)
    assert.match(portal, /toolbar=\{\(rightActions\) =>/, path)
    assert.match(portal, /\{rightActions\}/, path)
  }

  for (const path of [
    'app/agents/page.tsx',
    'app/partner/[id]/closed/page.tsx',
    'app/partner/[id]/orders/page.tsx',
    'app/suppliers/[id]/page.tsx',
    'app/customers/[id]/page.tsx',
  ]) {
    assert.doesNotMatch(source(path), /hideHeaderOnDesktop/, path)
  }

  const shell = source('components/workspace/shell.tsx')
  const partner = source('components/workspace/partner.tsx')
  const toolbar = source('components/workspace/toolbar.tsx')
  assert.match(shell, /typeof toolbar === 'function' \? toolbar\(!isMobile \?/)
  assert.match(shell, /page === 'requests'.*<NewJobRequestButton/s)
  assert.match(shell, /<NotificationBell \/>/)
  assert.doesNotMatch(source('app/jobs/page.tsx'), /NewJobRequestButton|NotificationBell/)
  assert.match(partner, /typeof toolbar === 'function' \? toolbar\(!isMobile \?/)
  assert.match(partner, /\{bell\(\)\}/)
  assert.match(toolbar, /rightActions\?: React\.ReactNode/)
  assert.match(toolbar, /min-\[900px\]:w-full min-\[1024px\]:w-auto/)
})

test('header and mobile detail actions keep a 44px target and honest row geometry', () => {
  const frame = source('components/workspace/frame.tsx')
  const shell = source('components/workspace/shell.tsx')
  const partner = source('components/workspace/partner.tsx')
  const supplier = source('app/suppliers/[id]/page.tsx')
  const customer = source('app/customers/[id]/page.tsx')
  const portalDetail = source('app/partner/[id]/requests/[arId]/page.tsx')
  const chatButton = source('lib/agent-chat-button-style.ts')

  assert.equal(frame.match(/\[&>button\]:min-h-11/g)?.length, 2)
  assert.equal(frame.match(/\[&>button\]:min-w-11/g)?.length, 2)
  assert.equal(frame.match(/\[&>a\]:min-h-11/g)?.length, 2)
  assert.equal(frame.match(/\[&>a\]:min-w-11/g)?.length, 2)
  assert.match(shell, /min-h-11 min-w-11 gap-1\.5 rounded-full/)
  assert.match(shell, /relative flex size-11 items-center justify-center rounded-full/)
  assert.match(partner, /relative flex size-11 items-center justify-center rounded-full/)
  assert.match(chatButton, /labelled[\s\S]*flex min-h-11 min-w-11/)

  // Icon-only back button (2026-10-07): still a 44px target, named for its destination.
  assert.match(portalDetail, /aria-label=\{isClosed \? 'Back to closed requests'[\s\S]{0,200}inline-flex size-11/)
  assert.match(customer, /inline-flex min-h-11 min-w-11 w-fit items-center[\s\S]{0,300}All customers/)
  assert.match(supplier, /flex min-h-11 min-w-36 flex-1 items-center/)
  assert.match(supplier, /size="icon-sm"\s+className="size-11"/)
  assert.match(supplier, /inline-flex min-h-11 min-w-11 w-fit[\s\S]{0,300}All availability requests/)
  assert.match(chatButton, /quickAction[\s\S]*flex size-11/)

  const titleLine = 24
  const target = 44
  const verticalPadding = 8
  const border = 1
  assert.equal(Math.max(40, titleLine + verticalPadding + border), 40)
  assert.equal(Math.max(40, target + verticalPadding + border), 53)
})

test('header metadata is relocated into existing toolbars or content', () => {
  const routeSources = [
    'app/suppliers/page.tsx',
    'app/plants/page.tsx',
    'app/photos/page.tsx',
    'app/customers/page.tsx',
    'app/requests/page.tsx',
    'app/agents/page.tsx',
    'app/settings/page.tsx',
    'app/suppliers/[id]/page.tsx',
    'app/customers/[id]/page.tsx',
    'app/partner/[id]/page.tsx',
    'app/partner/[id]/closed/page.tsx',
    'app/partner/[id]/requests/[arId]/page.tsx',
  ].map(source)

  for (const route of routeSources) assert.doesNotMatch(route, /subtitle=/)
  assert.match(source('app/photos/page.tsx'), /Ranked by match.*Newest first/)
  // All Jobs keeps per-record totals in the cards instead of repeating a toolbar count.
  assert.match(source('app/requests/page.tsx'), /summary=""/)
  assert.match(source('app/partner/[id]/page.tsx'), /<RequestBucketControls[\s\S]{0,200}counts=\{counts\}/)
  assert.match(source('app/partner/[id]/closed/page.tsx'), /closed\.length.*request/)
  assert.match(source('app/partner/[id]/requests/[arId]/page.tsx'), /request\.items\.length.*pending/)
})

test('purpose-built overlay headers remain separate from WorkspaceFrame', () => {
  const chat = source('components/workspace/chat.tsx')
  const drawer = source('components/workspace/ar-drawer.tsx')
  const photos = source('app/photos/page.tsx')
  const partner = source('components/workspace/partner.tsx')

  assert.match(chat, /top-\[calc\(env\(safe-area-inset-top\)\+0\.5rem\)\].*min-h-14/)
  assert.match(chat, /size-11/)
  assert.match(drawer, /pt-\[max\(12px,env\(safe-area-inset-top\)\)\]/)
  assert.match(drawer, /size-11/)
  assert.match(photos, /fixed inset-0 z-\[120\]/)
  assert.match(partner, /top-\[calc\(env\(safe-area-inset-top\)\+0\.5rem\)\].*min-h-14/)
})
