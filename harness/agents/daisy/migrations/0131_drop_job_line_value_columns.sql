-- 0131 — drop the job line value columns 0130 deprecated (written 2026-10-14)
--
-- (Bhoumik 2026-10-13/14) Since 0130 a job line's price, total, status,
-- available quantity and customer note are its selected candidate's, read
-- through job_lines and written through update_job_line; nothing reads or
-- writes these columns. Apply only once the app and Rosie running in
-- production use job_lines / update_job_line. job_request_items_pre_0130
-- keeps the last values.
BEGIN;
SET LOCAL lock_timeout = '250ms';
SET LOCAL statement_timeout = '5s';

ALTER TABLE public.job_request_items
  DROP COLUMN total,
  DROP COLUMN unit_price,
  DROP COLUMN status,
  DROP COLUMN available_quantity,
  DROP COLUMN note_for_customer;

NOTIFY pgrst, 'reload schema';
COMMIT;
