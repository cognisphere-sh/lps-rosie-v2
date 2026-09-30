-- 0124 — candidates kept only as a supplier's substitute options.
--
-- (Bhoumik 2026-09-30) When a line has an exact match, Rosie still adds 2–3
-- similar plants from the same supplier so the supplier's Unavailable/Sub
-- dialog has substitutes to tick. Those extra candidates are
-- `hide_from_lps = true`: the sourcing page leaves them out. When a supplier
-- picks one as a substitute (or Rosie links one with `link_candidate_offer`),
-- `apply_candidate_offer` clears the flag for good, so it shows on LPS from
-- then on, even if the supplier later switches to another substitute.
-- Additive: every existing candidate stays visible. Otherwise
-- `apply_candidate_offer` is 0123's.
--
-- A substitute stays linked to the AR (`create_order` needs an open AR), but
-- the app no longer lists it as its own AR row; the asked row reads Diff
-- Sz/Sub. So a tag that is replaced or cleared also leaves the AR here,
-- instead of lingering on it as a Pending row. Otherwise
-- `answer_availability_request` is 0123's.
BEGIN;

ALTER TABLE public.candidates ADD COLUMN hide_from_lps boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.candidates.hide_from_lps IS
  'Substitute option for the supplier only: offered as a tick box in the Unavailable/Sub dialog, left off the LPS sourcing page. Set by Rosie at intake when the line already has an exact match; cleared once a supplier picks it as a substitute (0124).';

CREATE OR REPLACE FUNCTION public.apply_candidate_offer(p_candidate_id bigint)
RETURNS void LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE src public.candidates; offered public.candidates; qty numeric; demand numeric;
BEGIN
  SELECT * INTO src FROM public.candidates
    WHERE id = p_candidate_id AND is_active AND status IN ('unavailable', 'diff_size_qty_sub')
      AND offered_candidate_id IS NOT NULL;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT * INTO offered FROM public.candidates WHERE id = src.offered_candidate_id AND is_active FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  demand := coalesce(offered.demanded_quantity, src.demanded_quantity);
  qty := coalesce(src.offer_quantity, demand);
  PERFORM set_config('lps.applying_offer', 'on', true);
  UPDATE public.candidates SET
    availability_request_id = src.availability_request_id,
    demanded_quantity = demand,
    status = CASE WHEN qty IS NOT NULL AND demand IS NOT NULL AND qty < demand THEN 'partial_qty' ELSE 'available' END,
    available_quantity = qty,
    unit_price = coalesce(src.offer_unit_price, offered.unit_price),
    note_from_supplier = src.note_from_supplier,
    note_for_customer = coalesce(nullif(btrim(src.note_from_supplier), ''), offered.note_for_customer),
    -- A supplier's pick is something LPS must see (0124).
    hide_from_lps = false,
    answered_at = now()
  WHERE id = offered.id;
  PERFORM set_config('lps.applying_offer', 'off', true);
END $function$;

CREATE OR REPLACE FUNCTION public.answer_availability_request(p_request_id bigint, p_supplier_id bigint,
  p_item_id bigint DEFAULT NULL::bigint, p_changes jsonb DEFAULT NULL::jsonb, p_submit boolean DEFAULT false)
RETURNS bigint LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE ar public.availability_requests; cur public.candidates; k text; next_status text;
  next_offer bigint; next_description text; has_offer boolean; typed boolean; prev_typed boolean;
BEGIN
  SELECT * INTO ar FROM public.availability_requests
    WHERE id = p_request_id AND supplier_id = p_supplier_id AND is_active AND status NOT IN ('closed', 'draft') FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM public.suppliers WHERE id = ar.supplier_id AND is_active) THEN
    RAISE EXCEPTION 'This request is closed, deleted or unavailable';
  END IF;
  IF p_submit THEN
    UPDATE public.availability_requests SET status = 'submitted', submitted_at = now() WHERE id = ar.id;
    RETURN ar.id;
  END IF;
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
  prev_typed := cur.offered_candidate_id IS NOT NULL AND cur.offer_description IS NOT NULL;

  next_status := CASE WHEN p_changes ? 'status' THEN nullif(trim(p_changes->>'status'), '') ELSE cur.status END;
  next_description := CASE WHEN p_changes ? 'offer_description'
    THEN nullif(btrim(p_changes->>'offer_description'), '') ELSE cur.offer_description END;
  next_offer := CASE WHEN p_changes ? 'offered_candidate_id'
    THEN nullif(trim(p_changes->>'offered_candidate_id'), '')::bigint ELSE cur.offered_candidate_id END;
  -- A typed substitute owns the candidate made for it; a tag has no description.
  typed := next_description IS NOT NULL AND (next_offer IS NULL OR (prev_typed AND next_offer = cur.offered_candidate_id));
  IF NOT typed THEN next_description := NULL; END IF;
  -- Editing a typed substitute keeps its candidate; a new one gets its own.
  IF typed THEN next_offer := CASE WHEN prev_typed THEN cur.offered_candidate_id END; END IF;
  has_offer := next_offer IS NOT NULL OR typed;
  -- A substitute makes the asked candidate Unavailable; Diff Sz/Sub needs one.
  -- A legacy Diff Sz/Sub answer without one is kept while neither is changed.
  IF next_status IN ('unavailable', 'diff_size_qty_sub') AND has_offer THEN
    next_status := 'unavailable';
  ELSIF next_status = 'diff_size_qty_sub' AND (p_changes ? 'status'
      OR p_changes ? 'offered_candidate_id' OR p_changes ? 'offer_description') THEN
    RAISE EXCEPTION 'Pick or describe the substitute';
  END IF;
  IF next_status IS DISTINCT FROM 'unavailable' THEN next_offer := NULL; next_description := NULL; typed := false; has_offer := false; END IF;
  IF next_offer IS NOT NULL AND NOT typed AND NOT EXISTS (SELECT 1 FROM public.candidates o
      WHERE o.id = next_offer AND o.id <> cur.id AND o.is_active AND o.supplier_id = cur.supplier_id
        AND o.job_request_item_id IS NOT DISTINCT FROM cur.job_request_item_id
        AND cur.job_request_item_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Offered candidate must be another candidate of this line and supplier';
  END IF;
  IF typed AND cur.job_request_item_id IS NULL THEN RAISE EXCEPTION 'This line has no job line for a substitute'; END IF;

  PERFORM set_config('lps.applying_offer', 'on', true);
  -- The previous substitute, if it is being replaced or cleared: a picked tag
  -- goes back to unanswered; a typed one is retired.
  IF cur.offered_candidate_id IS NOT NULL AND cur.offered_candidate_id IS DISTINCT FROM next_offer THEN
    IF prev_typed THEN
      UPDATE public.candidates SET is_active = false WHERE id = cur.offered_candidate_id;
      UPDATE public.job_request_items SET selected_candidate_id = NULL WHERE selected_candidate_id = cur.offered_candidate_id;
    ELSE
      -- …and leaves the request: it was only on it as the substitute (0124).
      UPDATE public.candidates SET status = NULL, available_quantity = NULL, note_from_supplier = NULL,
          availability_request_id = CASE WHEN availability_request_id = ar.id THEN NULL ELSE availability_request_id END,
          answered_at = now()
        WHERE id = cur.offered_candidate_id AND is_active;
    END IF;
  END IF;
  -- A typed substitute: create its candidate, or keep the one already made for it.
  IF typed AND next_offer IS NULL THEN
    INSERT INTO public.candidates(supplier_id, job_request_item_id, availability_request_id, name, description,
        is_original, unit_price, demanded_quantity)
      VALUES (cur.supplier_id, cur.job_request_item_id, ar.id, next_description, next_description,
        false, 0, cur.demanded_quantity)
      RETURNING id INTO next_offer;
  ELSIF typed AND next_description IS DISTINCT FROM cur.offer_description THEN
    -- Only a changed text renames it, so Rosie's enrichment survives other edits.
    UPDATE public.candidates SET name = next_description, description = next_description WHERE id = next_offer;
  END IF;
  PERFORM set_config('lps.applying_offer', 'off', true);

  UPDATE public.candidates SET
    status = next_status,
    -- Unavailable zeroes the quantity; a status never changes the price (0122).
    available_quantity = CASE WHEN next_status = 'unavailable' THEN 0
      WHEN p_changes ? 'available_quantity' THEN nullif(trim(p_changes->>'available_quantity'), '')::numeric
      ELSE available_quantity END,
    unit_price = CASE WHEN p_changes ? 'unit_price' THEN nullif(trim(p_changes->>'unit_price'), '')::numeric
      ELSE unit_price END,
    note_from_supplier = CASE WHEN p_changes ? 'note_from_supplier'
      THEN nullif(trim(p_changes->>'note_from_supplier'), '') ELSE note_from_supplier END,
    offered_candidate_id = next_offer,
    offer_description = next_description,
    offer_unit_price = CASE WHEN NOT has_offer THEN NULL
      WHEN p_changes ? 'offer_unit_price' THEN nullif(trim(p_changes->>'offer_unit_price'), '')::numeric
      ELSE offer_unit_price END,
    offer_quantity = CASE WHEN NOT has_offer THEN NULL
      WHEN p_changes ? 'offer_quantity' THEN nullif(trim(p_changes->>'offer_quantity'), '')::numeric
      ELSE offer_quantity END,
    answered_at = now()
  WHERE id = p_item_id;
  -- Only a change to the answer or the offer re-applies it; a note edit alone
  -- leaves the substitute's own row (which the supplier may have edited) as is.
  IF has_offer AND p_changes ?| ARRAY['status', 'offered_candidate_id', 'offer_description', 'offer_unit_price', 'offer_quantity'] THEN
    PERFORM public.apply_candidate_offer(p_item_id);
  END IF;
  UPDATE public.availability_requests SET status = 'processing' WHERE id = ar.id;
  RETURN ar.id;
END $function$;

COMMIT;
