-- 0125 — unselecting a candidate, and a blank Avail for an unanswered one.
--
-- (Bhoumik 2026-10-01, JR-96) A line's Avail is its selected candidate's
-- available quantity, capped at demand: blank while availability is not
-- checked, 0 when Unavailable. `least()` ignores NULLs, so an unanswered
-- candidate copied the demand as Avail. `apply_candidate_to_job_item` now keeps
-- it blank; otherwise it is 0123's. Open lines that picked up the demand that
-- way are cleared.
--
-- `unselect_candidate` clears a line's selection (dragging the Selected pill
-- back to Candidates). Like `delete_candidate`, the line keeps its values.
BEGIN;

CREATE OR REPLACE FUNCTION public.apply_candidate_to_job_item(p_job_request_item_id bigint)
RETURNS void LANGUAGE sql SET search_path TO 'public' AS $function$
  UPDATE public.job_request_items ji SET
    size = c.size,
    unit_price = nullif(c.unit_price, 0),
    available_quantity = CASE WHEN c.available_quantity IS NOT NULL
      THEN least(c.available_quantity, coalesce(c.demanded_quantity, ji.demanded_quantity)) END,
    status = CASE
      WHEN c.status IS NULL THEN 'pending'
      WHEN c.status = 'unavailable' AND c.offered_candidate_id IS NULL THEN 'unavailable'
      WHEN c.status = 'unavailable' OR NOT c.is_original OR c.status = 'diff_size_qty_sub' THEN 'alternative_proposed'
      WHEN c.status = 'can_order' THEN 'need_to_order'
      ELSE c.status END,
    note_for_customer = nullif(btrim(c.note_for_customer), '')
  FROM public.candidates c
  WHERE ji.id = p_job_request_item_id AND c.id = ji.selected_candidate_id;
$function$;

CREATE FUNCTION public.unselect_candidate(p_job_request_item_id bigint)
RETURNS void LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
  UPDATE public.job_request_items ji SET selected_candidate_id = NULL
    FROM public.job_requests j
    WHERE j.id = ji.job_request_id AND ji.id = p_job_request_item_id AND ji.is_active AND j.is_active
      AND j.status NOT IN ('closed_won', 'closed_lost', 'archived');
  IF NOT FOUND THEN RAISE EXCEPTION 'Open job line not found'; END IF;
END $function$;

REVOKE ALL ON FUNCTION public.unselect_candidate(bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.unselect_candidate(bigint) TO service_role;

-- Open lines whose Avail is the demand only because the selected candidate is unanswered.
UPDATE public.job_request_items ji SET available_quantity = NULL
  FROM public.candidates c, public.job_requests j
  WHERE c.id = ji.selected_candidate_id AND j.id = ji.job_request_id
    AND ji.is_active AND j.is_active AND j.status NOT IN ('closed_won', 'closed_lost', 'archived')
    AND c.available_quantity IS NULL
    AND ji.available_quantity = coalesce(c.demanded_quantity, ji.demanded_quantity);

NOTIFY pgrst, 'reload schema';
COMMIT;
