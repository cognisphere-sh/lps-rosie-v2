/**
 * What the user has open when they send a chat message — sent alongside the
 * text so the agent can read intent off the screen (a job request, a supplier
 * page, an availability request) rather than asking "which one?".
 */
export function currentPage(): { path: string; title?: string } | undefined {
  if (typeof window === 'undefined') return undefined
  const path = window.location.pathname + window.location.search
  const title = document.title.trim()
  return title ? { path, title } : { path }
}
