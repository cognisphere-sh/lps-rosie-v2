import { NextResponse } from 'next/server'

import { softDelete, updateCell } from '@/lib/queries'

/** Inline cell edit. Body: { table, id, column, value }. */
export async function PATCH(req: Request) {
  try {
    const body = (await req.json()) as {
      table?: string
      id?: string | number
      column?: string
      value?: string
    }
    if (!body.table || body.id == null || !body.column) {
      return NextResponse.json({ error: 'table, id and column are required' }, { status: 400 })
    }
    await updateCell(body.table, body.id, body.column, body.value ?? '')
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
    await softDelete(body.table, body.id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}
