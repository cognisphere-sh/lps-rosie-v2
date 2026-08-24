import { NextResponse } from 'next/server'

import { supabase } from '@/lib/supabase'

/**
 * The chat panel's thread picker: rosie's threads, grouped by what they are.
 *
 * The DB is the directory — every open job request, every engaged or Partner
 * supplier, every active customer — whether or not a web conversation exists
 * yet (the panel merges in the webchat plugin's transcript list for last
 * activity). Thread ids follow the restructure's conventions: `jr-<id>`,
 * `suppliers.rosie_thread_id`, `customers.rosie_thread_id` (computed
 * `customer-<slug>` when a named customer hasn't been minted one yet — the
 * same base rule rosie's `customer-coordination` skill uses).
 */

export interface ChatDirectoryEntry {
  threadId: string
  title: string
  subtitle: string | null
}

const slug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

export async function GET() {
  try {
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
        .select('id, name, rosie_thread_id, is_onboarded, city, state')
        .eq('is_active', true)
        .eq('is_onboarded', true)
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
      is_onboarded: boolean
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
        .select('id, name, rosie_thread_id, is_onboarded, city, state')
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

    return NextResponse.json({
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
          [s.is_onboarded ? 'LPS Partner' : null, [s.city, s.state].filter(Boolean).join(', ')]
            .filter(Boolean)
            .join(' · ') || null,
      })),
      customers: customers
        .filter((c) => c.rosie_thread_id || c.name)
        .map((c) => ({
          threadId: c.rosie_thread_id ?? `customer-${slug(c.name)}`,
          title: c.company || c.name,
          subtitle: c.company && c.name ? c.name : null,
        })),
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
