import { NextResponse } from 'next/server'

import { JOB_NAME_MAX_LENGTH } from '@/lib/job-identity'
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
      const name = body.table === 'job_requests' ? body.changes.name?.trim() : undefined
      if (name && name.length > JOB_NAME_MAX_LENGTH) {
        return NextResponse.json({ error: `Job name must be ${JOB_NAME_MAX_LENGTH} characters or fewer.` }, { status: 400 })
      }
      await updateFields(body.table, body.id, body.changes)
    } else if (body.column) {
      const value = body.value ?? ''
      if (body.table === 'job_requests' && body.column === 'name' && value.trim().length > JOB_NAME_MAX_LENGTH) {
        return NextResponse.json({ error: `Job name must be ${JOB_NAME_MAX_LENGTH} characters or fewer.` }, { status: 400 })
      }
      await updateCell(body.table, body.id, body.column, value)
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
