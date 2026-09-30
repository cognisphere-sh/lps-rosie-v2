-- 0122 — a status change never overwrites a candidate's price.
--
-- Unavailable (and Diff Sz/Sub with a substitute) still sets the asked
-- candidate's available quantity to 0, but keeps its price; only an explicit
-- `unit_price` in the answer changes it (Bhoumik 2026-09-30). Prices already
-- zeroed by earlier Unavailable answers are not restored (the old value is gone).
BEGIN;

CREATE OR REPLACE FUNCTION public.answer_availability_request(p_request_id bigint, p_supplier_id bigint,
  p_item_id bigint DEFAULT NULL::bigint, p_changes jsonb DEFAULT NULL::jsonb, p_submit boolean DEFAULT false)
RETURNS bigint LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE ar public.availability_requests; cur public.candidates; k text; next_status text;
  next_offer bigint; next_description text; has_offer boolean;
BEGIN
  SELECT * INTO ar FROM public.availability_requests
    WHERE id = p_request_id AND supplier_id = p_supplier_id AND is_active AND status NOT IN ('closed', 'draft') FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM public.suppliers WHERE id = ar.supplier_id AND is_active) THEN
    RAISE EXCEPTION 'This request is closed, deleted or unavailable';
  END IF;
  IF p_submit THEN
    UPDATE public.availability_requests SET status = 'submitted', submitted_at = now() WHERE id = ar.id;
  ELSE
    IF p_changes IS NULL OR jsonb_typeof(p_changes) <> 'object' OR p_changes = '{}'::jsonb THEN
      RAISE EXCEPTION 'Changes are required';
    END IF;
    FOR k IN SELECT jsonb_object_keys(p_changes) LOOP
      IF k NOT IN ('status', 'available_quantity', 'unit_price', 'note_from_supplier',
          'offered_candidate_id', 'offer_description', 'offer_unit_price', 'offer_quantity')
        OR jsonb_typeof(p_changes->k) <> 'string' THEN
        RAISE EXCEPTION 'Invalid answer field';
      END IF;
    END LOOP;
    FOREACH k IN ARRAY ARRAY['available_quantity', 'unit_price', 'offer_unit_price', 'offer_quantity'] LOOP
      IF p_changes ? k AND nullif(trim(p_changes->>k), '')::numeric::text IN ('NaN', 'Infinity', '-Infinity') THEN
        RAISE EXCEPTION 'Answer numbers must be finite';
      END IF;
    END LOOP;
    SELECT * INTO cur FROM public.candidates
      WHERE id = p_item_id AND availability_request_id = ar.id AND is_active FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Line not found'; END IF;
    next_status := CASE WHEN p_changes ? 'status' THEN nullif(trim(p_changes->>'status'), '') ELSE cur.status END;
    next_offer := CASE WHEN p_changes ? 'offered_candidate_id'
      THEN nullif(trim(p_changes->>'offered_candidate_id'), '')::bigint ELSE cur.offered_candidate_id END;
    next_description := CASE WHEN p_changes ? 'offer_description'
      THEN nullif(btrim(p_changes->>'offer_description'), '') ELSE cur.offer_description END;
    has_offer := next_offer IS NOT NULL OR next_description IS NOT NULL;
    -- Diff Sz/Sub needs a substitute (a tag or a typed one); Unavailable with a
    -- recommended substitute becomes Diff Sz/Sub. A legacy Diff Sz/Sub answer
    -- without an offer is kept as saved while neither is being changed.
    IF next_status = 'unavailable' AND has_offer THEN
      next_status := 'diff_size_qty_sub';
    ELSIF next_status = 'diff_size_qty_sub' AND NOT has_offer AND (p_changes ? 'status'
        OR p_changes ? 'offered_candidate_id' OR p_changes ? 'offer_description') THEN
      RAISE EXCEPTION 'Pick or describe the substitute';
    END IF;
    IF next_status IS DISTINCT FROM 'diff_size_qty_sub' THEN next_offer := NULL; next_description := NULL; END IF;
    IF next_offer IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.candidates o
        WHERE o.id = next_offer AND o.id <> cur.id AND o.is_active AND o.supplier_id = cur.supplier_id
          AND o.job_request_item_id IS NOT DISTINCT FROM cur.job_request_item_id
          AND cur.job_request_item_id IS NOT NULL) THEN
      RAISE EXCEPTION 'Offered candidate must be another candidate of this line and supplier';
    END IF;
    UPDATE public.candidates SET
      status = next_status,
      available_quantity = CASE WHEN next_status = 'unavailable' OR (next_status = 'diff_size_qty_sub' AND has_offer) THEN 0
        WHEN p_changes ? 'available_quantity' THEN nullif(trim(p_changes->>'available_quantity'), '')::numeric
        ELSE available_quantity END,
      -- A status never overwrites the price; only an explicit unit_price does.
      unit_price = CASE WHEN p_changes ? 'unit_price' THEN nullif(trim(p_changes->>'unit_price'), '')::numeric
        ELSE unit_price END,
      note_from_supplier = CASE WHEN p_changes ? 'note_from_supplier'
        THEN nullif(trim(p_changes->>'note_from_supplier'), '') ELSE note_from_supplier END,
      offered_candidate_id = next_offer,
      offer_description = next_description,
      offer_unit_price = CASE WHEN NOT has_offer OR next_status <> 'diff_size_qty_sub' THEN NULL
        WHEN p_changes ? 'offer_unit_price' THEN nullif(trim(p_changes->>'offer_unit_price'), '')::numeric
        ELSE offer_unit_price END,
      offer_quantity = CASE WHEN NOT has_offer OR next_status <> 'diff_size_qty_sub' THEN NULL
        WHEN p_changes ? 'offer_quantity' THEN nullif(trim(p_changes->>'offer_quantity'), '')::numeric
        ELSE offer_quantity END,
      answered_at = now()
    WHERE id = p_item_id;
    UPDATE public.availability_requests SET status = 'processing' WHERE id = ar.id;
  END IF;
  RETURN ar.id;
END $function$;

COMMIT;
