import 'server-only'

import { orderJobInbox, type JobInboxRow } from '@/lib/job-inbox'
import { ACTIVE_JOB_STATUSES } from '@/lib/job-requests'
import { supabase } from '@/lib/supabase'

/** Explicit product ceiling: above this the UI refuses rather than silently truncating. */
export const JOB_INBOX_MAX_ROWS = 5000
const CHUNK = 250
const ITEM_PAGE_SIZE = 1000

interface RequestMeta {
  id: number
  customer_id: number | null
  name: string | null
  status: string
  expected_install_date: string | null
  note_from_customer: string | null
  note_internal: string | null
  note_for_customer: string | null
  created_at: string | null
  updated_at: string | null
}
interface CustomerMeta { id: number; name: string; company: string | null; type: string | null }
interface ItemSearchMeta {
  id: number
  job_request_id: number
  name: string
  size: string | null
  note_from_customer: string | null
  note_internal: string | null
  note_for_customer: string | null
}
interface ThreadMeta {
  thread_id: string
  last_seq: number | null
  last_at: string | null
  last_text: string | null
  web_read_id: number | null
}

export class JobInboxCapacityError extends Error {
  constructor() {
    super(`Active job inbox exceeds the ${JOB_INBOX_MAX_ROWS.toLocaleString()}-job safety limit`)
    this.name = 'JobInboxCapacityError'
  }
}

const chunks = <T,>(values: T[], size = CHUNK) =>
  Array.from({ length: Math.ceil(values.length / size) }, (_, i) => values.slice(i * size, (i + 1) * size))

/**
 * Complete active inbox metadata without N+1 or pre-join pagination.
 *
 * Request ids are read in stable bounded pages through MAX+1 (the sentinel).
 * Only after the complete active set is known are customer and exact canonical
 * Rosie thread metadata fetched in batches, then global activity ordering is
 * computed. Active items are paged within bounded job-id batches to include
 * every searchable name/note. No transcript query or other jobs can leak.
 */
export async function listJobInbox(): Promise<ReturnType<typeof orderJobInbox>> {
  const requests: RequestMeta[] = []
  for (let from = 0; from <= JOB_INBOX_MAX_ROWS; from += CHUNK) {
    const remaining = JOB_INBOX_MAX_ROWS + 1 - from
    const limit = Math.min(CHUNK, remaining)
    const { data, error } = await supabase
      .from('job_requests')
      .select('id, customer_id, name, status, expected_install_date, note_from_customer, note_internal, note_for_customer, created_at, updated_at')
      .eq('is_active', true)
      .in('status', [...ACTIVE_JOB_STATUSES])
      .order('id', { ascending: true })
      .range(from, from + limit - 1)
    if (error) throw new Error(`job_requests: ${error.message}`)
    const rows = (data ?? []) as RequestMeta[]
    requests.push(...rows)
    if (requests.length > JOB_INBOX_MAX_ROWS) throw new JobInboxCapacityError()
    if (rows.length < limit) break
  }

  const customerIds = [...new Set(requests.flatMap((row) => row.customer_id == null ? [] : [row.customer_id]))]
  const threadIds = requests.map((row) => `jr-${row.id}`)
  const [customerResults, threadResults, itemResults] = await Promise.all([
    Promise.all(chunks(customerIds).map(async (ids) => {
      const { data, error } = await supabase
        .from('customers')
        .select('id, name, company, type')
        .eq('is_active', true)
        .in('id', ids)
      if (error) throw new Error(`customers: ${error.message}`)
      return (data ?? []) as CustomerMeta[]
    })),
    Promise.all(chunks(threadIds).map(async (ids) => {
      const { data, error } = await supabase
        .from('threads')
        .select('thread_id, last_seq, last_at, last_text, web_read_id')
        .eq('agent', 'rosie')
        .is('closed_at', null)
        .in('thread_id', ids)
      if (error) throw new Error(`threads: ${error.message}`)
      return (data ?? []) as ThreadMeta[]
    })),
    Promise.all(chunks(requests.map((request) => request.id)).map(async (ids) => {
      const items: ItemSearchMeta[] = []
      for (let from = 0; ; from += ITEM_PAGE_SIZE) {
        const { data, error } = await supabase
          .from('job_request_items')
          .select('id, job_request_id, name, size, note_from_customer, note_internal, note_for_customer')
          .eq('is_active', true)
          .in('job_request_id', ids)
          .order('id', { ascending: true })
          .range(from, from + ITEM_PAGE_SIZE - 1)
        if (error) throw new Error(`job_request_items: ${error.message}`)
        const rows = (data ?? []) as ItemSearchMeta[]
        items.push(...rows)
        if (rows.length < ITEM_PAGE_SIZE) break
      }
      return items
    })),
  ])
  const customers = new Map(customerResults.flat().map((row) => [row.id, row]))
  const threads = new Map(threadResults.flat().map((row) => [row.thread_id, row]))
  const itemText = new Map<number, string[]>()
  for (const item of itemResults.flat()) {
    const parts = itemText.get(item.job_request_id) ?? []
    parts.push(...[item.name, item.size, item.note_from_customer, item.note_internal, item.note_for_customer]
      .filter((value): value is string => Boolean(value)))
    itemText.set(item.job_request_id, parts)
  }

  const rows: JobInboxRow[] = requests.map((request) => {
    const customer = request.customer_id == null ? null : customers.get(request.customer_id)
    const thread = threads.get(`jr-${request.id}`)
    return {
      id: request.id,
      name: request.name,
      status: request.status,
      customer: customer ? customer.company || customer.name : null,
      customerCompany: customer?.company ?? null,
      customerContact: customer?.name ?? null,
      customerType: customer?.type ?? null,
      searchText: [
        `JR-${request.id}`, request.name, customer?.name, customer?.company,
        request.note_from_customer, request.note_internal, request.note_for_customer,
        ...(itemText.get(request.id) ?? []),
      ].filter(Boolean).join('\n'),
      createdAt: request.created_at,
      expectedInstallDate: request.expected_install_date ?? null,
      updatedAt: request.updated_at,
      thread: thread ? {
        lastId: Number(thread.last_seq ?? 0),
        lastAt: thread.last_at,
        lastText: thread.last_text ?? '',
        webReadId: Number(thread.web_read_id ?? 0),
      } : null,
    }
  })
  return orderJobInbox(rows)
}
