-- 0145 — update_job_line no longer edits size or name (2026-10-16)
--
-- (Bhoumik 2026-10-16) After 0144: "price belongs to candidate. The user will
-- see the selected candidate. And remove it." 0133 let update_job_line take
-- `size` / `name`: on an original selection it wrote both the line's ask and
-- the candidate, on a substitute only the candidate, and rebuilt the
-- candidate's description. The candidate kept its price and mapping, so the
-- edit could leave it naming one plant or size while priced for another. The
-- app stopped sending these keys on 2026-10-15.
-- * update_job_line takes only status, unit_price, available_quantity and
--   note_for_customer, written to the selected candidate as before (0134 /
--   0139 behaviour unchanged). `size` or `name` is refused with a message
--   saying where they belong.
-- * A line's size and name are plain job_request_items edits (the customer's
--   ask, never copied onto a candidate since 0144). A candidate's own name,
--   size and description are edited on the candidate.
-- Rollback: re-create the previous body, 0134's update_job_line with 0139's
-- in-place demand edit (live md5(prosrc) before this migration:
-- 1937ae09cd4bed97d8fa367cd52af95c).
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
    IF next_status = 'diff_size_sub' AND c.is_original THEN
      IF c.status = 'unavailable' AND EXISTS (SELECT 1 FROM public.candidates
          WHERE id = c.offered_candidate_id AND is_active) THEN
        next_status := 'unavailable';
      ELSE
        RAISE EXCEPTION 'Diff Sz/Sub needs a substitute: select it or have the supplier offer one';
      END IF;
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

COMMIT;
