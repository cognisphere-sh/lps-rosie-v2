-- Disposable database only. Keep a pre-existing publication member.
create table public.threads (id bigint primary key);
create publication supabase_realtime for table public.threads;
do $$
declare t text;
begin
  foreach t in array array['job_requests', 'job_request_items', 'availability_requests', 'availability_request_items', 'customers', 'suppliers'] loop
    execute format('create table public.%I (id bigint primary key, value text)', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('insert into public.%I values (1, ''Existing data'')', t);
  end loop;
end $$;
