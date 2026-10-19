'use client'

import Image from 'next/image'

import { Shell } from '@/components/workspace/shell'
import { AGENTS, chatBlockedReason } from '@/lib/agents'
import { cn } from '@/lib/utils'

export default function AgentsPage() {
  return (
    <Shell page="agents" title="Know your Agents" hideHeaderOnMobile>
      {/* Two profiles side by side once the page column can hold them, so
          the team scans at a glance instead of one banner per screen. */}
      <div className="@container min-h-0 flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-1 items-start gap-4 @min-[760px]:grid-cols-2">
          {AGENTS.map((a) => (
            <div key={a.id} className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="flex items-center gap-2.5 border-b border-lps-hair px-4 py-3">
                <Image src={a.avatar} alt="" width={30} height={30} className="size-[30px] flex-none rounded-full object-cover" />
                <span className="text-[14px] font-bold">{a.name}</span>
                <span className="min-w-0 truncate text-[13px] text-muted-foreground">{a.role}</span>
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
      </div>
    </Shell>
  )
}
