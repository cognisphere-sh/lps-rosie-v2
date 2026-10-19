import 'server-only'

import { redactPartnerRequestRefs } from '@/lib/partner-display'
import { supabase } from '@/lib/supabase'

// The supplier portal's chat transport: server-to-server against rosie's
// webchat plugin (`api/app-upload` / `api/app-send` / `api/app-messages` /
// `api/app-file`), authed by the shared
// WEBCHAT_APP_SECRET — portal users are not harness users, so the browser
// endpoints' session check can't serve them. The plugin serves the portal
// ONLY the portal-visible half of the supplier thread (what the supplier
// wrote, and replies rosie sent with `--portal`); the team's internal traffic
// on the same thread never crosses this path.

const HARNESS_URL = process.env.HARNESS_URL ?? 'http://127.0.0.1:3142'
const SECRET = process.env.WEBCHAT_APP_SECRET

export interface PartnerChatTarget {
  supplierId: number
  threadId: string
  supplierName: string
}

/** The portal-chat thread for a supplier — its company's rosie_thread_id. */
export async function partnerChatTarget(supplierId: number): Promise<PartnerChatTarget | null> {
  if (!SECRET) return null // not wired on this box
  const { data, error } = await supabase
    .from('suppliers')
    .select('name, rosie_thread_id, is_lps_partner, is_active')
    .eq('id', supplierId)
    .maybeSingle()
  if (error) throw new Error(`suppliers: ${error.message}`)
  const s = data as {
    name: string
    rosie_thread_id: string | null
    is_lps_partner: boolean
    is_active: boolean
  } | null
  if (!s?.is_active || !s.is_lps_partner || !s.rosie_thread_id) return null
  return { supplierId, threadId: s.rosie_thread_id, supplierName: s.name }
}

export async function partnerChatFetch(path: string, init?: RequestInit): Promise<Response> {
  const streamsFile = path.startsWith('api/app-upload') || path.startsWith('api/app-file')
  return fetch(`${HARNESS_URL}/webhook/rosie/webchat/${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      'x-app-secret': SECRET ?? '',
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
    // Upload/download bodies may legitimately exceed a short request timeout on
    // mobile. JSON control calls stay bounded; stream lifetime follows the
    // browser request and the app server instead.
    ...(!streamsFile ? { signal: AbortSignal.timeout(8_000) } : {}),
    // Node's fetch requires this when the app streams an upload to the plugin.
    ...(init?.body instanceof ReadableStream ? { duplex: 'half' } : {}),
  } as RequestInit)
}

/** What the portal shows above a message: which job it is about, and where to open it. */
export interface PartnerMessageRef {
  /** `order` once an order is placed for the job, else `ar`; `job` when neither is visible. */
  kind: 'order' | 'ar' | 'job'
  name: string
  href: string | null
}

interface PluginMessage {
  id: number
  role: 'user' | 'agent'
  senderKind?: 'lps' | 'agent' | 'supplier' | 'customer'
  senderName?: string
  originThreadId?: string
  jobRequestId?: number
  [key: string]: unknown
}

/**
 * Shape the plugin's portal-visible messages for the supplier: every message
 * from LPS reads as one "Local Plant Supply" (no team names, no internal
 * thread ids), and each message about a job carries a reference to it — the
 * job's order with this company when one is placed, else its availability
 * request; a message not about a job carries none. Draft ARs are LPS-only, so
 * they never become a link.
 */
export async function partnerChatMessages(supplierId: number, messages: PluginMessage[]) {
  const jobs = [...new Set(messages.map((m) => m.jobRequestId).filter((id): id is number => Number.isSafeInteger(id)))]
  const refs = new Map<number, PartnerMessageRef>()
  if (jobs.length) {
    const { data: me, error } = await supabase.from('suppliers').select('head_branch_id').eq('id', supplierId).single()
    if (error) throw new Error(`suppliers: ${error.message}`)
    const head = Number(me.head_branch_id ?? supplierId)
    const { data: branches, error: branchError } = await supabase.from('suppliers').select('id').or(`id.eq.${head},head_branch_id.eq.${head}`)
    if (branchError) throw new Error(`suppliers: ${branchError.message}`)
    const company = (branches ?? []).map((b) => Number(b.id))
    const [names, ars, orders] = await Promise.all([
      supabase.from('job_requests').select('id, name').in('id', jobs),
      supabase.from('availability_requests').select('id, supplier_id, job_request_id').in('job_request_id', jobs).in('supplier_id', company).neq('status', 'draft').order('id', { ascending: false }),
      supabase.from('orders').select('id, supplier_id, job_request_id').in('job_request_id', jobs).in('supplier_id', company).eq('is_active', true).order('id', { ascending: false }),
    ])
    for (const r of [names, ars, orders]) if (r.error) throw new Error(r.error.message)
    for (const job of (names.data ?? []) as { id: number; name: string | null }[]) {
      const name = redactPartnerRequestRefs(job.name?.trim() || 'Job request')
      const order = (orders.data ?? []).find((o) => Number(o.job_request_id) === job.id)
      const ar = (ars.data ?? []).find((a) => Number(a.job_request_id) === job.id)
      refs.set(job.id, order
        ? { kind: 'order', name, href: `/partner/${order.supplier_id}/orders/${order.id}` }
        : ar
          ? { kind: 'ar', name, href: `/partner/${ar.supplier_id}/requests/${ar.id}` }
          : { kind: 'job', name, href: null })
    }
  }
  return messages.map(({ senderName, originThreadId: _origin, jobRequestId, ...m }) => {
    const ref = jobRequestId != null ? refs.get(jobRequestId) : undefined
    return {
      ...m,
      ...(m.senderKind === 'supplier' && senderName ? { senderName } : {}),
      ...(ref ? { ref } : {}),
    }
  })
}
