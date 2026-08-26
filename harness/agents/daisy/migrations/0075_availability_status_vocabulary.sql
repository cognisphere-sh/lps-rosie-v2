-- 0075: the availability-request status vocabulary the supplier portal's
-- restructure needs (Bhoumik, 2026-08-26).
--
-- 1. `availability_requests.status` gains `processing` — the supplier has
--    started answering but has not submitted. The portal's four tabs are
--    All / New / Processing / Submitted.
-- 2. `availability_request_items.status` gains `arriving_soon`.
-- 3. Adding a line to an already-answered request re-opens it as `new`, so a
--    request LPS extends goes back to the top of the supplier's New tab
--    whoever added the line — the app or one of rosie's scripts.

alter table public.availability_requests
  drop constraint availability_requests_status_check;
alter table public.availability_requests
  add constraint availability_requests_status_check
  check (status = any (array['new'::text, 'processing'::text, 'submitted'::text, 'closed'::text]));

comment on column public.availability_requests.status is
  'new = waiting on the supplier (also re-set when a line is added to an answered request); processing = the supplier has started answering; submitted = they pressed Submit in the portal (submitted_at stamps it); closed = we are done with it (an admin act).';

alter table public.availability_request_items
  drop constraint availability_request_items_status_check;
alter table public.availability_request_items
  add constraint availability_request_items_status_check
  check (status is null or status = any (array[
    'available'::text,
    'can_order'::text,
    'substitute'::text,
    'arriving_soon'::text,
    'unavailable'::text
  ]));

comment on column public.availability_request_items.status is
  'The supplier''s answer: available | can_order (ETA in notes) | substitute (a different size, quantity or plant — what, in notes) | arriving_soon (when, in notes) | unavailable. NULL = not answered yet, and the only column that says a line was answered.';

-- A line added to a request the supplier already worked on is a new question:
-- put the request back in their New tab. `closed` is left alone — closing is a
-- deliberate terminal act, and re-opening one must be just as deliberate.
create or replace function public.availability_request_reopen_on_new_line()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.availability_requests
     set status = 'new'
   where id = new.availability_request_id
     and is_active
     and status in ('processing', 'submitted');
  return null;
end;
$$;

drop trigger if exists availability_request_items_reopen on public.availability_request_items;
create trigger availability_request_items_reopen
after insert on public.availability_request_items
for each row execute function public.availability_request_reopen_on_new_line();
