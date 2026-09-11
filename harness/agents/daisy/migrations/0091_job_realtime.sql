-- Job UI invalidations use the existing server-only Realtime relay.
-- No row data, RLS policies, replica identities or write triggers change.
-- Add only missing members so this migration is safe to reapply.
begin;
set local lock_timeout = '5s';
do $$
declare
  relation_name text;
begin
  foreach relation_name in array array[
    'job_requests', 'job_request_items',
    'availability_requests', 'availability_request_items',
    'customers', 'suppliers'
  ] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public' and tablename = relation_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', relation_name);
    end if;
  end loop;
end $$;
commit;
