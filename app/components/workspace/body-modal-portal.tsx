'use client'

import { useLayoutEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface BackgroundState {
  node: HTMLElement
  hadOwnInertProperty: boolean
  hadInertProperty: boolean
  inertPropertyValue: boolean | undefined
  hadInertAttribute: boolean
  inertAttributeValue: string | null
  hadAriaHidden: boolean
  ariaHiddenValue: string | null
}

interface OverflowState {
  hadDeclaration: boolean
  value: string
  priority: string
}

function snapshot(node: HTMLElement): BackgroundState {
  return {
    node,
    hadOwnInertProperty: Object.prototype.hasOwnProperty.call(node, 'inert'),
    hadInertProperty: 'inert' in node,
    inertPropertyValue: 'inert' in node ? node.inert : undefined,
    hadInertAttribute: node.hasAttribute('inert'),
    inertAttributeValue: node.getAttribute('inert'),
    hadAriaHidden: node.hasAttribute('aria-hidden'),
    ariaHiddenValue: node.getAttribute('aria-hidden'),
  }
}

function isolate(node: HTMLElement): void {
  node.inert = true
  node.setAttribute('inert', '')
  node.setAttribute('aria-hidden', 'true')
}

function restore(state: BackgroundState): void {
  const ownProperties = state.node as unknown as Record<string, unknown>

  // A reflected property write can change the attribute. Restore the property
  // first, including whether JSDOM/a polyfill supplied it as an own property;
  // then restore the exact attribute bytes last.
  if (state.hadInertProperty) state.node.inert = state.inertPropertyValue ?? false
  if (!state.hadOwnInertProperty && Object.prototype.hasOwnProperty.call(state.node, 'inert')) {
    delete ownProperties.inert
  }
  if (state.hadInertAttribute) state.node.setAttribute('inert', state.inertAttributeValue ?? '')
  else state.node.removeAttribute('inert')

  if (state.hadAriaHidden) state.node.setAttribute('aria-hidden', state.ariaHiddenValue ?? '')
  else state.node.removeAttribute('aria-hidden')
}

function exposeManagedHost(node: HTMLElement): void {
  const ownProperties = node as unknown as Record<string, unknown>
  if ('inert' in node) node.inert = false
  if (Object.prototype.hasOwnProperty.call(node, 'inert')) delete ownProperties.inert
  node.removeAttribute('inert')
  node.removeAttribute('aria-hidden')
}

// Body portals share one document-level baseline and stack. Per-instance
// snapshots cannot restore correctly when React disposes a parent portal before
// its nested portal, so every transition is derived from this common baseline.
let managedDocument: Document | null = null
let modalStack: HTMLElement[] = []
let managedHosts = new Set<HTMLElement>()
let baseline = new Map<HTMLElement, BackgroundState>()
let overflowBaseline: OverflowState | null = null
let bodyObserver: MutationObserver | null = null

function bodyElements(doc: Document): HTMLElement[] {
  return [...doc.body.children].filter((node): node is HTMLElement => node instanceof HTMLElement)
}

function captureNewBackgroundChildren(doc: Document): void {
  for (const node of bodyElements(doc)) {
    if (!managedHosts.has(node) && !baseline.has(node)) baseline.set(node, snapshot(node))
  }
}

function recomputeIsolation(): void {
  const doc = managedDocument
  if (!doc || modalStack.length === 0) return
  captureNewBackgroundChildren(doc)
  const top = modalStack.at(-1)
  doc.body.style.setProperty('overflow', 'hidden')
  for (const node of bodyElements(doc)) {
    if (node === top) exposeManagedHost(node)
    else isolate(node)
  }
}

function beginManagement(doc: Document): void {
  managedDocument = doc
  const style = doc.body.style
  const value = style.getPropertyValue('overflow')
  overflowBaseline = {
    hadDeclaration: [...style].includes('overflow'),
    value,
    priority: style.getPropertyPriority('overflow'),
  }
  captureNewBackgroundChildren(doc)
  const Observer = doc.defaultView?.MutationObserver
  if (Observer) {
    bodyObserver = new Observer(() => recomputeIsolation())
    bodyObserver.observe(doc.body, { childList: true })
  }
}

function restoreAll(): void {
  const doc = managedDocument
  if (!doc) return

  for (const state of baseline.values()) restore(state)
  if (overflowBaseline?.hadDeclaration) {
    doc.body.style.setProperty('overflow', overflowBaseline.value, overflowBaseline.priority)
  } else {
    doc.body.style.removeProperty('overflow')
  }
  bodyObserver?.disconnect()
  bodyObserver = null

  baseline.clear()
  managedHosts.clear()
  modalStack = []
  overflowBaseline = null
  managedDocument = null
}

function registerModalHost(host: HTMLElement): () => void {
  const doc = host.ownerDocument
  if (managedDocument && managedDocument !== doc) {
    throw new Error('BodyModalPortal cannot manage multiple documents at once')
  }
  managedHosts.add(host)
  if (!managedDocument) beginManagement(doc)
  modalStack.push(host)
  recomputeIsolation()

  let registered = true
  return () => {
    if (!registered) return
    registered = false
    const index = modalStack.lastIndexOf(host)
    if (index >= 0) modalStack.splice(index, 1)

    if (modalStack.length > 0) {
      // Keep a retiring host managed through this recomputation. This is what
      // makes outer-first disposal safe while an inner host remains active.
      recomputeIsolation()
      managedHosts.delete(host)
      host.remove()
      return
    }

    // Restore every non-host baseline before the final managed host disappears.
    restoreAll()
    host.remove()
  }
}

/**
 * Mount one modal in a dedicated body child. A document-level stack exposes
 * only the current top host and makes cleanup order-independent, including a
 * whole React tree unmount while a nested modal is open.
 */
export function BodyModalPortal({
  children,
  hostAttribute,
}: {
  children: ReactNode
  hostAttribute: string
}) {
  const [host, setHost] = useState<HTMLElement | null>(null)

  useLayoutEffect(() => {
    const portal = document.createElement('div')
    portal.setAttribute(hostAttribute, '')
    document.body.appendChild(portal)
    const unregister = registerModalHost(portal)
    setHost(portal)
    return unregister
  }, [hostAttribute])

  return host ? createPortal(children, host) : null
}

/** A focus target that is still visible and outside inert/hidden ancestry. */
export function validModalFocusTarget(target: HTMLElement | null | undefined): target is HTMLElement {
  if (!target?.isConnected || target.matches(':disabled')) return false
  for (let node: HTMLElement | null = target; node; node = node.parentElement) {
    if (node.hidden || node.getAttribute('aria-hidden') === 'true') return false
    if (node.hasAttribute('inert') || ('inert' in node && node.inert)) return false
  }
  const style = getComputedStyle(target)
  return style.display !== 'none'
    && style.visibility !== 'hidden'
    && target.getClientRects().length > 0
}

export function firstModalFocusTarget(root: ParentNode, exclude?: Element | null): HTMLElement | null {
  const candidates = root.querySelectorAll<HTMLElement>(
    'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
  )
  for (const candidate of candidates) {
    if (exclude?.contains(candidate)) continue
    if (validModalFocusTarget(candidate)) return candidate
  }
  return null
}
