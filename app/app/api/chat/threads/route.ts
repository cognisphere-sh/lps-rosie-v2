import { NextResponse } from 'next/server'

import { CHAT_AGENTS } from '@/lib/agents'
import type { ThreadRow } from '@/lib/chat-realtime'
import { supabase } from '@/lib/supabase'

/**
 * Every chattable agent's open threads with a transcript, from the `threads`
 * table — the notification bell's sweep. One request for all agents, the
 * same row shape the plugin's `api/threads` returns, minus closed threads
 * (migration 0080). Between sweeps `/api/chat/events` keeps it current.
 */
export const dynamic = 'force-dynamic'

export async function GET() {
  const { data, error } = await supabase
    .from('threads')
    .select('agent, thread_id, last_seq, last_at, last_role, last_sender, last_text, web_read_id')
    .in('agent', CHAT_AGENTS.map((a) => a.id))
    .not('last_seq', 'is', null)
    .is('closed_at', null)
    .order('last_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const threads: Record<string, unknown[]> = {}
  for (const r of (data ?? []) as Pick<ThreadRow, 'agent' | 'thread_id' | 'last_seq' | 'last_at' | 'last_role' | 'last_sender' | 'last_text' | 'web_read_id'>[]) {
    ;(threads[r.agent] ??= []).push({
      threadId: r.thread_id,
      lastId: r.last_seq,
      lastAt: r.last_at ? Date.parse(r.last_at) : 0,
      lastRole: r.last_role,
      ...(r.last_sender ? { lastSender: r.last_sender } : {}),
      lastText: r.last_text ?? '',
      readId: r.web_read_id,
    })
  }
  return NextResponse.json({ threads })
}
