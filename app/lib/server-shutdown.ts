// Next waits for active HTTP requests before exiting. SSE must close on signals
// so an open browser tab cannot hold a deployment in systemd's stop timeout.
type ShutdownState = { stopping: boolean; listeners: Set<() => void> }
const globals = globalThis as typeof globalThis & { __lps_server_shutdown?: ShutdownState }

export function onServerShutdown(listener: () => void): () => void {
  if (!globals.__lps_server_shutdown) {
    const state: ShutdownState = { stopping: false, listeners: new Set() }
    globals.__lps_server_shutdown = state
    const stop = () => {
      if (state.stopping) return
      state.stopping = true
      const listeners = [...state.listeners]
      state.listeners.clear()
      for (const close of listeners) close()
    }
    // One listener per signal across all routes/streams, including hot reloads.
    process.once('SIGTERM', stop)
    process.once('SIGINT', stop)
  }
  const state = globals.__lps_server_shutdown
  if (state.stopping) {
    listener()
    return () => {}
  }
  state.listeners.add(listener)
  return () => { state.listeners.delete(listener) }
}
