-- 053_enable_rls — turn on row level security across the public schema.
--
-- Before this migration `suppliers`, `inventory`, `chat_sessions`, `users` and
-- `availability_queries` had RLS *disabled*. Four of them already carried
-- policies, which were therefore inert. Because anon holds table grants on
-- everything in `public`, the publishable/anon key was a full read-write handle
-- on the whole database — including `users`, which stores Gmail OAuth tokens.
--
-- Who keeps working, and why:
--   * agents  — `scripts/agent/supabase/query` connects as the `postgres` role,
--               which has BYPASSRLS. Unaffected.
--   * app/    — lps-rosie-v2 queries server-side with the secret key
--               (service_role, BYPASSRLS). Unaffected.
--   * lps-rosie — logged-in users act as `authenticated`, which the policies
--               below (and the pre-existing ones) admit. Its handful of
--               genuinely public routes were moved onto the service-role key in
--               the same change, because an unauthenticated supplier filling in
--               an availability form has no `authenticated` role to carry.
--
-- After this, `anon` reaches no application table at all.

alter table public.suppliers            enable row level security;
alter table public.inventory            enable row level security;
alter table public.chat_sessions        enable row level security;
alter table public.users                enable row level security;
alter table public.availability_queries enable row level security;

-- availability_queries was the one table with no policies at all. The app reads
-- and writes it as a signed-in user (the chat sidebar lists a session's forms);
-- the public supplier form reaches it via service_role instead.
drop policy if exists "Authenticated full access" on public.availability_queries;
create policy "Authenticated full access" on public.availability_queries
    for all to authenticated using (true) with check (true);

-- Views launder RLS unless they are security_invoker. Both of these are owned by
-- `postgres` (BYPASSRLS), so with the default `security_invoker = off` they run
-- with the owner's rights and would have handed anon the entire catalogue
-- straight back — enabling RLS on `inventory` while leaving these alone would
-- have been security theatre.
alter view public.inventory_enriched set (security_invoker = true);
alter view public.rate_charts        set (security_invoker = true);
