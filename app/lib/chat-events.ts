'use client'

/**
 * One shared EventSource per URL, reference-counted, so the bell, the open
 * panel and the portal's two hooks share a connection rather than each
 * holding one. Listeners get every parsed `data:` event; `onOpen` fires on
 * each (re)connect, which is when a subscriber should re-sync what it may
 * have missed. Browser-only.
 */
interface Shared {
  source: EventSource
  listeners: Set<(data: unknown) => void>
  opens: Set<() => void>
}

const shared = new Map<string, Shared>()

export function subscribeEvents(
  url: string,
  onEvent: (data: unknown) => void,
  onOpen?: () => void,
): () => void {
  let s = shared.get(url)
  if (!s) {
    const source = new EventSource(url)
    const entry: Shared = { source, listeners: new Set(), opens: new Set() }
    source.onmessage = (e) => {
      let data: unknown
      try {
        data = JSON.parse(e.data)
      } catch {
        return
      }
      for (const l of entry.listeners) l(data)
    }
    source.onopen = () => {
      for (const o of entry.opens) o()
    }
    shared.set(url, entry)
    s = entry
  }
  s.listeners.add(onEvent)
  if (onOpen) s.opens.add(onOpen)
  return () => {
    s.listeners.delete(onEvent)
    if (onOpen) s.opens.delete(onOpen)
    if (s.listeners.size === 0) {
      s.source.close()
      shared.delete(url)
    }
  }
}
