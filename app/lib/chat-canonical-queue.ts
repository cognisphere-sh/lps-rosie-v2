export const CANONICAL_QUEUE_LIMITS = {
  perKeyOperations: 8,
  activeKeys: 64,
  totalOperations: 128,
} as const

export type CanonicalQueueSaturation = 'per-key' | 'active-keys' | 'total-operations'

/** A capacity rejection callers can map to HTTP 429 without string matching. */
export class CanonicalQueueSaturatedError extends Error {
  readonly status = 429

  constructor(readonly saturation: CanonicalQueueSaturation) {
    super(`canonical queue saturated: ${saturation}`)
    this.name = 'CanonicalQueueSaturatedError'
  }
}

type CanonicalQueue = { tail: Promise<void>; depth: number }

// send/reset for one canonical conversation must reach webchat in arrival
// order even when the browser disconnects. All three counters are bounded;
// every operation supplied by the route also has a finite upstream timeout.
const canonicalQueues = new Map<string, CanonicalQueue>()
let totalOperations = 0

export async function enqueueCanonical<T>(key: string, operation: () => Promise<T>): Promise<T> {
  const existing = canonicalQueues.get(key)
  if ((existing?.depth ?? 0) >= CANONICAL_QUEUE_LIMITS.perKeyOperations) {
    throw new CanonicalQueueSaturatedError('per-key')
  }
  if (totalOperations >= CANONICAL_QUEUE_LIMITS.totalOperations) {
    throw new CanonicalQueueSaturatedError('total-operations')
  }
  if (!existing && canonicalQueues.size >= CANONICAL_QUEUE_LIMITS.activeKeys) {
    throw new CanonicalQueueSaturatedError('active-keys')
  }

  // No await occurs before all capacity checks and counter updates, so one JS
  // turn reserves its slot atomically with respect to every other request.
  const previous = existing?.tail ?? Promise.resolve()
  let release!: () => void
  const turn = new Promise<void>((resolve) => { release = resolve })
  const tail = previous.catch(() => undefined).then(() => turn)
  canonicalQueues.set(key, { tail, depth: (existing?.depth ?? 0) + 1 })
  totalOperations += 1

  await previous.catch(() => undefined)
  try {
    return await operation()
  } finally {
    release()
    totalOperations = Math.max(0, totalOperations - 1)
    const current = canonicalQueues.get(key)
    if (current?.tail === tail) canonicalQueues.delete(key)
    else if (current) canonicalQueues.set(key, { ...current, depth: Math.max(0, current.depth - 1) })
  }
}

/** Read-only production-safe diagnostics; useful for health checks and tests. */
export function canonicalQueueSnapshot(): { activeKeys: number; totalOperations: number; depths: number[] } {
  return {
    activeKeys: canonicalQueues.size,
    totalOperations,
    depths: [...canonicalQueues.values()].map(({ depth }) => depth),
  }
}

/** Tests may reset only an already-idle queue; active production work cannot be discarded. */
export function resetCanonicalQueueForTests(): void {
  if (totalOperations !== 0 || canonicalQueues.size !== 0) {
    throw new Error('cannot reset a non-idle canonical queue')
  }
  canonicalQueues.clear()
  totalOperations = 0
}
