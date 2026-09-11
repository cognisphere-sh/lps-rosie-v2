-- Run after applying 0091 twice to verify idempotence and data/security preservation.
do $$
declare t text; unchanged boolean;
begin
  if (select count(*) from pg_publication_tables where pubname = 'supabase_realtime') <> 7 then
    raise exception 'Publication must contain the six job tables and existing threads';
  end if;
  foreach t in array array['job_requests', 'job_request_items', 'availability_requests', 'availability_request_items', 'customers', 'suppliers'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      raise exception 'Missing publication member: %', t;
    end if;
    if not exists (select 1 from pg_class where oid = format('public.%I', t)::regclass and relrowsecurity and relreplident = 'd') then
      raise exception 'RLS or replica identity changed: %', t;
    end if;
    execute format('select count(*) = 1 and bool_and(id = 1 and value = ''Existing data'') from public.%I', t) into unchanged;
    if not unchanged then raise exception 'Data changed: %', t; end if;
  end loop;
  if exists (select 1 from pg_policies where schemaname = 'public') then
    raise exception 'No new read policies should be added';
  end if;
end $$;
