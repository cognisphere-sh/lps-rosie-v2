/**
 * Spatial continuity (2026-10-19): moving between places is a View
 * Transition, so every move shows where the new view came from.
 *
 * - **Lateral**: another rail destination. The page column slides along
 *   the rail (vertically on desktop, along the tab bar on a phone), and the
 *   rail's solid "you are here" mark glides to its new item.
 * - **Deeper**: a list row opens its record. The record unfolds out of the
 *   row's own rectangle (a clip-path inset), and the row's subject (its
 *   name or JR reference) flies into the record's title.
 * - **Back**: the record folds back into its row when the list has it, and
 *   the subject flies home.
 * - **Swap**: same level (another job, another farm, another tab). A short
 *   slide in the direction of travel; a tab's solid mark glides with it.
 *
 * Only the page column (`[data-vt-page]`), or a tab panel, moves. The rest
 * of the frame is captured as an unchanged root, so it stays put. The names
 * this module sets live on their elements only for the length of one
 * transition, because a `view-transition-name` makes its element a stacking
 * context. The exception is the solid "you are here" marks, which carry a
 * permanent name in their own markup so they glide on any move: the rail's
 * `lps-here` and the tab bar's `lps-here-tab` (`frame.tsx`), and the partner
 * history tabs' `lps-history-tab` (`partner-history-tabs.tsx`).
 *
 * Without the API, or in a background tab, the update simply runs. Under
 * reduced motion everything is a 120ms crossfade with nothing travelling.
 */
import type { useRouter } from 'next/navigation'
import { flushSync } from 'react-dom'

type Router = ReturnType<typeof useRouter>
export type TransitionKind = 'lateral' | 'deeper' | 'back' | 'swap'

interface Box { top: number; right: number; bottom: number; left: number }

export interface TransitionPlan {
  /** Inferred from the rail and the path depth when left out. */
  kind?: TransitionKind
  /** What was pressed: the row a record unfolds from. */
  from?: Element | null
  /** A `data-vt-key` carried across, e.g. `supplier:12` or `job:340`. */
  subject?: string
  /** What moves. Defaults to the page column. */
  region?: HTMLElement | null
  /** Travel along `axis`: 1 forward (down / right), -1 back. */
  direction?: number
  axis?: 'x' | 'y'
  /** Resolves once the update has landed (a route navigation). */
  commit?: () => boolean
  /** Hold the old frame until this is true (capped), e.g. a record loading. */
  ready?: () => boolean
  /** A solid mark that glides from one element to another (a tab pill). */
  mark?: { from: HTMLElement | null; to: () => HTMLElement | null }
}

const PAGE = 'lps-page'
const SUBJECT = 'lps-subject'
const MARK = 'lps-mark'
const EASE = 'cubic-bezier(.16, 1, .3, 1)'
const EXIT = 'cubic-bezier(.4, 0, 1, 1)'

/*
 * The stage, injected once at runtime because Turbopack's CSS pipeline drops
 * `::view-transition-*` rules from globals.css. The frame itself is the
 * unchanged root, so it holds still; `lps-here` is the rail's solid mark.
 */
const STAGE_CSS = `
::view-transition { pointer-events: none; }
/* The transition animates the change, so a tab's own colour easing must not
   be caught half-way in the new snapshot. */
:root[data-vt-active] *,
:root[data-vt-active] *::before,
:root[data-vt-active] *::after { transition: none !important; }
::view-transition-group(*) {
  animation-duration: .28s;
  animation-timing-function: var(--ease-lps);
}
::view-transition-old(root),
::view-transition-new(root) { animation-duration: .2s; }
/* Pages and panels change size freely; their images stay at 1:1, pinned to
   the top-left, and the script animates them, never the browser. */
::view-transition-group(lps-page) { animation: none; overflow: clip; }
::view-transition-old(lps-page),
::view-transition-new(lps-page) {
  animation: none;
  width: 100%;
  height: 100%;
  object-fit: none;
  object-position: left top;
  mix-blend-mode: normal;
}
/* Folding back: the record closes over the list it returns to. */
:root[data-vt-kind="back"]::view-transition-old(lps-page) { z-index: 1; }
/* The subject travels at its own height, anchored at its left edge, so a
   13px name grows into a 23px title instead of stretching into it. */
::view-transition-group(lps-subject) { animation-duration: .3s; }
::view-transition-old(lps-subject),
::view-transition-new(lps-subject) {
  width: auto;
  height: 100%;
  inset-inline-start: 0;
}
::view-transition-old(lps-subject) { animation-duration: .2s; }

@media (prefers-reduced-motion: reduce) {
  ::view-transition-group(*) { animation: none !important; }
  ::view-transition-old(*),
  ::view-transition-new(*) { animation-duration: .12s !important; }
}
`

let active: ViewTransition | null = null
/** Which transition last named an element, so a skipped one never unnames what a newer one claimed. */
const namedBy = new WeakMap<HTMLElement, object>()
let seed: { key: string; text: string } | null = null

/**
 * The subject's text as the list showed it, while the record it opened is
 * still loading — so the title the subject lands in already says it.
 */
export function subjectSeed(key: string): string | null {
  return seed?.key === key && seed.text ? seed.text : null
}

/** Which way a move goes, from the rail position and path depth either side. */
export function inferKind(
  before: { section: number; path: string },
  after: { section: number; path: string },
): TransitionKind {
  if (before.section >= 0 && after.section >= 0 && before.section !== after.section) return 'lateral'
  const depth = (path: string) => path.split('/').filter(Boolean).length
  const from = depth(before.path)
  const to = depth(after.path)
  return to > from ? 'deeper' : to < from ? 'back' : 'swap'
}

/** `rect` as a clip-path inset of `frame`, never negative. */
export function insetWithin(rect: Box, frame: Box): string {
  const px = (n: number) => `${Math.max(0, Math.round(n))}px`
  return `inset(${px(rect.top - frame.top)} ${px(frame.right - rect.right)} ${px(frame.bottom - rect.bottom)} ${px(rect.left - frame.left)} round 12px)`
}

export function canTransition(): boolean {
  return typeof document !== 'undefined'
    && typeof document.startViewTransition === 'function'
    && document.visibilityState === 'visible'
}

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const phone = () => window.matchMedia('(max-width: 899px)').matches
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function visible(element: Element): boolean {
  const rect = element.getBoundingClientRect()
  return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight
}

async function until<T>(probe: () => T | null | undefined | false, cap: number): Promise<T | null> {
  const end = performance.now() + cap
  for (;;) {
    const value = probe()
    if (value) return value
    if (performance.now() >= end) return null
    await pause(16)
  }
}

/** Names `element` for `owner`; an empty name clears it only while `owner` still holds it. */
function setName(element: HTMLElement | null | undefined, name: string, owner: object) {
  if (!element) return
  if (name) {
    element.style.viewTransitionName = name
    namedBy.set(element, owner)
  } else if (namedBy.get(element) === owner) {
    element.style.viewTransitionName = ''
    namedBy.delete(element)
  }
}

function pageRegion(): HTMLElement | null {
  return [...document.querySelectorAll<HTMLElement>('[data-vt-page]')].find(visible) ?? null
}

/** The visible subject for `key`, preferring one inside `within`. */
function findSubject(key: string, within?: Element | null): HTMLElement | null {
  const selector = `[data-vt-key="${CSS.escape(key)}"]`
  const own = within?.matches(selector) ? within : within?.querySelector(selector)
  if (own instanceof HTMLElement && visible(own)) return own
  return [...document.querySelectorAll<HTMLElement>(selector)].find(visible) ?? null
}

/** The row or card a record opens from, or folds back into. */
function rowOf(element: Element | null | undefined): Element | null {
  if (!element) return null
  return element.closest('[data-vt-card], tr, article') ?? element
}

/** Index of the current destination among the visible rail or tab bar items. */
function sectionIndex(): number {
  const items = [...document.querySelectorAll<HTMLElement>('[data-vt-nav]')].filter(visible)
  return items.findIndex((item) => item.getAttribute('aria-current') === 'page')
}

function stage() {
  if (document.getElementById('lps-view-transitions')) return
  const style = document.createElement('style')
  style.id = 'lps-view-transitions'
  style.textContent = STAGE_CSS
  document.head.append(style)
}

function shift(axis: 'x' | 'y', px: number) {
  return axis === 'x' ? `translateX(${px}px)` : `translateY(${px}px)`
}

/** Run `update` inside a view transition shaped by `plan`. */
export function transition(update: () => unknown, plan: TransitionPlan = {}): void {
  if (!canTransition()) {
    void update()
    return
  }
  active?.skipTransition()
  stage()

  const before = { section: sectionIndex(), path: location.pathname }
  const oldRegion = plan.region ?? pageRegion()
  const sourceRect = rowOf(plan.from)?.getBoundingClientRect() ?? null
  const oldSubject = plan.subject ? findSubject(plan.subject, plan.from) : null
  if (plan.subject) seed = { key: plan.subject, text: oldSubject?.textContent?.trim() ?? '' }
  // This transition's claim on the names it sets (the transition itself does not exist yet).
  const self = {}
  setName(oldRegion, PAGE, self)
  setName(oldSubject, SUBJECT, self)
  setName(plan.mark?.from, MARK, self)

  let kind: TransitionKind = plan.kind ?? 'swap'
  let newRegion: HTMLElement | null = null
  let newSubject: HTMLElement | null = null
  let newMark: HTMLElement | null = null
  let destinationRect: DOMRect | null = null
  let landed = true
  const root = document.documentElement
  root.dataset.vtActive = ''
  // Held to the transition's end, then dropped, so the images never snap back.
  const running: Animation[] = []
  const play = (pseudo: string, keyframes: Keyframe[], options: KeyframeAnimationOptions) => {
    running.push(root.animate(keyframes, { fill: 'both', ...options, pseudoElement: pseudo }))
  }

  const vt = document.startViewTransition(async () => {
    // The old frame is captured; free the names before the new one is.
    setName(oldRegion, '', self)
    setName(oldSubject, '', self)
    setName(plan.mark?.from, '', self)
    await update()
    // A newer transition skipped this one; the names and the stage are its now.
    if (active !== vt) return
    // A route that has not landed shows no move at all; it arrives later, still.
    if (plan.commit) landed = !!(await until(plan.commit, 900))
    if (!landed || active !== vt) return
    // Each page mounts its own frame; give its rail a moment to say where it is.
    if (before.section >= 0) await until(() => sectionIndex() >= 0, 200)
    if (active !== vt) return
    kind = plan.kind ?? inferKind(before, { section: sectionIndex(), path: location.pathname })
    newRegion = plan.region ?? pageRegion()
    // The frame still shows the old view; nothing unseen takes a click.
    if (newRegion) newRegion.style.pointerEvents = 'none'
    if (plan.subject) {
      const key = plan.subject
      newSubject = await until(() => findSubject(key), kind === 'back' ? 450 : 400)
    }
    if (plan.ready) await until(plan.ready, 350)
    if (newRegion) newRegion.style.pointerEvents = ''
    if (active !== vt) return
    if (kind === 'back') destinationRect = rowOf(newSubject)?.getBoundingClientRect() ?? null
    newMark = plan.mark?.to() ?? null
    root.dataset.vtKind = kind
    setName(newRegion, PAGE, self)
    setName(newSubject, SUBJECT, self)
    setName(newMark, MARK, self)
  })
  active = vt

  vt.ready.then(() => {
    const old = `::view-transition-old(${PAGE})`
    const next = `::view-transition-new(${PAGE})`
    if (!landed || (!oldRegion && !newRegion)) return
    if (reducedMotion()) {
      play(old, [{ opacity: 1 }, { opacity: 0 }], { duration: 120, easing: 'ease-out' })
      play(next, [{ opacity: 0 }, { opacity: 1 }], { duration: 120, easing: 'ease-out' })
      return
    }
    const axis = plan.axis ?? (kind === 'lateral' && !phone() ? 'y' : 'x')
    const frame = (newRegion as HTMLElement | null)?.getBoundingClientRect()

    if (kind === 'deeper' && sourceRect && frame) {
      // The record unfolds out of the row that was pressed.
      const cx = sourceRect.left + sourceRect.width / 2 - frame.left
      const cy = sourceRect.top + sourceRect.height / 2 - frame.top
      const origin = `${Math.round(cx)}px ${Math.round(cy)}px`
      play(old, [
        { opacity: 1, transform: 'none', transformOrigin: origin },
        { opacity: 0, transform: 'scale(.97)', transformOrigin: origin },
      ], { duration: 150, easing: EXIT })
      // Opaque inside the clip: the row becomes the record, nothing double-exposes.
      play(next, [{ clipPath: insetWithin(sourceRect, frame) }, { clipPath: 'inset(0px 0px 0px 0px round 0px)' }],
        { duration: 300, easing: EASE })
      return
    }
    if (kind === 'back' && destinationRect && frame) {
      // …and folds back into its row, which waits underneath.
      play(old, [
        { clipPath: 'inset(0px 0px 0px 0px round 0px)', opacity: 1 },
        { clipPath: insetWithin(destinationRect, frame), opacity: 1, offset: 0.8 },
        { clipPath: insetWithin(destinationRect, frame), opacity: 0 },
      ], { duration: 300, easing: EASE })
      play(next, [{ opacity: 0, transform: 'scale(.985)' }, { opacity: 1, transform: 'none' }],
        { duration: 300, easing: EASE })
      return
    }
    if (kind === 'deeper' || kind === 'back') {
      // No row to grow from (or to return to): rise in, or settle back.
      const d = kind === 'deeper' ? 1 : -1
      play(old, [{ opacity: 1 }, { opacity: 0 }], { duration: 110, easing: EXIT })
      play(next, [{ opacity: 0, transform: shift('y', 14 * d) }, { opacity: 1, transform: 'none' }],
        { duration: 230, easing: EASE, delay: 70 })
      return
    }
    // Hand-off rather than crossfade: two dense tables never double-expose.
    const d = Math.sign(plan.direction ?? (kind === 'lateral' ? sectionIndex() - before.section : 0))
    const travel = kind === 'lateral' ? 28 : 18
    play(old, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: shift(axis, -10 * d) }],
      { duration: 110, easing: EXIT })
    play(next, [{ opacity: 0, transform: shift(axis, travel * d) }, { opacity: 1, transform: 'none' }],
      { duration: kind === 'lateral' ? 230 : 210, easing: EASE, delay: 70 })
  }).catch(() => {})

  void vt.finished.finally(() => {
    for (const animation of running) animation.cancel()
    for (const element of [oldRegion, newRegion, oldSubject, newSubject, newMark, plan.mark?.from]) setName(element, '', self)
    if (active === vt) {
      active = null
      delete root.dataset.vtKind
      delete root.dataset.vtActive
    }
  })
}

/** Navigate with a view transition; the transition holds until the route lands. */
export function navigate(
  router: Router,
  href: string,
  plan: TransitionPlan & { replace?: boolean; scroll?: boolean } = {},
): void {
  const { replace, scroll = true, ...rest } = plan
  const target = new URL(href, location.href)
  transition(
    () => (replace ? router.replace(href, { scroll }) : router.push(href, { scroll })),
    { ...rest, commit: () => location.pathname === target.pathname && location.search === target.search },
  )
}

/**
 * Switch tabs in a transition: the panel after the tab bar slides toward the
 * tab chosen, and the solid tab mark glides across. The tab bar carries
 * `data-vt-tabs`; the element right after it carries `data-vt-panel`.
 */
export function switchTab(trigger: HTMLElement, update: () => void): void {
  const bar = trigger.closest('[data-vt-tabs]')
  const panel = bar?.nextElementSibling
  const tabs = bar ? [...bar.querySelectorAll<HTMLElement>('[role="tab"], [data-vt-tab]')] : []
  const current = tabs.find((tab) => tab.getAttribute('aria-selected') === 'true' || tab.dataset.vtTab === 'active')
  if (!(panel instanceof HTMLElement) || !panel.hasAttribute('data-vt-panel') || !current || current === trigger) {
    update()
    return
  }
  transition(() => flushSync(update), {
    kind: 'swap',
    region: panel,
    axis: 'x',
    direction: tabs.indexOf(trigger) - tabs.indexOf(current),
    mark: { from: current, to: () => trigger },
  })
}
