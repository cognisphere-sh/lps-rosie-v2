'use client'

import Image from 'next/image'
import { useState } from 'react'

import { CheckIcon } from '@/components/workspace/icons'
import { useChatAppearanceSettings } from '@/components/workspace/shell'
import { AGENTS } from '@/lib/agents'
import {
  CHAT_THEMES, DEFAULT_CHAT_APPEARANCE, chatThemeForAgent, chatThemeStyle,
  type ChatAgentId,
} from '@/lib/chat-appearance'
import { cn } from '@/lib/utils'

export function ChatAppearanceSettings() {
  const { appearance, save } = useChatAppearanceSettings()
  const [previewAgent, setPreviewAgent] = useState<ChatAgentId>('nova')
  const previewName = AGENTS.find((agent) => agent.id === previewAgent)?.name ?? 'Nova'

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
      <section
        className="mx-auto flex max-w-[920px] flex-col gap-4"
        style={chatThemeStyle(chatThemeForAgent(appearance, previewAgent))}
      >
        <div className="flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-[18px] font-bold">Chat appearance</h2>
            <p className="mt-1 max-w-[620px] text-[12.5px] leading-relaxed text-muted-foreground">
              Set each agent’s accent independently and choose a shared chat wallpaper. Changes preview and save immediately on this device.
            </p>
          </div>
          <button
            type="button"
            onClick={() => save(DEFAULT_CHAT_APPEARANCE)}
            className="flex-none rounded-lg border border-border bg-card px-3 py-2 text-[11.5px] font-semibold text-primary hover:bg-muted"
          >
            Reset
          </button>
        </div>

        <div className="grid items-start gap-4 lg:grid-cols-[minmax(280px,0.9fr)_minmax(390px,1.1fr)]">
          <section className="overflow-hidden rounded-2xl border border-border bg-card lg:sticky lg:top-0">
            <div
              className="flex min-h-[230px] flex-col justify-end gap-2 p-4"
              style={appearance.wallpaper ? {
                backgroundImage: "url('/desert-plants-chat.svg')",
                backgroundRepeat: 'repeat',
                backgroundSize: '240px 240px',
              } : undefined}
            >
              <div className="font-chat max-w-[82%] self-start rounded-[12px_12px_12px_4px] border border-lps-hair bg-lps-bubble px-3 py-2 text-[16px] leading-[1.35]">
                The agaves are looking sharp today.
              </div>
              <div className="font-chat max-w-[82%] self-end rounded-[12px_12px_4px_12px] bg-primary px-3 py-2 text-[16px] leading-[1.35] text-primary-foreground">
                Send me the availability 🌵
              </div>
            </div>
            <div className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
              {previewName} preview
            </div>
          </section>

          <div className="flex flex-col gap-4">
            <section className="flex flex-col gap-2">
              <h3 className="text-[11px] font-bold uppercase tracking-[.06em] text-lps-dim">Agent colors</h3>
              <div className="flex flex-col gap-2">
                {AGENTS.map((agent) => {
                  const agentId = agent.id as ChatAgentId
                  return (
                    <div
                      key={agent.id}
                      className={cn(
                        'flex items-center gap-2.5 rounded-xl border bg-card p-2.5',
                        previewAgent === agentId ? 'border-primary' : 'border-border',
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => setPreviewAgent(agentId)}
                        className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      >
                        <Image src={agent.avatar} alt="" width={32} height={32} className="rounded-full" />
                        <span className="min-w-0">
                          <span className="block truncate text-[12.5px] font-bold">{agent.name}</span>
                          <span className="block truncate text-[10.5px] text-muted-foreground">{agent.role}</span>
                        </span>
                      </button>
                      <span className="flex flex-none gap-1 sm:gap-1.5">
                        {CHAT_THEMES.map((theme) => {
                          const selected = appearance.themes[agentId] === theme.id
                          return (
                            <button
                              key={theme.id}
                              type="button"
                              title={theme.label}
                              aria-label={`${agent.name}: ${theme.label}`}
                              aria-pressed={selected}
                              onClick={() => {
                                setPreviewAgent(agentId)
                                save({
                                  ...appearance,
                                  themes: { ...appearance.themes, [agentId]: theme.id },
                                })
                              }}
                              className={cn(
                                'relative size-7 rounded-full border-2 p-[3px] sm:size-8',
                                selected ? 'border-foreground' : 'border-transparent',
                              )}
                            >
                              <span className="block size-full rounded-full" style={{ backgroundColor: theme.accent }} />
                              {selected && <CheckIcon className="absolute inset-0 m-auto size-3.5 text-white" />}
                            </button>
                          )
                        })}
                      </span>
                    </div>
                  )
                })}
              </div>
            </section>

            <section className="flex flex-col gap-2">
              <h3 className="text-[11px] font-bold uppercase tracking-[.06em] text-lps-dim">Wallpaper</h3>
              <button
                type="button"
                onClick={() => save({ ...appearance, wallpaper: !appearance.wallpaper })}
                className={cn(
                  'flex items-center gap-3 overflow-hidden rounded-2xl border bg-card p-3 text-left',
                  appearance.wallpaper ? 'border-primary ring-2 ring-primary/20' : 'border-border',
                )}
              >
                <span
                  className="h-20 w-24 flex-none rounded-xl border border-lps-hair bg-background"
                  style={{
                    backgroundImage: "url('/desert-plants-chat.svg')",
                    backgroundSize: '150px 150px',
                  }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-bold">Desert plants</span>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">
                    Cactus, agave and yucca line art
                  </span>
                </span>
                <span className={cn(
                  'relative h-[22px] w-10 flex-none rounded-full transition-colors',
                  appearance.wallpaper ? 'bg-primary' : 'bg-muted',
                )}>
                  <span className={cn(
                    'absolute top-[3px] size-4 rounded-full bg-white transition-all',
                    appearance.wallpaper ? 'left-[21px]' : 'left-[3px]',
                  )} />
                </span>
              </button>
            </section>
          </div>
        </div>
      </section>
    </div>
  )
}
