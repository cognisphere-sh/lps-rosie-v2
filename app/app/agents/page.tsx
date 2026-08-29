'use client'

import Image from 'next/image'

import { Shell } from '@/components/workspace/shell'
import { AGENTS, chatBlockedReason } from '@/lib/agents'
import { cn } from '@/lib/utils'

export default function AgentsPage() {
  return (
    <Shell page="agents" title="Know your Agents" hideHeaderOnMobile>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
        {AGENTS.map((a) => (
          <div key={a.id} className="shrink-0 overflow-hidden rounded-xl border border-border bg-card">
            <div className="flex items-center gap-2.5 border-b border-lps-hair px-4 py-3">
              <Image src={a.avatar} alt="" width={30} height={30} className="size-[30px] flex-none rounded-full object-cover" />
              <span className="text-[14px] font-bold">{a.name}</span>
              <span className="min-w-0 truncate text-[12.5px] text-muted-foreground">{a.role}</span>
              <span
                className={cn(
                  'ml-auto whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
                  a.upcoming ? 'bg-muted text-muted-foreground' : 'bg-secondary text-secondary-foreground',
                )}
              >
                {chatBlockedReason(a) ?? 'Active'}
              </span>
            </div>
            <Image
              src={a.profile}
              alt={`${a.name} — ${a.role}`}
              width={1672}
              height={941}
              className={cn('h-auto w-full', a.upcoming && 'opacity-80 saturate-[.85]')}
            />
          </div>
        ))}
      </div>
    </Shell>
  )
}
