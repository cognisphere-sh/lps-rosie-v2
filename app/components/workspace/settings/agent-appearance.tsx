'use client'

import { CheckIcon } from '@/components/workspace/icons'
import { useChatAppearanceSettings } from '@/components/workspace/shell'
import type { Agent } from '@/lib/agents'
import {
  CHAT_THEMES, CHAT_WALLPAPERS, chatThemeStyle, chatWallpaperStyle,
  type ChatAgentId,
} from '@/lib/chat-appearance'
import { cn } from '@/lib/utils'

import { Panel } from './parts'

/**
 * One agent's chat look: the colour its outgoing bubbles and chat actions use,
 * and the wallpaper behind that conversation. Both are per-agent and per-device
 * — the app accent they sit under is on the Global tab.
 *
 * Unlike everything else on an agent tab this is a browser preference, not
 * harness state, so it saves on click with no Save button and no reload.
 */
export function AgentAppearance({ agent }: { agent: Agent }) {
  const { appearance, save } = useChatAppearanceSettings()
  const agentId = agent.id as ChatAgentId
  const theme = appearance.themes[agentId]
  const wallpaper = appearance.wallpapers[agentId]

  return (
    <Panel
      title="Appearance"
      description={`How ${agent.name}’s conversation looks on this device. Saves as you pick.`}
    >
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(240px,0.8fr)_minmax(300px,1.2fr)]">
        <div
          className="overflow-hidden rounded-2xl border border-border"
          style={chatThemeStyle(theme)}
        >
          <div
            className="flex min-h-[170px] flex-col justify-end gap-2 bg-background p-4"
            style={chatWallpaperStyle(wallpaper)}
          >
            <div className="font-chat max-w-[86%] self-start rounded-[12px_12px_12px_4px] border border-[var(--chat-bubble-border,var(--lps-hair))] bg-lps-bubble px-3 py-2 text-[15px] leading-[1.35]">
              The agaves are looking sharp today.
            </div>
            <div className="font-chat max-w-[86%] self-end rounded-[12px_12px_4px_12px] bg-primary px-3 py-2 text-[15px] leading-[1.35] text-primary-foreground">
              Send me the availability 🌵
            </div>
          </div>
          <div className="border-t border-border bg-card px-3 py-2 text-[11px] text-muted-foreground">
            {agent.name} preview
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <section className="flex flex-col gap-2">
            <h4 className="text-[11px] font-bold uppercase tracking-[.06em] text-lps-dim">
              Outgoing message &amp; accent
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {CHAT_THEMES.map((option) => {
                const selected = theme === option.id
                return (
                  <button
                    key={option.id}
                    type="button"
                    title={option.label}
                    aria-label={`${agent.name}: ${option.label}`}
                    aria-pressed={selected}
                    onClick={() =>
                      save({
                        ...appearance,
                        themes: { ...appearance.themes, [agentId]: option.id },
                      })
                    }
                    className={cn(
                      'relative size-8 rounded-full border-2 p-[3px]',
                      selected ? 'border-foreground' : 'border-transparent',
                    )}
                  >
                    <span className="block size-full rounded-full" style={{ backgroundColor: option.accent }} />
                    {selected && <CheckIcon className="absolute inset-0 m-auto size-3.5 text-white" />}
                  </button>
                )
              })}
            </div>
          </section>

          <section className="flex flex-col gap-2">
            <h4 className="text-[11px] font-bold uppercase tracking-[.06em] text-lps-dim">Wallpaper</h4>
            <div className="grid grid-cols-3 gap-2">
              {CHAT_WALLPAPERS.map((option) => {
                const selected = wallpaper === option.id
                return (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() =>
                      save({
                        ...appearance,
                        wallpapers: { ...appearance.wallpapers, [agentId]: option.id },
                      })
                    }
                    className={cn(
                      'relative flex min-w-0 flex-col gap-2 rounded-xl border bg-card p-2 text-left',
                      selected ? 'border-primary ring-2 ring-primary/20' : 'border-border',
                    )}
                  >
                    <span
                      className="relative flex h-16 w-full items-center justify-center overflow-hidden rounded-lg border border-lps-hair bg-background text-[11.5px] font-semibold text-muted-foreground"
                      style={option.image ? {
                        backgroundImage: `url('${option.image}')`,
                        backgroundRepeat: 'repeat',
                        backgroundSize: option.id === 'desert-night' ? '150px 150px' : '125px 125px',
                      } : undefined}
                    >
                      {!option.image && 'No image'}
                      {selected && (
                        <span className="absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <CheckIcon className="size-3" />
                        </span>
                      )}
                    </span>
                    <span className="truncate text-[11.5px] font-bold">{option.label}</span>
                  </button>
                )
              })}
            </div>
          </section>
        </div>
      </div>
    </Panel>
  )
}
