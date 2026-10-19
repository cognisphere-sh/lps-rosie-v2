'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

import { canTransition, navigate, type TransitionKind } from '@/lib/view-transitions'

/**
 * Turns every in-app link click inside the workspace frame into a view
 * transition (`lib/view-transitions.ts`). Mounted once, from the root layout.
 *
 * A link's own click handler still gets the final say: this listener stops
 * Next's `<Link>` from navigating on its own, then waits for the click to
 * finish dispatching and steps aside if any handler prevented the default
 * (an unsaved-changes confirm, the tab bar unwinding an overlay).
 *
 * A link can steer its move with `data-vt-kind` and `data-vt-subject`, or
 * opt out with `data-vt="off"`. A subject is otherwise read from a
 * `data-vt-key` inside the link. Links inside a `data-vt-tabs` group slide
 * toward the tab chosen.
 */
export function RouteTransitions() {
  const router = useRouter()
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null
      if (!link || link.dataset.vt === 'off' || !link.closest('[data-workspace-shell]')) return
      if ((link.target && link.target !== '_self') || link.hasAttribute('download')) return
      const url = new URL(link.href, location.href)
      if (url.origin !== location.origin || /^\/(api|a|public)\//.test(url.pathname)) return
      if (url.pathname === location.pathname && url.search === location.search) return
      if (!canTransition()) return

      let vetoed = false
      const prevent = event.preventDefault.bind(event)
      Object.defineProperty(event, 'preventDefault', {
        configurable: true,
        value: () => {
          vetoed = true
          prevent()
        },
      })
      prevent()

      const tabs = link.closest('[data-vt-tabs]')
      const siblings = tabs ? [...tabs.querySelectorAll('a[href]')] : []
      const current = siblings.findIndex((tab) => tab.getAttribute('aria-current') === 'page')
      setTimeout(() => {
        if (vetoed) return
        navigate(router, url.pathname + url.search + url.hash, {
          from: link,
          kind: (link.dataset.vtKind as TransitionKind | undefined) ?? (tabs ? 'swap' : undefined),
          subject: link.dataset.vtSubject ?? link.querySelector('[data-vt-key]')?.getAttribute('data-vt-key') ?? undefined,
          ...(tabs && current >= 0 ? { axis: 'x' as const, direction: siblings.indexOf(link) - current } : {}),
        })
      }, 0)
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [router])
  return null
}
