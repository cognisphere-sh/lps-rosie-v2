import { NextResponse } from 'next/server'

import { customerThreadId } from '@/lib/customers'
import { supabase } from '@/lib/supabase'

/**
 * The chat panel's thread picker: an agent's threads, grouped by what they are.
 * `?agent=rosie` (the default) or `?agent=daisy` — the two agents that work on
 * dedicated threads; the panel adds its own General section either way.
 *
 * The DB is the directory — the entities each agent has a thread for, whether
 * or not a web conversation exists yet (the panel merges in the webchat
 * plugin's transcript list for last activity). Thread ids follow the
 * restructure's conventions: `jr-<id>`, `suppliers.rosie_thread_id` /
 * `daisy_thread_id`, `customers.rosie_thread_id` (`customerThreadId` computes
 * the latter when a named customer hasn't been minted one yet).
 */

export interface ChatDirectoryEntry {
  threadId: string
  title: string
  subtitle: string | null
}

interface ChatDirectory {
  jobs: ChatDirectoryEntry[]
  suppliers: ChatDirectoryEntry[]
  customers: ChatDirectoryEntry[]
}

export async function GET(request: Request) {
  const agentId = new URL(request.url).searchParams.get('agent') ?? 'rosie'
  try {
    return NextResponse.json(agentId === 'daisy' ? await daisyDirectory() : await rosieDirectory())
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

/** Rosie's threads: every open job request, every engaged or Partner supplier, every active customer. */
async function rosieDirectory(): Promise<ChatDirectory> {
  const [jobsRes, suppliersRes, engagedRes, customersRes] = await Promise.all([
    supabase
      .from('job_requests')
      .select('id, name, status, customer_id, updated_at')
      .eq('is_active', true)
      .neq('status', 'archived')
      .order('updated_at', { ascending: false })
      .limit(100),
    supabase
      .from('suppliers')
      .select('id, name, rosie_thread_id, is_lps_partner, city, state')
      .eq('is_active', true)
      .eq('is_lps_partner', true)
      .not('rosie_thread_id', 'is', null),
    supabase.from('availability_requests').select('supplier_id').eq('is_active', true),
    supabase
      .from('customers')
      .select('id, name, company, rosie_thread_id')
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(200),
  ])
  for (const r of [jobsRes, suppliersRes, engagedRes, customersRes]) {
    if (r.error) throw new Error(r.error.message)
  }

  type JobRow = { id: number; name: string | null; status: string; customer_id: number | null }
  type SupplierRow = {
    id: number
    name: string
    rosie_thread_id: string | null
    is_lps_partner: boolean
    city: string | null
    state: string | null
  }
  type CustomerRow = { id: number; name: string; company: string | null; rosie_thread_id: string | null }

  const jobs = (jobsRes.data ?? []) as JobRow[]
  const customers = (customersRes.data ?? []) as CustomerRow[]
  const customerById = new Map(customers.map((c) => [c.id, c]))

  // Suppliers worth a card: every LPS Partner, plus anyone engaged on an
  // availability request (their thread is where the conversation is).
  const engagedIds = [
    ...new Set(((engagedRes.data ?? []) as { supplier_id: number }[]).map((r) => r.supplier_id)),
  ]
  let engaged: SupplierRow[] = []
  if (engagedIds.length) {
    const res = await supabase
      .from('suppliers')
      .select('id, name, rosie_thread_id, is_lps_partner, city, state')
      .in('id', engagedIds)
    if (res.error) throw new Error(res.error.message)
    engaged = (res.data ?? []) as SupplierRow[]
  }
  const supplierByThread = new Map<string, SupplierRow>()
  for (const s of [...((suppliersRes.data ?? []) as SupplierRow[]), ...engaged]) {
    if (s.rosie_thread_id && !supplierByThread.has(s.rosie_thread_id)) {
      supplierByThread.set(s.rosie_thread_id, s)
    }
  }

  return {
    jobs: jobs.map((j) => {
      const customer = j.customer_id != null ? customerById.get(j.customer_id) : null
      return {
        threadId: `jr-${j.id}`,
        title: j.name ?? `JR-${j.id}`,
        subtitle: [`JR-${j.id}`, customer?.company || customer?.name, j.status]
          .filter(Boolean)
          .join(' · '),
      }
    }),
    suppliers: [...supplierByThread.entries()].map(([threadId, s]) => ({
      threadId,
      title: s.name,
      subtitle:
        [s.is_lps_partner ? 'LPS Partner' : null, [s.city, s.state].filter(Boolean).join(', ')]
          .filter(Boolean)
          .join(' · ') || null,
    })),
    customers: customers
      .filter((c) => c.rosie_thread_id || c.name)
      .map((c) => ({
        threadId: customerThreadId({ name: c.name, rosieThreadId: c.rosie_thread_id }),
        title: c.company || c.name,
        subtitle: c.company && c.name ? c.name : null,
      })),
  }
}

/**
 * Daisy's threads: supplier companies only — jobs and customers are rosie's.
 *
 * All 1,300-odd suppliers carry a `daisy_thread_id`, which is a directory
 * nobody can read, so the list is bounded to the ones she actually works:
 * everyone we have ingested an availability drop from, plus every LPS Partner.
 */
async function daisyDirectory(): Promise<ChatDirectory> {
  const sourcesRes = await supabase
    .from('inventory_sources')
    .select('supplier_id')
    .eq('is_active', true)
  if (sourcesRes.error) throw new Error(sourcesRes.error.message)
  const ingestedIds = [
    ...new Set(((sourcesRes.data ?? []) as { supplier_id: number }[]).map((r) => r.supplier_id)),
  ]

  // One thread per company: a location row carries the head branch's
  // `daisy_thread_id` but not its name, so the card is drawn from the head.
  const headIds = new Set<number>()
  const queries = [
    supabase
      .from('suppliers')
      .select('head_branch_id')
      .eq('is_active', true)
      .eq('is_lps_partner', true),
    ...(ingestedIds.length
      ? [supabase.from('suppliers').select('head_branch_id').eq('is_active', true).in('id', ingestedIds)]
      : []),
  ]
  for (const query of queries) {
    const res = await query
    if (res.error) throw new Error(res.error.message)
    for (const row of (res.data ?? []) as { head_branch_id: number }[]) headIds.add(row.head_branch_id)
  }
  if (!headIds.size) return { jobs: [], suppliers: [], customers: [] }

  const headsRes = await supabase
    .from('suppliers')
    .select('id, name, daisy_thread_id, is_lps_partner, city, state')
    .in('id', [...headIds])
    .not('daisy_thread_id', 'is', null)
    .order('name')
  if (headsRes.error) throw new Error(headsRes.error.message)

  type HeadRow = {
    name: string
    daisy_thread_id: string
    is_lps_partner: boolean
    city: string | null
    state: string | null
  }
  return {
    jobs: [],
    customers: [],
    suppliers: ((headsRes.data ?? []) as HeadRow[]).map((s) => ({
      threadId: s.daisy_thread_id,
      title: s.name,
      subtitle:
        [s.is_lps_partner ? 'LPS Partner' : null, [s.city, s.state].filter(Boolean).join(', ')]
          .filter(Boolean)
          .join(' · ') || null,
    })),
  }
}
