# scripts/app/secrets.sh — sourced by ../server.sh after the stock secrets.
# Appends the Supabase credentials to app/.env.local. The app reads
# suppliers/inventory straight from Supabase; the secret key stays server-side
# (no NEXT_PUBLIC_ prefix) because it bypasses RLS.

if [[ -f "$ROOT/app/.env.local" ]]; then
  printf 'SUPABASE_URL=%s\nSUPABASE_SECRET_KEY=%s\n' \
    "${SUPABASE_URL:-}" "${SUPABASE_SECRET_KEY:-}" >> "$ROOT/app/.env.local"
fi
