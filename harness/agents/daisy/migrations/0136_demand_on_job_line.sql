-- 0136 — demand belongs to the job line; a Qty change re-checks Partial Qty (2026-10-15)
--
-- (Bhoumik 2026-10-15) The quantity the customer wants lives only on the job
-- line (job_request_items.demanded_quantity). A candidate on a job line keeps
-- no demand of its own: candidates.demanded_quantity is NULL there (new check
-- constraint) and every reader already resolves coalesce(candidate, line), so
-- the job table, the AR, the portal and orders all read the line's Qty.
-- Candidates with no job line (job-less stock-inquiry ARs) keep theirs: it is
-- the only record of what was asked.
-- * Backfill: clear the demand of every candidate on a job line. 15 active
--   ones differed from their line (AR snapshots, e.g. JR-55's 42 vs 35); the
--   line's value wins. updated_at is kept.
-- * create_job_line_default, sync_job_line_default and
--   add_candidates_to_availability_request stop copying the line's demand.
-- * apply_candidate_offer takes the line's demand for the substitute's Avail.
-- * sync_job_line_default: a line Qty change re-checks its active candidates
--   the way update_job_line does for an Avail edit: Available with
--   0 < Avail < Qty becomes Partial Qty, Partial Qty with Avail >= Qty becomes
--   Available (whose Avail the status trigger then sets to the Qty). Closed
--   ARs included (LPS override).
-- The column stays for job-less candidates; no column is dropped.
BEGIN;
SET LOCAL lock_timeout = '250ms';
SET LOCAL statement_timeout = '5s';
SET LOCAL app.actor = 'migration 0136';

-- 1. Backfill + constraint --------------------------------------------------
SELECT set_config('lps.lps_override', 'on', true);
ALTER TABLE public.candidates DISABLE TRIGGER handle_updated_at;
UPDATE public.candidates SET demanded_quantity = NULL
  WHERE job_request_item_id IS NOT NULL AND demanded_quantity IS NOT NULL;
ALTER TABLE public.candidates ENABLE TRIGGER handle_updated_at;
SELECT set_config('lps.lps_override', '', true);

ALTER TABLE public.candidates ADD CONSTRAINT candidates_demand_on_job_line
  CHECK (job_request_item_id IS NULL OR demanded_quantity IS NULL);
COMMENT ON COLUMN public.candidates.demanded_quantity IS
  'Quantity asked, only for a candidate with no job line (a job-less AR). A job line''s candidates read the line''s demanded_quantity.';

-- 2. Writers stop copying the line's demand ---------------------------------
CREATE OR REPLACE FUNCTION public.create_job_line_default() RETURNS trigger
LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
  INSERT INTO public.candidates(supplier_id, is_original, job_request_item_id, name, size,
      description, unit_price)
    VALUES (1, true, NEW.id, NEW.name, NEW.size,
      btrim(concat_ws(' ', NEW.size, NEW.name)), 0)
    RETURNING id INTO NEW.default_candidate_id;
  NEW.selected_candidate_id := coalesce(NEW.selected_candidate_id, NEW.default_candidate_id);
  RETURN NEW;
END $function$;

-- An unasked default follows the line's ask, an Available one keeps the full
-- quantity, and a Qty change re-checks Available / Partial Qty on every
-- active candidate of the line (0136).
CREATE OR REPLACE FUNCTION public.sync_job_line_default() RETURNS trigger
LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE prior text;
BEGIN
  UPDATE public.candidates SET
    name = CASE WHEN NEW.name IS DISTINCT FROM OLD.name THEN NEW.name ELSE name END,
    size = CASE WHEN NEW.size IS DISTINCT FROM OLD.size THEN NEW.size ELSE size END,
    description = CASE WHEN ROW(NEW.size, NEW.name) IS DISTINCT FROM ROW(OLD.size, OLD.name)
        AND lower(description) = lower(btrim(concat_ws(' ', size, name)))
      THEN CASE WHEN NEW.size IS NOT NULL AND lower(left(NEW.name, length(NEW.size) + 1)) = lower(NEW.size || ' ')
        THEN NEW.name ELSE btrim(concat_ws(' ', NEW.size, NEW.name)) END
      WHEN NEW.size IS DISTINCT FROM OLD.size AND size IS DISTINCT FROM NEW.size
        AND lower(left(description, length(size) + 1)) = lower(size || ' ')
      THEN btrim(concat_ws(' ', NEW.size, substr(description, length(size) + 2)))
      ELSE description END,
    available_quantity = CASE WHEN status = 'available' AND NEW.demanded_quantity IS DISTINCT FROM OLD.demanded_quantity
      THEN NEW.demanded_quantity ELSE available_quantity END
  WHERE id = NEW.default_candidate_id AND availability_request_id IS NULL;
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

CREATE OR REPLACE FUNCTION public.add_candidates_to_availability_request(p_request_id bigint, p_candidate_ids bigint[])
RETURNS bigint LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE ar public.availability_requests; attached bigint;
BEGIN
  IF coalesce(cardinality(p_candidate_ids), 0) = 0 THEN RAISE EXCEPTION 'Candidates are required'; END IF;
  SELECT * INTO ar FROM public.availability_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Availability request not found'; END IF;
  IF ar.status IN ('submitted', 'processing', 'closed') THEN
    RAISE EXCEPTION 'AR-% is %: reopen it before adding candidates', ar.id, ar.status;
  END IF;
  UPDATE public.candidates c SET availability_request_id = ar.id,
      status = CASE WHEN c.answered_at IS NOT NULL THEN NULL ELSE c.status END,
      available_quantity = CASE WHEN c.answered_at IS NOT NULL THEN NULL ELSE c.available_quantity END,
      answered_at = NULL
    FROM public.job_request_items ji JOIN public.job_requests j ON j.id = ji.job_request_id
    WHERE c.id = ANY(p_candidate_ids) AND c.is_active AND c.availability_request_id IS NULL
      AND c.supplier_id = ar.supplier_id AND ji.id = c.job_request_item_id AND ji.is_active
      AND ji.job_request_id = ar.job_request_id
      AND j.is_active AND j.status NOT IN ('closed_won', 'closed_lost', 'archived');
  GET DIAGNOSTICS attached = ROW_COUNT;
  IF attached <> cardinality(ARRAY(SELECT DISTINCT unnest(p_candidate_ids))) THEN
    RAISE EXCEPTION 'Each candidate must be active, unasked, on an open line of this request''s job and for its supplier';
  END IF;
  RETURN ar.id;
END $function$;

-- 3. A substitute's Avail is the line's demand ------------------------------
CREATE OR REPLACE FUNCTION public.apply_candidate_offer(p_candidate_id bigint)
RETURNS void LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE src public.candidates; offered public.candidates; demand numeric;
BEGIN
  SELECT * INTO src FROM public.candidates
    WHERE id = p_candidate_id AND is_active AND status = 'unavailable' AND offered_candidate_id IS NOT NULL;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT * INTO offered FROM public.candidates WHERE id = src.offered_candidate_id AND is_active FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  demand := coalesce((SELECT demanded_quantity FROM public.job_request_items WHERE id = offered.job_request_item_id),
    offered.demanded_quantity, src.demanded_quantity);
  UPDATE public.candidates SET
    availability_request_id = src.availability_request_id,
    status = 'diff_size_sub',
    available_quantity = demand,
    hide_from_lps = false,
    answered_at = now()
  WHERE id = offered.id;
END $function$;

COMMENT ON COLUMN public.job_lines.demand IS 'The line''s demanded_quantity (candidates on a job line carry none, 0136).';

NOTIFY pgrst, 'reload schema';
COMMIT;
