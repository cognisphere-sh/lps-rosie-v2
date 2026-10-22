'use client'

import { CheckIcon } from '@/components/workspace/icons'
import { useChatAppearanceSettings } from '@/components/workspace/shell'
import { APP_ACCENTS } from '@/lib/app-appearance'
import { cn } from '@/lib/utils'

import { Panel } from './parts'

/**
 * The app-wide half of appearance, on Settings → Global. Each agent's own chat
 * colour and wallpaper moved onto that agent's tab (`settings/agent-appearance`)
 * — they are per-conversation choices, so they belong beside the rest of what
 * that agent owns.
 *
 * Reset still clears everything, both halves, because there is one stored
 * preference behind them.
 */
export function AppAppearance() {
  const { appAccent, saveAppAccent, reset } = useChatAppearanceSettings()

  return (
    <Panel
      title="App header & accent"
      description="Used by navigation highlights and app actions. The browser title bar stays charcoal. Saved on this device and applied immediately. Each agent’s chat colour and wallpaper live on that agent’s own tab."
      action={
        <button
          type="button"
          onClick={reset}
          className="flex-none rounded-lg border border-border bg-card px-3 py-2 text-[12px] font-semibold text-primary transition-colors duration-150 hover:bg-muted"
        >
          Reset all
        </button>
      }
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {APP_ACCENTS.map((accent) => {
          const selected = appAccent === accent.id
          return (
            <button
              key={accent.id}
              type="button"
              aria-pressed={selected}
              onClick={() => saveAppAccent(accent.id)}
              className={cn(
                'flex min-w-0 items-center gap-2 rounded-xl border bg-card p-2.5 text-left transition-[border-color,box-shadow] duration-150 ease-lps',
                selected ? 'border-primary ring-2 ring-primary/20' : 'border-border',
              )}
            >
              <span
                className="relative size-7 flex-none rounded-full border border-black/10 dark:border-white/20"
                style={{ background: `linear-gradient(135deg, ${accent.light}, ${accent.dark})` }}
              >
                {selected && <CheckIcon className="absolute inset-0 m-auto size-3.5 text-white drop-shadow-sm" />}
              </span>
              <span className="truncate text-[12px] font-bold">{accent.label}</span>
            </button>
          )
        })}
      </div>
    </Panel>
  )
}
