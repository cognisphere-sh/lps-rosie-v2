-- Use one author/audience vocabulary across jobs, requests, orders and their lines.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE public.job_requests RENAME COLUMN customer_notes TO note_from_customer;
ALTER TABLE public.job_requests RENAME COLUMN sourcing_notes TO note_internal;
ALTER TABLE public.job_requests RENAME COLUMN external_notes TO note_for_customer;
ALTER TABLE public.job_request_items RENAME COLUMN customer_notes TO note_from_customer;
ALTER TABLE public.job_request_items RENAME COLUMN sourcing_notes TO note_internal;
ALTER TABLE public.job_request_items RENAME COLUMN external_notes TO note_for_customer;
ALTER TABLE public.availability_requests RENAME COLUMN supplier_notes TO note_from_supplier;
ALTER TABLE public.availability_requests RENAME COLUMN lps_notes TO note_for_supplier;
ALTER TABLE public.availability_request_items RENAME COLUMN supplier_notes TO note_from_supplier;
ALTER TABLE public.availability_request_items RENAME COLUMN lps_notes TO note_for_supplier;
ALTER TABLE public.orders RENAME COLUMN supplier_notes TO note_from_supplier;
ALTER TABLE public.orders RENAME COLUMN notes TO note_for_supplier;
ALTER TABLE public.orders ADD COLUMN note_from_customer text, ADD COLUMN note_for_customer text;
ALTER TABLE public.order_items RENAME COLUMN notes TO note_from_supplier;
ALTER TABLE public.order_items ADD COLUMN note_for_supplier text, ADD COLUMN note_for_customer text;

-- Old AR-backed order lines copied supplier_notes; direct quote orders copied
-- external_notes. Preserve those exact snapshots under their respective authors.
-- The transfer must not alter the historical modification timestamps.
ALTER TABLE public.order_items DISABLE TRIGGER handle_updated_at;
UPDATE public.order_items SET note_for_customer = note_from_supplier, note_from_supplier = NULL
  WHERE availability_request_item_id IS NULL AND note_from_supplier IS NOT NULL;
ALTER TABLE public.order_items ENABLE TRIGGER handle_updated_at;
COMMENT ON COLUMN public.job_requests.note_from_customer IS 'Information supplied by the customer, including requirements and additional context.';
COMMENT ON COLUMN public.job_requests.note_for_customer IS 'LPS/Chris communication intended for the customer; may summarize a supplier response.';
COMMENT ON COLUMN public.job_request_items.note_from_customer IS 'Information supplied by the customer, including requirements and additional context.';
COMMENT ON COLUMN public.job_request_items.note_for_customer IS 'LPS/Chris communication intended for the customer; may summarize a supplier response.';
COMMENT ON COLUMN public.orders.note_from_customer IS 'Information supplied by the customer, including requirements and additional context.';
COMMENT ON COLUMN public.orders.note_for_customer IS 'LPS/Chris communication intended for the customer; may summarize a supplier response.';
COMMENT ON COLUMN public.order_items.note_for_customer IS 'LPS/Chris communication intended for the customer; may summarize a supplier response.';
COMMENT ON COLUMN public.job_requests.note_internal IS 'Internal LPS/Chris sourcing progress and updates from supplier availability requests and orders; never shared externally.';
COMMENT ON COLUMN public.job_request_items.note_internal IS 'Internal LPS/Chris sourcing progress and updates from supplier availability requests and orders; never shared externally.';
COMMENT ON COLUMN public.availability_requests.note_from_supplier IS 'Information and responses supplied by the supplier.';
COMMENT ON COLUMN public.availability_requests.note_for_supplier IS 'LPS/Chris instructions intended for the supplier, including relevant customer requirements.';
COMMENT ON COLUMN public.availability_request_items.note_from_supplier IS 'Information and responses supplied by the supplier.';
COMMENT ON COLUMN public.availability_request_items.note_for_supplier IS 'LPS/Chris instructions intended for the supplier, including relevant customer requirements.';
COMMENT ON COLUMN public.orders.note_from_supplier IS 'Information and responses supplied by the supplier.';
COMMENT ON COLUMN public.orders.note_for_supplier IS 'LPS/Chris instructions intended for the supplier, including relevant customer requirements.';
COMMENT ON COLUMN public.order_items.note_from_supplier IS 'Information and responses supplied by the supplier.';
COMMENT ON COLUMN public.order_items.note_for_supplier IS 'LPS/Chris instructions intended for the supplier, including relevant customer requirements.';

CREATE OR REPLACE FUNCTION public.create_availability_request(p_supplier_id bigint, p_items jsonb, p_share_customer_details boolean DEFAULT false, p_public_token uuid DEFAULT NULL::uuid)
 RETURNS bigint
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE line jsonb; allocation jsonb; job public.job_requests; item public.job_request_items;
  request_id bigint; line_id bigint; linked_job_ids bigint[] := '{}'; demand numeric; allocation_total numeric; unknown_quantity boolean;
BEGIN
  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Availability items are required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.suppliers WHERE id = p_supplier_id AND is_active) THEN
    RAISE EXCEPTION 'Active supplier required';
  END IF;
  -- Lock customer demand before the supplier request, the same order as closure.
  FOR job IN SELECT j.* FROM public.job_requests j WHERE j.id IN (
    SELECT ji.job_request_id FROM public.job_request_items ji WHERE ji.id IN (
      SELECT (a->>'job_request_item_id')::bigint FROM jsonb_array_elements(p_items) l,
        LATERAL jsonb_array_elements(l->'allocations') a
    )) ORDER BY j.id FOR UPDATE LOOP
    IF NOT job.is_active OR job.status IN ('closed_won', 'closed_lost', 'archived') THEN
      RAISE EXCEPTION 'This job request is closed';
    END IF;
    linked_job_ids := array_append(linked_job_ids, job.id);
  END LOOP;
  IF cardinality(linked_job_ids) = 0 THEN RAISE EXCEPTION 'Job allocations are required'; END IF;
  INSERT INTO public.availability_requests(supplier_id, share_customer_details, public_token)
    VALUES (p_supplier_id, p_share_customer_details, p_public_token) RETURNING id INTO request_id;
  -- Establish every validated header link before line triggers update the AR.
  INSERT INTO public.availability_request_jobs(availability_request_id, job_request_id)
    SELECT request_id, linked_job_id FROM unnest(linked_job_ids) AS jobs(linked_job_id)
    ORDER BY linked_job_id;
  FOR line IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    IF jsonb_typeof(line->'allocations') IS DISTINCT FROM 'array' OR jsonb_array_length(line->'allocations') = 0
      OR nullif(trim(line->>'name'), '') IS NULL THEN RAISE EXCEPTION 'Named lines with job allocations are required'; END IF;
    demand := (line->>'demanded_quantity')::numeric;
    IF demand <= 0 OR demand >= 'Infinity'::numeric THEN RAISE EXCEPTION 'Known quantities must be positive and finite'; END IF;
    INSERT INTO public.availability_request_items(availability_request_id, name, size, demanded_quantity, unit_price, mapped_inventory_id, note_for_supplier)
      VALUES (request_id, line->>'name', line->>'size', demand, (line->>'unit_price')::numeric,
        (line->>'mapped_inventory_id')::uuid, line->>'note_for_supplier') RETURNING id INTO line_id;
    allocation_total := 0;
    unknown_quantity := false;
    FOR allocation IN SELECT * FROM jsonb_array_elements(line->'allocations') LOOP
      SELECT * INTO item FROM public.job_request_items WHERE id = (allocation->>'job_request_item_id')::bigint AND is_active;
      IF NOT FOUND THEN RAISE EXCEPTION 'Active job line not found'; END IF;
      IF (allocation->>'quantity')::numeric <= 0 OR (allocation->>'quantity')::numeric >= 'Infinity'::numeric THEN
        RAISE EXCEPTION 'Known allocations must be positive and finite'; END IF;
      INSERT INTO public.availability_request_item_jobs VALUES (line_id, item.id, (allocation->>'quantity')::numeric);
      unknown_quantity := unknown_quantity OR (allocation->>'quantity') IS NULL;
      allocation_total := allocation_total + coalesce((allocation->>'quantity')::numeric, 0);
    END LOOP;
    IF (unknown_quantity AND demand IS NOT NULL) OR (NOT unknown_quantity AND demand IS DISTINCT FROM allocation_total) THEN
      RAISE EXCEPTION 'Allocations must equal requested quantity'; END IF;
  END LOOP;
  RETURN request_id;
END $function$;

CREATE OR REPLACE FUNCTION public.process_availability_answer()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  -- An inserted catalogue price is still an unanswered ask. Saving an answer
  -- (from a portal, public link or an agent entering a supplier reply) starts work.
  IF ROW(NEW.status, NEW.available_quantity, NEW.unit_price, NEW.note_from_supplier)
    IS DISTINCT FROM ROW(OLD.status, OLD.available_quantity, OLD.unit_price, OLD.note_from_supplier) THEN
    UPDATE public.availability_requests SET status = 'processing'
    WHERE id = NEW.availability_request_id AND is_active AND status <> 'closed';
  END IF;
  RETURN NULL;
END $function$;

CREATE OR REPLACE FUNCTION public.answer_availability_request(p_request_id bigint, p_supplier_id bigint, p_item_id bigint DEFAULT NULL::bigint, p_changes jsonb DEFAULT NULL::jsonb, p_submit boolean DEFAULT false)
 RETURNS bigint
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE ar public.availability_requests; k text;
BEGIN
  SELECT * INTO ar FROM public.availability_requests
    WHERE id = p_request_id AND supplier_id = p_supplier_id AND is_active AND status <> 'closed' FOR UPDATE;
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
      IF k NOT IN ('status', 'available_quantity', 'unit_price', 'note_from_supplier') OR jsonb_typeof(p_changes->k) <> 'string' THEN
        RAISE EXCEPTION 'Invalid answer field';
      END IF;
    END LOOP;
    FOREACH k IN ARRAY ARRAY['available_quantity', 'unit_price'] LOOP
      IF p_changes ? k AND nullif(trim(p_changes->>k), '')::numeric::text IN ('NaN', 'Infinity', '-Infinity') THEN
        RAISE EXCEPTION 'Answer numbers must be finite';
      END IF;
    END LOOP;
    UPDATE public.availability_request_items SET
      status = CASE WHEN p_changes ? 'status' THEN nullif(trim(p_changes->>'status'), '') ELSE status END,
      available_quantity = CASE WHEN p_changes ? 'available_quantity' THEN nullif(trim(p_changes->>'available_quantity'), '')::numeric ELSE available_quantity END,
      unit_price = CASE WHEN p_changes ? 'unit_price' THEN nullif(trim(p_changes->>'unit_price'), '')::numeric ELSE unit_price END,
      note_from_supplier = CASE WHEN p_changes ? 'note_from_supplier' THEN nullif(trim(p_changes->>'note_from_supplier'), '') ELSE note_from_supplier END
    WHERE id = p_item_id AND availability_request_id = ar.id AND is_active;
    IF NOT FOUND THEN RAISE EXCEPTION 'Line not found'; END IF;
    UPDATE public.availability_requests SET status = 'processing' WHERE id = ar.id;
  END IF;
  RETURN ar.id;
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
  UPDATE public.availability_requests SET note_from_supplier = nullif(btrim(p_note), '') WHERE id = p_request_id;
  RETURN p_request_id;
END $function$;

CREATE OR REPLACE FUNCTION public.update_partner_order(p_order_id bigint, p_supplier_id bigint, p_patch jsonb)
 RETURNS bigint
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE current_order public.orders; next_status text; next_method text; next_date date; date_text text; next_note text;
BEGIN
  IF jsonb_typeof(p_patch) IS DISTINCT FROM 'object' OR p_patch = '{}'::jsonb THEN
    RAISE EXCEPTION 'Order update is required'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_object_keys(p_patch) key
    WHERE key NOT IN ('status', 'fulfillment_method', 'fulfillment_date', 'note_from_supplier')) THEN
    RAISE EXCEPTION 'Unsupported order update'; END IF;
  -- Match order creation/closure lock order, including concurrent job archival.
  PERFORM 1 FROM public.job_requests j WHERE j.id IN (
    SELECT ji.job_request_id FROM public.order_item_job_request_items a
      JOIN public.job_request_items ji ON ji.id = a.job_request_item_id
      JOIN public.order_items oi ON oi.id = a.order_item_id
      JOIN public.orders o ON o.id = oi.order_id
      WHERE o.id = p_order_id AND o.supplier_id = p_supplier_id AND oi.is_active
  ) ORDER BY j.id FOR UPDATE;
  SELECT o.* INTO current_order FROM public.orders o JOIN public.suppliers s ON s.id = o.supplier_id
    WHERE o.id = p_order_id AND o.supplier_id = p_supplier_id AND o.is_active AND s.is_active FOR UPDATE OF o;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order is unavailable'; END IF;
  IF current_order.status NOT IN ('new', 'processing', 'order_ready') THEN
    RAISE EXCEPTION 'Closed orders cannot be changed'; END IF;
  IF EXISTS (SELECT 1 FROM public.order_item_job_request_items a JOIN public.order_items oi ON oi.id = a.order_item_id
      WHERE oi.order_id = p_order_id AND oi.is_active)
    AND NOT EXISTS (SELECT 1 FROM public.order_item_job_request_items a
      JOIN public.order_items oi ON oi.id = a.order_item_id
      JOIN public.job_request_items ji ON ji.id = a.job_request_item_id
      JOIN public.job_requests j ON j.id = ji.job_request_id
      WHERE oi.order_id = p_order_id AND oi.is_active AND j.is_active
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
  next_method := CASE WHEN p_patch ? 'fulfillment_method' THEN p_patch->>'fulfillment_method' ELSE current_order.fulfillment_method END;
  IF next_method IS NOT NULL AND next_method NOT IN ('pickup', 'delivery') THEN
    RAISE EXCEPTION 'Choose pickup or delivery'; END IF;
  next_date := current_order.fulfillment_date;
  IF p_patch ? 'fulfillment_date' THEN
    date_text := p_patch->>'fulfillment_date';
    IF date_text IS NOT NULL AND date_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN
      RAISE EXCEPTION 'Fulfillment date must be a valid date (YYYY-MM-DD)'; END IF;
    next_date := date_text::date;
    IF next_date IS NOT NULL AND to_char(next_date, 'YYYY-MM-DD') <> date_text THEN
      RAISE EXCEPTION 'Fulfillment date must be a valid date (YYYY-MM-DD)'; END IF;
  END IF;
  IF next_status IN ('processing', 'order_ready') AND next_date IS NULL THEN
    RAISE EXCEPTION 'Choose a fulfillment date before confirming the order'; END IF;
  next_note := current_order.note_from_supplier;
  IF p_patch ? 'note_from_supplier' THEN
    IF jsonb_typeof(p_patch->'note_from_supplier') NOT IN ('string', 'null') THEN
      RAISE EXCEPTION 'Supplier note must be text'; END IF;
    IF length(p_patch->>'note_from_supplier') > 10000 THEN
      RAISE EXCEPTION 'Supplier note must be 10000 characters or fewer'; END IF;
    next_note := nullif(btrim(p_patch->>'note_from_supplier'), '');
  END IF;
  UPDATE public.orders SET status = next_status, fulfillment_method = next_method, fulfillment_date = next_date,
    note_from_supplier = next_note,
    confirmation_date = CASE WHEN current_order.status = 'new' AND next_status = 'processing'
      THEN coalesce(current_order.confirmation_date, CURRENT_DATE) ELSE confirmation_date END
    WHERE id = p_order_id;
  RETURN p_order_id;
END $function$;

DROP FUNCTION public.create_direct_order(bigint,jsonb,text,date,text,boolean) RESTRICT;

CREATE OR REPLACE FUNCTION public.create_direct_order(p_supplier_id bigint, p_items jsonb, p_fulfillment_method text DEFAULT NULL::text, p_fulfillment_date date DEFAULT NULL::date, p_note_for_supplier text DEFAULT NULL::text, p_customer_confirmed boolean DEFAULT false, p_note_from_customer text DEFAULT NULL::text, p_note_for_customer text DEFAULT NULL::text)
 RETURNS bigint
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE line jsonb; job public.job_requests; demand_item public.job_request_items;
  order_id bigint; line_id bigint; requested numeric; already_ordered numeric;
BEGIN
  IF p_customer_confirmed IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Explicit customer confirmation is required';
  END IF;
  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Order items are required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.suppliers WHERE id = p_supplier_id AND is_active) THEN
    RAISE EXCEPTION 'Active supplier required';
  END IF;
  IF p_fulfillment_method IS NOT NULL AND p_fulfillment_method NOT IN ('pickup', 'delivery') THEN
    RAISE EXCEPTION 'Choose pickup or delivery';
  END IF;

  -- Take job locks before line locks, matching the existing order lifecycle.
  FOR job IN SELECT j.* FROM public.job_requests j WHERE j.id IN (
    SELECT ji.job_request_id FROM public.job_request_items ji WHERE ji.id IN (
      SELECT (input_line.line->>'job_request_item_id')::bigint
      FROM jsonb_array_elements(p_items) AS input_line(line)
    )) ORDER BY j.id FOR UPDATE LOOP
    IF NOT job.is_active OR job.status IN ('closed_won', 'closed_lost', 'archived') THEN
      RAISE EXCEPTION 'This job request is closed';
    END IF;
  END LOOP;

  INSERT INTO public.orders(supplier_id, fulfillment_method, fulfillment_date, note_for_supplier, note_from_customer, note_for_customer)
    VALUES (p_supplier_id, p_fulfillment_method, p_fulfillment_date, p_note_for_supplier, p_note_from_customer, p_note_for_customer)
    RETURNING id INTO order_id;
  FOR line IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    requested := (line->>'quantity')::numeric;
    IF requested IS NULL OR requested <= 0 OR requested >= 'Infinity'::numeric THEN
      RAISE EXCEPTION 'Positive finite quantities are required';
    END IF;
    SELECT * INTO demand_item FROM public.job_request_items
      WHERE id = (line->>'job_request_item_id')::bigint AND is_active FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Active quoted line not found'; END IF;
    -- Direct and availability-backed orders both consume the same customer demand.
    SELECT coalesce(sum(link.quantity), 0) INTO already_ordered
      FROM public.order_item_job_request_items link
      JOIN public.order_items item ON item.id = link.order_item_id
      JOIN public.orders existing_order ON existing_order.id = item.order_id
      WHERE link.job_request_item_id = demand_item.id AND item.is_active
        AND existing_order.is_active AND existing_order.status <> 'closed_lost';
    IF demand_item.demanded_quantity IS NOT NULL AND requested + already_ordered > demand_item.demanded_quantity THEN
      RAISE EXCEPTION 'Order exceeds remaining customer demand';
    END IF;
    INSERT INTO public.order_items(order_id, availability_request_item_id, name, size, quantity, unit_price, status, note_for_customer)
      VALUES (order_id, NULL, demand_item.name, demand_item.size, requested, demand_item.unit_price,
        coalesce(demand_item.status, 'pending'), demand_item.note_for_customer)
      RETURNING id INTO line_id;
    INSERT INTO public.order_item_job_request_items(order_item_id, job_request_item_id, quantity)
      VALUES (line_id, demand_item.id, requested);
    UPDATE public.job_requests SET status = 'committed'
      WHERE id = demand_item.job_request_id AND status IN ('quoted', 'availability');
  END LOOP;
  RETURN order_id;
END $function$;
REVOKE ALL ON FUNCTION public.create_direct_order(bigint,jsonb,text,date,text,boolean,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_direct_order(bigint,jsonb,text,date,text,boolean,text,text) TO service_role;

DROP FUNCTION public.create_order(bigint,jsonb,text,date,text,boolean) RESTRICT;

CREATE OR REPLACE FUNCTION public.create_order(p_supplier_id bigint, p_items jsonb, p_fulfillment_method text DEFAULT NULL::text, p_fulfillment_date date DEFAULT NULL::date, p_note_for_supplier text DEFAULT NULL::text, p_customer_confirmed boolean DEFAULT false, p_note_from_customer text DEFAULT NULL::text, p_note_for_customer text DEFAULT NULL::text)
 RETURNS bigint
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE line jsonb; allocation jsonb; source public.availability_request_items; ar public.availability_requests;
  job public.job_requests; demand_item public.job_request_items; order_id bigint; line_id bigint;
  demand numeric; allocated numeric; allocation_limit numeric; already_ordered numeric;
BEGIN
  IF p_customer_confirmed IS DISTINCT FROM true THEN RAISE EXCEPTION 'Explicit customer confirmation is required'; END IF;
  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'Order items are required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.suppliers WHERE id = p_supplier_id AND is_active) THEN RAISE EXCEPTION 'Active supplier required'; END IF;
  FOR job IN SELECT j.* FROM public.job_requests j WHERE j.id IN (
    SELECT ji.job_request_id FROM public.job_request_items ji WHERE ji.id IN (
      SELECT (a->>'job_request_item_id')::bigint FROM jsonb_array_elements(p_items) l,
        LATERAL jsonb_array_elements(l->'allocations') a
    )) ORDER BY j.id FOR UPDATE LOOP
    IF NOT job.is_active OR job.status IN ('closed_won', 'closed_lost', 'archived') THEN RAISE EXCEPTION 'This job request is closed'; END IF;
  END LOOP;
  -- Serialize repeated/subdivided orders on the source request, then its lines.
  PERFORM 1 FROM public.availability_requests a WHERE a.id IN (
    SELECT ai.availability_request_id FROM public.availability_request_items ai WHERE ai.id IN (
      SELECT (l->>'availability_request_item_id')::bigint FROM jsonb_array_elements(p_items) l
    )) ORDER BY a.id FOR UPDATE;
  INSERT INTO public.orders(supplier_id, fulfillment_method, fulfillment_date, note_for_supplier, note_from_customer, note_for_customer)
    VALUES (p_supplier_id, p_fulfillment_method, p_fulfillment_date, p_note_for_supplier, p_note_from_customer, p_note_for_customer) RETURNING id INTO order_id;
  FOR line IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    IF jsonb_typeof(line->'allocations') IS DISTINCT FROM 'array' OR jsonb_array_length(line->'allocations') = 0 THEN
      RAISE EXCEPTION 'Order allocations are required'; END IF;
    SELECT * INTO source FROM public.availability_request_items WHERE id = (line->>'availability_request_item_id')::bigint AND is_active FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Availability line not found'; END IF;
    SELECT * INTO ar FROM public.availability_requests WHERE id = source.availability_request_id;
    IF ar.supplier_id <> p_supplier_id OR NOT ar.is_active OR ar.status = 'closed' THEN RAISE EXCEPTION 'Availability request is closed or belongs to another supplier'; END IF;
    IF source.status IS NULL OR source.status = 'unavailable' THEN RAISE EXCEPTION 'Supplier must answer availability before ordering'; END IF;
    SELECT sum((a->>'quantity')::numeric) INTO demand FROM jsonb_array_elements(line->'allocations') a;
    IF demand IS NULL OR demand <= 0 OR demand >= 'Infinity'::numeric THEN RAISE EXCEPTION 'Positive finite quantities are required'; END IF;
    SELECT coalesce(sum(oi.quantity), 0) INTO already_ordered FROM public.order_items oi JOIN public.orders o ON o.id = oi.order_id
      WHERE oi.availability_request_item_id = source.id AND oi.is_active AND o.is_active AND o.status <> 'closed_lost';
    IF source.demanded_quantity IS NOT NULL AND demand + already_ordered > source.demanded_quantity THEN RAISE EXCEPTION 'Order exceeds remaining requested quantity'; END IF;
    IF source.available_quantity IS NOT NULL AND source.status <> 'can_order' AND demand + already_ordered > source.available_quantity THEN
      RAISE EXCEPTION 'Order exceeds supplier available quantity'; END IF;
    INSERT INTO public.order_items(order_id, availability_request_item_id, name, size, quantity, unit_price, status, note_from_supplier, note_for_supplier, note_for_customer)
      VALUES (order_id, source.id, source.name, source.size, demand, source.unit_price,
        CASE WHEN source.status = 'can_order' THEN 'need_to_order' ELSE coalesce(source.status, 'pending') END, source.note_from_supplier, source.note_for_supplier,
        (SELECT string_agg(DISTINCT ji.note_for_customer, E'\n\n' ORDER BY ji.note_for_customer)
          FROM public.job_request_items ji WHERE ji.id IN
            (SELECT (a->>'job_request_item_id')::bigint FROM jsonb_array_elements(line->'allocations') a)))
      RETURNING id INTO line_id;
    FOR allocation IN SELECT * FROM jsonb_array_elements(line->'allocations') LOOP
      allocated := (allocation->>'quantity')::numeric;
      IF allocated IS NULL OR allocated <= 0 OR allocated >= 'Infinity'::numeric THEN RAISE EXCEPTION 'Positive finite allocations are required'; END IF;
      SELECT * INTO demand_item FROM public.job_request_items WHERE id = (allocation->>'job_request_item_id')::bigint AND is_active;
      IF NOT FOUND THEN RAISE EXCEPTION 'Active job line not found'; END IF;
      SELECT quantity INTO allocation_limit FROM public.availability_request_item_jobs
        WHERE availability_request_item_id = source.id AND job_request_item_id = demand_item.id;
      IF NOT FOUND THEN RAISE EXCEPTION 'Job line is not allocated to this availability line'; END IF;
      SELECT coalesce(sum(a.quantity), 0) INTO already_ordered FROM public.order_item_job_request_items a
        JOIN public.order_items oi ON oi.id = a.order_item_id JOIN public.orders o ON o.id = oi.order_id
        WHERE a.job_request_item_id = demand_item.id AND oi.availability_request_item_id = source.id
          AND oi.is_active AND o.is_active AND o.status <> 'closed_lost';
      IF allocation_limit IS NOT NULL AND allocated + already_ordered > allocation_limit THEN RAISE EXCEPTION 'Order exceeds remaining availability allocation'; END IF;
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
REVOKE ALL ON FUNCTION public.create_order(bigint,jsonb,text,date,text,boolean,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_order(bigint,jsonb,text,date,text,boolean,text,text) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
