'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Ellipsis, Trash2 } from 'lucide-react'

export function JobActionsMenu({ requestId, onDelete }: {
  requestId: number
  onDelete: (returnFocus: HTMLElement | null) => void
}) {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const menuId = useId()

  useEffect(() => {
    if (!position) return
    menu.current?.querySelector('button')?.focus()
    const dismiss = (event: MouseEvent) => {
      if (!menu.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) setPosition(null)
    }
    const close = () => setPosition(null)
    document.addEventListener('mousedown', dismiss)
    window.addEventListener('resize', close)
    window.addEventListener('scroll', close, true)
    return () => {
      document.removeEventListener('mousedown', dismiss)
      window.removeEventListener('resize', close)
      window.removeEventListener('scroll', close, true)
    }
  }, [position])

  return <>
    <button ref={trigger} type="button" aria-label={`More actions for JR-${requestId}`}
      aria-haspopup="menu" aria-expanded={!!position} aria-controls={position ? menuId : undefined}
      className="flex size-8 flex-none cursor-pointer items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      onClick={() => {
        if (position) { setPosition(null); return }
        const rect = trigger.current!.getBoundingClientRect()
        setPosition({ top: Math.min(rect.bottom + 4, window.innerHeight - 56), left: Math.max(8, Math.min(rect.right - 160, window.innerWidth - 168)) })
      }}><Ellipsis size={16} aria-hidden="true" /></button>
    {position && createPortal(<div ref={menu} id={menuId} role="menu" aria-label={`Actions for JR-${requestId}`}
      style={position} className="lps-pop fixed z-[100] w-40 rounded-xl border border-border bg-popover p-1.5 shadow-[var(--lps-shadow)]"
      onKeyDown={(event) => {
        if (event.key === 'Escape' || event.key === 'Tab') {
          event.preventDefault()
          setPosition(null)
          trigger.current?.focus()
        } else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
          event.preventDefault()
          menu.current?.querySelector('button')?.focus()
        }
      }}>
      <button type="button" role="menuitem" aria-label={`Delete JR-${requestId}`}
        className="flex min-h-9 w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] text-destructive outline-none hover:bg-destructive/10 focus:bg-destructive/10"
        onClick={() => { setPosition(null); onDelete(trigger.current) }}>
        <Trash2 size={14} aria-hidden="true" />Delete
      </button>
    </div>, document.body)}
  </>
}
