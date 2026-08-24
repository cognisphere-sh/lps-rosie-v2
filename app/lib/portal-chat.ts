import 'server-only'

import { supabase } from '@/lib/supabase'

// The supplier portal's chat transport: server-to-server against rosie's
// webchat plugin (`api/app-send` / `api/app-messages`), authed by the shared
// WEBCHAT_APP_SECRET — portal users are not harness users, so the browser
// endpoints' session check can't serve them. The plugin serves the portal
// ONLY the portal-visible half of the supplier thread (what the supplier
// wrote, and replies rosie sent with `--portal`); the team's internal traffic
// on the same thread never crosses this path.

const HARNESS_URL = process.env.HARNESS_URL ?? 'http://127.0.0.1:3142'
const SECRET = process.env.WEBCHAT_APP_SECRET

export interface PortalChatTarget {
  threadId: string
  supplierName: string
}

/** The portal-chat thread for a supplier — its company's rosie_thread_id. */
export async function portalChatTarget(supplierId: number): Promise<PortalChatTarget | null> {
  if (!SECRET) return null // not wired on this box
  const { data, error } = await supabase
    .from('suppliers')
    .select('name, rosie_thread_id, is_onboarded, is_active')
    .eq('id', supplierId)
    .maybeSingle()
  if (error) throw new Error(`suppliers: ${error.message}`)
  const s = data as {
    name: string
    rosie_thread_id: string | null
    is_onboarded: boolean
    is_active: boolean
  } | null
  if (!s?.is_active || !s.is_onboarded || !s.rosie_thread_id) return null
  return { threadId: s.rosie_thread_id, supplierName: s.name }
}

export async function portalChatFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${HARNESS_URL}/webhook/rosie/webchat/${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      'x-app-secret': SECRET ?? '',
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(8000),
  })
}
