BEGIN;
SET LOCAL lock_timeout = '250ms';
SET LOCAL statement_timeout = '2s';
ALTER TABLE public.job_request_items
  ADD COLUMN selected_availability_request_item_id bigint
  REFERENCES public.availability_request_items(id) ON DELETE SET NULL;
COMMENT ON COLUMN public.job_request_items.selected_availability_request_item_id IS
  'The supplier AR line response chosen for this job line. Null means none chosen. Selecting copies its status, price, capped quantity and supplier note once; later edits to either row do not resync.';
NOTIFY pgrst, 'reload schema';
COMMIT;
