-- Rollback for 0145: the update_job_line live before it (0134's body with
-- 0139's in-place demand edit; md5(prosrc) 1937ae09cd4bed97d8fa367cd52af95c).
CREATE OR REPLACE FUNCTION public.update_job_line(p_item_id bigint, p_changes jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE line public.job_request_items; c public.candidates; k text; next_status text;
  qty numeric; demand numeric; next_size text; next_name text;
BEGIN
  IF p_changes IS NULL OR jsonb_typeof(p_changes) <> 'object' OR p_changes = '{}'::jsonb THEN
    RAISE EXCEPTION 'Changes are required';
  END IF;
  FOR k IN SELECT jsonb_object_keys(p_changes) LOOP
    IF k NOT IN ('status', 'unit_price', 'available_quantity', 'note_for_customer', 'size', 'name')
      OR jsonb_typeof(p_changes->k) NOT IN ('string', 'number', 'null') THEN
      RAISE EXCEPTION 'Invalid line field';
    END IF;
  END LOOP;
  FOREACH k IN ARRAY ARRAY['unit_price', 'available_quantity'] LOOP
    IF nullif(trim(p_changes->>k), '')::numeric::text IN ('NaN', 'Infinity', '-Infinity') THEN
      RAISE EXCEPTION 'Line numbers must be finite';
    END IF;
  END LOOP;
  IF p_changes ? 'name' AND nullif(btrim(p_changes->>'name'), '') IS NULL THEN
    RAISE EXCEPTION 'Plant name is required';
  END IF;
  SELECT * INTO line FROM public.job_request_items WHERE id = p_item_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Job line not found'; END IF;
  SELECT * INTO c FROM public.candidates WHERE id = line.selected_candidate_id FOR UPDATE;
  demand := line.demanded_quantity;
  qty := CASE WHEN p_changes ? 'available_quantity'
    THEN nullif(trim(p_changes->>'available_quantity'), '')::numeric ELSE c.available_quantity END;
  next_size := CASE WHEN p_changes ? 'size' THEN nullif(btrim(p_changes->>'size'), '') ELSE c.size END;
  next_name := CASE WHEN p_changes ? 'name' THEN btrim(p_changes->>'name') ELSE c.name END;
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
      THEN p_changes->>'note_for_customer' ELSE note_for_customer END,
    size = CASE WHEN p_changes ? 'size' THEN next_size ELSE size END,
    name = CASE WHEN p_changes ? 'name' THEN next_name ELSE name END,
    description = CASE WHEN (p_changes ? 'name' AND NOT c.is_original) OR ((p_changes ? 'size' OR p_changes ? 'name')
        AND lower(description) = lower(btrim(concat_ws(' ', c.size, c.name))))
      THEN CASE WHEN next_size IS NOT NULL AND lower(left(next_name, length(next_size) + 1)) = lower(next_size || ' ')
        THEN next_name ELSE btrim(concat_ws(' ', next_size, next_name)) END
      WHEN p_changes ? 'size' AND lower(left(description, length(c.size) + 1)) = lower(c.size || ' ')
      THEN btrim(concat_ws(' ', next_size, substr(description, length(c.size) + 2)))
      ELSE description END
  WHERE id = c.id;
  IF c.is_original AND (p_changes ? 'size' OR p_changes ? 'name') THEN
    UPDATE public.job_request_items SET
      size = CASE WHEN p_changes ? 'size' THEN next_size ELSE size END,
      name = CASE WHEN p_changes ? 'name' THEN next_name ELSE name END
    WHERE id = line.id;
  END IF;
  PERFORM set_config('lps.lps_override', '', true);
END $function$;
