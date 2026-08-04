'use client'

import Image from 'next/image'
import { useState } from 'react'

import { CheckIcon } from '@/components/workspace/icons'
import { useChatAppearanceSettings } from '@/components/workspace/shell'
import { AGENTS } from '@/lib/agents'
import {
  CHAT_THEMES, CHAT_WALLPAPERS, DEFAULT_CHAT_APPEARANCE,
  chatThemeForAgent, chatThemeStyle, chatWallpaperStyle,
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
              style={chatWallpaperStyle(appearance.wallpaper)}
            >
              <div className="font-chat max-w-[82%] self-start rounded-[12px_12px_12px_4px] border border-[var(--chat-bubble-border,var(--lps-hair))] bg-lps-bubble px-3 py-2 text-[16px] leading-[1.35]">
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
              <div className="grid grid-cols-3 gap-2">
                {CHAT_WALLPAPERS.map((wallpaper) => {
                  const selected = appearance.wallpaper === wallpaper.id
                  return (
                    <button
                      key={wallpaper.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => save({ ...appearance, wallpaper: wallpaper.id })}
                      className={cn(
                        'relative flex min-w-0 flex-col gap-2 rounded-xl border bg-card p-2 text-left',
                        selected ? 'border-primary ring-2 ring-primary/20' : 'border-border',
                      )}
                    >
                      <span
                        className="relative flex h-20 w-full items-center justify-center overflow-hidden rounded-lg border border-lps-hair bg-background text-[12px] font-semibold text-muted-foreground"
                        style={wallpaper.image ? {
                          backgroundImage: `url('${wallpaper.image}')`,
                          backgroundRepeat: 'repeat',
                          backgroundSize: wallpaper.id === 'desert-night' ? '180px 180px' : '150px 150px',
                        } : undefined}
                      >
                        {!wallpaper.image && 'No image'}
                        {selected && (
                          <span className="absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                            <CheckIcon className="size-3" />
                          </span>
                        )}
                      </span>
                      <span className="truncate text-[11.5px] font-bold">{wallpaper.label}</span>
                      <span className="line-clamp-2 text-[10.5px] leading-tight text-muted-foreground">{wallpaper.description}</span>
                    </button>
                  )
                })}
              </div>
            </section>
          </div>
        </div>
      </section>
    </div>
  )
}
