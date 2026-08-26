-- 0076: rename the supplier's `substitute` answer to `diff_size_qty_sub`
-- (Bhoumik, 2026-08-26), the name the portal's status picker now uses.
--
-- The answer was never only "a different plant": it is the one a supplier
-- reaches for when what they have differs from the ask in size, quantity OR
-- identity, and `substitute` named a third of that. Renaming the stored value
-- rather than only its label keeps rosie's SQL reading like the screen.
-- 1 of 13 answered lines carried the old value.

alter table public.availability_request_items
  drop constraint availability_request_items_status_check;

update public.availability_request_items
   set status = 'diff_size_qty_sub'
 where status = 'substitute';

alter table public.availability_request_items
  add constraint availability_request_items_status_check
  check (status is null or status = any (array[
    'available'::text,
    'can_order'::text,
    'diff_size_qty_sub'::text,
    'arriving_soon'::text,
    'unavailable'::text
  ]));

comment on column public.availability_request_items.status is
  'The supplier''s answer: available | can_order (ETA in notes) | diff_size_qty_sub (a different size, quantity or plant — what, in notes) | arriving_soon (when, in notes) | unavailable. NULL = not answered yet, and the only column that says a line was answered.';
