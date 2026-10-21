-- 0151 — an order's additional details are JSON (2026-10-21)
--
-- (Bhoumik 2026-10-21) "let additional details be json instead of markdown."
-- orders.additional_details becomes jsonb: an ordered list of
-- {"field": "...", "value": "..."} (jsonb keeps array order, not object key
-- order), e.g. [{"field": "Customer", "value": "Lake Landscapes"}, ...].
-- * Existing markdown converts: each `| Field | value |` pair becomes an item
--   (header and `| --- |` rows dropped); any other text becomes one last
--   "Notes" item. Old text backed up in orders_pre_0151.
-- * CHECK public.is_order_details: NULL, or 1–50 objects with exactly
--   non-blank string "field" (≤ 100) and "value" (≤ 2000).
-- * create_order's p_additional_details and update_partner_order's
--   additional_details take that list; [] or null clears.
-- Rollback: drop the constraint, ALTER COLUMN additional_details TYPE text
-- USING (SELECT b.additional_details FROM orders_pre_0151 b WHERE b.id = orders.id)
-- (orders made since lose their details), and re-run 0149's create_order and
-- 0150's update_partner_order.
BEGIN;
SET LOCAL lock_timeout = '1s';
SET LOCAL statement_timeout = '30s';

CREATE TABLE public.orders_pre_0151 AS SELECT id, additional_details FROM public.orders;
ALTER TABLE public.orders_pre_0151 ADD PRIMARY KEY (id);
ALTER TABLE public.orders_pre_0151 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.orders_pre_0151 FROM PUBLIC, anon, authenticated;
COMMENT ON TABLE public.orders_pre_0151 IS 'orders.additional_details as markdown, before 0151 made them JSON.';

CREATE FUNCTION public.is_order_details(p jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path TO 'public' AS $function$
DECLARE e jsonb;
BEGIN
  IF p IS NULL THEN RETURN true; END IF;
  IF jsonb_typeof(p) <> 'array' OR jsonb_array_length(p) NOT BETWEEN 1 AND 50 THEN RETURN false; END IF;
  FOR e IN SELECT value FROM jsonb_array_elements(p) LOOP
    IF jsonb_typeof(e) <> 'object' THEN RETURN false; END IF;
    IF (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(e) k) IS DISTINCT FROM ARRAY['field', 'value'] THEN RETURN false; END IF;
    IF jsonb_typeof(e->'field') <> 'string' OR jsonb_typeof(e->'value') <> 'string' THEN RETURN false; END IF;
    IF btrim(e->>'field') = '' OR btrim(e->>'value') = ''
      OR length(e->>'field') > 100 OR length(e->>'value') > 2000 THEN RETURN false; END IF;
  END LOOP;
  RETURN true;
END $function$;
COMMENT ON FUNCTION public.is_order_details(jsonb) IS
  'orders.additional_details shape: NULL or 1–50 {"field","value"} objects of non-blank text (field ≤ 100, value ≤ 2000).';

CREATE OR REPLACE FUNCTION pg_temp.details_json(t text) RETURNS jsonb LANGUAGE plpgsql AS $function$
DECLARE
  lines text[]; line text; cells text[]; i int; j int;
  result jsonb := '[]'; notes text[] := '{}';
  sep constant text := '^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$';
BEGIN
  IF t IS NULL OR btrim(t) = '' THEN RETURN NULL; END IF;
  lines := regexp_split_to_array(t, E'\r?\n');
  FOR i IN 1..array_length(lines, 1) LOOP
    line := btrim(lines[i]);
    IF left(line, 1) = '|' THEN
      -- Skip separators and the header row above one.
      CONTINUE WHEN line ~ sep OR (i < array_length(lines, 1) AND lines[i + 1] ~ sep);
      cells := regexp_split_to_array(regexp_replace(regexp_replace(line, '^\|', ''), '\|$', ''), '\|');
      j := 1;
      WHILE j <= array_length(cells, 1) LOOP
        IF btrim(cells[j]) <> '' AND btrim(coalesce(cells[j + 1], '')) <> '' THEN
          result := result || jsonb_build_array(jsonb_build_object('field', btrim(cells[j]), 'value', btrim(cells[j + 1])));
        END IF;
        j := j + 2;
      END LOOP;
    ELSIF line <> '' THEN
      notes := notes || line;
    END IF;
  END LOOP;
  IF cardinality(notes) > 0 THEN
    result := result || jsonb_build_array(jsonb_build_object('field', 'Notes', 'value', array_to_string(notes, E'\n')));
  END IF;
  RETURN nullif(result, '[]'::jsonb);
END $function$;

ALTER TABLE public.orders ALTER COLUMN additional_details TYPE jsonb USING pg_temp.details_json(additional_details);
ALTER TABLE public.orders ADD CONSTRAINT orders_additional_details_check CHECK (public.is_order_details(additional_details));
COMMENT ON COLUMN public.orders.additional_details IS
  'What the supplier needs to fulfil the order, as an ordered JSON list of {"field","value"} (customer, delivery address, delivery and billing contacts, payment method, other delivery facts) where known. Pickup/delivery and the date are the job''s; the change log is change_log.';

DROP FUNCTION public.create_order(bigint, bigint, bigint[], text);
CREATE FUNCTION public.create_order(p_job_request_id bigint, p_supplier_id bigint, p_job_request_item_ids bigint[],
    p_additional_details jsonb DEFAULT NULL)
RETURNS bigint LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE job public.job_requests; line public.job_request_items; c public.candidates;
  v_order bigint; v_item bigint; taken bigint; qty numeric;
  details jsonb := nullif(nullif(p_additional_details, 'null'::jsonb), '[]'::jsonb);
BEGIN
  IF p_job_request_item_ids IS NULL OR cardinality(p_job_request_item_ids) = 0 THEN
    RAISE EXCEPTION 'Choose at least one job line to order';
  END IF;
  IF NOT public.is_order_details(details) THEN
    RAISE EXCEPTION 'Additional details must be a list of {"field", "value"} texts';
  END IF;
  -- The job row lock serialises orders for the job.
  SELECT * INTO job FROM public.job_requests WHERE id = p_job_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Job request not found'; END IF;
  IF NOT job.is_active OR job.status IN ('closed_won', 'closed_lost', 'archived') THEN
    RAISE EXCEPTION 'This job request is closed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.suppliers WHERE id = p_supplier_id AND is_active) THEN
    RAISE EXCEPTION 'Active supplier required';
  END IF;
  -- One open order per job and supplier: more lines go onto it.
  SELECT id INTO v_order FROM public.orders
    WHERE job_request_id = job.id AND supplier_id = p_supplier_id AND is_active
      AND status IN ('new', 'processing', 'order_ready')
    FOR UPDATE;
  IF v_order IS NULL THEN
    INSERT INTO public.orders(job_request_id, supplier_id, additional_details)
      VALUES (job.id, p_supplier_id, details)
      RETURNING id INTO v_order;
  END IF;
  FOREACH v_item IN ARRAY (SELECT array_agg(DISTINCT x ORDER BY x) FROM unnest(p_job_request_item_ids) x) LOOP
    SELECT * INTO line FROM public.job_request_items
      WHERE id = v_item AND job_request_id = job.id AND is_active;
    IF NOT FOUND THEN RAISE EXCEPTION 'Job line % is not an active line of JR-%', v_item, job.id; END IF;
    SELECT * INTO c FROM public.candidates WHERE id = line.selected_candidate_id FOR UPDATE;
    IF c.supplier_id <> p_supplier_id THEN
      RAISE EXCEPTION '% is selected from another supplier', line.name;
    END IF;
    SELECT oi.order_id INTO taken FROM public.order_items oi WHERE oi.candidate_id = c.id;
    IF FOUND THEN
      RAISE EXCEPTION '% is already on order O-%', coalesce(c.description, c.name), taken;
    END IF;
    -- The quantity the job line shows available, else its Qty.
    qty := coalesce(nullif(least(c.available_quantity, line.demanded_quantity), 0), line.demanded_quantity);
    IF qty IS NULL THEN RAISE EXCEPTION 'Set a quantity for % before ordering', line.name; END IF;
    INSERT INTO public.order_items(order_id, candidate_id, name, size, quantity, unit_price, status,
        note_for_supplier, note_from_supplier)
      VALUES (v_order, c.id, c.name, coalesce(c.size, line.size), qty, c.unit_price,
        CASE WHEN c.status IS NULL THEN 'pending' WHEN c.status = 'can_order' THEN 'need_to_order' ELSE c.status END,
        nullif(btrim(c.note_for_supplier), ''), nullif(btrim(c.note_from_supplier), ''));
  END LOOP;
  UPDATE public.job_requests SET status = 'committed' WHERE id = job.id AND status IN ('quoted', 'availability');
  RETURN v_order;
END $function$;

CREATE OR REPLACE FUNCTION public.update_partner_order(p_order_id bigint, p_supplier_id bigint, p_patch jsonb)
RETURNS bigint LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE current_order public.orders; next_status text; next_details jsonb; next_log text; next_reply text;
BEGIN
  IF jsonb_typeof(p_patch) IS DISTINCT FROM 'object' OR p_patch = '{}'::jsonb THEN
    RAISE EXCEPTION 'Order update is required'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_object_keys(p_patch) key
    WHERE key NOT IN ('status', 'additional_details', 'change_log', 'note_from_supplier')) THEN
    RAISE EXCEPTION 'Unsupported order update'; END IF;
  -- Job before order, as create_order and close_order lock.
  PERFORM 1 FROM public.job_requests j JOIN public.orders o ON o.job_request_id = j.id
    WHERE o.id = p_order_id AND o.supplier_id = p_supplier_id FOR UPDATE OF j;
  SELECT o.* INTO current_order FROM public.orders o JOIN public.suppliers s ON s.id = o.supplier_id
    WHERE o.id = p_order_id AND o.supplier_id = p_supplier_id AND o.is_active AND s.is_active FOR UPDATE OF o;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order is unavailable'; END IF;
  IF current_order.status NOT IN ('new', 'processing', 'order_ready') OR NOT EXISTS (
    SELECT 1 FROM public.job_requests j WHERE j.id = current_order.job_request_id AND j.is_active
      AND j.status NOT IN ('closed_won', 'closed_lost', 'archived')) THEN
    RAISE EXCEPTION 'Closed orders cannot be changed'; END IF;
  next_status := current_order.status;
  IF p_patch ? 'status' THEN
    next_status := p_patch->>'status';
    IF next_status IS NULL OR NOT (
      (current_order.status = 'new' AND next_status = 'processing') OR
      (current_order.status = 'processing' AND next_status = 'order_ready')
    ) THEN RAISE EXCEPTION 'Orders move from New to Processing to Order Ready'; END IF;
  END IF;
  next_details := current_order.additional_details;
  IF p_patch ? 'additional_details' THEN
    next_details := nullif(nullif(p_patch->'additional_details', 'null'::jsonb), '[]'::jsonb);
    IF NOT public.is_order_details(next_details) THEN
      RAISE EXCEPTION 'Additional details must be a list of {"field", "value"} texts'; END IF;
  END IF;
  next_log := current_order.change_log;
  IF p_patch ? 'change_log' THEN
    IF jsonb_typeof(p_patch->'change_log') NOT IN ('string', 'null') THEN
      RAISE EXCEPTION 'Change log must be text'; END IF;
    IF length(p_patch->>'change_log') > 10000 THEN
      RAISE EXCEPTION 'Change log must be 10000 characters or fewer'; END IF;
    next_log := nullif(btrim(p_patch->>'change_log'), '');
  END IF;
  next_reply := current_order.note_from_supplier;
  IF p_patch ? 'note_from_supplier' THEN
    IF jsonb_typeof(p_patch->'note_from_supplier') NOT IN ('string', 'null') THEN
      RAISE EXCEPTION 'Note from supplier must be text'; END IF;
    IF length(p_patch->>'note_from_supplier') > 10000 THEN
      RAISE EXCEPTION 'Note from supplier must be 10000 characters or fewer'; END IF;
    next_reply := nullif(btrim(p_patch->>'note_from_supplier'), '');
  END IF;
  UPDATE public.orders SET status = next_status, additional_details = next_details, change_log = next_log,
    note_from_supplier = next_reply,
    confirmation_date = CASE WHEN current_order.status = 'new' AND next_status = 'processing'
      THEN coalesce(current_order.confirmation_date, CURRENT_DATE) ELSE confirmation_date END
    WHERE id = p_order_id;
  RETURN p_order_id;
END $function$;

REVOKE ALL ON FUNCTION public.create_order(bigint, bigint, bigint[], jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_order(bigint, bigint, bigint[], jsonb) TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
