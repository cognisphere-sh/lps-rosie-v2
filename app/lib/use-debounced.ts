'use client'

import { useEffect, useState } from 'react'

/**
 * Debounce a whole search request — the typed question and the serialized
 * filter state — as one value. The search boxes feed the pgroonga search RPCs,
 * which are far too expensive to fire per keystroke.
 *
 * Query and filters settle *together* deliberately. On separate timers a
 * keystroke and a filter click landing in the same window settle at two
 * different moments and cost two requests for one intent.
 *
 * `settled` is false from the first keystroke until the debounced value has
 * caught up, so a caller can show its loader across the debounce window rather
 * than 300ms later when the fetch actually fires.
 */
export function useDebouncedSearch(query: string, filters: string, delay = 300) {
  const [debounced, setDebounced] = useState({ query, filters })

  useEffect(() => {
    const timer = setTimeout(
      () =>
        setDebounced((prev) =>
          prev.query === query && prev.filters === filters ? prev : { query, filters },
        ),
      delay,
    )
    return () => clearTimeout(timer)
  }, [query, filters, delay])

  return {
    query: debounced.query,
    filters: debounced.filters,
    settled: debounced.query === query && debounced.filters === filters,
  }
}
