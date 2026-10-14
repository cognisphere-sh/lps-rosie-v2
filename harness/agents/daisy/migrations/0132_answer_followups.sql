-- 0132 — follow-ups to 0130 from the first live answers (2026-10-14)
--
-- (Bhoumik 2026-10-14)
-- 1. Pending clears the available quantity. Status sets quantity for every
--    writer (0130): available = demand, unavailable = 0, and now a change to
--    pending (status NULL) = not answered, so the quantity is unknown (NA).
--    Inserts are unchanged. Candidate 1503 (line 1246, JR-108) is the one
--    pending row still holding a quantity: 0130's backfill copied the line's 3.
-- 2. Submission hides the supplier's other alternatives on the AR's lines,
--    asked or not. 0130 hid only those asked on the AR, so unasked options
--    stayed visible (JR-114 / AR-83: 1973 Gaura, 1974 4" Stemodia). The line's
--    default and selection, the supplier's originals and the substitutes they
--    offer stay visible, as before.
-- 3. A supplier reply resets the customer note: when note_from_supplier gets
--    a new, non-empty value, the candidate's note_for_customer override is
--    cleared (unless the same write sets it), so the customer note starts as
--    the supplier's reply and LPS overrides from there. JR-114's 15 G Sotol
--    (1980) kept Rosie's intake note "15 G instead of 5 G" over the reply.
BEGIN;
SET LOCAL lock_timeout = '250ms';
SET LOCAL statement_timeout = '5s';
SET LOCAL app.actor = 'migration 0132';

-- 1. Pending = NA ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.candidate_status_quantity() RETURNS trigger
LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE demand numeric;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  demand := coalesce(NEW.demanded_quantity,
    (SELECT demanded_quantity FROM public.job_request_items WHERE id = NEW.job_request_item_id));
  IF NEW.status = 'available' THEN
    NEW.available_quantity := coalesce(demand, NEW.available_quantity);
  ELSIF NEW.status = 'unavailable' THEN
    NEW.available_quantity := 0;
  ELSIF NEW.status = 'diff_size_sub' AND NEW.available_quantity IS NULL THEN
    NEW.available_quantity := demand;
  ELSIF NEW.status IS NULL AND TG_OP = 'UPDATE' THEN
    NEW.available_quantity := NULL;
  END IF;
  RETURN NEW;
END $function$;

-- 2. Submission hides unasked alternatives too ------------------------------
CREATE OR REPLACE FUNCTION public.apply_submitted_candidates() RETURNS trigger
LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
  UPDATE public.job_request_items ji SET selected_candidate_id = s.id
    FROM public.candidates c, public.candidates s, public.job_requests j
    WHERE c.id = ji.selected_candidate_id AND c.availability_request_id = NEW.id AND c.is_active
      AND c.status = 'unavailable' AND c.answered_at > coalesce(OLD.submitted_at, '-infinity'::timestamptz)
      AND s.id = c.offered_candidate_id AND s.is_active AND s.job_request_item_id = ji.id
      AND ji.is_active AND j.id = ji.job_request_id AND j.is_active AND j.status IN ('quoted', 'availability');
  PERFORM public.hide_submitted_alternatives(NEW.id);
  RETURN NULL;
END $function$;

-- The supplier's alternatives on the AR's lines (asked here or never asked),
-- except the line's default and selection, originals and their substitutes.
CREATE FUNCTION public.hide_submitted_alternatives(p_request_id bigint)
RETURNS bigint LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE ar public.availability_requests; hidden bigint;
BEGIN
  SELECT * INTO ar FROM public.availability_requests WHERE id = p_request_id;
  UPDATE public.candidates c SET hide_from_lps = true
    FROM public.job_request_items ji, public.job_requests j
    WHERE c.supplier_id = ar.supplier_id AND c.is_active AND NOT c.hide_from_lps AND NOT c.is_original
      AND (c.availability_request_id = ar.id OR c.availability_request_id IS NULL)
      AND ji.id = c.job_request_item_id AND ji.is_active
      AND EXISTS (SELECT 1 FROM public.candidates a WHERE a.job_request_item_id = ji.id AND a.availability_request_id = ar.id)
      AND c.id <> ji.default_candidate_id AND c.id <> ji.selected_candidate_id
      AND j.id = ji.job_request_id AND j.is_active AND j.status IN ('quoted', 'availability')
      AND NOT EXISTS (SELECT 1 FROM public.candidates o
        WHERE o.job_request_item_id = ji.id AND o.supplier_id = ar.supplier_id AND o.is_original
          AND o.is_active AND o.offered_candidate_id = c.id);
  GET DIAGNOSTICS hidden = ROW_COUNT;
  RETURN hidden;
END $function$;
REVOKE ALL ON FUNCTION public.hide_submitted_alternatives(bigint) FROM PUBLIC, anon, authenticated;

-- 3. A supplier reply resets the customer note ------------------------------
CREATE FUNCTION public.reset_customer_note_on_reply() RETURNS trigger
LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
  IF nullif(btrim(NEW.note_from_supplier), '') IS NOT NULL
    AND NEW.note_from_supplier IS DISTINCT FROM OLD.note_from_supplier
    AND NEW.note_for_customer IS NOT DISTINCT FROM OLD.note_for_customer THEN
    NEW.note_for_customer := NULL;
  END IF;
  RETURN NEW;
END $function$;
CREATE TRIGGER candidates_reset_customer_note BEFORE UPDATE OF note_from_supplier ON public.candidates
  FOR EACH ROW EXECUTE FUNCTION public.reset_customer_note_on_reply();
REVOKE ALL ON FUNCTION public.reset_customer_note_on_reply() FROM PUBLIC, anon, authenticated;

-- Backfill (LPS values on closed ARs too) -----------------------------------
SELECT set_config('lps.lps_override', 'on', true);
UPDATE public.candidates SET available_quantity = NULL
  WHERE is_active AND status IS NULL AND available_quantity IS NOT NULL;
-- Answers since 0130 whose override predates the reply (only 1980 on apply).
UPDATE public.candidates SET note_for_customer = NULL
  WHERE is_active AND answered_at > '2026-10-14 06:48:00+00'
    AND nullif(btrim(note_from_supplier), '') IS NOT NULL AND note_for_customer IS NOT NULL;
-- ARs submitted since 0130 (only AR-83 on apply).
SELECT public.hide_submitted_alternatives(id) FROM public.availability_requests
  WHERE status = 'submitted' AND submitted_at > '2026-10-14 06:48:00+00';
SELECT set_config('lps.lps_override', '', true);

COMMENT ON COLUMN public.candidates.status IS
  'Supplier answer: available (quantity = demand), partial_qty (fewer than demanded), can_order, arriving_soon, unavailable (quantity 0; with offered_candidate_id it offers a substitute), diff_size_sub (the substitute, or a legacy single-row answer), NULL = not answered (quantity unknown).';
COMMENT ON COLUMN public.candidates.note_for_customer IS
  'LPS override of the customer note. NULL = follow note_from_supplier; '''' = deliberately blank; text = the note. A new supplier reply clears it.';
COMMIT;
