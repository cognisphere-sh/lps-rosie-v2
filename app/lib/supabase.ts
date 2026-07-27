import 'server-only'

import { createClient } from '@supabase/supabase-js'

// Server-only Supabase client. It holds the project's SECRET key, so it must
// never be imported into a client component — the `server-only` import above
// turns that mistake into a build error rather than a leaked credential.
//
// The secret key bypasses RLS, which this app depends on: RLS is currently
// DISABLED on `suppliers` and `inventory` (see docs/supabase-schema.md), so
// there is no anon-key read path that would be safe to expose to the browser.
// Every read below therefore happens in a server component.

const url = process.env.SUPABASE_URL
const secretKey = process.env.SUPABASE_SECRET_KEY

if (!url || !secretKey) {
  throw new Error(
    'SUPABASE_URL and SUPABASE_SECRET_KEY must be set (see ../config, materialized into app/.env.local by scripts/server.sh)',
  )
}

export const supabase = createClient(url, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// The `lps` bucket is public, so an object key needs no signing to be viewable.
// `inventory_sources.file_path` holds either a bare object key or a full URL.
export function sourceUrl(filePath: string): string {
  if (/^https?:\/\//i.test(filePath)) return filePath
  return `${url}/storage/v1/object/public/lps/${filePath.split('/').map(encodeURIComponent).join('/')}`
}
