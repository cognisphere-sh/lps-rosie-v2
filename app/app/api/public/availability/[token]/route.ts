import { NextResponse } from 'next/server'
import { publicAvailabilityRequest } from '@/lib/availability-queries'
import { supabase } from '@/lib/supabase'
import { notifySupplierEvent } from '@/lib/notify-supplier-events'

const headers = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex, nofollow' }
type Context = { params: Promise<{ token: string }> }

export async function GET(_req: Request, { params }: Context) {
  const { token } = await params
  const request = await publicAvailabilityRequest(token)
  return NextResponse.json(request ? { request } : { error: 'This link is no longer available.' }, { status: request ? 200 : 404, headers })
}

export async function POST(req: Request, { params }: Context) {
  const { token } = await params
  const request = await publicAvailabilityRequest(token)
  if (!request) return NextResponse.json({ error: 'This link is no longer available.' }, { status: 404, headers })
  try {
    const body = await req.json()
    if (body.submit !== true && (!Number.isSafeInteger(body.itemId) || !body.changes)) {
      return NextResponse.json({ error: 'An item and answer are required.' }, { status: 400, headers })
    }
    if ('supplierNote' in body && body.supplierNote != null && (typeof body.supplierNote !== 'string' || body.supplierNote.length > 10000)) throw new Error('Supplier note must be text of 10000 characters or fewer')
    const { error } = body.submit === true && 'supplierNote' in body
      ? await supabase.rpc('submit_public_availability_note', { p_token: token, p_note: body.supplierNote })
      : await supabase.rpc('answer_public_availability', {
      p_token: token, p_item_id: body.itemId ?? null,
      p_changes: body.changes ?? null, p_submit: body.submit === true,
    })
    if (error) throw new Error(error.message)
    const { data } = await supabase.from('suppliers').select('rosie_thread_id').eq('id', request.supplierId).single()
    await notifySupplierEvent({ type: body.submit === true ? 'availability_submitted' : 'availability_updated',
      supplierId: request.supplierId, supplierName: request.supplierName, availabilityRequestId: request.id,
      jobRequestId: request.jobRequestId, threadId: data?.rosie_thread_id ?? null })
    return NextResponse.json({ ok: true }, { headers })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: /closed/i.test((error as Error).message) ? 409 : 400, headers })
  }
}
