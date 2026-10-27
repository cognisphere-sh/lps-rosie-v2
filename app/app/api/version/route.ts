import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * The build this server is running, so a page left open — above all the
 * installed app, which a phone resumes rather than reloads — can tell a deploy
 * has happened since it loaded (`PWAProvider`). Public in `proxy.ts`: a build id
 * is no secret, and the login page and partner portal need it too.
 *
 * `null` under `next dev`, which writes no BUILD_ID; the client ignores it.
 */
export async function GET() {
  const buildId = await readFile(path.join(process.cwd(), '.next', 'BUILD_ID'), 'utf8').then(
    (id) => id.trim(),
    () => null,
  )
  return NextResponse.json({ buildId }, { headers: { 'cache-control': 'no-store' } })
}
