import { NextResponse } from 'next/server'

import { deactivateSource, softDelete, updateCell, updateFields } from '@/lib/queries'

/** One inline edit, or a staged set of fields written atomically. */
export async function PATCH(req: Request) {
  try {
    const body = (await req.json()) as {
      table?: string
      id?: string | number
      column?: string
      value?: string
      changes?: Record<string, string>
    }
    if (!body.table || body.id == null) {
      return NextResponse.json({ error: 'table and id are required' }, { status: 400 })
    }
    if (body.changes) {
      await updateFields(body.table, body.id, body.changes)
    } else if (body.column) {
      await updateCell(body.table, body.id, body.column, body.value ?? '')
    } else {
      return NextResponse.json({ error: 'column or changes is required' }, { status: 400 })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}

/** Soft delete (is_active = false). Body: { table, id }. */
export async function DELETE(req: Request) {
  try {
    const body = (await req.json()) as { table?: string; id?: string | number }
    if (!body.table || body.id == null) {
      return NextResponse.json({ error: 'table and id are required' }, { status: 400 })
    }
    // A file carries its inventory rows with it, so it reports how many it took.
    if (body.table === 'inventory_sources') {
      const retired = await deactivateSource(String(body.id))
      return NextResponse.json({ ok: true, retired })
    }
    await softDelete(body.table, body.id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}
