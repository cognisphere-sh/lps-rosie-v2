'use client'

import { useEffect, useState } from 'react'

/**
 * Debounce a value. The search boxes feed the pgroonga search RPCs, which are
 * far too expensive to fire per keystroke.
 */
export function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debounced
}
