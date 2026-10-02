-- 0127 — ARs are retained permanently; Draft is the supplier visibility control.
-- Remove the header's deletion flag without deleting headers, answers or links.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- Formerly retired ARs become private Draft history. They cannot be published
-- if their job is missing/closed; no previously hidden AR reaches a supplier.
-- Install the revised guard first so archived drafts can be retained.
CREATE OR REPLACE FUNCTION public.guard_ar_public_link()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status NOT IN ('closed', 'draft') AND NOT EXISTS (
    SELECT 1 FROM public.job_requests j WHERE j.id = NEW.job_request_id AND j.is_active
      AND j.status NOT IN ('closed_won', 'closed_lost', 'archived')
  ) THEN RAISE EXCEPTION 'All linked job requests are closed'; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'draft' AND NEW.status IN ('processing', 'submitted') THEN
    RAISE EXCEPTION 'Publish the draft before recording supplier progress';
  END IF;
  -- LPS changes to the request-wide ask return a published request to New.
  IF TG_OP = 'UPDATE' AND NEW.status NOT IN ('draft', 'closed')
    AND current_setting('lps.ar_supplier_note', true) IS DISTINCT FROM 'on'
    AND ROW(NEW.note_for_supplier, NEW.share_customer_details)
      IS DISTINCT FROM ROW(OLD.note_for_supplier, OLD.share_customer_details) THEN
    NEW.status := 'new';
  END IF;
  IF NEW.status IN ('draft', 'new') THEN NEW.submitted_at := NULL; END IF;
  IF NEW.status IN ('closed', 'draft') THEN
    NEW.public_token := NULL;
  ELSIF NEW.public_token IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.suppliers WHERE id = NEW.supplier_id AND is_active
  ) THEN RAISE EXCEPTION 'Public requests require an active supplier'; END IF;
  -- Reopening an AR is explicit. Entering Submitted is a new submission.
  IF NEW.status = 'submitted' AND (TG_OP = 'INSERT' OR OLD.status <> 'submitted') THEN
    NEW.submitted_at := now();
  END IF;
  RETURN NEW;
END $function$;

UPDATE public.availability_requests SET status='draft', public_token=NULL, submitted_at=NULL
  WHERE NOT is_active;

DROP TRIGGER availability_requests_apply_selected ON public.availability_requests;
CREATE TRIGGER availability_requests_apply_selected AFTER UPDATE OF status ON public.availability_requests
  FOR EACH ROW WHEN (NEW.status = 'submitted') EXECUTE FUNCTION public.apply_submitted_candidates();

ALTER TABLE public.availability_requests DROP COLUMN is_active RESTRICT;
CREATE INDEX availability_requests_supplier_idx ON public.availability_requests(supplier_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.create_order(p_supplier_id bigint, p_items jsonb, p_fulfillment_method text DEFAULT NULL::text, p_fulfillment_date date DEFAULT NULL::date, p_note_for_supplier text DEFAULT NULL::text, p_customer_confirmed boolean DEFAULT false, p_note_for_customer text DEFAULT NULL::text)
 RETURNS bigint
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE line jsonb; allocation jsonb; source public.candidates; ar public.availability_requests;
  job public.job_requests; demand_item public.job_request_items; order_id bigint; line_id bigint;
  demand numeric; allocated numeric; already_ordered numeric;
BEGIN
  IF p_customer_confirmed IS DISTINCT FROM true THEN RAISE EXCEPTION 'Explicit customer confirmation is required'; END IF;
  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'Order items are required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.suppliers WHERE id = p_supplier_id AND is_active) THEN RAISE EXCEPTION 'Active supplier required'; END IF;
  -- Serialize supplier commitments, including direct orders for other jobs on a shared AR.
  PERFORM pg_advisory_xact_lock(hashtextextended('order-supplier:' || p_supplier_id, 0));
  FOR job IN SELECT j.* FROM public.job_requests j WHERE j.id IN (
    SELECT ji.job_request_id FROM public.job_request_items ji WHERE ji.id IN (
      SELECT (a->>'job_request_item_id')::bigint FROM jsonb_array_elements(p_items) l,
        LATERAL jsonb_array_elements(l->'allocations') a
    )) ORDER BY j.id FOR UPDATE LOOP
    IF NOT job.is_active OR job.status IN ('closed_won', 'closed_lost', 'archived') THEN RAISE EXCEPTION 'This job request is closed'; END IF;
  END LOOP;
  -- Serialize repeated/subdivided orders on the source request, then its lines.
  PERFORM 1 FROM public.availability_requests a WHERE a.id IN (
    SELECT c.availability_request_id FROM public.candidates c WHERE c.id IN (
      SELECT (l->>'candidate_id')::bigint FROM jsonb_array_elements(p_items) l
    )) ORDER BY a.id FOR UPDATE;
  INSERT INTO public.orders(supplier_id, fulfillment_method, fulfillment_date, note_for_supplier, note_for_customer)
    VALUES (p_supplier_id, p_fulfillment_method, p_fulfillment_date, p_note_for_supplier, p_note_for_customer) RETURNING id INTO order_id;
  FOR line IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    IF jsonb_typeof(line->'allocations') IS DISTINCT FROM 'array' OR jsonb_array_length(line->'allocations') = 0 THEN
      RAISE EXCEPTION 'Order allocations are required'; END IF;
    SELECT * INTO source FROM public.candidates WHERE id = (line->>'candidate_id')::bigint AND is_active FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Availability line not found'; END IF;
    SELECT * INTO ar FROM public.availability_requests WHERE id = source.availability_request_id;
    IF NOT FOUND OR ar.supplier_id <> p_supplier_id OR ar.status = 'closed' THEN RAISE EXCEPTION 'Availability request is closed or belongs to another supplier'; END IF;
    IF source.status IS NULL OR source.status = 'unavailable' OR (source.status = 'diff_size_qty_sub'
      AND (source.offered_candidate_id IS NOT NULL OR source.offer_description IS NOT NULL)) THEN RAISE EXCEPTION 'Supplier must answer availability before ordering'; END IF;
    SELECT sum((a->>'quantity')::numeric) INTO demand FROM jsonb_array_elements(line->'allocations') a;
    IF demand IS NULL OR demand <= 0 OR demand >= 'Infinity'::numeric THEN RAISE EXCEPTION 'Positive finite quantities are required'; END IF;
    -- All commitments to this supplier for the candidate's job line consume its
    -- budget, including direct orders and selections from another related AR.
    SELECT coalesce(sum(a.quantity), 0) INTO already_ordered
      FROM public.order_item_job_request_items a
      JOIN public.order_items oi ON oi.id = a.order_item_id
      JOIN public.orders o ON o.id = oi.order_id
      WHERE a.job_request_item_id = source.job_request_item_id AND o.supplier_id = p_supplier_id
        AND oi.is_active AND o.is_active AND o.status <> 'closed_lost';
    IF source.demanded_quantity IS NOT NULL AND demand + already_ordered > source.demanded_quantity THEN RAISE EXCEPTION 'Order exceeds remaining requested quantity'; END IF;
    IF source.available_quantity IS NOT NULL AND source.status <> 'can_order' AND demand + already_ordered > source.available_quantity THEN
      RAISE EXCEPTION 'Order exceeds supplier available quantity'; END IF;
    INSERT INTO public.order_items(order_id, name, size, quantity, unit_price, status, note_for_supplier, note_for_customer)
      VALUES (order_id, source.name, source.size, demand, source.unit_price,
        CASE WHEN source.status = 'can_order' THEN 'need_to_order' ELSE coalesce(source.status, 'pending') END,
        nullif(concat_ws(E'\n\n', nullif(btrim(source.note_for_supplier), ''), nullif(btrim(source.note_from_supplier), '')), ''),
        (SELECT string_agg(DISTINCT ji.note_for_customer, E'\n\n' ORDER BY ji.note_for_customer)
          FROM public.job_request_items ji WHERE ji.id IN
            (SELECT (a->>'job_request_item_id')::bigint FROM jsonb_array_elements(line->'allocations') a)))
      RETURNING id INTO line_id;
    FOR allocation IN SELECT * FROM jsonb_array_elements(line->'allocations') LOOP
      allocated := (allocation->>'quantity')::numeric;
      IF allocated IS NULL OR allocated <= 0 OR allocated >= 'Infinity'::numeric THEN RAISE EXCEPTION 'Positive finite allocations are required'; END IF;
      SELECT * INTO demand_item FROM public.job_request_items WHERE id = (allocation->>'job_request_item_id')::bigint AND is_active;
      IF NOT FOUND THEN RAISE EXCEPTION 'Active job line not found'; END IF;
      IF demand_item.id IS DISTINCT FROM source.job_request_item_id THEN RAISE EXCEPTION 'Job line is not allocated to this availability line'; END IF;
      SELECT coalesce(sum(a.quantity), 0) INTO already_ordered FROM public.order_item_job_request_items a
        JOIN public.order_items oi ON oi.id = a.order_item_id JOIN public.orders o ON o.id = oi.order_id
        WHERE a.job_request_item_id = demand_item.id AND oi.is_active AND o.is_active AND o.status <> 'closed_lost';
      IF demand_item.demanded_quantity IS NOT NULL AND allocated + already_ordered > demand_item.demanded_quantity THEN RAISE EXCEPTION 'Order exceeds remaining customer demand'; END IF;
      INSERT INTO public.order_item_job_request_items VALUES (line_id, demand_item.id, allocated);
      UPDATE public.job_requests SET status = 'committed' WHERE id = demand_item.job_request_id AND status IN ('quoted', 'availability');
    END LOOP;
  END LOOP;
  RETURN order_id;
END $function$;

CREATE OR REPLACE FUNCTION public.availability_request_reopen_on_new_line()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.availability_request_id IS NULL OR (TG_OP = 'UPDATE'
    AND NEW.availability_request_id IS NOT DISTINCT FROM OLD.availability_request_id)
    OR current_setting('lps.applying_offer', true) = 'on'
    OR current_setting('lps.ar_supplier_answer', true) = 'on' THEN
    RETURN NULL;
  END IF;
  UPDATE public.availability_requests SET status = 'new'
    WHERE id = NEW.availability_request_id AND status IN ('processing', 'submitted');
  RETURN NULL;
END $function$;

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
  -- Lock candidate parent rows before examining their associations. This also
  -- serializes against order/AR creation and attachment through foreign keys.
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
  DELETE FROM public.orders WHERE id=ANY(order_ids);
  GET DIAGNOSTICS order_count=ROW_COUNT;
  -- Job deletion closes its ARs and keeps their supplier snapshots.
  -- Candidates never asked on an AR go with the job.
  UPDATE public.availability_requests SET status='closed',public_token=NULL WHERE id=ANY(ar_ids);
  -- ARs were retained, so the deletion count remains zero.
  DELETE FROM public.candidates c USING public.job_request_items ji
    WHERE ji.id=c.job_request_item_id AND ji.job_request_id=OLD.id AND c.availability_request_id IS NULL;
  INSERT INTO public.deleted_job_threads(agent,thread_id,job_request_id,deleted_counts)
    VALUES ('rosie','jr-'||OLD.id,OLD.id,jsonb_build_object('items',item_count,'changelog',history_count,
      'availabilityRequests',ar_count,'availabilityRequestItems',ar_items,'orders',order_count,
      'orderItems',order_items_count,'threads',thread_count,'answers',0));
  RETURN OLD;
END $function$;

CREATE OR REPLACE FUNCTION public.answer_availability_request(p_request_id bigint, p_supplier_id bigint, p_item_id bigint DEFAULT NULL::bigint, p_changes jsonb DEFAULT NULL::jsonb, p_submit boolean DEFAULT false)
 RETURNS bigint
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE ar public.availability_requests; cur public.candidates; k text; next_status text;
  next_offer bigint; next_description text; has_offer boolean; typed boolean; prev_typed boolean;
BEGIN
  SELECT * INTO ar FROM public.availability_requests
    WHERE id = p_request_id AND supplier_id = p_supplier_id  AND status <> 'closed'
      AND (status <> 'draft' OR current_setting('lps.ar_admin_edit', true) = 'on') FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM public.suppliers WHERE id = ar.supplier_id AND is_active) THEN
    RAISE EXCEPTION 'This request is closed, draft or unavailable';
  END IF;
  IF p_submit THEN
    UPDATE public.availability_requests SET status = 'submitted', submitted_at = now() WHERE id = ar.id;
    RETURN ar.id;
  END IF;
  PERFORM set_config('lps.ar_supplier_answer', CASE WHEN current_setting('lps.ar_admin_edit', true) = 'on' THEN 'off' ELSE 'on' END, true);
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
  UPDATE public.availability_requests SET status = CASE
    WHEN ar.status = 'draft' THEN 'draft'
    WHEN current_setting('lps.ar_admin_edit', true) = 'on' THEN 'new'
    ELSE 'processing' END WHERE id = ar.id;
  PERFORM set_config('lps.ar_supplier_answer', 'off', true);
  RETURN ar.id;
END $function$;

CREATE OR REPLACE FUNCTION public.add_candidates_to_availability_request(p_request_id bigint, p_candidate_ids bigint[])
 RETURNS bigint
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE ar public.availability_requests; attached bigint;
BEGIN
  IF coalesce(cardinality(p_candidate_ids), 0) = 0 THEN RAISE EXCEPTION 'Candidates are required'; END IF;
  SELECT * INTO ar FROM public.availability_requests WHERE id = p_request_id  AND status <> 'closed' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'This request is closed or deleted'; END IF;
  UPDATE public.candidates c SET availability_request_id = ar.id,
      demanded_quantity = coalesce(c.demanded_quantity, ji.demanded_quantity)
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

CREATE OR REPLACE FUNCTION public.request_candidate_availability(p_candidate_id bigint)
 RETURNS bigint
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE c public.candidates; job_id bigint; request_id bigint;
BEGIN
  SELECT * INTO c FROM public.candidates WHERE id = p_candidate_id AND is_active FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Candidate not found'; END IF;
  IF c.availability_request_id IS NOT NULL THEN RETURN c.availability_request_id; END IF;
  SELECT job_request_id INTO job_id FROM public.job_request_items WHERE id = c.job_request_item_id;
  SELECT id INTO request_id FROM public.availability_requests
    WHERE job_request_id = job_id AND supplier_id = c.supplier_id
       AND status IN ('draft', 'new', 'processing')
    ORDER BY id DESC LIMIT 1;
  IF request_id IS NOT NULL THEN
    RETURN public.add_candidates_to_availability_request(request_id, ARRAY[p_candidate_id]);
  END IF;
  RETURN public.create_availability_request(c.supplier_id, ARRAY[p_candidate_id], false, NULL);
END $function$;

CREATE OR REPLACE FUNCTION public.create_availability_request(p_supplier_id bigint, p_candidate_ids bigint[], p_share_customer_details boolean DEFAULT false, p_public_token uuid DEFAULT NULL::uuid)
 RETURNS bigint
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE request_id bigint; job_id bigint; job_count bigint;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.suppliers WHERE id = p_supplier_id AND is_active) THEN
    RAISE EXCEPTION 'Active supplier required';
  END IF;
  SELECT min(ji.job_request_id), count(DISTINCT ji.job_request_id) INTO job_id, job_count
    FROM public.candidates c JOIN public.job_request_items ji ON ji.id = c.job_request_item_id
    WHERE c.id = ANY(p_candidate_ids);
  IF job_count <> 1 THEN RAISE EXCEPTION 'An availability request asks for one job''s candidates'; END IF;
  -- Lock customer demand before the supplier request, the same order as closure.
  PERFORM 1 FROM public.job_requests WHERE id = job_id FOR UPDATE;
  INSERT INTO public.availability_requests(supplier_id, job_request_id, status, share_customer_details, public_token)
    VALUES (p_supplier_id, job_id, 'draft', p_share_customer_details, p_public_token) RETURNING id INTO request_id;
  RETURN public.add_candidates_to_availability_request(request_id, p_candidate_ids);
END $function$;

CREATE OR REPLACE FUNCTION public.send_availability_request(p_request_id bigint)
 RETURNS bigint
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE ar public.availability_requests;
BEGIN
  SELECT * INTO ar FROM public.availability_requests WHERE id = p_request_id  FOR UPDATE;
  IF NOT FOUND OR ar.status <> 'draft' THEN RAISE EXCEPTION 'Only a draft request can be published'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.candidates WHERE availability_request_id = ar.id AND is_active) THEN
    RAISE EXCEPTION 'Add at least one candidate before publishing';
  END IF;
  UPDATE public.availability_requests SET status = 'new',
      public_token = CASE WHEN public_token IS NULL AND NOT EXISTS (
        SELECT 1 FROM public.suppliers WHERE id = ar.supplier_id AND is_lps_partner) THEN gen_random_uuid()
        ELSE public_token END
    WHERE id = ar.id;
  RETURN ar.id;
END $function$;

CREATE OR REPLACE FUNCTION public.close_ar_on_job_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Job reopening never restores ARs. Deleted ARs retain their saved state.
  IF NEW.is_active AND NEW.status NOT IN ('closed_won', 'closed_lost', 'archived') THEN RETURN NEW; END IF;
  UPDATE public.availability_requests SET status = 'closed', public_token = NULL
    WHERE job_request_id = NEW.id AND (status <> 'closed' OR public_token IS NOT NULL);
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.submit_public_availability_note(p_token uuid, p_note text)
 RETURNS bigint
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE ar public.availability_requests;
BEGIN
  SELECT * INTO ar FROM public.availability_requests
    WHERE public_token = p_token  AND status NOT IN ('closed', 'draft') FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'This link is no longer available'; END IF;
  RETURN public.submit_availability_request_note(ar.id, ar.supplier_id, p_note);
END $function$;

CREATE OR REPLACE FUNCTION public.guard_candidate_write()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE ar public.availability_requests;
BEGIN
  IF NEW.availability_request_id IS NULL OR current_setting('lps.line_sync', true) = 'on' THEN RETURN NEW; END IF;
  SELECT * INTO ar FROM public.availability_requests
    WHERE id = NEW.availability_request_id FOR UPDATE;
  IF NOT FOUND OR ar.status = 'closed' THEN
    RAISE EXCEPTION 'This request is closed or unavailable';
  END IF;
  IF ar.supplier_id <> NEW.supplier_id THEN
    RAISE EXCEPTION 'Candidate supplier must match the request supplier';
  END IF;
  IF NEW.job_request_item_id IS NOT NULL AND ar.job_request_id IS DISTINCT FROM
    (SELECT job_request_id FROM public.job_request_items WHERE id = NEW.job_request_item_id) THEN
    RAISE EXCEPTION 'Candidate must be asked on its own job''s request';
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.submit_availability_request_note(p_request_id bigint, p_supplier_id bigint, p_note text)
 RETURNS bigint
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF length(p_note) > 10000 THEN RAISE EXCEPTION 'Supplier note must be 10000 characters or fewer'; END IF;
  -- Existing submission locks and verifies the active request and supplier,
  -- rejects closed requests, and stamps submitted_at in this transaction.
  PERFORM public.answer_availability_request(p_request_id, p_supplier_id, p_submit => true);
  PERFORM set_config('lps.ar_supplier_note', 'on', true);
  UPDATE public.availability_requests SET note_for_supplier = nullif(btrim(p_note), '') WHERE id = p_request_id;
  PERFORM set_config('lps.ar_supplier_note', 'off', true);
  RETURN p_request_id;
END $function$;

CREATE OR REPLACE FUNCTION public.answer_public_availability(p_token uuid, p_item_id bigint DEFAULT NULL::bigint, p_changes jsonb DEFAULT NULL::jsonb, p_submit boolean DEFAULT false)
 RETURNS bigint
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE ar public.availability_requests;
BEGIN
  SELECT * INTO ar FROM public.availability_requests
    WHERE public_token = p_token  AND status NOT IN ('closed', 'draft') FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'This link is no longer available'; END IF;
  RETURN public.answer_availability_request(ar.id, ar.supplier_id, p_item_id, p_changes, p_submit);
END $function$;

CREATE OR REPLACE FUNCTION public.advance_linked_job_on_partner_request()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.job_request_id IS NOT NULL AND NEW.status NOT IN ('draft', 'closed')
    AND (TG_OP = 'INSERT' OR OLD.status = 'draft') AND EXISTS (
    SELECT 1 FROM public.suppliers s WHERE s.id = NEW.supplier_id AND s.is_active AND s.is_lps_partner) THEN
    PERFORM public.record_job_workflow_event(NEW.job_request_id, 'availability_sent');
  END IF;
  RETURN NULL;
END $function$;

-- All content changes, including note-only edits, additions and removals, return
-- a published ask to New. Drafts stay private; closed history stays closed.
CREATE OR REPLACE FUNCTION public.process_availability_answer() RETURNS trigger
LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
  IF (current_setting('lps.applying_offer', true) = 'on'
      AND current_setting('lps.line_sync', true) IS DISTINCT FROM 'on')
    OR current_setting('lps.ar_submission', true) = 'on'
    OR current_setting('lps.ar_supplier_answer', true) = 'on' THEN RETURN NULL; END IF;
  IF (to_jsonb(NEW) - ARRAY['updated_at', 'answered_at'])
    IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['updated_at', 'answered_at']) THEN
    UPDATE public.availability_requests SET status='new', submitted_at=NULL
      WHERE id IN (OLD.availability_request_id, NEW.availability_request_id)
        AND status NOT IN ('draft', 'closed');
  END IF;
  RETURN NULL;
END $function$;
DROP TRIGGER candidates_processing ON public.candidates;
CREATE TRIGGER candidates_processing AFTER UPDATE ON public.candidates
  FOR EACH ROW EXECUTE FUNCTION public.process_availability_answer();

CREATE OR REPLACE FUNCTION public.apply_submitted_candidates() RETURNS trigger
LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
  PERFORM set_config('lps.ar_submission', 'on', true);
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
  PERFORM set_config('lps.ar_submission', 'off', true);
  RETURN NULL;
END $function$;

-- Admins prepare draft answers and correct published answers using the same
-- validation and substitute handling as suppliers, but without supplier progress.
CREATE FUNCTION public.edit_availability_request(p_request_id bigint, p_supplier_id bigint,
  p_item_id bigint, p_changes jsonb)
RETURNS bigint LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE result bigint;
BEGIN
  PERFORM set_config('lps.ar_admin_edit', 'on', true);
  result := public.answer_availability_request(p_request_id, p_supplier_id, p_item_id, p_changes, false);
  PERFORM set_config('lps.ar_admin_edit', 'off', true);
  RETURN result;
END $function$;
REVOKE ALL ON FUNCTION public.edit_availability_request(bigint,bigint,bigint,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.edit_availability_request(bigint,bigint,bigint,jsonb) TO service_role;

CREATE FUNCTION public.prevent_availability_request_delete() RETURNS trigger
LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
  RAISE EXCEPTION 'Availability requests cannot be deleted. Move the request to Draft to hide it from the supplier.';
END $function$;
CREATE TRIGGER availability_requests_no_delete BEFORE DELETE ON public.availability_requests
  FOR EACH ROW EXECUTE FUNCTION public.prevent_availability_request_delete();
CREATE TRIGGER availability_requests_no_truncate BEFORE TRUNCATE ON public.availability_requests
  FOR EACH STATEMENT EXECUTE FUNCTION public.prevent_availability_request_delete();

COMMENT ON COLUMN public.availability_requests.status IS
  'draft = private LPS preparation; publish via send_availability_request to new; LPS content edits return published requests to new; supplier answers move to processing, submission to submitted; closed = retained read-only history. AR deletion is prohibited.';
NOTIFY pgrst, 'reload schema';
COMMIT;
