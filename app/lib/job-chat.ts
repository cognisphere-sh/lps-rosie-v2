import 'server-only'

import { randomUUID } from 'node:crypto'

import { supabase } from '@/lib/supabase'

// A job's chat tabs (2026-10-19): Rosie (the job's own `jr-<id>` thread), one
// per supplier the job works with, and the customer. A supplier's or
// customer's tab is their one shared conversation with LPS (`rosie_thread_id`)
// filtered to the job, so the tab needs that thread id to exist — it is minted
// here, with the same guarded write the customer chat button uses, when a job
// first needs it.

export interface JobChatSupplier {
  /** The company (head branch) — every location shares one conversation. */
  id: number
  name: string
  /** `suppliers.short_name` (e.g. APS) — the tab's label when set. */
  shortName: string | null
  threadId: string
  /** An LPS Partner has a portal, so `@Supplier` messages can reach them. */
  partner: boolean
}

export interface JobChatParties {
  customer: { id: number; name: string; threadId: string } | null
  suppliers: JobChatSupplier[]
}

const slug = (name: string, fallback: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70) || fallback

/** The customer's conversation id, minting it on first use. */
export async function ensureCustomerThread(id: number): Promise<{ threadId: string; name: string } | null> {
  const read = () => supabase.from('customers').select('id, name, rosie_thread_id').eq('id', id).eq('is_active', true).maybeSingle()
  const { data: customer, error } = await read()
  if (error) throw error
  if (!customer) return null
  if (customer.rosie_thread_id?.trim()) return { threadId: customer.rosie_thread_id.trim(), name: customer.name }

  // Include an id and random suffix so different customers with the same
  // name cannot claim one conversation, even across concurrent requests.
  const threadId = `customer-${slug(customer.name || '', 'customer')}-${id}-${randomUUID()}`
  let update = supabase.from('customers').update({ rosie_thread_id: threadId }).eq('id', id).eq('is_active', true)
  update = customer.rosie_thread_id == null
    ? update.is('rosie_thread_id', null)
    : update.eq('rosie_thread_id', customer.rosie_thread_id)
  const { error: writeError } = await update
  if (writeError) throw writeError
  // A concurrent opener may have won the guarded write. Always use the
  // recorded winner rather than this request's proposed id.
  const { data: saved, error: readError } = await read()
  if (readError) throw readError
  if (!saved?.rosie_thread_id?.trim()) throw new Error('Could not create customer chat')
  return { threadId: saved.rosie_thread_id.trim(), name: saved.name }
}

interface SupplierRow {
  id: number
  name: string
  short_name: string | null
  head_branch_id: number
  rosie_thread_id: string | null
  is_lps_partner: boolean
}

/** The company's conversation id, minting it on the company and its locations on first use. */
async function ensureSupplierThread(head: SupplierRow): Promise<string> {
  if (head.rosie_thread_id?.trim()) return head.rosie_thread_id.trim()
  const threadId = `supplier-${slug(head.name, 'supplier')}-${head.id}`
  const { error } = await supabase.from('suppliers').update({ rosie_thread_id: threadId })
    .or(`id.eq.${head.id},head_branch_id.eq.${head.id}`).is('rosie_thread_id', null)
  if (error) throw error
  const { data, error: readError } = await supabase.from('suppliers').select('rosie_thread_id').eq('id', head.id).single()
  if (readError) throw readError
  if (!data?.rosie_thread_id?.trim()) throw new Error('Could not create supplier chat')
  return data.rosie_thread_id.trim()
}

/**
 * The tabs of one job's chat: the suppliers it has an availability request or
 * order with (drafts included — Chris may talk to Rosie about them), plus any
 * supplier whose conversation already has a message tagged with the job (a
 * quick question that never became an AR), and the job's customer.
 */
export async function jobChatParties(jobId: number): Promise<JobChatParties | null> {
  const { data: job, error } = await supabase.from('job_requests').select('id, customer_id').eq('id', jobId).maybeSingle()
  if (error) throw error
  if (!job) return null

  const [ars, orders, tagged] = await Promise.all([
    supabase.from('availability_requests').select('supplier_id').eq('job_request_id', jobId),
    supabase.from('orders').select('supplier_id').eq('job_request_id', jobId).eq('is_active', true),
    supabase.from('thread_messages').select('threads!inner(agent, thread_id)').eq('job_request_id', jobId).eq('threads.agent', 'rosie').like('threads.thread_id', 'supplier-%'),
  ])
  for (const r of [ars, orders, tagged]) if (r.error) throw r.error

  const taggedThreads = [...new Set(((tagged.data ?? []) as unknown as { threads: { thread_id: string } }[]).map((r) => r.threads.thread_id))]
  const ids = [...new Set([...(ars.data ?? []), ...(orders.data ?? [])].map((r) => Number(r.supplier_id)))]
  const columns = 'id, name, short_name, head_branch_id, rosie_thread_id, is_lps_partner'
  const [byId, byThread] = await Promise.all([
    ids.length ? supabase.from('suppliers').select(columns).in('id', ids) : Promise.resolve({ data: [], error: null }),
    taggedThreads.length ? supabase.from('suppliers').select(columns).in('rosie_thread_id', taggedThreads) : Promise.resolve({ data: [], error: null }),
  ])
  for (const r of [byId, byThread]) if (r.error) throw r.error
  const heads = [...new Set([...(byId.data ?? []), ...(byThread.data ?? [])].map((s) => Number((s as SupplierRow).head_branch_id ?? (s as SupplierRow).id)))]
  const { data: headRows, error: headError } = heads.length
    ? await supabase.from('suppliers').select(columns).in('id', heads)
    : { data: [], error: null }
  if (headError) throw headError

  const suppliers: JobChatSupplier[] = []
  for (const head of (headRows ?? []) as SupplierRow[]) {
    suppliers.push({ id: head.id, name: head.name, shortName: head.short_name?.trim() || null, threadId: await ensureSupplierThread(head), partner: head.is_lps_partner })
  }
  suppliers.sort((a, b) => a.name.localeCompare(b.name))

  const customer = job.customer_id ? await ensureCustomerThread(Number(job.customer_id)) : null
  return {
    customer: customer && job.customer_id ? { id: Number(job.customer_id), ...customer } : null,
    suppliers,
  }
}
