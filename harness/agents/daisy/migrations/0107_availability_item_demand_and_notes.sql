-- Distinguish requested demand, LPS instructions and supplier-provided detail.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE public.availability_request_items RENAME COLUMN quantity TO demanded_quantity;
ALTER TABLE public.availability_request_items RENAME COLUMN notes TO supplier_notes;
ALTER TABLE public.availability_request_items RENAME CONSTRAINT availability_request_items_quantity_check
  TO availability_request_items_demanded_quantity_check;
COMMENT ON COLUMN public.availability_request_items.demanded_quantity IS
  'Total quantity LPS requests from the supplier for this line. Per-job shares remain availability_request_item_jobs.quantity; supplier stock is available_quantity.';
COMMENT ON COLUMN public.availability_request_items.lps_notes IS
  'Additional information LPS/Chris shares with the supplier for this line, including relevant customer details, variety, special requests and other instructions. Displayed below the plant name.';
COMMENT ON COLUMN public.availability_request_items.supplier_notes IS
  'Additional details supplied by the supplier about this availability line for LPS/Chris or the customer. Supplier-authored response, displayed in the Supplier notes column.';

CREATE OR REPLACE FUNCTION public.create_availability_request(p_supplier_id bigint, p_items jsonb,
  p_share_customer_details boolean DEFAULT false, p_public_token uuid DEFAULT NULL)
RETURNS bigint LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE line jsonb; allocation jsonb; job public.job_requests; item public.job_request_items;
  request_id bigint; line_id bigint; primary_job_id bigint; demand numeric; allocation_total numeric; unknown_quantity boolean;
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
    primary_job_id := coalesce(primary_job_id, job.id);
  END LOOP;
  IF primary_job_id IS NULL THEN RAISE EXCEPTION 'Job allocations are required'; END IF;
  INSERT INTO public.availability_requests(job_request_id, supplier_id, share_customer_details, public_token)
    VALUES (primary_job_id, p_supplier_id, p_share_customer_details, p_public_token) RETURNING id INTO request_id;
  FOR line IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    IF jsonb_typeof(line->'allocations') IS DISTINCT FROM 'array' OR jsonb_array_length(line->'allocations') = 0
      OR nullif(trim(line->>'name'), '') IS NULL THEN RAISE EXCEPTION 'Named lines with job allocations are required'; END IF;
    demand := (line->>'demanded_quantity')::numeric;
    IF demand <= 0 OR demand >= 'Infinity'::numeric THEN RAISE EXCEPTION 'Known quantities must be positive and finite'; END IF;
    INSERT INTO public.availability_request_items(availability_request_id, name, size, demanded_quantity, unit_price, mapped_inventory_id, lps_notes)
      VALUES (request_id, line->>'name', line->>'size', demand, (line->>'unit_price')::numeric,
        (line->>'mapped_inventory_id')::uuid, line->>'lps_notes') RETURNING id INTO line_id;
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
END $$;

CREATE OR REPLACE FUNCTION public.sync_availability_quantity_allocation() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE allocation_count integer; known_count integer; allocated_quantity numeric;
BEGIN
  IF NEW.demanded_quantity IS NOT DISTINCT FROM OLD.demanded_quantity THEN RETURN NEW; END IF;
  SELECT count(*), count(quantity), sum(quantity) INTO allocation_count, known_count, allocated_quantity
    FROM public.availability_request_item_jobs WHERE availability_request_item_id = NEW.id;
  IF allocation_count > 1 AND NOT (
    (known_count = allocation_count AND NEW.demanded_quantity IS NOT NULL AND allocated_quantity = NEW.demanded_quantity)
    OR (known_count = 0 AND NEW.demanded_quantity IS NULL)
  ) THEN
    RAISE EXCEPTION 'Combined request quantities require explicit allocation edits; this field cannot redistribute demand across jobs';
  ELSIF allocation_count = 1 THEN
    UPDATE public.availability_request_item_jobs SET quantity = NEW.demanded_quantity WHERE availability_request_item_id = NEW.id;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.process_availability_answer() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  -- An inserted catalogue price is still an unanswered ask. Saving an answer
  -- (from a portal, public link or an agent entering a supplier reply) starts work.
  IF ROW(NEW.status, NEW.available_quantity, NEW.unit_price, NEW.supplier_notes)
    IS DISTINCT FROM ROW(OLD.status, OLD.available_quantity, OLD.unit_price, OLD.supplier_notes) THEN
    UPDATE public.availability_requests SET status = 'processing'
    WHERE id = NEW.availability_request_id AND is_active AND status NOT IN ('closed', 'hidden');
  END IF;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.answer_availability_request(p_request_id bigint, p_supplier_id bigint,
  p_item_id bigint DEFAULT NULL, p_changes jsonb DEFAULT NULL, p_submit boolean DEFAULT false)
RETURNS bigint LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE ar public.availability_requests; k text;
BEGIN
  SELECT * INTO ar FROM public.availability_requests
    WHERE id = p_request_id AND supplier_id = p_supplier_id AND is_active AND status NOT IN ('closed', 'hidden') FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM public.suppliers WHERE id = ar.supplier_id AND is_active) THEN
    RAISE EXCEPTION 'This request is closed or hidden or unavailable';
  END IF;
  IF p_submit THEN
    UPDATE public.availability_requests SET status = 'submitted', submitted_at = now() WHERE id = ar.id;
  ELSE
    IF p_changes IS NULL OR jsonb_typeof(p_changes) <> 'object' OR p_changes = '{}'::jsonb THEN
      RAISE EXCEPTION 'Changes are required';
    END IF;
    FOR k IN SELECT jsonb_object_keys(p_changes) LOOP
      IF k NOT IN ('status', 'available_quantity', 'unit_price', 'supplier_notes') OR jsonb_typeof(p_changes->k) <> 'string' THEN
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
      supplier_notes = CASE WHEN p_changes ? 'supplier_notes' THEN nullif(trim(p_changes->>'supplier_notes'), '') ELSE supplier_notes END
    WHERE id = p_item_id AND availability_request_id = ar.id AND is_active;
    IF NOT FOUND THEN RAISE EXCEPTION 'Line not found'; END IF;
    UPDATE public.availability_requests SET status = 'processing' WHERE id = ar.id;
  END IF;
  RETURN ar.id;
END $$;

CREATE OR REPLACE FUNCTION public.create_order(p_supplier_id bigint, p_items jsonb,
  p_fulfillment_method text DEFAULT NULL, p_fulfillment_date date DEFAULT NULL,
  p_notes text DEFAULT NULL, p_customer_confirmed boolean DEFAULT false)
RETURNS bigint LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
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
  INSERT INTO public.orders(supplier_id, fulfillment_method, fulfillment_date, notes)
    VALUES (p_supplier_id, p_fulfillment_method, p_fulfillment_date, p_notes) RETURNING id INTO order_id;
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
    INSERT INTO public.order_items(order_id, availability_request_item_id, name, size, quantity, unit_price, status, notes)
      VALUES (order_id, source.id, source.name, source.size, demand, source.unit_price,
        CASE WHEN source.status = 'can_order' THEN 'need_to_order' ELSE coalesce(source.status, 'pending') END, source.supplier_notes)
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
      IF demand_item.quantity IS NOT NULL AND allocated + already_ordered > demand_item.quantity THEN RAISE EXCEPTION 'Order exceeds remaining customer demand'; END IF;
      INSERT INTO public.order_item_job_request_items VALUES (line_id, demand_item.id, allocated);
      UPDATE public.job_requests SET status = 'committed' WHERE id = demand_item.job_request_id AND status IN ('quoted', 'availability');
    END LOOP;
  END LOOP;
  RETURN order_id;
END $$;

NOTIFY pgrst, 'reload schema';
COMMIT;
