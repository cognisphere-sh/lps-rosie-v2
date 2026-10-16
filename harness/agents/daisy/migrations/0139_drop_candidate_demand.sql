-- 0139 — every AR and candidate has a job; candidates.demanded_quantity dropped (2026-10-15)
--
-- (Bhoumik 2026-10-15) Follows 0136: demand belongs to the job line, so the
-- job-less requests that still carried their own asked quantity go, and with
-- them the column. Independent of 0137/0138 (job-line status).
-- * Deleted: the 19 availability requests with no job (stock inquiries, and
--   requests whose job was deleted) with their 292 candidates, and the 8
--   candidates whose job line was deleted (1 on AR-18, 7 on AR-77). Nothing
--   else referenced them (no order line, job line or outside offer). Backups:
--   `availability_requests_pre_0139`, `candidates_pre_0139`.
-- * availability_requests.job_request_id and candidates.job_request_item_id
--   are NOT NULL, and deletes no longer leave orphans (Bhoumik: delete them
--   along): a deleted job line takes all its candidates, asked ones included
--   (candidates_job_request_item_id_fkey ON DELETE CASCADE), and a deleted job
--   takes its ARs (close_orphaned_availability_on_job_delete deletes its lines,
--   then its ARs, instead of closing them). An AR is still never deleted on its
--   own: prevent_availability_request_delete lets only that job delete through
--   (transaction-local lps.ar_delete).
-- * candidate_status_quantity, update_job_line, answer_availability_request
--   and apply_candidate_offer read the line's demanded_quantity only
--   (job_lines since 0138; create_order since 0140, which dropped its
--   candidate-demand check and is not replaced here).
-- * candidates.demanded_quantity is dropped, with its two checks; the
--   candidates_guard trigger is recreated without it.
BEGIN;
SET LOCAL lock_timeout = '250ms';
SET LOCAL statement_timeout = '5s';
SET LOCAL app.actor = 'migration 0139';

-- 1. Backups -----------------------------------------------------------------
CREATE TABLE public.availability_requests_pre_0139 AS
  SELECT * FROM public.availability_requests WHERE job_request_id IS NULL;
ALTER TABLE public.availability_requests_pre_0139 ADD PRIMARY KEY (id);
ALTER TABLE public.availability_requests_pre_0139 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.availability_requests_pre_0139 FROM PUBLIC, anon, authenticated;
COMMENT ON TABLE public.availability_requests_pre_0139 IS
  'Job-less availability requests deleted by 0139.';
CREATE TABLE public.candidates_pre_0139 AS
  SELECT * FROM public.candidates WHERE job_request_item_id IS NULL;
ALTER TABLE public.candidates_pre_0139 ADD PRIMARY KEY (id);
ALTER TABLE public.candidates_pre_0139 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.candidates_pre_0139 FROM PUBLIC, anon, authenticated;
COMMENT ON TABLE public.candidates_pre_0139 IS
  'Candidates with no job line (job-less requests and deleted lines) deleted by 0139, with their own demanded_quantity.';

-- 2. Delete them ---------------------------------------------------------------
-- Only a job's deletion removes its ARs.
CREATE OR REPLACE FUNCTION public.prevent_availability_request_delete()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'DELETE' AND current_setting('lps.ar_delete', true) = 'on' THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'Availability requests cannot be deleted. Move the request to Draft to hide it from the supplier.';
END $function$;

SELECT set_config('lps.lps_override', 'on', true);
DELETE FROM public.candidates WHERE job_request_item_id IS NULL;
SELECT set_config('lps.ar_delete', 'on', true);
DELETE FROM public.availability_requests WHERE job_request_id IS NULL;
SELECT set_config('lps.ar_delete', '', true);
SELECT set_config('lps.lps_override', '', true);

ALTER TABLE public.availability_requests ALTER COLUMN job_request_id SET NOT NULL;
ALTER TABLE public.candidates ALTER COLUMN job_request_item_id SET NOT NULL;

-- 3. Deletes take their dependants ------------------------------------------------
-- A deleted line takes all its candidates (asked ones leave their AR).
ALTER TABLE public.candidates DROP CONSTRAINT candidates_job_request_item_id_fkey;
ALTER TABLE public.candidates ADD CONSTRAINT candidates_job_request_item_id_fkey
  FOREIGN KEY (job_request_item_id) REFERENCES public.job_request_items(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;

-- A deleted job takes its lines (and so their candidates), then its ARs.
CREATE OR REPLACE FUNCTION public.close_orphaned_availability_on_job_delete()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  ar_ids bigint[] := '{}'; order_ids bigint[] := '{}';
  ar_count bigint := 0; ar_items bigint := 0; order_count bigint := 0; order_items_count bigint := 0;
  item_count bigint; history_count bigint; thread_count bigint; row_id bigint;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('deleted-job:jr-' || OLD.id, 0));
  FOR row_id IN SELECT o.id FROM public.orders o WHERE EXISTS (
    SELECT 1 FROM public.order_items oi JOIN public.order_item_job_request_items l ON l.order_item_id=oi.id
      JOIN public.job_request_items ji ON ji.id=l.job_request_item_id
      WHERE oi.order_id=o.id AND ji.job_request_id=OLD.id
  ) ORDER BY o.id FOR UPDATE LOOP
    IF NOT EXISTS (SELECT 1 FROM public.order_items oi
      JOIN public.order_item_job_request_items l ON l.order_item_id=oi.id
      JOIN public.job_request_items ji ON ji.id=l.job_request_item_id
      WHERE oi.order_id=row_id AND ji.job_request_id<>OLD.id) THEN
      order_ids := array_append(order_ids,row_id);
    END IF;
  END LOOP;
  FOR row_id IN SELECT id FROM public.availability_requests WHERE job_request_id=OLD.id ORDER BY id FOR UPDATE LOOP
    ar_ids := array_append(ar_ids,row_id);
  END LOOP;
  SELECT count(*) INTO item_count FROM public.job_request_items WHERE job_request_id=OLD.id;
  SELECT count(*) INTO history_count FROM public.job_request_changelog WHERE job_request_id=OLD.id;
  SELECT count(*) INTO order_items_count FROM public.order_items WHERE order_id=ANY(order_ids);
  SELECT count(*) INTO thread_count FROM public.threads WHERE agent='rosie' AND thread_id='jr-'||OLD.id;
  SELECT count(*) INTO ar_items FROM public.candidates WHERE availability_request_id=ANY(ar_ids);
  DELETE FROM public.orders WHERE id=ANY(order_ids);
  GET DIAGNOSTICS order_count=ROW_COUNT;
  DELETE FROM public.job_request_items WHERE job_request_id=OLD.id;
  PERFORM set_config('lps.ar_delete', 'on', true);
  DELETE FROM public.availability_requests WHERE id=ANY(ar_ids);
  GET DIAGNOSTICS ar_count=ROW_COUNT;
  PERFORM set_config('lps.ar_delete', '', true);
  INSERT INTO public.deleted_job_threads(agent,thread_id,job_request_id,deleted_counts)
    VALUES ('rosie','jr-'||OLD.id,OLD.id,jsonb_build_object('items',item_count,'changelog',history_count,
      'availabilityRequests',ar_count,'availabilityRequestItems',ar_items,'orders',order_count,
      'orderItems',order_items_count,'threads',thread_count,'answers',0));
  RETURN OLD;
END $function$;

-- 4. Readers take the line's demand ----------------------------------------------
-- job_lines: 0138 already reads the line's demand only. Before 0138 the live
-- view is rewritten in place (grants, comments and security_invoker kept);
-- after it there is nothing to change. A view still reading the candidate
-- column would make the DROP COLUMN below fail.
DO $$
DECLARE def text := rtrim(pg_get_viewdef('public.job_lines'::regclass), '; ');
  next_def text := replace(def, 'COALESCE(c.demanded_quantity, ji.demanded_quantity)', 'ji.demanded_quantity');
BEGIN
  IF next_def <> def THEN
    EXECUTE 'CREATE OR REPLACE VIEW public.job_lines WITH (security_invoker = true) AS ' || next_def;
  END IF;
END $$;
COMMENT ON COLUMN public.job_lines.demand IS 'The line''s demanded_quantity (0139: candidates carry none).';

-- The four functions are edited in place, so a concurrent change to anything
-- else in them is kept; each edit must apply exactly once.
DO $$
DECLARE f record; def text; next_def text;
BEGIN
  FOR f IN SELECT * FROM (VALUES
    ('update_job_line', 'demand := coalesce(c.demanded_quantity, line.demanded_quantity);',
      'demand := line.demanded_quantity;'),
    ('candidate_status_quantity', E'demand := coalesce(NEW.demanded_quantity,\n    (SELECT demanded_quantity FROM public.job_request_items WHERE id = NEW.job_request_item_id));',
      'demand := (SELECT demanded_quantity FROM public.job_request_items WHERE id = NEW.job_request_item_id);'),
    ('apply_candidate_offer', E'demand := coalesce((SELECT demanded_quantity FROM public.job_request_items WHERE id = offered.job_request_item_id),\n    offered.demanded_quantity, src.demanded_quantity);',
      'demand := (SELECT demanded_quantity FROM public.job_request_items WHERE id = offered.job_request_item_id);'),
    ('answer_availability_request', 'is_original, unit_price, demanded_quantity, status,',
      'is_original, unit_price, status,'),
    ('answer_availability_request', 'false, NULL, cur.demanded_quantity, ''diff_size_sub''',
      'false, NULL, ''diff_size_sub'''),
    ('answer_availability_request', E'demand := coalesce(cur.demanded_quantity,\n    (SELECT demanded_quantity FROM public.job_request_items WHERE id = cur.job_request_item_id));',
      'demand := (SELECT demanded_quantity FROM public.job_request_items WHERE id = cur.job_request_item_id);')
  ) AS e(name, old, new) LOOP
    def := pg_get_functiondef(('public.' || f.name)::regproc);
    next_def := replace(def, f.old, f.new);
    IF (length(def) - length(next_def)) <> (length(f.old) - length(f.new)) OR next_def = def THEN
      RAISE EXCEPTION '0139: % did not match its edit exactly once', f.name;
    END IF;
    EXECUTE next_def;
  END LOOP;
  -- sync_job_line_default's NEW is the job line, whose demand stays.
  IF EXISTS (SELECT 1 FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname <> 'sync_job_line_default'
      AND prosrc ~ '(NEW|cur|src|offered|source|c)\.demanded_quantity') THEN
    RAISE EXCEPTION '0139: a function still reads a candidate demand';
  END IF;
END $$;

-- 5. Drop the column -------------------------------------------------------------
DROP TRIGGER candidates_guard ON public.candidates;
ALTER TABLE public.candidates DROP CONSTRAINT candidates_demand_on_job_line;
ALTER TABLE public.candidates DROP COLUMN demanded_quantity;
CREATE TRIGGER candidates_guard BEFORE INSERT OR UPDATE OF availability_request_id, supplier_id, name, size,
  status, available_quantity, unit_price, note_for_supplier, note_from_supplier, mapped_inventory_id, is_active
  ON public.candidates FOR EACH ROW EXECUTE FUNCTION public.guard_candidate_write();

NOTIFY pgrst, 'reload schema';
COMMIT;
