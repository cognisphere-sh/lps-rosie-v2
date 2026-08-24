'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * A mobile view that is a page rather than an overlay.
 *
 * The Agents channel list, an agent conversation and the supplier's chat all
 * draw over the route they were opened from instead of getting one of their
 * own. Without a history entry each, the device Back button skips straight
 * past them and leaves the route. So each one pushes an entry — same URL, so
 * the app router treats it as a no-op restore — and what is on screen is read
 * back out of `history.state`. Back pops one view; returning to an entry after
 * navigating away restores the view it was opened on.
 *
 * `V` is the caller's own shape (which list, which agent); `null` is the page
 * itself with nothing over it.
 */
export function useHistoryView<V>() {
  const [view, setView] = useState<V | null>(null)
  /** How many entries of ours sit above the page's own, from the live entry. */
  const depth = useRef(0)

  useEffect(() => {
    const sync = () => {
      const entry = (window.history.state as { lpsView?: { view: V; depth: number } } | null)?.lpsView
      setView(entry?.view ?? null)
      depth.current = entry?.depth ?? 0
    }
    sync()
    window.addEventListener('popstate', sync)
    return () => window.removeEventListener('popstate', sync)
  }, [])

  /** Open a stack of views at once — the last one is what shows. */
  const open = useCallback((...views: V[]) => {
    for (const next of views) {
      depth.current += 1
      window.history.pushState({ lpsView: { view: next, depth: depth.current } }, '')
    }
    setView(views[views.length - 1] ?? null)
  }, [])

  /** One step out, exactly as the device's Back button does it. */
  const back = useCallback(() => window.history.back(), [])

  /**
   * All the way out, to the page the views were opened over — for a tap on
   * the destination you are already on, which has no route change to make.
   */
  const close = useCallback(() => {
    if (depth.current > 0) window.history.go(-depth.current)
  }, [])

  /**
   * Take the view off the screen without touching history — for a tap that
   * navigates. A route transition keeps the current page mounted until the new
   * one arrives, and behind a full-screen view that reads as the tap having
   * done nothing. The entry stays put, so coming back re-opens it.
   */
  const dismiss = useCallback(() => setView(null), [])

  return { view, open, back, close, dismiss }
}
