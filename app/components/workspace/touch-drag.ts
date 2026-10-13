'use client'

import { useEffect, useRef, type RefObject } from 'react'

/**
 * Touch drag for elements that use HTML5 drag and drop (2026-10-07).
 *
 * Phone browsers either never fire `dragover`/`drop` for a touch, or run
 * their own long-press drag that cancels the touch, so a candidate pill could
 * not be dragged there. Press and hold, then drag: this replays the same drag
 * events at the element under the finger, carrying a stand-in `dataTransfer`,
 * so every existing drop zone works unchanged. A short touch-and-move is still
 * a scroll; only a hold starts a drag.
 */

const HOLD_MS = 350
const SLOP_PX = 8
const EDGE_PX = 72

/** The parts of `DataTransfer` the drop zones read and write. */
export class TouchDataTransfer {
  private data = new Map<string, string>()
  dropEffect = 'none'
  effectAllowed = 'all'
  get types() { return [...this.data.keys()] }
  setData(type: string, value: string) { this.data.set(type, value) }
  getData(type: string) { return this.data.get(type) ?? '' }
  clearData() { this.data.clear() }
}

function fire(target: Element, type: string, dataTransfer: TouchDataTransfer, x: number, y: number) {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperties(event, {
    dataTransfer: { value: dataTransfer },
    clientX: { value: x },
    clientY: { value: y },
  })
  target.dispatchEvent(event)
  return event.defaultPrevented
}

/** The nearest ancestor that scrolls vertically, for edge auto-scroll. */
function scroller(from: Element | null): Element | null {
  for (let node = from; node; node = node.parentElement) {
    const style = getComputedStyle(node)
    if (/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight) return node
  }
  return document.scrollingElement
}

export function useTouchDrag(
  ref: RefObject<HTMLElement | null>,
  { start, end, disabled = false }: {
    /** Fill the drag's data, as `onDragStart` would. */
    start: (dataTransfer: TouchDataTransfer) => void
    /** The drag finished, dropped or not, as `onDragEnd`. */
    end: () => void
    disabled?: boolean
  },
) {
  // Starting a drag re-renders its owner; held in refs, the callbacks can
  // change without tearing the listeners (and the drag in progress) down.
  const handlers = useRef({ start, end })
  useEffect(() => { handlers.current = { start, end } })
  useEffect(() => {
    const node = ref.current
    if (!node || disabled) return
    let timer: number | null = null
    let dragging = false
    let origin = { x: 0, y: 0 }
    let point = { x: 0, y: 0 }
    let over: Element | null = null
    let accepted = false
    let ghost: HTMLElement | null = null
    let frame = 0
    let dt = new TouchDataTransfer()

    const moveGhost = () => {
      if (ghost) ghost.style.transform = `translate(${point.x - ghost.offsetWidth / 2}px, ${point.y - ghost.offsetHeight - 16}px)`
    }
    const target = () => {
      const hit = document.elementFromPoint(point.x, point.y)
      return hit && !ghost?.contains(hit) ? hit : null
    }
    const dragTo = () => {
      const next = target()
      if (next !== over) {
        if (over) fire(over, 'dragleave', dt, point.x, point.y)
        over = next
        if (over) fire(over, 'dragenter', dt, point.x, point.y)
      }
      accepted = over ? fire(over, 'dragover', dt, point.x, point.y) : false
    }
    // Holding near the top or bottom edge scrolls, so a drop zone off screen
    // (a supplier tab above the lines) is still reachable.
    const autoScroll = () => {
      if (!dragging) return
      const edge = point.y < EDGE_PX ? -1 : point.y > window.innerHeight - EDGE_PX ? 1 : 0
      if (edge) {
        scroller(over ?? node)?.scrollBy(0, edge * 10)
        dragTo()
      }
      frame = requestAnimationFrame(autoScroll)
    }
    const begin = () => {
      timer = null
      dragging = true
      dt = new TouchDataTransfer()
      handlers.current.start(dt)
      navigator.vibrate?.(10)
      ghost = node.cloneNode(true) as HTMLElement
      Object.assign(ghost.style, {
        position: 'fixed', left: '0', top: '0', zIndex: '1000', pointerEvents: 'none',
        opacity: '0.9', boxShadow: '0 6px 18px rgba(0,0,0,.18)', width: `${node.offsetWidth}px`,
      })
      document.body.appendChild(ghost)
      moveGhost()
      dragTo()
      frame = requestAnimationFrame(autoScroll)
    }
    // Phone browsers run their own long-press drag on a `draggable` element,
    // which takes the touch over (touchcancel) the moment ours begins. The
    // element stays draggable for a mouse; only a touch switches it off.
    let wasDraggable: boolean | null = null
    const restoreDraggable = () => {
      if (wasDraggable != null) node.draggable = wasDraggable
      wasDraggable = null
    }
    const finish = (drop: boolean) => {
      if (timer != null) window.clearTimeout(timer)
      timer = null
      restoreDraggable()
      if (!dragging) return
      dragging = false
      cancelAnimationFrame(frame)
      if (over) {
        if (drop && accepted) fire(over, 'drop', dt, point.x, point.y)
        else fire(over, 'dragleave', dt, point.x, point.y)
      }
      over = null
      accepted = false
      ghost?.remove()
      ghost = null
      handlers.current.end()
    }

    const onStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) return
      const touch = event.touches[0]
      origin = point = { x: touch.clientX, y: touch.clientY }
      wasDraggable = node.draggable
      node.draggable = false
      timer = window.setTimeout(begin, HOLD_MS)
    }
    const onMove = (event: TouchEvent) => {
      const touch = event.touches[0]
      point = { x: touch.clientX, y: touch.clientY }
      if (!dragging) {
        // Moving before the hold completes is a scroll, not a drag.
        if (timer != null && Math.hypot(point.x - origin.x, point.y - origin.y) > SLOP_PX) {
          window.clearTimeout(timer)
          timer = null
        }
        return
      }
      event.preventDefault()
      moveGhost()
      dragTo()
    }
    const onEnd = (event: TouchEvent) => {
      // A finished drag is not also a tap on the pill.
      if (dragging) event.preventDefault()
      finish(true)
    }
    const onCancel = () => finish(false)
    // The long press would otherwise open the system's callout menu.
    const onContext = (event: Event) => { if (timer != null || dragging) event.preventDefault() }
    // Belt and braces: a native drag that still starts mid-touch is refused.
    const onNativeDrag = (event: Event) => { if (timer != null || dragging) event.preventDefault() }

    node.addEventListener('touchstart', onStart, { passive: true })
    node.addEventListener('touchmove', onMove, { passive: false })
    node.addEventListener('touchend', onEnd)
    node.addEventListener('touchcancel', onCancel)
    node.addEventListener('contextmenu', onContext)
    node.addEventListener('dragstart', onNativeDrag)
    return () => {
      finish(false)
      node.removeEventListener('touchstart', onStart)
      node.removeEventListener('touchmove', onMove)
      node.removeEventListener('touchend', onEnd)
      node.removeEventListener('touchcancel', onCancel)
      node.removeEventListener('contextmenu', onContext)
      node.removeEventListener('dragstart', onNativeDrag)
    }
  }, [ref, disabled])
}
