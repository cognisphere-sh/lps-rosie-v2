'use client'

import Image from 'next/image'
import { useCallback, useEffect, useState } from 'react'

import { AGENTS } from '@/lib/agents'
import { harnessFetch, PROVIDER_ID, type ProviderInfo } from '@/lib/harness-settings'
import { cn } from '@/lib/utils'

import { AgentSettings } from './agent-settings'
import { AppAppearance } from './app-appearance'
import { ProviderSettings } from './provider-settings'

type Banner = { kind: 'ok' | 'error'; message: string }

/**
 * The settings page: one Global tab for everything harness-wide, then one tab
 * per agent for what only that agent has — its model, its Google account and
 * its schedules.
 *
 * The tab lives in `?tab=`, because Google's OAuth redirect has to be able to
 * land the browser back on the agent tab that started the sign-in.
 */
export function SettingsView() {
  const [tab, setTab] = useState('global')
  const [provider, setProvider] = useState<ProviderInfo | null>(null)
  const [providerError, setProviderError] = useState<string | null>(null)
  const [banner, setBanner] = useState<Banner | null>(null)

  const reload = useCallback(() => {
    void (async () => {
      try {
        const { providers } = await harnessFetch<{ providers: ProviderInfo[] }>('/api/harness/models')
        setProvider(providers.find((p) => p.id === PROVIDER_ID) ?? null)
        setProviderError(null)
      } catch (err) {
        setProviderError((err as Error).message)
      }
    })()
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  // Pick up `?tab=` and the gws callback's `?gws=` / `?gwsError=`, then strip
  // the one-shot feedback params so a reload doesn't replay them.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const wanted = params.get('tab')
    if (wanted && (wanted === 'global' || AGENTS.some((a) => a.id === wanted))) setTab(wanted)
    const ok = params.get('gws')
    const failed = params.get('gwsError')
    if (ok) setBanner({ kind: 'ok', message: 'Google account connected.' })
    else if (failed) setBanner({ kind: 'error', message: failed })
    if (ok || failed) {
      params.delete('gws')
      params.delete('gwsError')
      const query = params.toString()
      window.history.replaceState(null, '', `/settings${query ? `?${query}` : ''}`)
    }
  }, [])

  const select = (id: string) => {
    setTab(id)
    setBanner(null)
    window.history.replaceState(null, '', id === 'global' ? '/settings' : `/settings?tab=${id}`)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <nav className="flex flex-none gap-1 overflow-x-auto border-b border-border px-4 sm:px-6">
        <TabButton id="global" label="Global" active={tab === 'global'} onSelect={select} />
        {AGENTS.map((agent) => (
          <TabButton
            key={agent.id}
            id={agent.id}
            label={agent.name}
            avatar={agent.avatar}
            active={tab === agent.id}
            onSelect={select}
          />
        ))}
      </nav>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="mx-auto flex max-w-[920px] flex-col gap-5">
          {providerError && (
            <p className="rounded-xl bg-lps-warn-bg px-3 py-2 text-[12px] font-semibold text-lps-warn-fg">
              Couldn&rsquo;t read the harness model configuration: {providerError}
            </p>
          )}

          {tab === 'global' ? (
            <>
              <ProviderSettings provider={provider} reload={reload} />
              <AppAppearance />
            </>
          ) : (
            AGENTS.filter((a) => a.id === tab).map((agent) => (
              <AgentSettings key={agent.id} agent={agent} provider={provider} banner={banner} />
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function TabButton({
  id,
  label,
  avatar,
  active,
  onSelect,
}: {
  id: string
  label: string
  avatar?: string
  active: boolean
  onSelect: (id: string) => void
}) {
  return (
    <button
      type="button"
      aria-current={active ? 'page' : undefined}
      onClick={() => onSelect(id)}
      className={cn(
        'flex flex-none items-center gap-1.5 border-b-2 px-3 py-2.5 text-[12.5px] font-semibold',
        active
          ? 'border-primary text-foreground'
          : 'border-transparent text-muted-foreground hover:text-foreground',
      )}
    >
      {avatar && <Image src={avatar} alt="" width={20} height={20} className="size-5 rounded-full" />}
      {label}
    </button>
  )
}
