import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

/** Resolve the saved conversation before opening it; never send a message here. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = await params
  const id = Number(raw)
  if (!Number.isSafeInteger(id) || id <= 0) return NextResponse.json({ error: 'bad id' }, { status: 400 })
  try {
    const read = () => supabase.from('customers').select('id, name, rosie_thread_id').eq('id', id).eq('is_active', true).maybeSingle()
    const { data: customer, error } = await read()
    if (error) throw error
    if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    if (customer.rosie_thread_id?.trim()) return NextResponse.json({ threadId: customer.rosie_thread_id.trim() })

    // Include an id and random suffix so different customers with the same
    // name cannot claim one conversation, even across concurrent requests.
    const slug = (customer.name || 'customer').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70) || 'customer'
    const threadId = `customer-${slug}-${id}-${randomUUID()}`
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
    return NextResponse.json({ threadId: saved.rosie_thread_id.trim() })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
