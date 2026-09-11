'use client'

import { useEffect, useRef } from 'react'

import { subscribeEvents } from '@/lib/chat-events'
import { isJobEvent } from '@/lib/job-events'

/**
 * Share chat's authenticated SSE connection. Re-read authoritative API data
 * after DB writes, reconnects, tab returns and a slow fallback poll. A bounded
 * batch groups bulk inserts; a change during a read always gets another read.
 * Callers keep their records mounted and guard stale responses on navigation.
 */
export function useJobUpdates(refresh: () => void | Promise<unknown>, enabled = true): void {
  const latest = useRef(refresh)
  useEffect(() => { latest.current = refresh }, [refresh])

  useEffect(() => {
    if (!enabled) return
    let disposed = false
    let running = false
    let dirty = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const schedule = () => {
      dirty = true
      if (disposed || running || timer || document.visibilityState === 'hidden') return
      timer = setTimeout(() => {
        timer = undefined
        if (disposed || document.visibilityState === 'hidden') return
        dirty = false
        running = true
        void Promise.resolve().then(() => latest.current()).catch(() => {
          // Each view owns its error state. A failed read can retry on the
          // next event, reconnect, focus or fallback tick.
        }).finally(() => {
          running = false
          if (!disposed && dirty) schedule()
        })
      }, 200)
    }
    const off = typeof EventSource === 'undefined' ? () => {} : subscribeEvents('/api/chat/events', (event) => {
      if (isJobEvent(event)) schedule()
    }, schedule)
    const visible = () => { if (document.visibilityState !== 'hidden') schedule() }
    const poll = setInterval(visible, 60_000)
    window.addEventListener('focus', visible)
    window.addEventListener('online', visible)
    document.addEventListener('visibilitychange', visible)
    return () => {
      disposed = true
      clearTimeout(timer)
      clearInterval(poll)
      off()
      window.removeEventListener('focus', visible)
      window.removeEventListener('online', visible)
      document.removeEventListener('visibilitychange', visible)
    }
  }, [enabled])
}
