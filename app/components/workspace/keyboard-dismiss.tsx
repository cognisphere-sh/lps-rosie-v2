'use client'

import { useEffect } from 'react'

/**
 * Android's back button or back swipe while typing only hides the keyboard:
 * the field keeps focus, so a card's inline editor stayed open (2026-10-26).
 * When the keyboard closes with a text field still focused, blur it — every
 * inline editor saves and closes on blur, as on a tap outside it.
 */

// The visual viewport shrinks by at least this much while a keyboard is up;
// browser toolbars sliding in and out move it by less.
const KEYBOARD_PX = 150
const TEXT_TYPES = new Set(['text', 'number', 'search', 'email', 'tel', 'url', 'password'])

const typing = (element: Element | null): element is HTMLElement =>
  element instanceof HTMLTextAreaElement || (element instanceof HTMLInputElement && TEXT_TYPES.has(element.type))

export function KeyboardDismissBlur() {
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv || typeof window.matchMedia !== 'function' || !window.matchMedia('(pointer: coarse)').matches) return
    let full = vv.height
    let width = vv.width
    let open = false
    const resize = () => {
      // A rotation or zoom changes the width, a keyboard never does: start over.
      if (vv.width !== width) { width = vv.width; full = vv.height; open = false; return }
      full = Math.max(full, vv.height)
      if (full - vv.height > KEYBOARD_PX) { open = true; return }
      if (!open) return
      open = false
      const active = document.activeElement
      if (typing(active)) active.blur()
    }
    vv.addEventListener('resize', resize)
    return () => vv.removeEventListener('resize', resize)
  }, [])
  return null
}
