-- 0123 — a chosen substitute is its own row as soon as the supplier saves.
--
-- (Bhoumik 2026-09-30) When a supplier answers Unavailable or Diff Sz/Sub with a
-- substitute, on save:
-- * the asked candidate is stored as `unavailable` (quantity 0, price kept),
--   keeping `offered_candidate_id` (and `offer_*` as the record of the offer);
-- * a picked tag (another candidate of the line) becomes Available — Partial
--   Qty if the offered quantity is short — on the same request, with the
--   offer's price, quantity and note;
-- * a typed substitute creates a new candidate for it (name = what was typed,
--   no size, not original) on the same request, Available likewise; Rosie
--   enriches it after submission. A typed offer is `offered_candidate_id` plus
--   `offer_description`; a tag has no description.
-- Changing or clearing the substitute resets a previously picked tag to
-- unanswered and retires a previously typed one. Offers are no longer applied
-- at submission. A selected original with a substitute on offer still reads
-- Diff Sz/Sub on its job line (JR-90). `diff_size_qty_sub` stays valid input
-- (it needs a substitute) and for older answers.
BEGIN;

-- The offered candidate takes the offer as its own answer and joins the request,
-- without reopening it or marking it processing.
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
      UPDATE public.candidates SET status = NULL, available_quantity = NULL, note_from_supplier = NULL, answered_at = now()
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

-- Offers are applied on save now; submission only copies replies and re-applies lines.
CREATE OR REPLACE FUNCTION public.apply_submitted_candidates() RETURNS trigger
LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
  -- Only candidates answered since the previous submission. A supplier reply
  -- becomes the candidate's customer note, then selecting open lines follow.
  UPDATE public.candidates SET note_for_customer = btrim(note_from_supplier)
    WHERE availability_request_id = NEW.id AND is_active
      AND answered_at > coalesce(OLD.submitted_at, '-infinity'::timestamptz)
      AND nullif(btrim(note_from_supplier), '') IS NOT NULL;
  PERFORM public.apply_candidate_to_job_item(ji.id)
    FROM public.job_request_items ji
    JOIN public.candidates c ON c.id = ji.selected_candidate_id
    JOIN public.job_requests j ON j.id = ji.job_request_id
    WHERE c.availability_request_id = NEW.id AND c.is_active AND ji.is_active
      AND j.is_active AND j.status IN ('quoted', 'availability')
      AND c.answered_at > coalesce(OLD.submitted_at, '-infinity'::timestamptz);
  RETURN NULL;
END $function$;

-- Rosie's correction path: record another candidate as an answer's substitute.
CREATE OR REPLACE FUNCTION public.link_candidate_offer(p_candidate_id bigint, p_offered_candidate_id bigint)
RETURNS void LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE src public.candidates; line bigint;
BEGIN
  SELECT * INTO src FROM public.candidates
    WHERE id = p_candidate_id AND is_active AND status IN ('unavailable', 'diff_size_qty_sub') FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unavailable answer not found'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.candidates o WHERE o.id = p_offered_candidate_id AND o.id <> src.id
      AND o.is_active AND o.supplier_id = src.supplier_id AND o.job_request_item_id = src.job_request_item_id) THEN
    RAISE EXCEPTION 'Offered candidate must be another candidate of this line and supplier';
  END IF;
  UPDATE public.candidates SET offered_candidate_id = p_offered_candidate_id, status = 'unavailable', available_quantity = 0
    WHERE id = src.id;
  PERFORM public.apply_candidate_offer(src.id);
  SELECT ji.id INTO line FROM public.job_request_items ji JOIN public.job_requests j ON j.id = ji.job_request_id
    WHERE ji.selected_candidate_id IN (p_offered_candidate_id, p_candidate_id) AND ji.is_active AND j.is_active
      AND j.status IN ('quoted', 'availability');
  IF line IS NOT NULL THEN PERFORM public.apply_candidate_to_job_item(line); END IF;
END $function$;

-- A selected original that offered a substitute reads Diff Sz/Sub (JR-90).
CREATE OR REPLACE FUNCTION public.apply_candidate_to_job_item(p_job_request_item_id bigint)
RETURNS void LANGUAGE sql SET search_path TO 'public' AS $function$
  UPDATE public.job_request_items ji SET
    size = c.size,
    unit_price = nullif(c.unit_price, 0),
    available_quantity = least(c.available_quantity, coalesce(c.demanded_quantity, ji.demanded_quantity)),
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

COMMENT ON COLUMN public.candidates.offered_candidate_id IS
  'Substitute for an Unavailable answer: another candidate of the same supplier and line (a picked tag), or the candidate created for a typed one (offer_description set). Made Available on save (0123).';
COMMENT ON COLUMN public.candidates.offer_description IS
  'What the supplier typed as a substitute; its candidate (offered_candidate_id) was created on save and Rosie enriches it after submission.';

COMMIT;
