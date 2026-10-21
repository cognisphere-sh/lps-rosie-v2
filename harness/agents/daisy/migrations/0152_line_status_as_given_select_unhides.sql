-- 0152 — a line's status is written as given; selecting a hidden candidate unhides it (2026-10-21)
--
-- (Bhoumik 2026-10-21) JR-111 line 1270: setting Diff Sz/Sub on the default
-- candidate failed ("Diff Sz/Sub needs a substitute"), and selecting a hidden
-- candidate failed ("Candidate is hidden"). "Updating job line's status
-- updates candidate status." "Hidden candidate can be selected, that unhides
-- them."
-- * update_job_line no longer refuses Diff Sz/Sub on an original with no
--   substitute: the selected candidate stores diff_size_sub, avail = demand.
--   An original answered Unavailable with a live offered substitute still
--   stays Unavailable (as since 0130), so the supplier's offer is not released.
-- * select_candidate clears hide_from_lps on the candidate it selects, in the
--   same transaction.
-- Rollback: re-create 0145's update_job_line (live md5(prosrc) before this
-- migration: cf32d28d0d376d3945be97b2233dd127) and 0130's select_candidate
-- (5183a216b0b4c54ea5264761d85f7683).
BEGIN;
SET LOCAL lock_timeout = '250ms';
SET LOCAL statement_timeout = '5s';

CREATE OR REPLACE FUNCTION public.update_job_line(p_item_id bigint, p_changes jsonb) RETURNS void
LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE line public.job_request_items; c public.candidates; k text; next_status text;
  qty numeric; demand numeric;
BEGIN
  IF p_changes IS NULL OR jsonb_typeof(p_changes) <> 'object' OR p_changes = '{}'::jsonb THEN
    RAISE EXCEPTION 'Changes are required';
  END IF;
  -- 0145: a line's size and name are its own columns; a candidate's are the candidate's.
  IF p_changes ?| ARRAY['size', 'name'] THEN
    RAISE EXCEPTION 'Size and name are not line values: update job_request_items for the ask, or the candidate itself';
  END IF;
  FOR k IN SELECT jsonb_object_keys(p_changes) LOOP
    IF k NOT IN ('status', 'unit_price', 'available_quantity', 'note_for_customer')
      OR jsonb_typeof(p_changes->k) NOT IN ('string', 'number', 'null') THEN
      RAISE EXCEPTION 'Invalid line field';
    END IF;
  END LOOP;
  FOREACH k IN ARRAY ARRAY['unit_price', 'available_quantity'] LOOP
    IF nullif(trim(p_changes->>k), '')::numeric::text IN ('NaN', 'Infinity', '-Infinity') THEN
      RAISE EXCEPTION 'Line numbers must be finite';
    END IF;
  END LOOP;
  SELECT * INTO line FROM public.job_request_items WHERE id = p_item_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Job line not found'; END IF;
  SELECT * INTO c FROM public.candidates WHERE id = line.selected_candidate_id FOR UPDATE;
  demand := line.demanded_quantity;
  qty := CASE WHEN p_changes ? 'available_quantity'
    THEN nullif(trim(p_changes->>'available_quantity'), '')::numeric ELSE c.available_quantity END;
  next_status := c.status;
  IF p_changes ? 'status' THEN
    IF (p_changes->>'status') IS NULL OR (p_changes->>'status') NOT IN
        ('pending', 'available', 'partial_qty', 'unavailable', 'diff_size_sub', 'need_to_order', 'arriving_soon') THEN
      RAISE EXCEPTION 'Choose a valid line status';
    END IF;
    next_status := CASE p_changes->>'status' WHEN 'pending' THEN NULL
      WHEN 'need_to_order' THEN 'can_order' ELSE p_changes->>'status' END;
    -- 0152: an original answered with a live offer keeps it (the sub carries
    -- Diff Sz/Sub); any other selection stores the status as given.
    IF next_status = 'diff_size_sub' AND c.is_original AND c.status = 'unavailable'
        AND EXISTS (SELECT 1 FROM public.candidates WHERE id = c.offered_candidate_id AND is_active) THEN
      next_status := 'unavailable';
    END IF;
  END IF;
  IF p_changes ? 'status' AND NOT p_changes ? 'available_quantity'
    AND next_status IN ('available', 'can_order', 'arriving_soon', 'diff_size_sub') THEN
    qty := coalesce(demand, qty);
  END IF;
  IF p_changes ? 'available_quantity' AND qty IS NOT NULL AND demand IS NOT NULL THEN
    IF next_status = 'available' AND qty > 0 AND qty < demand THEN next_status := 'partial_qty';
    ELSIF next_status = 'partial_qty' AND qty >= demand THEN next_status := 'available';
    END IF;
  END IF;
  PERFORM set_config('lps.lps_override', 'on', true);
  IF c.offered_candidate_id IS NOT NULL AND c.status = 'unavailable' AND next_status IS DISTINCT FROM 'unavailable' THEN
    PERFORM public.release_candidate_offer(c.id);
  END IF;
  UPDATE public.candidates SET
    status = next_status,
    unit_price = CASE WHEN p_changes ? 'unit_price'
      THEN nullif(trim(p_changes->>'unit_price'), '')::numeric ELSE unit_price END,
    available_quantity = qty,
    note_for_customer = CASE WHEN p_changes ? 'note_for_customer'
      THEN p_changes->>'note_for_customer' ELSE note_for_customer END
  WHERE id = c.id;
  PERFORM set_config('lps.lps_override', '', true);
END $function$;


CREATE OR REPLACE FUNCTION public.select_candidate(p_job_request_item_id bigint, p_candidate_id bigint) RETURNS void
LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
  PERFORM 1 FROM public.job_request_items ji JOIN public.job_requests j ON j.id = ji.job_request_id
    WHERE ji.id = p_job_request_item_id AND ji.is_active AND j.is_active
      AND j.status NOT IN ('closed_won', 'closed_lost', 'archived')
    FOR UPDATE OF ji;
  IF NOT FOUND THEN RAISE EXCEPTION 'Open job line not found'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.candidates
    WHERE id = p_candidate_id AND job_request_item_id = p_job_request_item_id AND is_active) THEN
    RAISE EXCEPTION 'Candidate not found for this line';
  END IF;
  -- 0152: selecting a hidden candidate shows it again.
  UPDATE public.candidates SET hide_from_lps = false WHERE id = p_candidate_id AND hide_from_lps;
  UPDATE public.job_request_items SET selected_candidate_id = p_candidate_id WHERE id = p_job_request_item_id;
END $function$;

COMMIT;
