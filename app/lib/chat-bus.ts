'use client'

/**
 * Tiny window-event bus between the workspace and the chat panel.
 *
 * Cards deep in a page need to open the docked chat on a specific agent
 * thread, or an availability request in the global drawer — and the panel and
 * drawer live at the Shell level. A custom event keeps that a one-liner from
 * anywhere instead of threading callbacks through every layer.
 */

export interface OpenChatDetail {
  agentId: string
  threadId: string
  /** What the panel header calls the thread (falls back to the id). */
  label?: string
}

export function openChat(detail: OpenChatDetail): void {
  window.dispatchEvent(new CustomEvent<OpenChatDetail>('lps:open-chat', { detail }))
}

export function onOpenChat(handler: (detail: OpenChatDetail) => void): () => void {
  const listener = (e: Event) => handler((e as CustomEvent<OpenChatDetail>).detail)
  window.addEventListener('lps:open-chat', listener)
  return () => window.removeEventListener('lps:open-chat', listener)
}

export function openAvailabilityRequest(arId: number): void {
  window.dispatchEvent(new CustomEvent<number>('lps:open-ar', { detail: arId }))
}

export function onOpenAvailabilityRequest(handler: (arId: number) => void): () => void {
  const listener = (e: Event) => handler((e as CustomEvent<number>).detail)
  window.addEventListener('lps:open-ar', listener)
  return () => window.removeEventListener('lps:open-ar', listener)
}

export interface AvailabilityRequestStatusDetail {
  arId: number
  status: string
}

/** Tell mounted admin views that a drawer write changed an AR lifecycle state. */
export function availabilityRequestStatusChanged(detail: AvailabilityRequestStatusDetail): void {
  window.dispatchEvent(new CustomEvent<AvailabilityRequestStatusDetail>('lps:ar-status', { detail }))
}

export function onAvailabilityRequestStatusChanged(
  handler: (detail: AvailabilityRequestStatusDetail) => void,
): () => void {
  const listener = (e: Event) => handler((e as CustomEvent<AvailabilityRequestStatusDetail>).detail)
  window.addEventListener('lps:ar-status', listener)
  return () => window.removeEventListener('lps:ar-status', listener)
}

export interface RenameThreadDetail {
  threadId: string
  /** What the thread is called now — the panel header and picker follow it. */
  label: string
}

/**
 * A thread's subject was renamed elsewhere (a job request's name, today).
 *
 * The picker reads its titles from the database on every open, so it needs no
 * telling; this is for the panel that is *already* looking at the thread, whose
 * header would otherwise keep the name the thread was opened under.
 */
export function renameThread(detail: RenameThreadDetail): void {
  window.dispatchEvent(new CustomEvent<RenameThreadDetail>('lps:rename-thread', { detail }))
}

export function onRenameThread(handler: (detail: RenameThreadDetail) => void): () => void {
  const listener = (e: Event) => handler((e as CustomEvent<RenameThreadDetail>).detail)
  window.addEventListener('lps:rename-thread', listener)
  return () => window.removeEventListener('lps:rename-thread', listener)
}
