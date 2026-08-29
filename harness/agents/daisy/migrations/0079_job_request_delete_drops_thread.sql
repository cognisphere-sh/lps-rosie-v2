-- 0079: deleting a job request deletes its chat thread.
-- Applied 2026-08-26 (Bhoumik, via Supabase MCP), the same day as 0078.
--
-- A job request's `jr-<id>` thread exists for the job and nothing else, so a
-- permanent delete of the job (the app's trash button — not a soft delete,
-- see `deleteJobRequest`) takes the `threads` row with it, and the transcript
-- cascades from there. Supplier and customer threads are NOT touched by any
-- delete: they outlive every job. The app also asks the webchat plugin to
-- forget its in-memory copy and wipe the harness conversation (`api/reset`).

create or replace function public.job_requests_drop_thread()
returns trigger language plpgsql as $$
begin
  if old.rosie_thread_ref is not null then
    delete from public.threads where id = old.rosie_thread_ref;
  end if;
  return old;
end $$;

create trigger job_requests_drop_thread
  after delete on public.job_requests
  for each row execute function public.job_requests_drop_thread();
