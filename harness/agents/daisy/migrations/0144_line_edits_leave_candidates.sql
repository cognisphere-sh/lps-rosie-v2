-- 0144 — editing a job line's name or size never changes a candidate (2026-10-16)
--
-- (Bhoumik 2026-10-16) "Do not update candidate on manual edit, as candidate
-- also hold price info. So it may refer to incorrect price." Since 0130
-- job_request_items_sync_default copied a line's new name and size (and a
-- generated description) onto its unasked default candidate. That candidate
-- keeps its price and mapped_inventory_id, so it ended up naming one plant
-- and size while carrying another's price. The app has written Size / Plant
-- name edits only to job_request_items since 2026-10-15.
-- * sync_job_line_default keeps only its demand rules (0136): an unasked
--   Available default keeps quantity = demand, and a demand change re-checks
--   Available <-> Partial Qty on the line's candidates. Name and size edits
--   change the line (the customer's ask) and nothing else.
-- * update_job_line is unchanged: its explicit size / name keys still write
--   the selected candidate (0133).
-- Rollback: re-run 0136's sync_job_line_default (live md5(prosrc) before
-- this migration: 9d93ee1f4199ef61f34dce95000d18d2, 0136's body).
BEGIN;
SET LOCAL lock_timeout = '250ms';
SET LOCAL statement_timeout = '5s';

CREATE OR REPLACE FUNCTION public.sync_job_line_default() RETURNS trigger
LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE prior text;
BEGIN
  -- A line's name and size are the customer's ask only (0144): a candidate's
  -- price is for its own plant and size, so they never follow onto it.
  IF NEW.demanded_quantity IS DISTINCT FROM OLD.demanded_quantity THEN
    UPDATE public.candidates SET available_quantity = NEW.demanded_quantity
      WHERE id = NEW.default_candidate_id AND availability_request_id IS NULL AND status = 'available';
  END IF;
  IF NEW.demanded_quantity IS DISTINCT FROM OLD.demanded_quantity AND NEW.demanded_quantity IS NOT NULL THEN
    prior := current_setting('lps.lps_override', true);
    PERFORM set_config('lps.lps_override', 'on', true);
    UPDATE public.candidates SET status = CASE WHEN status = 'available' THEN 'partial_qty' ELSE 'available' END
      WHERE job_request_item_id = NEW.id AND is_active AND (
        (status = 'available' AND available_quantity > 0 AND available_quantity < NEW.demanded_quantity)
        OR (status = 'partial_qty' AND available_quantity >= NEW.demanded_quantity));
    PERFORM set_config('lps.lps_override', coalesce(prior, ''), true);
  END IF;
  RETURN NULL;
END $function$;

COMMIT;
