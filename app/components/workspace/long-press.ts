'use client'

import { useEffect, useRef, useState, type TouchEvent } from 'react'

/**
 * Press-and-hold to edit, on touch screens only (2026-10-07).
 *
 * A tap that starts a scroll used to open the field under the finger. On a
 * coarse pointer an inline editor now opens only after a hold; moving the
 * finger first (a scroll) or lifting early cancels it. Mouse and keyboard keep
 * their click-to-edit.
 */

const HOLD_MS = 450
const SLOP_PX = 10

/** True on phones and tablets; false until mounted, so SSR and desktop agree. */
export function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(false)
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const query = window.matchMedia('(pointer: coarse)')
    const sync = () => setCoarse(query.matches)
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])
  return coarse
}

/** Touch handlers that call `onHold` after a still press. Spread onto the element. */
export function useLongPress(onHold: () => void, enabled: boolean, onRelease?: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const origin = useRef<{ x: number; y: number } | null>(null)
  const held = useRef(false)
  const clear = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    origin.current = null
  }
  useEffect(() => clear, [])
  if (!enabled) return {}
  return {
    onTouchStart: (event: TouchEvent) => {
      const touch = event.touches[0]
      origin.current = { x: touch.clientX, y: touch.clientY }
      timer.current = setTimeout(() => { clear(); held.current = true; onHold() }, HOLD_MS)
    },
    onTouchMove: (event: TouchEvent) => {
      const touch = event.touches[0]
      const from = origin.current
      if (from && Math.hypot(touch.clientX - from.x, touch.clientY - from.y) > SLOP_PX) clear()
    },
    // `onRelease` runs inside the lifting touch, which browsers count as a user
    // gesture: the one place a native picker or keyboard may be opened.
    onTouchEnd: () => {
      clear()
      if (held.current) { held.current = false; onRelease?.() }
    },
    onTouchCancel: () => { clear(); held.current = false },
    // The browser's own hold menu would otherwise cover the editor.
    onContextMenu: (event: { preventDefault: () => void }) => event.preventDefault(),
  }
}
