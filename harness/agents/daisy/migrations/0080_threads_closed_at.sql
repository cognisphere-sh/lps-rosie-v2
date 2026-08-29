-- 0080: threads.closed_at — a job request's thread closes with the job.
-- Applied 2026-08-26 (Bhoumik, via Supabase MCP), the same day as 0078/0079.
--
-- When a job request reaches a terminal status (`closed_won`, `closed_lost`,
-- `archived`) or is soft-deleted, its `jr-<id>` thread is closed: the
-- transcript stays (it is the order's record), but the thread leaves the
-- chat picker and the notification bell. Moving the job back to `sourcing`
-- or `quoted` (or reactivating it) reopens the thread. Supplier and customer
-- threads never close this way — they outlive every job.

alter table public.threads add column closed_at timestamptz;
comment on column public.threads.closed_at is
  'Set when the owning job request is closed_won / closed_lost / archived or deactivated (trigger); NULL = open. Closed threads keep their transcript but are hidden from the picker and the bell.';

create or replace function public.job_requests_close_thread()
returns trigger language plpgsql as $$
begin
  if new.rosie_thread_ref is null then return new; end if;
  if new.status in ('closed_won', 'closed_lost', 'archived') or not new.is_active then
    update public.threads set closed_at = now()
     where id = new.rosie_thread_ref and closed_at is null;
  else
    update public.threads set closed_at = null
     where id = new.rosie_thread_ref and closed_at is not null;
  end if;
  return new;
end $$;

create trigger job_requests_close_thread
  after insert or update of status, is_active on public.job_requests
  for each row execute function public.job_requests_close_thread();

-- Backfill the jobs already closed.
update public.threads t set closed_at = now()
  from public.job_requests j
 where j.rosie_thread_ref = t.id
   and (j.status in ('closed_won', 'closed_lost', 'archived') or not j.is_active);
